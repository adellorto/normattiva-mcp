import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../dist/tools.js';
import { UpstreamRuntime } from '../dist/upstream.js';
import { fileURLToPath } from 'node:url';

const args = { data_gu: '1988-09-12', codice_redazionale: '088G0458', articolo: 13 };

async function checkContracts(client) {
  assert.ok((await client.listTools()).tools.some(tool => tool.name === 'read_article'));
  const found = await client.callTool({ name: 'read_article', arguments: args });
  assert.equal(found.structuredContent.outcome, 'found');
  assert.equal(found.structuredContent.content.text, 'Fixture legal text.');
  assert.deepEqual(JSON.parse(found.content[0].text), found.structuredContent);
  const unresolved = await client.callTool({ name: 'read_article', arguments: { ...args, articolo: 999 } });
  assert.equal(unresolved.structuredContent.outcome, 'unresolved');
  const error = await client.callTool({ name: 'read_article', arguments: { ...args, articolo: 998 } });
  assert.equal(error.isError, true);
  assert.equal(error.structuredContent.error.category, 'rate_limited');
  assert.equal(JSON.stringify(error).includes('private dump'), false);
}

test('the built stdio server exposes the common outcome and error contracts', async () => {
  const client = new Client({ name: 'stdio-contract', version: '0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [
    '--import', fileURLToPath(new URL('./fixtures/upstream.mjs', import.meta.url)),
    fileURLToPath(new URL('../../stdio-server/dist/index.js', import.meta.url)),
  ] });
  await client.connect(transport);
  try { await checkContracts(client); }
  finally { await client.close(); }
});

test('Streamable HTTP serializes the same common contracts', async () => {
  const originalFetch = globalThis.fetch;
  await import('./fixtures/upstream.mjs');
  const runtime = new UpstreamRuntime();
  const client = new Client({ name: 'http-contract', version: '0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://fixture.invalid/mcp'), {
    fetch: async (url, init) => {
      const server = new McpServer({ name: 'http-contract', version: '0' });
      registerTools(server, { upstream: runtime });
      const serverTransport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, enableJsonResponse: true,
      });
      await server.connect(serverTransport);
      try { return await serverTransport.handleRequest(new Request(url, init)); }
      finally { await server.close(); }
    },
  });
  try {
    await client.connect(transport);
    await checkContracts(client);
  } finally {
    globalThis.fetch = originalFetch;
    await client.close();
  }
});
