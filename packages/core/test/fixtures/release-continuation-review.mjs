// Offline review of every generated continuation call, through production MCP.
// node .../release-continuation-review.mjs INPUT RESULTS CLIENT > REVIEW.json
// Synthetic upstream only; no inference or official-source requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../../dist/index.js';
import { signingKey } from './traversal-upstream.mjs';
import './public-upstream.mjs';

const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const report = JSON.parse(await readFile(process.argv[3], 'utf8'));
const terminal = JSON.parse(await readFile(process.argv[4], 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(report.input_sha256, hash(input), 'Model inputs changed after dispatch');
assert.equal(report.schema_sha256, hash(input.schema), 'Model schema changed after dispatch');
const allowed = { list_articles: ['cursor', 'page_size'], read_article: ['cursor', 'max_chars'], read_act: ['cursor', 'max_chars'] };
async function execute(name, args) {
  const server = new McpServer({ name: 'continuation-review', version: '0' });
  registerTools(server, { signingKey });
  const client = new Client({ name: 'continuation-review', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try { return await client.callTool({ name, arguments: args }); }
  finally { await client.close(); await server.close(); }
}
const rows = [];
assert.equal(report.runs.length, report.planned_calls, 'Incomplete provider matrix');
for (const row of report.runs) {
  const checks = [], calls = row.message?.tool_calls ?? [];
  if (row.blocked_error || !row.message || !['stop', 'tool_calls'].includes(row.finish_reason)) checks.push('incomplete_provider_output');
  if (row.case === 'edge-missing-cursor') {
    if (calls.length) checks.push('invented_cursor_or_wrong_route');
    if (!row.message?.content) checks.push('missing_clarification');
  } else {
    if (calls.length !== 1) checks.push('wrong_call_count');
    for (const call of calls) {
      let args;
      try { args = JSON.parse(call.function.arguments); } catch { checks.push('invalid_arguments'); continue; }
      if (call.function.name !== row.expected_tool) checks.push('wrong_continuation_tool');
      if (args.cursor !== row.expected_cursor) checks.push('altered_or_invented_reference');
      if (Object.keys(args).some(key => !(allowed[row.expected_tool] ?? []).includes(key))) checks.push('conflicting_arguments');
      if (checks.length) continue;
      const resumed = await execute(call.function.name, args);
      if (resumed.isError) checks.push('mcp_rejected_continuation');
      assert.deepEqual(JSON.parse(resumed.content[0].text), resumed.structuredContent);
      assert.ok(Buffer.byteLength(JSON.stringify(resumed)) <= 128 * 1024);
      const expected = input.samples[row.case].structuredContent;
      const date = expected.requested?.snapshot_date ?? expected.snapshot.snapshot_date;
      assert.equal(resumed.structuredContent.requested?.snapshot_date ?? resumed.structuredContent.snapshot.snapshot_date, date);
    }
  }
  rows.push({ model: row.requested_model, repetition: row.repetition, case: row.case,
    caller_visible_text: row.message?.content ?? null, calls_checked: calls.length, failures: checks });
}
const articleCalls = terminal.calls.filter(call => call.tool === 'read_article' && call.result?.outcome === 'found');
const text = articleCalls.map(call => call.result.content.text).join('');
const unresolved = terminal.calls.find(call => call.arguments.article_reference === '999');
const cliChecks = {
  execution_completed: !terminal.execution_error && !terminal.client_errors?.length,
  literal_continuation: terminal.continuation_checks.length > 0 && terminal.continuation_checks.every(check => check.literal && check.status === 'completed' && !check.error),
  complete_text: text === 'Art. 13. Fixture text 13.' && articleCalls.at(-1)?.result.progress === 'complete',
  unresolved_999: unresolved?.result.outcome === 'unresolved',
};
console.log(JSON.stringify({ scope: 'Every generated continuation call checked literally; compatible calls executed through fresh production MCP with synthetic sources. Model prose and terminal absence explanation need manual review. No live/model-general acceptance.',
  rows, terminal_checks: cliChecks,
  gate: rows.every(row => !row.failures.length) && Object.values(cliChecks).every(Boolean) ? 'passed' : 'failed' }, null, 2));
if (rows.some(row => row.failures.length) || !Object.values(cliChecks).every(Boolean)) process.exitCode = 1;
