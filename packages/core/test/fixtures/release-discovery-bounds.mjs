// Production MCP request/result bounds, empty external-source controls only.
// node .../release-discovery-bounds.mjs > MEASUREMENTS.json
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../../dist/index.js';
import { signingKey } from './traversal-upstream.mjs';

let attempts = 0;
globalThis.fetch = async () => {
  attempts++;
  return Response.json({ listaAtti: [], numeroAttiTrovati: 0, numeroPagine: 0, paginaCorrente: 1 });
};
const server = new McpServer({ name: 'discovery-bounds', version: '0' });
registerTools(server, { signingKey });
const client = new Client({ name: 'discovery-bounds', version: '0' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(b); await client.connect(a);
const cases = JSON.parse(await readFile(new URL('./discovery/routing-cases.json', import.meta.url)));
cases.push({ id: 'max-ascii-request', prompt: 'x'.repeat(4096), route: 'discover' },
  { id: 'bounded-unicode-request', prompt: 'è'.repeat(2048), route: 'discover' },
  { id: 'oversized-unicode-reference', prompt: 'è'.repeat(4096), route: 'reject', error: 'request_reference_limit' });
const samples = [];
try {
  for (const scenario of cases.filter(c => !['continue', 'clarify'].includes(c.route))) {
    const before = attempts, started = performance.now();
    const result = await client.callTool({ name: 'find_acts', arguments: { request: scenario.prompt } });
    const invalid = scenario.route === 'reject' || scenario.conflict;
    assert.equal(!!result.isError, !!invalid, scenario.id);
    if (invalid) {
      assert.equal(attempts, before);
      if (scenario.error) assert.equal(result.structuredContent.error.code, scenario.error);
    }
    else {
      assert.equal(result.structuredContent.interpretation, scenario.prompt);
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    }
    const bytes = Buffer.byteLength(JSON.stringify(result));
    assert.ok(bytes <= 128 * 1024);
    samples.push({ case: scenario.id, elapsed_ms: performance.now() - started,
      upstream_attempts: attempts - before, full_mcp_bytes: bytes,
      interpreted_request_chars: result.structuredContent?.interpretation?.length,
      outcome: result.isError ? result.structuredContent.error.code : result.structuredContent.match });
  }
  const before = attempts;
  const rejected = await client.callTool({ name: 'find_acts', arguments: { request: 'è'.repeat(4097) } });
  assert.equal(rejected.isError, true);
  assert.equal(attempts, before);
} finally { await client.close(); await server.close(); }
const maxRSS = process.resourceUsage().maxRSS;
assert.ok(maxRSS <= 256 * 1024);
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
  scope: 'Default MCP with empty-source controls; first/cached legal-source latency and full-release memory remain separate. Full serialized responses count both MCP copies.',
  max_rss_kib: maxRSS, total_upstream_attempts: attempts, samples }, null, 2));
