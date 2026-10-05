import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import * as core from '../dist/index.js';
import { UpstreamRuntime } from '../dist/upstream.js';

test('the shallow MCP discovery interface exposes literal continuation and exclusive typed failures', async () => {
  const upstream = new UpstreamRuntime(), finder = new core.ActDiscovery({ signingKey: Buffer.alloc(32,19), upstream });
  const server = new McpServer({ name:'discovery-contract', version:'0' });
  core.registerDiscoveryTools(server, finder, { upstream });
  const client = new Client({ name:'discovery-contract', version:'0' });
  const [ct,st] = InMemoryTransport.createLinkedPair();
  const original = globalThis.fetch; let attempts = 0;
  globalThis.fetch = async (_url, init) => {
    attempts++;
    const page = JSON.parse(init.body).paginazione.paginaCorrente;
    return Response.json({ listaAtti: Array.from({ length:page === 1 ? 5 : 1 }, (_,i) => ({ dataGU:'2023-03-31', codiceRedazionale:`SYN${page}${i}`, titoloAtto:`Synthetic act ${page}:${i}` })),
      numeroAttiTrovati:6, numeroPagine:2, paginaCorrente:page });
  };
  await server.connect(st); await client.connect(ct);
  try {
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ['find_acts','continue_acts']);
    assert.deepEqual(Object.keys(tools.tools[0].inputSchema.properties), ['request']);
    let result = await client.callTool({ name:'find_acts', arguments:{ request:'trasparenza amministrativa' } });
    assert.equal(result.structuredContent.traversal.progress,'more');
    assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
    result = await client.callTool({ name:'continue_acts', arguments:{ cursor:result.structuredContent.traversal.cursor } });
    assert.equal(result.structuredContent.traversal.progress,'complete');
    assert.equal(attempts,2);
    result = await client.callTool({ name:'continue_acts', arguments:{ cursor:'invented' } });
    assert.equal(result.isError,true);
    assert.equal(result.structuredContent.error.category,'invalid_cursor');
    assert.equal(attempts,2);
    result = await client.callTool({ name:'find_acts', arguments:{ request:'legge 241' } });
    assert.equal(result.isError,true);
    assert.equal(result.structuredContent.error.category,'invalid_input');
    assert.equal(attempts,2);
  } finally { globalThis.fetch=original; await client.close(); await server.close(); }
});
