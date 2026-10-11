// On-demand release gate: real tarball, isolated npm consumer, production MCP seams.
// Run after building: node packages/core/test/fixtures/release-package.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { checkContracts } from './public-contracts.mjs';
import { signingKey } from './traversal-upstream.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'normattiva-release-package-'));
const fixture = fileURLToPath(new URL('./release-upstream.mjs', import.meta.url));
const http = fileURLToPath(new URL('./release-http.mjs', import.meta.url));
const env = { ...process.env, NORMATTIVA_REFERENCE_KEY: signingKey.toString('hex') };
const localStateRoot = join(scratch, 'state');
const localKeyFile = join(localStateRoot, 'normattiva-mcp', 'reference-key');
const localEnv = { ...process.env, XDG_STATE_HOME: localStateRoot };
delete localEnv.NORMATTIVA_REFERENCE_KEY;
// The source/worker must work without workspace packages. Dependencies are
// installed from the tarball manifest without development dependencies.
await exec('npm', ['pack', '--json', '--pack-destination', scratch, '--cache', join(scratch, 'cache')],
  { cwd: join(root, 'packages/stdio-server'), env: localEnv, timeout: 60_000, maxBuffer: 1024 * 1024 });
const manifest = JSON.parse(await readFile(join(root, 'packages/stdio-server/package.json'), 'utf8'));
const archive = join(scratch, `normattiva-mcp-${manifest.version}.tgz`);
await writeFile(join(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
await exec('npm', ['install', archive, '--omit=dev', '--no-audit', '--no-fund', '--cache', join(scratch, 'cache')],
  { cwd: scratch, env: localEnv, timeout: 120_000, maxBuffer: 1024 * 1024 });
await assert.rejects(access(localKeyFile), error => error.code === 'ENOENT',
  'package installation must not create local reference trust');
const serverPath = join(scratch, 'node_modules/normattiva-mcp/dist/index.js');
async function stdio(work, key = signingKey) {
  const client = new Client({ name: 'release-package', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: ['--import', fixture, serverPath], cwd: scratch,
    env: { ...env, NORMATTIVA_REFERENCE_KEY: key.toString('hex') } }));
  try {
    assert.equal(client.getServerVersion().version, manifest.version);
    return await work(client);
  } finally { await client.close(); }
}
async function localStdio(work, processEnvironment = localEnv) {
  const client = new Client({ name: 'release-package-local-trust', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: ['--import', fixture, serverPath], cwd: scratch, env: processEnvironment }));
  try {
    assert.equal(client.getServerVersion().version, manifest.version);
    return await work(client);
  } finally { await client.close(); }
}
async function hosted(name, args, key = signingKey) {
  const { stdout } = await exec(process.execPath, [http, JSON.stringify({ name, arguments: args })],
    { cwd: root, env: { ...env, NORMATTIVA_REFERENCE_KEY: key.toString('hex') }, timeout: 30_000 });
  return JSON.parse(stdout);
}
function data(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result.structuredContent));
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 128 * 1024);
  return result.structuredContent;
}

// A normal installed package creates local-only trust on first server launch,
// not during installation, and reuses it for signed references after restart.
const localReference = await localStdio(async client => {
  const discovery = data(await client.callTool({ name: 'find_acts', arguments: {
    request: 'decreto legislativo 267/2000 articolo 13',
  } }));
  const act_locator = discovery.traversal.items[0].act_locator;
  const article = data(await client.callTool({ name: 'read_article', arguments: {
    act_locator, article_reference: '13', snapshot_date: '2026-10-02', max_chars: 4,
  } }));
  return article;
});
const localKeyMode = (await stat(localKeyFile)).mode & 0o777;
const localDirectoryMode = (await stat(join(localStateRoot, 'normattiva-mcp'))).mode & 0o777;
if (process.platform !== 'win32') {
  assert.equal(localKeyMode, 0o600);
  assert.equal(localDirectoryMode, 0o700);
}
await localStdio(async client => {
  const rest = data(await client.callTool({ name: 'read_article', arguments: {
    cursor: localReference.cursor, max_chars: 100,
  } }));
  assert.equal(localReference.content.text + rest.content.text, 'Art. 13. Fixture text 13.');
});
const concurrentStateRoot = join(scratch, 'concurrent-state');
const concurrentEnv = { ...localEnv, XDG_STATE_HOME: concurrentStateRoot };
await Promise.all([
  localStdio(client => client.listTools(), concurrentEnv),
  localStdio(client => client.listTools(), concurrentEnv),
]);
await access(join(concurrentStateRoot, 'normattiva-mcp', 'reference-key'));

// Fails if bundled worker/dependencies are missing, even though source tests pass.
await stdio(async client => {
  const found = data(await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } }));
  data(await client.callTool({ name: 'list_articles', arguments: {
    act_locator: found.traversal.items[0].act_locator, snapshot_date: '2026-10-02', page_size: 1,
  } }));
  await checkContracts(client);
});
const references = await stdio(async client => {
  const discovery = data(await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000 articolo 13' } }));
  const act_locator = discovery.traversal.items[0].act_locator;
  const index = data(await client.callTool({ name: 'list_articles', arguments: { act_locator, snapshot_date: '2026-10-02', page_size: 1 } }));
  const article = data(await client.callTool({ name: 'read_article', arguments: { article_locator: index.traversal.items[0].article_locator, max_chars: 4 } }));
  const reading = data(await client.callTool({ name: 'read_act', arguments: { act_locator, snapshot_date: '2026-10-02', max_chars: 4 } }));
  const topic = data(await client.callTool({ name: 'find_acts', arguments: { request: 'trasparenza amministrativa' } }));
  return { act_locator, index, article, reading, topic };
});
await stdio(async client => {
  const rest = data(await client.callTool({ name: 'read_article', arguments: { cursor: references.article.cursor, max_chars: 100 } }));
  assert.equal(references.article.content.text + rest.content.text, 'Art. 13. Fixture text 13.');
  assert.equal(rest.evidence[0].snapshot_date, '2026-10-02');
});
const transferred = data(await hosted('read_article', { cursor: references.article.cursor, max_chars: 4 }));
await stdio(async client => {
  const rest = data(await client.callTool({ name: 'read_article', arguments: { cursor: transferred.cursor, max_chars: 100 } }));
  assert.equal(references.article.content.text + transferred.content.text + rest.content.text, 'Art. 13. Fixture text 13.');
});
const nextIndex = data(await hosted('list_articles', { cursor: references.index.traversal.cursor }));
assert.equal(nextIndex.traversal.items[0].label, '20');
assert.equal(nextIndex.traversal.progress, 'complete');
const nextReading = data(await hosted('read_act', { cursor: references.reading.traversal.cursor, max_chars: 100 }));
assert.equal(nextReading.traversal.progress, 'complete');
assert.equal([...references.reading.traversal.items, ...nextReading.traversal.items]
  .flatMap(i => i.segments).map(s => s.text).join(''), 'Art. 13.Fixture text 13.Art. 20.Fixture text 20.');
const nextTopic = data(await hosted('continue_acts', { cursor: references.topic.traversal.cursor }));
assert.equal(nextTopic.traversal.items[0].title, 'Synthetic act 2:0');
assert.equal(nextTopic.traversal.progress, 'complete');
for (const [name, args] of [
  ['read_article', { cursor: references.article.cursor }],
  ['read_article', { article_locator: references.index.traversal.items[0].article_locator }],
  ['list_articles', { cursor: references.index.traversal.cursor }],
  ['continue_acts', { cursor: references.topic.traversal.cursor }],
]) {
  const rejected = await hosted(name, args, Buffer.alloc(32, 8));
  assert.equal(rejected.isError, true);
  assert.ok(['invalid_locator', 'invalid_cursor'].includes(rejected.structuredContent.error.category));
}
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
  package_version: manifest.version, scratch, archive, isolated_package_contracts: 'passed',
  install_side_effect: 'absent', automatic_local_trust: 'passed', concurrent_first_launch: 'passed',
  local_key_mode: localKeyMode.toString(8), local_directory_mode: localDirectoryMode.toString(8),
  same_key_restart: 'passed', configured_npm_http_transfer: 'passed', different_trust_rejection: 'passed',
  scope: 'Synthetic upstream; fresh production HTTP handler processes, not deployed Vercel or model acceptance.' }, null, 2));
