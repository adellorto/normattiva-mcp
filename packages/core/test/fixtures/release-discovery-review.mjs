// Offline review of every routing call through production MCP and empty-source
// controls. No inference or official-source requests. Clarifying prose still
// requires manual review; the full model trace remains the authority.
// node .../release-discovery-review.mjs INPUT RESULTS > REVIEW.json
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../../dist/index.js';
import { signingKey } from './traversal-upstream.mjs';

const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const report = JSON.parse(await readFile(process.argv[3], 'utf8'));
const cases = JSON.parse(await readFile(new URL('./discovery/routing-cases.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(report.input_sha256, hash(input));
assert.equal(report.schema_sha256, hash(input.schema));
const rows = [];
for (const run of report.runs) {
  const scenario = cases.find(c => c.id === run.case);
  assert.ok(scenario && !['continue', 'clarify'].includes(scenario.route));
  const failures = [...(run.automated_failures ?? [])];
  if (run.blocked_error || !run.message || !['stop', 'tool_calls'].includes(run.finish_reason)) failures.push('incomplete_provider_output');
  const calls = run.message?.tool_calls ?? [], checks = [];
  const clarification = scenario.route === 'reject' && !calls.length && !!run.message?.content?.trim();
  if (!clarification && calls.length !== 1) failures.push('wrong_call_count');
  for (const call of calls) {
    const issues = [], name = call.function.name;
    let args, result, requests = [];
    try { args = JSON.parse(call.function.arguments); } catch { issues.push('invalid_argument_json'); }
    if (name !== 'find_acts') issues.push('reading_before_discovery_or_wrong_tool');
    if (args && (Object.keys(args).length !== 1 || typeof args.request !== 'string')) issues.push('unsupported_arguments');
    if (args?.request !== scenario.prompt) issues.push('request_changed');
    for (const field of ['act_locator', 'article_locator', 'attachment_ref', 'cursor']) {
      if (args?.[field]) issues.push(`reference_not_issued:${field}`);
    }
    if (name === 'find_acts' && args) {
      globalThis.fetch = async (url, init) => {
        requests.push({ url: String(url), body: JSON.parse(init.body) });
        return Response.json({ listaAtti: [], numeroAttiTrovati: 0, numeroPagine: 0, paginaCorrente: 1 });
      };
      const server = new McpServer({ name: 'discovery-review', version: '0' });
      registerTools(server, { signingKey });
      const client = new Client({ name: 'discovery-review', version: '0' });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await server.connect(b); await client.connect(a);
      try { result = await client.callTool({ name, arguments: args }); }
      finally { await client.close(); await server.close(); }
      const invalid = scenario.route === 'reject' || scenario.conflict;
      if (invalid) {
        if (!result.isError || result.structuredContent?.error?.category !== 'invalid_input' || requests.length) issues.push('invalid_request_not_rejected_locally');
      } else {
        if (result.isError) issues.push('mcp_rejected_request');
        else {
          assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
          if (result.structuredContent.interpretation !== scenario.prompt) issues.push('incomplete_interpretation');
          for (const token of scenario.articleTokens ?? (scenario.article ? [scenario.article] : [])) {
            if (!result.structuredContent.article_reference?.toUpperCase().includes(token.toUpperCase())) issues.push('lost_article_intent');
          }
        }
      }
      if (Buffer.byteLength(JSON.stringify(result)) > 128 * 1024) issues.push('response_byte_limit');
    }
    checks.push({ tool: name, arguments: args, issues, upstream_requests: requests,
      result: result?.structuredContent });
    failures.push(...issues);
  }
  rows.push({ model: run.requested_model, repetition: run.repetition, case: run.case,
    caller_visible_text: run.message?.content ?? null,
    clarification: clarification ? 'requires manual review; no semantic constraint-loss defect inferred' : undefined,
    calls: checks, failures: [...new Set(failures)] });
}
const complete = report.runs.length === report.planned_calls;
const passed = complete && rows.every(row => !row.failures.length);
console.log(JSON.stringify({ scope: 'Every generated routing call inspected and find_acts calls replayed through default MCP with empty-source controls. Not live/deployed acceptance; prose needs manual review.',
  complete, gate: passed ? 'passed mechanical checks; manual review required' : 'failed', rows }, null, 2));
if (!passed) process.exitCode = 1;
