import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';

const SOURCE_LIMIT = 24 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_PACE_MS = 1_100;
const TRANSIENT_HTTP = new Set([429, 502, 503, 504]);
const TRANSIENT_ERRORS = new Set([
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'TimeoutError',
]);

function retryAfter(response) {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function failureCode(error) {
  return error.cause?.code ?? error.code ?? error.name ?? error.message;
}

export async function captureDetails({ root, directoryPrefix, plan, manifest = {},
  priorAttempts = [], policy, dependencies = {} }) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const wait = dependencies.wait ?? setTimeout;
  const bounded = policy !== undefined;
  const settings = {
    maxAttemptsPerCoordinate: policy?.maxAttemptsPerCoordinate ?? 1,
    maxNewRequests: policy?.maxNewRequests ?? plan.length,
    transientCircuitBreaker: policy?.transientCircuitBreaker ?? 1,
    retryBackoffMs: policy?.retryBackoffMs ?? [],
    coordinatePaceMs: policy?.coordinatePaceMs ?? REQUEST_PACE_MS,
  };
  assert.ok(settings.maxAttemptsPerCoordinate >= 1);
  assert.ok(settings.maxNewRequests >= 0);
  const directory = new URL(`${directoryPrefix}-${new Date().toISOString().replaceAll(':', '-')}/`, root);
  mkdirSync(directory, { recursive: true });
  const captures = [];
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const report = { ...manifest, started_at: startedAt, updated_at: startedAt, elapsed_ms: 0,
    policy: { max_attempts_per_coordinate: settings.maxAttemptsPerCoordinate,
      max_new_requests: settings.maxNewRequests,
      transient_circuit_breaker: settings.transientCircuitBreaker,
      circuit_scope: 'new requests in this resumed run',
      retry_backoff_ms: settings.retryBackoffMs,
      coordinate_pace_ms: settings.coordinatePaceMs,
      request_timeout_ms: REQUEST_TIMEOUT_MS, decoded_source_limit_bytes: SOURCE_LIMIT,
      traffic: 'strictly sequential' },
    prior_attempts: priorAttempts, captures, coordinates: [], outcome: 'in_progress' };
  const save = () => {
    report.updated_at = new Date().toISOString();
    report.elapsed_ms = performance.now() - started;
    writeFileSync(new URL('manifest.json', directory), JSON.stringify(report, null, 2) + '\n');
  };
  save();
  let consecutiveTransient = 0;
  let stop = false;
  for (const [coordinateIndex, entry] of plan.entries()) {
    if (stop || captures.length >= settings.maxNewRequests) break;
    if (coordinateIndex > 0) await wait(settings.coordinatePaceMs);
    const prior = priorAttempts.find(row => row.name === entry.name);
    let totalAttempts = prior?.attempts ?? 0;
    let outcome = prior?.lastOutcome === 'success' ? 'succeeded' : 'pending';
    let retryDelay = prior?.lastOutcome === 'transient_failure'
      ? settings.retryBackoffMs[Math.max(0, totalAttempts - 1)] ?? 0 : 0;
    while (outcome === 'pending' && totalAttempts < settings.maxAttemptsPerCoordinate
      && captures.length < settings.maxNewRequests) {
      if (retryDelay > 0) await wait(retryDelay);
      const attempt = totalAttempts + 1;
      const record = { ...entry, attempt, state: 'in_flight', captured_at: new Date().toISOString() };
      captures.push(record);
      save();
      const at = performance.now();
      let response;
      try {
        response = await fetchImpl(entry.url, { method: 'POST', headers: {
          'Content-Type': 'application/json', Origin: 'https://dati.normattiva.it',
          'User-Agent': 'normattiva-mcp/0.2.0 research',
        }, body: JSON.stringify(entry.request), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        record.status = response.status;
        record.retry_after_ms = retryAfter(response);
        const chunks = []; record.decoded_bytes = 0;
        for await (const chunk of response.body) {
          record.decoded_bytes += chunk.length;
          assert.ok(record.decoded_bytes <= SOURCE_LIMIT, 'Decoded source limit exceeded');
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        record.file = `${entry.name}-attempt-${attempt}.json.gz`;
        record.sha256 = createHash('sha256').update(body).digest('hex');
        writeFileSync(new URL(record.file, directory), gzipSync(body));
        if (TRANSIENT_HTTP.has(response.status)) {
          record.failure = `HTTP_${response.status}`;
          record.classification = 'transient';
        } else if (response.status !== 200) {
          record.failure = `HTTP_${response.status}`;
          record.classification = 'hard';
        } else {
          const envelope = JSON.parse(body.toString());
          assert.equal(envelope.success, true);
          assert.ok(envelope.data?.atto?.articoloHtml);
          record.classification = 'success';
        }
      } catch (error) {
        record.failure = failureCode(error);
        record.classification = TRANSIENT_ERRORS.has(record.failure) ? 'transient' : 'hard';
      } finally {
        record.elapsed_ms = performance.now() - at;
        record.state = 'complete';
        save();
      }
      totalAttempts = attempt;
      if (record.classification === 'success') {
        outcome = 'succeeded';
        consecutiveTransient = 0;
      } else if (record.classification === 'hard') {
        outcome = 'hard_failure';
        consecutiveTransient = 0;
      } else {
        consecutiveTransient += 1;
        if (consecutiveTransient >= settings.transientCircuitBreaker) {
          outcome = 'circuit_open';
          stop = true;
        } else if (totalAttempts >= settings.maxAttemptsPerCoordinate) {
          outcome = 'transient_attempts_exhausted';
        } else {
          retryDelay = Math.max(record.retry_after_ms ?? 0,
            settings.retryBackoffMs[Math.max(0, totalAttempts - 1)] ?? 0);
        }
      }
      if (!bounded && record.failure) stop = true;
    }
    report.coordinates.push({ name: entry.name, total_attempts: totalAttempts, outcome });
  }
  report.outcome = report.coordinates.length === plan.length
    && report.coordinates.every(row => row.outcome === 'succeeded') ? 'complete'
    : stop && consecutiveTransient >= settings.transientCircuitBreaker ? 'circuit_open'
    : 'not_currently_verifiable_under_bounded_policy';
  save();
  if (report.outcome !== 'complete') process.exitCode = 1;
  console.log(JSON.stringify({ directory: directory.pathname, attempted: captures.length,
    completed: captures.filter(row => row.classification === 'success').length,
    outcome: report.outcome }));
  return { directory, manifest: report };
}
