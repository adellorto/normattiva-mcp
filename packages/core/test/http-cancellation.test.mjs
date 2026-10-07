import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('HTTP caller cancellation aborts upstream and releases the shared lane', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/release-transport-limits.mjs', import.meta.url)), 'http', 'cancellation',
  ], { timeout: 10_000 });
  const report = JSON.parse(stdout);
  assert.equal(report.gate, 'passed');
  assert.equal(report.healthy.outcome, 'found');
});

test('an aborted HTTP Request stops active upstream work without a protocol notification', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'request-abort',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('protocol cancellation removes queued HTTP work without making an upstream attempt', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'queued',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('HTTP Request abort removes queued work and preserves the active caller', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'queued-abort',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('HTTP cancellation isolates clients with identical request ids and ignores stale or malformed notifications', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'isolation',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('HTTP rejects a batch before one cancellation could affect unrelated requests in that POST', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'batch',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('HTTP accepts portable namespaces but a notification on another instance cannot cancel a local call', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'other-instance',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('HTTP abort before dispatch makes no upstream request and leaves the lane usable', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'pre-abort',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});

test('a request using the cancellation method gets an RPC error without cancelling another HTTP call', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./fixtures/http-cancellation.mjs', import.meta.url)), 'request-shaped-cancellation',
  ], { timeout: 10_000 });
  assert.match(stdout, /HTTP cancellation contracts passed/);
});
