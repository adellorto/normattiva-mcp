#!/usr/bin/env node
// Small paced live canary for the built, configured stdio server.
// No full-act crawl, no load test; upstream failures are failures, never absence.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../packages/stdio-server/dist/index.js', import.meta.url));
const proc = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: proc.stdout });
const pending = new Map(); let nextId = 1;
function failPending(error) {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
  pending.clear();
}
proc.on('error', failPending);
proc.on('exit', code => failPending(new Error(`Server exited (${code}); check preserved reference trust configuration.`)));
rl.on('line', line => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const entry = pending.get(msg.id); if (!entry) return;
  pending.delete(msg.id); clearTimeout(entry.timer);
  if (msg.error) entry.reject(new Error(msg.error.message)); else entry.resolve(msg.result);
});
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 65_000);
    pending.set(id, { resolve, reject, timer });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
async function call(name, args) {
  const result = await send('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${result.structuredContent?.error?.code ?? result.content[0]?.text}`);
  const text = JSON.parse(result.content[0].text);
  assert.deepEqual(text, result.structuredContent);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 128 * 1024);
  return text;
}
try {
  const init = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
  console.log('serverInfo:', init.serverInfo);
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  const tools = await send('tools/list', {});
  assert.deepEqual(tools.tools.map(t => t.name), ['find_acts', 'continue_acts', 'list_articles', 'read_article', 'read_act', 'recent_updates']);
  assert.equal((await send('resources/list', {})).resources.length, 4);
  assert.equal((await send('prompts/list', {})).prompts.length, 2);
  const prompt = await send('prompts/get', { name: 'ricerca-articolo', arguments: { argomento: 'enti locali' } });
  assert.ok(prompt.messages[0].content.text.includes('find_acts'));
  const resource = await send('resources/read', { uri: 'normattiva://tipologiche/denominazioni' });
  assert.ok(JSON.parse(resource.contents[0].text).length > 0);
  const discovery = await call('find_acts', { request: 'decreto legislativo 267/2000 articolo 13' });
  assert.equal(discovery.match, 'identified');
  const act_locator = discovery.traversal.items[0].act_locator;
  const snapshot_date = '2026-10-02';
  const first = await call('read_article', { act_locator, article_reference: discovery.article_reference, snapshot_date, max_chars: 4 });
  assert.equal(first.outcome, 'found'); assert.equal(first.progress, 'more');
  const rest = await call('read_article', { cursor: first.cursor });
  assert.equal(rest.outcome, 'found'); assert.ok(rest.content.text.length > 0);
  const index = await call('list_articles', { act_locator, snapshot_date, page_size: 1 });
  assert.ok(['pending', 'more', 'complete'].includes(index.traversal.progress));
  if (index.traversal.cursor) {
    const next = await call('list_articles', { cursor: index.traversal.cursor });
    assert.equal(next.snapshot.snapshot_date, snapshot_date);
  }
  const read = await call('read_act', { act_locator, snapshot_date, max_chars: 80 });
  assert.ok(['pending', 'more', 'complete'].includes(read.traversal.progress));
  const invalid = await send('tools/call', { name: 'continue_acts', arguments: { cursor: 'invented' } });
  assert.equal(invalid.isError, true); assert.equal(invalid.structuredContent.error.category, 'invalid_cursor');
  const end = new Date(), start = new Date(end.getTime() - 7 * 86_400_000), fmt = date => date.toISOString().slice(0, 10);
  const updates = await call('recent_updates', { data_inizio: fmt(start), data_fine: fmt(end) });
  assert.ok(Number.isInteger(updates.numero_atti));
  console.log('Smoke passed: focused tools, literal continuation, frozen date, prompts/resources and typed errors.');
} catch (error) {
  console.error('Smoke failed:', error.message); process.exitCode = 1;
} finally {
  failPending(new Error('Smoke finished')); rl.close(); proc.kill();
}
