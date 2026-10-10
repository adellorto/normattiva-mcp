// Execute the actual local Vercel function output from an isolated copy.
// No deploy, inference or official traffic. SDK/source controls are test drivers.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, access, realpath, lstat, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { signingKey } from './traversal-upstream.mjs';
import { checkContracts } from './public-contracts.mjs';
import './release-upstream.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const source = join(root, '.vercel/output/functions/api/mcp.func');
const scratch = await mkdtemp(join(tmpdir(), 'normattiva-vercel-function-'));
await cp(source, scratch, { recursive: true, dereference: true });
const config = JSON.parse(await readFile(join(scratch, '.vc-config.json'), 'utf8'));
// Local build stores FileFsRef/symlink entries in filePathMap rather than
// materializing them. Recreate only those declared mappings, with every link
// resolving inside the isolated output. Do not fall back to workspace imports.
for (const [destination, sourcePath] of Object.entries(config.filePathMap ?? {})) {
  const sourceRef = resolve(root, sourcePath), target = resolve(scratch, destination);
  assert.ok(sourceRef.startsWith(root) && target.startsWith(scratch + '/'));
  await mkdir(dirname(target), { recursive: true });
  if ((await lstat(sourceRef)).isSymbolicLink()) {
    const sourceReal = await realpath(sourceRef);
    assert.ok(sourceReal.startsWith(root));
    const isolatedReal = resolve(scratch, relative(root, sourceReal));
    assert.ok(isolatedReal.startsWith(scratch + '/'));
    await access(isolatedReal);
    await symlink(relative(dirname(target), isolatedReal), target);
  } else await cp(sourceRef, target, { recursive: true, dereference: true });
}
const worker = join(scratch, 'packages/core/dist/act-parser-worker.js');
await access(worker);
assert.ok((await realpath(worker)).startsWith(scratch + '/'));
assert.equal(config.maxDuration, 60);
assert.equal(config.supportsCancellation, true);
process.env.NORMATTIVA_REFERENCE_KEY = signingKey.toString('hex');
const { POST } = await import(pathToFileURL(join(scratch, config.handler)));
const client = new Client({ name: 'release-vercel-function', version: '1' });
await client.connect(new StreamableHTTPClientTransport(new URL('https://fixture.invalid/api/mcp'), {
  fetch: (url, init) => POST(new Request(url, init)),
}));
try {
  assert.equal(client.getServerVersion().version, '0.2.0');
  await checkContracts(client);
  // Exercise cancellation in the traced function, rather than inferring it
  // from source-handler tests or a client-side rejected promise.
  const found = (await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } })).structuredContent;
  assert.equal(found.match, 'identified');
  const act_locator = found.traversal.items[0].act_locator;
  const boundary = globalThis.fetch, events = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('dettaglio-atto') || JSON.parse(init.body).idArticolo !== 997) return boundary(url, init);
    events.push({ event: 'started', at: Date.now() });
    return new Promise((resolve, reject) => {
      const abort = () => { events.push({ event: 'aborted', at: Date.now() }); reject(init.signal.reason); };
      if (init.signal.aborted) abort();
      else init.signal.addEventListener('abort', abort, { once: true });
    });
  };
  const controller = new AbortController();
  const pending = client.callTool({ name: 'read_article', arguments: {
    act_locator, article_reference: '997', snapshot_date: '2026-10-02',
  } }, undefined, { signal: controller.signal, timeout: 3000 }).then(() => null, error => error);
  const until = async check => {
    const deadline = Date.now() + 750;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(check(), 'built handler must reach and abort the upstream request');
  };
  let cancellationMs;
  try {
    await until(() => events.length > 0);
    const cancelledAt = Date.now();
    controller.abort();
    await until(() => events.some(e => e.event === 'aborted'));
    cancellationMs = events[1].at - cancelledAt;
    const healthy = await client.callTool({ name: 'read_article', arguments: {
      act_locator, article_reference: '13', snapshot_date: '2026-10-02',
    } }, undefined, { timeout: 1500 });
    assert.equal(healthy.structuredContent.outcome, 'found');
    assert.deepEqual(events.map(e => e.event), ['started', 'aborted']);
    assert.ok(await pending, 'caller rejects the explicitly cancelled request');
  } finally { controller.abort(); globalThis.fetch = boundary; }
  console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
    built_handler: config.handler, runtime: config.runtime, max_duration_seconds: config.maxDuration,
    downstream_cancellation_enabled: config.supportsCancellation,
    worker_present: true, declared_file_path_mappings: Object.keys(config.filePathMap ?? {}).length,
    isolated_built_function_contracts: 'passed', package_version: client.getServerVersion().version,
    isolated_built_function_cancellation: 'passed', cancellation_abort_ms: cancellationMs,
    cancellation_events: events,
    scope: 'Dereferenced local Vercel output outside workspace; parser worker, default contracts and same-instance upstream cancellation/lane release. Synthetic official boundaries; not deployed Vercel verification.' }, null, 2));
} finally { await client.close(); }
process.exit(0);
