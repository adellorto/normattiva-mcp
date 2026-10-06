// Inspect every generated call in the named frozen reports; execute compatible
// calls against fresh default MCP registration and external synthetic controls.
// Prose honesty is recorded separately by human-readable review annotations.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../../dist/index.js';
import { signingKey } from './traversal-upstream.mjs';
import './release-upstream.mjs';
const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function collectReferences(value, refs) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['cursor', 'act_locator', 'article_locator', 'attachment_ref'].includes(key) && typeof child === 'string') refs.add(child);
    else collectReferences(child, refs);
  }
}
async function execute(name, args) {
  const server = new McpServer({ name: 'final-model-review', version: '0' });
  registerTools(server, { signingKey });
  const client = new Client({ name: 'final-model-review', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 128 * 1024);
    if (!result.isError) assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    return { is_error: result.isError ?? false, result: result.structuredContent };
  } catch (error) { return { protocol_error: error.message }; }
  finally { await client.close(); await server.close(); }
}
const rows = [];
for (const path of process.argv.slice(3)) {
  const report = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(report.input_sha256, hash(input)); assert.equal(report.schema_sha256, hash(input.schema));
  assert.equal(report.runs.length, report.planned_calls);
  for (const run of report.runs) {
    const refs = new Set();
    for (const message of run.input) if (message.role === 'tool') collectReferences(JSON.parse(message.content), refs);
    const calls = [];
    for (const call of run.message?.tool_calls ?? []) {
      const issues = []; let args, replay;
      try { args = JSON.parse(call.function.arguments); }
      catch { issues.push('invalid_argument_json'); }
      if (args) {
        for (const field of ['cursor', 'act_locator', 'article_locator', 'attachment_ref']) {
          if (args[field] && !refs.has(args[field])) issues.push(`reference_not_returned:${field}`);
        }
        // A supplied cursor in the original prototype scenario is recorded as
        // such, without pretending it was issued by production MCP.
        replay = await execute(call.function.name, args);
      }
      calls.push({ tool: call.function.name, arguments: args, issues, replay });
    }
    rows.push({ model: run.requested_model, repetition: run.repetition, case: run.case,
      input_history_has_issued_references: refs.size > 0,
      automated_failures: run.automated_failures, provider_error: run.blocked_error,
      caller_visible_text: run.message?.content ?? null, calls });
  }
}
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), input_sha256: hash(input), schema_sha256: hash(input.schema),
  scope: 'Every generated call replayed through fresh default MCP with synthetic sources. Replays are contract checks, not live-law or multi-turn model acceptance. Prose requires separate review.', rows }, null, 2));
