import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkContracts } from './fixtures/public-contracts.mjs';
import { fileURLToPath } from 'node:url';
import { signingKey } from './fixtures/traversal-upstream.mjs';

test('the built stdio server integrates discovery, reading, resources and prompts with configured trust', async () => {
  const client = new Client({ name: 'stdio-contract', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [
    '--import', fileURLToPath(new URL('./fixtures/public-upstream.mjs', import.meta.url)),
    fileURLToPath(new URL('../../stdio-server/dist/index.js', import.meta.url)),
  ], env: { ...process.env, NORMATTIVA_REFERENCE_KEY: signingKey.toString('hex') } }));
  try { await checkContracts(client); } finally { await client.close(); }
});

test('the production HTTP handler exposes the same focused interface on stateless requests', async () => {
  // Isolate the production handler and its upstream fixture in a fresh process.
  const { stdout } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('./fixtures/public-http.mjs', import.meta.url))], { timeout: 30_000 });
  assert.match(stdout, /HTTP public contracts passed/);
});

test('the production HTTP handler still refuses to create local trust when configuration is absent', async () => {
  const { stdout } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('./fixtures/http-without-reference-trust.mjs', import.meta.url))], {
      timeout: 30_000,
      env: Object.fromEntries(Object.entries(process.env)
        .filter(([name]) => name !== 'NORMATTIVA_REFERENCE_KEY')),
    });
  assert.match(stdout, /HTTP explicit trust requirement passed/);
});

test('the migration smoke workflow crosses the built server using synthetic controls', async () => {
  const fixture = new URL('./fixtures/public-upstream.mjs', import.meta.url).href;
  const { stdout } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('../../../tests/smoke.mjs', import.meta.url))], {
      timeout: 30_000,
      env: { ...process.env, NORMATTIVA_REFERENCE_KEY: signingKey.toString('hex'),
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${fixture}` },
    });
  assert.match(stdout, /Smoke passed/);
});
