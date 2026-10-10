import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const deployment = new URL(process.argv[2]);
const endpoint = new URL('/api/mcp', deployment);
const abortDelayMs = Number(process.argv[4] ?? 255);
assert.ok(Number.isInteger(abortDelayMs) && abortDelayMs > 0 && abortDelayMs <= 5_000);
const cookie = (await readFile(process.argv[3], 'utf8')).split('\n')
  .filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
  .map(line => line.split('\t'))
  .filter(fields => fields.length >= 7)
  .map(fields => `${fields[5]}=${fields[6]}`)
  .join('; ');
assert.ok(cookie, 'Vercel Authentication cookie jar is empty');

const authenticatedFetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Cookie', cookie);
  return fetch(input, { ...init, headers });
};
const client = new Client({ name: 'release-vercel-cancellation', version: '1' });
const transport = new StreamableHTTPClientTransport(endpoint, { fetch: authenticatedFetch });
const sha256 = value => createHash('sha256').update(value).digest('hex');
const report = {
  recorded_at: new Date().toISOString(),
  deployment: deployment.hostname,
  probe_id: `issue33-${randomUUID()}`,
  authentication: 'Vercel bypass cookie established before application requests',
};

try {
  await client.connect(transport);
  assert.equal(client.getServerVersion().version, '0.2.0');
  const discovery = (await client.callTool({
    name: 'find_acts',
    arguments: { request: 'decreto legislativo 267/2000 articolo 13' },
  })).structuredContent;
  assert.equal(discovery.match, 'identified');
  const actLocator = discovery.traversal.items[0].act_locator;
  const initial = (await client.callTool({
    name: 'read_act',
    arguments: { act_locator: actLocator, snapshot_date: '2026-10-02', max_chars: 4 },
  })).structuredContent;
  assert.equal(initial.traversal.progress, 'more');
  const cursor = initial.traversal.cursor;
  assert.ok(cursor);

  const controller = new AbortController();
  const abortStarted = performance.now();
  const pending = authenticatedFetch(new URL(`/api/mcp?probe=${report.probe_id}`, deployment), {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Protocol-Version': '2025-11-25',
      'Mcp-Session-Id': transport.sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: report.probe_id, method: 'tools/call',
      params: { name: 'read_act', arguments: {
        act_locator: actLocator, snapshot_date: '2026-10-02', max_chars: 64_000,
      } },
    }),
  }).then(
    response => ({ kind: 'response', status: response.status }),
    error => ({ kind: 'error', name: error.name, message: error.message }),
  );
  setTimeout(() => controller.abort(), abortDelayMs);
  const aborted = await pending;
  const abortElapsedMs = Math.round(performance.now() - abortStarted);
  assert.equal(aborted.kind, 'error');
  assert.equal(aborted.name, 'AbortError');

  const pingStarted = performance.now();
  await client.ping(undefined, { timeout: 5_000 });
  const pingElapsedMs = Math.round(performance.now() - pingStarted);
  const continuation = (await client.callTool({
    name: 'read_act', arguments: { cursor, max_chars: 100 },
  }, undefined, { timeout: 60_000 })).structuredContent;
  assert.ok(['more', 'complete'].includes(continuation.traversal.progress));

  Object.assign(report, {
    server_version: client.getServerVersion().version,
    act_locator_sha256: sha256(actLocator),
    cursor_sha256: sha256(cursor),
    client_abort: aborted,
    requested_abort_delay_ms: abortDelayMs,
    abort_elapsed_ms: abortElapsedMs,
    healthy_ping_elapsed_ms: pingElapsedMs,
    continuation_progress: continuation.traversal.progress,
    supplied_cursor_unchanged: true,
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.close();
}
