// Offline measurement inputs from the default MCP seam; synthetic controls only.
// Usage: node .../measure-guidance.mjs > /tmp/guidance-input.json
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools, ActTraversal } from '../../dist/index.js';
import { UpstreamRuntime } from '../../dist/upstream.js';
import { signingKey, publication } from './traversal-upstream.mjs';
import './public-upstream.mjs';
import { installDiscoveryBoundary } from './discovery-upstream.mjs';
const boundary = globalThis.fetch;
const act_locator = new ActTraversal({ signingKey }).actLocator(publication);
async function collect(work, composedAttempts = 16) {
  const server = new McpServer({ name: 'guidance-measurement', version: '0' });
  registerTools(server, { signingKey, upstream: new UpstreamRuntime({ composedAttempts }) });
  const client = new Client({ name: 'guidance-measurement', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  const call = async (name, args) => await client.callTool({ name, arguments: args });
  try { return await work(client, call); } finally { await client.close(); await server.close(); }
}
const { schema, samples } = await collect(async (client, call) => ({
  schema: await client.listTools(),
  samples: {
    identified_currentness_unknown: await call('find_acts', { request: 'decreto legislativo 267/2000' }),
    index_more: await call('list_articles', { act_locator, snapshot_date: '2026-10-02', page_size: 1 }),
    article_more: await call('read_article', { act_locator, article_reference: '13', max_chars: 4 }),
    article_unresolved: await call('read_article', { act_locator, article_reference: '999' }),
    suffix_unresolved: await call('read_article', { act_locator, article_reference: '13 bis' }),
    reading_more: await call('read_act', { act_locator, snapshot_date: '2026-10-02', max_chars: 4 }),
    invalid_cursor: await call('continue_acts', { cursor: 'invented' }),
  },
}));
samples.index_pending = await collect((_, call) => call('list_articles', { act_locator, snapshot_date: '2026-10-02' }), 2);
installDiscoveryBoundary();
samples.discovery_more = await collect((_, call) => call('find_acts', { request: 'trasparenza amministrativa' }));
globalThis.fetch = async (url, init) => String(url).endsWith('/ricerca/semplice')
  ? new Response('unavailable', { status: 404 }) : boundary(url, init);
samples.degraded_discovery = await collect((_, call) => call('find_acts', { request: 'trasparenza amministrativa' }));
globalThis.fetch = async (url, init) => String(url).endsWith('/ricerca/avanzata')
  ? Response.json({ numeroAttiTrovati: 0, numeroPagine: 0, paginaCorrente: 1, listaAtti: [] }) : boundary(url, init);
samples.no_candidates = await collect((_, call) => call('find_acts', { request: 'legge 123456/2020' }));
globalThis.fetch = async (url, init) => String(url).includes('dettaglio-atto') && JSON.parse(init.body).idArticolo === 20
  ? new Response('unclassified gateway', { status: 503 }) : boundary(url, init);
samples.index_interrupted = await collect((_, call) => call('list_articles', { act_locator, snapshot_date: '2026-10-02' }));
console.log(JSON.stringify({ schema, samples }));
