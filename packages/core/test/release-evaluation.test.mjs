import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

async function fixture(mode, priorAmount = .01) {
  const scratch = await mkdtemp(join(tmpdir(), 'normattiva-release-budget-'));
  const input = join(scratch, 'input.json'), prior = join(scratch, 'prior.json'), output = join(scratch, 'report.json');
  await writeFile(input, gunzipSync(await readFile(new URL('../../../docs/implementation/release-model-input.json.gz', import.meta.url))));
  await writeFile(prior, JSON.stringify({ runs: [], recorded_cost_usd: 0, accounted_upper_bound_usd: priorAmount }));
  return { input, output, attempts: join(scratch, 'attempts'),
    args: ['--import', fileURLToPath(new URL('./fixtures/release-provider.mjs', import.meta.url)),
      fileURLToPath(new URL('./fixtures/release-openrouter.mjs', import.meta.url)), input, output, '--prior-report', prior],
    env: { ...process.env, OPENROUTER_API_KEY: 'fixture-eval-key', OPENROUTER_MODELS: 'fixture-model',
      OPENROUTER_MAX_COST_USD: '1', OPENROUTER_CONCURRENCY: '1',
      RELEASE_PROVIDER_MODE: mode, RELEASE_ATTEMPT_FILE: join(scratch, 'attempts') } };
}
test('prior unknown spending can block the whole plan before any inference dispatch', async () => {
  const f = await fixture('error', .99);
  await assert.rejects(promisify(execFile)(process.execPath, f.args, { env: f.env }),
    error => error.stderr.includes('including prior attempts exceeds spend limit'));
  await assert.rejects(readFile(f.attempts), error => error.code === 'ENOENT');
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.accounted_upper_bound_usd, .99);
  assert.equal(report.runs.length, 0);
});
test('unsupported optional parameters are omitted and unknown-cost failures retain spending', async () => {
  const f = await fixture('error');
  await assert.rejects(promisify(execFile)(process.execPath, f.args, { env: f.env }));
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(await readFile(f.attempts, 'utf8'), '1');
  assert.match(report.runs[0].blocked_error, /HTTP 503.*<REDACTED>/);
  assert.equal(JSON.stringify(report).includes('fixture-eval-key'), false);
  assert.ok(report.accounted_upper_bound_usd > .01);
  assert.equal(report.recorded_cost_usd, 0);
});
test('an in-flight request has a durable cost reservation before the provider responds', async () => {
  const f = await fixture('stall');
  const child = spawn(process.execPath, f.args, { env: f.env, stdio: 'ignore' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    const deadline = Date.now() + 5000;
    while (true) {
      if (await readFile(f.attempts, 'utf8').catch(() => '') === '1') break;
      assert.ok(Date.now() < deadline, 'Provider was never reached');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const report = JSON.parse(await readFile(f.output, 'utf8'));
    assert.equal(report.runs.length, 1);
    assert.ok(report.accounted_upper_bound_usd > .01);
    assert.equal(report.runs[0].message, undefined);
  } finally { child.kill('SIGTERM'); await exited; }
});
test('four concurrent requests each reserve cost and produce one readable checkpoint', async () => {
  const f = await fixture('stall');
  f.env.OPENROUTER_CONCURRENCY = '4';
  const child = spawn(process.execPath, f.args, { env: f.env, stdio: 'ignore' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    const deadline = Date.now() + 5000;
    while (await readFile(f.attempts, 'utf8').catch(() => '') !== '4') {
      assert.ok(Date.now() < deadline, 'Concurrent provider requests were never reached');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const report = JSON.parse(await readFile(f.output, 'utf8'));
    assert.equal(report.runs.length, 4);
    assert.ok(Math.abs(report.accounted_upper_bound_usd - .01
      - report.runs.reduce((total, row) => total + row.reserved_cost_usd, 0)) < 1e-9);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(await readFile(f.attempts, 'utf8'), '4');
  } finally { child.kill('SIGTERM'); await exited; }
});

test('clarification of an inverted range is scored separately from semantic constraint loss', async () => {
  const f = await fixture('clarify-invalid');
  f.env.OPENROUTER_CASES = 'edge-reversed-range';
  await promisify(execFile)(process.execPath, f.args, { env: f.env });
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.runs.length, 2);
  assert.ok(report.runs.every(run => run.automated_failures.length === 0));
  assert.ok(report.runs.every(run => run.semantic_review.startsWith('pending')));
});

test('paced evaluation delays the next provider request without adding retries or losing cost reservations', async () => {
  const f = await fixture('clarify-invalid');
  f.env.OPENROUTER_CASES = 'edge-reversed-range';
  f.env.OPENROUTER_PAUSE_MS = '80';
  f.env.RELEASE_TIMING_FILE = f.output + '.timing';
  await promisify(execFile)(process.execPath, f.args, { env: f.env });
  const times = (await readFile(f.env.RELEASE_TIMING_FILE, 'utf8')).trim().split('\n').map(Number);
  assert.equal(times.length, 2);
  assert.ok(times[1] - times[0] >= 75, 'Provider dispatches were not paced');
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.settings.pause_between_requests_per_worker_ms, 80);
  assert.equal(report.runs.length, report.planned_calls);
  assert.equal(report.accounted_upper_bound_usd, .01);
  assert.ok(report.runs.every(row => row.reserved_cost_usd > 0 && row.cost_usd === 0));
});

test('a pinned provider uses verified endpoint prices and disables fallback while retaining actual receipts', async () => {
  const f = await fixture('pinned-provider');
  f.env.OPENROUTER_CASES = 'edge-law-short-year';
  f.env.OPENROUTER_PROVIDER = 'fixture/fp8';
  await promisify(execFile)(process.execPath, f.args, { env: f.env });
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.models[0].selected_endpoint.tag, 'fixture/fp8');
  assert.equal(report.models[0].pricing.prompt, '0.0000002');
  assert.equal(report.models[0].pricing.completion, '0.0000003');
  assert.ok(Math.abs(report.accounted_upper_bound_usd - .0104) < 1e-9);
  assert.ok(report.runs.every(row => row.provider === 'Fixture provider' && row.cost_usd === .0002));
});

test('higher endpoint prices can reject a pinned plan before any paid dispatch', async () => {
  const f = await fixture('pinned-expensive', .9);
  f.env.OPENROUTER_CASES = 'edge-law-short-year';
  f.env.OPENROUTER_PROVIDER = 'fixture/fp8';
  await assert.rejects(promisify(execFile)(process.execPath, f.args, { env: f.env }));
  await assert.rejects(readFile(f.attempts), error => error.code === 'ENOENT');
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.models[0].pricing.prompt, '0.00001');
  assert.ok(report.total_plan_reserve_usd + report.accounted_upper_bound_usd > 1);
  assert.equal(report.runs.length, 0);
});

test('a bounded completion ceiling is recorded in the provider plan', async () => {
  const f = await fixture('error');
  f.env.OPENROUTER_CASES = 'edge-law-short-year';
  f.env.OPENROUTER_MAX_TOKENS = '1520';
  await promisify(execFile)(process.execPath, [...f.args, '--plan'], { env: f.env });
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.settings.max_tokens, 1520);
  assert.equal(report.planned_calls, 2);
  assert.equal(report.runs.length, 0);
});

test('silently repairing an inverted range remains a measured routing failure', async () => {
  const f = await fixture('repair-invalid');
  f.env.OPENROUTER_CASES = 'edge-reversed-range';
  await assert.rejects(promisify(execFile)(process.execPath, f.args, { env: f.env }));
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.ok(report.runs.every(run => run.automated_failures.includes('lost_invalid_constraint')));
});

test('discovery continuation evaluation supplies a reference actually returned in its tool history', async () => {
  const f = await fixture('discovery-continuation');
  f.env.OPENROUTER_CASES = 'edge-cursor';
  await promisify(execFile)(process.execPath, f.args, { env: f.env });
  const report = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(report.runs.length, 2);
  assert.ok(report.runs.every(run => run.automated_failures.length === 0));
  for (const run of report.runs) {
    const history = run.input.find(message => message.role === 'tool');
    assert.equal(run.expected_cursor, JSON.parse(history.content).traversal.cursor);
  }
});

test('incomplete provider reports retain every available call replay without claiming complete coverage', async () => {
  const f = await fixture('error');
  const input = JSON.parse(await readFile(f.input, 'utf8'));
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  await writeFile(f.output, JSON.stringify({ input_sha256: hash(input), schema_sha256: hash(input.schema),
    planned_calls: 4, runs: [
      { requested_model: 'fixture-model', repetition: 1, case: 'index_pending', input: [],
        message: { tool_calls: [{ function: { name: 'continue_acts', arguments: '{"cursor":"invented"}' } }] } },
      { requested_model: 'fixture-model', repetition: 2, case: 'index_pending', input: [], blocked_error: 'Provider unavailable' },
    ] }));
  const { stdout } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('./fixtures/release-final-model-review.mjs', import.meta.url)), f.input, f.output]);
  const review = JSON.parse(stdout);
  assert.equal(review.complete, false);
  assert.deepEqual(review.reports.map(report => [report.planned_calls, report.dispatched_calls, report.complete]), [[4, 2, false]]);
  assert.equal(review.rows.length, 2);
  assert.deepEqual(review.rows[0].calls[0].issues, ['reference_not_returned:cursor']);
  assert.equal(review.rows[0].calls[0].replay.result.error.category, 'invalid_cursor');
  assert.equal(review.rows[1].provider_error, 'Provider unavailable');
});
