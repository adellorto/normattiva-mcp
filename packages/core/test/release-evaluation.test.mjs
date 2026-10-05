import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
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
  return { output, attempts: join(scratch, 'attempts'),
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
