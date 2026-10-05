import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../dist/tools.js';

async function connected(work) {
  const server = new McpServer({ name: 'contract-test', version: '0' });
  registerTools(server, {});
  const client = new Client({ name: 'contract-test', version: '0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try { await work(client); }
  finally { await client.close(); await server.close(); }
}

test('MCP callers receive bounded typed throttling details without upstream bodies', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ code: '1000', message: 'private coordinate dump' }, { status: 429 });
  try {
    await connected(async client => {
      const result = await client.callTool({ name: 'read_article', arguments: {
        data_gu: '1988-09-12', codice_redazionale: '088G0458', articolo: 13,
      } });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.error.category, 'rate_limited');
      assert.equal(result.structuredContent.error.retryability, true);
      assert.equal(result.content[0].text.includes('private coordinate dump'), false);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('impossible calendar dates fail locally with a typed caller error', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; throw new Error('must not contact upstream'); };
  try {
    await connected(async client => {
      const result = await client.callTool({ name: 'read_article', arguments: {
        data_gu: '2025-02-29', codice_redazionale: '088G0458', articolo: 13,
      } });
      assert.equal(result.structuredContent.error.category, 'invalid_input');
      assert.equal(result.structuredContent.error.code, 'invalid_calendar_date');
    });
    assert.equal(attempts, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('a well-formed lookup with inconclusive official evidence is unresolved', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: false, message: 'non trovato' });
  try {
    await connected(async client => {
      const result = await client.callTool({ name: 'read_article', arguments: {
        data_gu: '1988-09-12', codice_redazionale: '088G0458', articolo: 13,
      } });
      const data = result.structuredContent;
      assert.equal(data.outcome, 'unresolved');
      assert.equal('found' in data, false);
      assert.equal('content' in data, false);
      assert.equal(JSON.parse(result.content[0].text).outcome, data.outcome);
    });
  } finally { globalThis.fetch = originalFetch; }
});
