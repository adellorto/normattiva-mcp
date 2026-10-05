import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools, ActTraversal } from '../dist/index.js';
import { signingKey } from './fixtures/traversal-upstream.mjs';

async function connected(work) {
  const server = new McpServer({ name: 'public-contract', version: '0' });
  registerTools(server, { signingKey });
  const client = new Client({ name: 'public-contract', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try { await work(client); } finally { await client.close(); await server.close(); }
}

test('default registration exposes focused discovery and locator reading without legacy grammar', async () => {
  await connected(async client => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['find_acts', 'continue_acts', 'list_articles', 'read_article', 'read_act', 'recent_updates']);
    for (const tool of tools.filter(t => t.name !== 'recent_updates')) {
      for (const legacy of ['data_gu', 'codice_redazionale', 'articolo', 'sotto_articolo', 'id_gruppo', 'page', 'per_page', 'articolo_da', 'format']) {
        assert.equal(legacy in tool.inputSchema.properties, false, `${tool.name}: ${legacy}`);
      }
    }
  });
});

test('default servers require explicit stable trust and never print malformed key material', () => {
  const original = process.env.NORMATTIVA_REFERENCE_KEY;
  try {
    for (const value of [undefined, 'private-invalid-key', 'a'.repeat(63), 'z'.repeat(64)]) {
      if (value === undefined) delete process.env.NORMATTIVA_REFERENCE_KEY;
      else process.env.NORMATTIVA_REFERENCE_KEY = value;
      const server = new McpServer({ name: 'trust-test', version: '0' });
      assert.throws(() => registerTools(server), error =>
        error.detail?.code === 'reference_trust_unconfigured' && !error.message.includes('private-invalid-key'));
    }
    process.env.NORMATTIVA_REFERENCE_KEY = signingKey.toString('hex');
    registerTools(new McpServer({ name: 'configured-trust', version: '0' }));
  } finally {
    if (original === undefined) delete process.env.NORMATTIVA_REFERENCE_KEY;
    else process.env.NORMATTIVA_REFERENCE_KEY = original;
  }
});

test('removed coordinate fields cannot silently modify a valid replacement call', async () => {
  const original = globalThis.fetch; let attempts = 0;
  globalThis.fetch = async () => { attempts++; throw new Error('unexpected upstream traffic'); };
  try {
    await connected(async client => {
      const error = await client.callTool({ name: 'read_article', arguments: {
        act_locator: new ActTraversal({ signingKey }).actLocator({ data_gu: '2000-09-28', codice_redazionale: '000G0304' }),
        article_reference: '13', data_vigenza: '2025-01-01',
      } });
      assert.equal(error.isError, true);
    });
    assert.equal(attempts, 0);
  } finally { globalThis.fetch = original; }
});

test('opt-in research discovers headings, bounds reads and discloses actual coverage', async () => {
  const { registerPrompts, registerResources } = await import('../dist/index.js');
  const server = new McpServer({ name: 'guidance-contract', version: '0' });
  registerPrompts(server, {}); registerResources(server, {});
  const client = new Client({ name: 'guidance-contract', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try {
    const research = await client.getPrompt({ name: 'ricerca-articolo', arguments: { argomento: 'privacy' } });
    const text = research.messages[0].content.text;
    for (const required of ['find_acts', 'list_articles', 'article_locator', '10', 'letti', 'copertura', 'cursor']) assert.ok(text.includes(required), required);
    assert.equal(text.includes('search_acts'), false);
    const monitoring = await client.getPrompt({ name: 'monitoraggio-modifiche', arguments: { giorni: '7' } });
    assert.ok(monitoring.messages[0].content.text.includes('find_acts'));
    assert.equal(monitoring.messages[0].content.text.includes('search_acts'), false);
    for (const resource of (await client.listResources()).resources) assert.equal(resource.description.includes('search_acts'), false);
  } finally { await client.close(); await server.close(); }
});

test('uncertain currentness and exact-occurrence requirements have actionable situational explanations', async () => {
  const original = globalThis.fetch;
  await import('./fixtures/public-upstream.mjs');
  try {
    await connected(async client => {
      const page = await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } });
      assert.match(page.structuredContent.explanation, /current.*unknown/i);
      const act_locator = page.structuredContent.traversal.items[0].act_locator;
      const unresolved = await client.callTool({ name: 'read_article', arguments: { act_locator, article_reference: '13 bis' } });
      assert.equal(unresolved.structuredContent.outcome, 'unresolved');
      assert.match(unresolved.structuredContent.evidence[0].explanation, /list_articles.*article_locator/);
    });
  } finally { globalThis.fetch = original; }
});

test('malformed update identities remain upstream errors rather than invalid caller locators', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ numeroAttiTrovati: 1, listaAtti: [{ titoloAtto: 'No publication identity' }] });
  try {
    await connected(async client => {
      const result = await client.callTool({ name: 'recent_updates', arguments: { data_inizio: '2026-10-01', data_fine: '2026-10-02' } });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.error.category, 'upstream_failure');
      assert.equal(result.structuredContent.error.code, 'malformed_upstream_response');
    });
  } finally { globalThis.fetch = original; }
});

test('the live TUEL detail without editorial identity remains unresolved rather than proving absence', async () => {
  const original = globalThis.fetch;
  const capture = gunzipSync(readFileSync(new URL('./fixtures/acts/tuel-direct-2026-10-05.json.gz', import.meta.url))).toString();
  globalThis.fetch = async () => new Response(capture, { headers: { 'Content-Type': 'application/json' } });
  try {
    await connected(async client => {
      const result = await client.callTool({ name: 'read_article', arguments: {
        act_locator: new ActTraversal({ signingKey }).actLocator({ data_gu: '2000-09-28', codice_redazionale: '000G0304' }),
        article_reference: '13', snapshot_date: '2026-10-02',
      } });
      assert.equal(result.structuredContent.outcome, 'unresolved');
      assert.equal(result.structuredContent.reason, 'source_identity_conflict');
      assert.equal(result.structuredContent.content, undefined);
      assert.equal(result.structuredContent.absence_basis, undefined);
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    });
  } finally { globalThis.fetch = original; }
});
