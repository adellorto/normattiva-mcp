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
process.env.NORMATTIVA_REFERENCE_KEY = signingKey.toString('hex');
const { POST } = await import(pathToFileURL(join(scratch, config.handler)));
const client = new Client({ name: 'release-vercel-function', version: '1' });
await client.connect(new StreamableHTTPClientTransport(new URL('https://fixture.invalid/api/mcp'), {
  fetch: (url, init) => POST(new Request(url, init)),
}));
try {
  assert.equal(client.getServerVersion().version, '0.2.0');
  await checkContracts(client);
  console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
    built_handler: config.handler, runtime: config.runtime, max_duration_seconds: config.maxDuration,
    worker_present: true, declared_file_path_mappings: Object.keys(config.filePathMap ?? {}).length,
    isolated_built_function_contracts: 'passed', package_version: client.getServerVersion().version,
    scope: 'Dereferenced local Vercel output outside workspace; parser worker and default discovery/reading/resource/prompt contracts. Synthetic official boundaries; not deployed Vercel verification.' }, null, 2));
} finally { await client.close(); }
process.exit(0);
