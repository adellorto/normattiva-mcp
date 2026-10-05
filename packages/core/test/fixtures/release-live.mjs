// Small paced official-surface canaries at the default MCP seam. No full crawl.
// Writes successes AND failures; a blocked canary exits nonzero, never passes.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../../dist/index.js';

const report = { recorded_at: new Date().toISOString(), node: process.version,
  scope: 'Live official sources through local default MCP registration; no deployed/npm/model acceptance.',
  calls: [], attempts: [] };
const fetchOfficial = globalThis.fetch;
let lastAttempt = 0;
globalThis.fetch = async (url, init) => {
  await setTimeout(Math.max(0, 1000 - (Date.now() - lastAttempt)), undefined, { signal: init?.signal });
  lastAttempt = Date.now();
  const record = { url: String(url), request: init?.body ? JSON.parse(init.body) : undefined };
  report.attempts.push(record);
  try {
    const response = await fetchOfficial(url, init);
    record.http_status = response.status;
    record.headers_ms = Date.now() - lastAttempt;
    return response;
  } catch (error) {
    record.transport_cause = error.cause?.code ?? error.name;
    throw error;
  }
};
const server = new McpServer({ name: 'release-live', version: '1' });
registerTools(server, { signingKey: randomBytes(32) }); // Temporary local canary trust only.
const client = new Client({ name: 'release-live', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(b); await client.connect(a);
async function canary(name, tool, args, verify) {
  const record = { name, tool, input: args }, started = performance.now();
  report.calls.push(record);
  try {
    const result = await client.callTool({ name: tool, arguments: args });
    record.result = result.structuredContent;
    record.serialized_bytes = Buffer.byteLength(JSON.stringify(result));
    record.elapsed_ms = Math.round(performance.now() - started);
    assert.notEqual(result.isError, true, JSON.stringify(result.structuredContent));
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.ok(record.serialized_bytes <= 128 * 1024);
    verify?.(result.structuredContent);
    record.validation = 'passed';
    return result.structuredContent;
  } catch (error) {
    record.validation = 'blocked_or_failed'; record.failure = error.message;
    process.stderr.write(`${name}: ${error.message}\n`);
    process.exitCode = 1;
    return undefined;
  }
}
try {
  const found = await canary('TUEL exact discovery', 'find_acts', { request: 'decreto legislativo 267/2000 articolo 13' }, value => {
    assert.equal(value.match, 'identified'); assert.equal(value.article_reference, '13');
  });
  if (found?.traversal?.items[0]) {
    const act_locator = found.traversal.items[0].act_locator, snapshot_date = '2026-10-02';
    const read = await canary('TUEL ordinary direct read', 'read_article', { act_locator, article_reference: '13', snapshot_date, max_chars: 4 }, value => {
      assert.equal(value.outcome, 'found'); assert.equal(value.progress, 'more');
    });
    if (read?.cursor) await canary('TUEL literal article continuation', 'read_article', { cursor: read.cursor }, value => {
      assert.equal(value.outcome, 'found'); assert.equal(value.evidence[0].snapshot_date, snapshot_date);
    });
    const index = await canary('TUEL dated AKN/index canary', 'list_articles', { act_locator, snapshot_date, page_size: 1 }, value => {
      assert.equal(value.traversal.items[0].label, '1'); assert.equal(value.traversal.progress, 'more');
    });
    if (index?.traversal?.cursor) await canary('TUEL literal index continuation', 'list_articles', { cursor: index.traversal.cursor, page_size: 1 }, value => {
      assert.equal(value.snapshot.snapshot_date, snapshot_date); assert.equal(value.traversal.items[0].label, '2');
    });
  }
  await canary('CAD reviewed alias live verification', 'find_acts', { request: 'CAD articolo 5' }, value => {
    assert.equal(value.match, 'identified'); assert.equal(value.article_reference, '5');
  });
  await canary('Official relevance search', 'find_acts', { request: 'trasparenza amministrativa' }, value => {
    assert.ok(['candidates', 'identified', 'no_candidates'].includes(value.match));
  });
  const civil = await canary('Civil Code discovery', 'find_acts', { request: 'regio decreto 262/1942' }, value => assert.equal(value.match, 'identified'));
  if (civil?.traversal?.items[0]) {
    const act_locator = civil.traversal.items[0].act_locator, snapshot_date = '2026-10-02';
    const index = await canary('Civil Code structured snapshot', 'list_articles', { act_locator, snapshot_date, page_size: 1 }, value => {
      assert.equal(value.snapshot.snapshot_date, snapshot_date);
      assert.ok(['more', 'complete'].includes(value.traversal.progress));
      assert.equal(value.traversal.items.length, 1);
      assert.ok(value.traversal.items[0].article_locator);
    });
    if (index?.traversal) await canary('Civil Code attachment article 2043', 'read_article', { act_locator, article_reference: '2043', snapshot_date }, value => assert.equal(value.outcome, 'found'));
  }
  const privacy = await canary('Privacy Code discovery', 'find_acts', { request: 'decreto legislativo 196/2003' }, value => assert.equal(value.match, 'identified'));
  // Route availability only: date/label assertions do not certify historical content.
  if (privacy?.traversal?.items[0]) await canary('Privacy 2017 dated-route availability', 'list_articles', {
    act_locator: privacy.traversal.items[0].act_locator, snapshot_date: '2017-01-01', page_size: 1,
  }, value => { assert.equal(value.snapshot.snapshot_date, '2017-01-01'); assert.equal(value.traversal.items[0].label, '1'); });
} finally {
  await client.close(); await server.close(); globalThis.fetch = fetchOfficial;
  await writeFile(process.argv[2] ?? '/tmp/normattiva-release-live.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ calls: report.calls.length, passed: report.calls.filter(c => c.validation === 'passed').length,
    attempts: report.attempts.length, report: process.argv[2] ?? '/tmp/normattiva-release-live.json' }));
}
