import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools, ActTraversal } from '../dist/index.js';
import { signingKey } from './fixtures/traversal-upstream.mjs';

async function connected(work, key = signingKey) {
  const server = new McpServer({ name: 'public-contract', version: '0' });
  registerTools(server, { signingKey: key });
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
    for (const name of ['list_articles', 'read_article', 'read_act']) {
      const description = tools.find(tool => tool.name === name).inputSchema.properties.cursor.description;
      assert.match(description, /opaque/i, name);
      assert.match(description, /case-sensitive/i, name);
      assert.match(description, /exact.*tool result/i, name);
      assert.match(description, /never.*change.*case/i, name);
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

test('independently discovered TUEL identity verifies the captured detail in one request and survives continuation restart', async () => {
  const original = globalThis.fetch;
  const detail = gunzipSync(readFileSync(new URL('./fixtures/acts/tuel-direct-2026-10-05.json.gz', import.meta.url))).toString();
  const search = readFileSync(new URL('./fixtures/discovery/tuel-exact-2026-10-05.json', import.meta.url)).toString();
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(String(url).endsWith('/ricerca/avanzata') ? search : detail, { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    let cursor, prefix;
    await connected(async client => {
      const found = (await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000 articolo 13' } })).structuredContent;
      const before = requests.length;
      const result = await client.callTool({ name: 'read_article', arguments: {
        act_locator: found.traversal.items[0].act_locator, article_reference: '13', snapshot_date: '2026-10-02', max_chars: 4,
      } });
      assert.equal(result.structuredContent.outcome, 'found');
      assert.equal(requests.length, before + 1);
      assert.equal(result.structuredContent.progress, 'more');
      cursor = result.structuredContent.cursor;
      prefix = result.structuredContent.content.text;
    });
    await connected(async client => {
      const before = requests.length;
      const result = (await client.callTool({ name: 'read_article', arguments: { cursor } })).structuredContent;
      assert.equal(result.outcome, 'found');
      assert.equal(requests.length, before + 1);
      assert.equal(prefix + result.content.text, 'Art. 13.');
      assert.equal(result.evidence[0].snapshot_date, '2026-10-02');
    });
  } finally { globalThis.fetch = original; }
});

test('discovery proof rejects conflicting or incomplete detail identity and forged act locators', async () => {
  const original = globalThis.fetch;
  const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/acts/tuel-direct-2026-10-05.json.gz', import.meta.url))));
  const search = readFileSync(new URL('./fixtures/discovery/tuel-exact-2026-10-05.json', import.meta.url)).toString();
  let returned = capture, attempts = 0;
  globalThis.fetch = async url => {
    attempts++;
    return String(url).endsWith('/ricerca/avanzata') ? new Response(search) : Response.json(returned);
  };
  try {
    await connected(async client => {
      const found = (await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } })).structuredContent;
      const act_locator = found.traversal.items[0].act_locator;
      for (const changed of [
        { numeroProvvedimento: 268 }, { giornoProvvedimento: 19 }, { tipoProvvedimentoDescrizione: 'LEGGE' },
        { numeroGU: 228 }, { numeroSupplemento: 163 }, { tipoSupplementoCode: 'SE' }, { numeroProvvedimento: undefined }, { giornoGU: 29 },
        { sottoTitolo: '(999G9999)' },
      ]) {
        // Even a matching editorial subtitle cannot override a conflicting authenticated identity.
        returned = { ...capture, data: { atto: { ...capture.data.atto, sottoTitolo: '(000G0304)', ...changed } } };
        const result = (await client.callTool({ name: 'read_article', arguments: { act_locator, article_reference: '13', snapshot_date: '2026-10-02' } })).structuredContent;
        assert.equal(result.outcome, 'unresolved', JSON.stringify(changed));
        assert.equal(result.reason, 'source_identity_conflict');
        assert.equal(result.content, undefined);
      }
      const before = attempts;
      const forged = act_locator.slice(0, -1) + (act_locator.endsWith('A') ? 'B' : 'A');
      const error = await client.callTool({ name: 'read_article', arguments: { act_locator: forged, article_reference: '13' } });
      assert.equal(error.structuredContent.error.category, 'invalid_locator');
      await assert.rejects(new ActTraversal({ signingKey: Buffer.alloc(32, 99) }).readArticle({ act_locator, article_reference: '13' }),
        error => error.detail.category === 'invalid_locator');
      assert.equal(attempts, before);
    });
  } finally { globalThis.fetch = original; }
});

test('the independently rendered dated TUEL first occurrence verifies its index without discarding API preamble content', async () => {
  const original = globalThis.fetch;
  const saved = name => gunzipSync(readFileSync(new URL('./fixtures/acts/' + name, import.meta.url))).toString();
  const search = readFileSync(new URL('./fixtures/discovery/tuel-exact-2026-10-05.json', import.meta.url)).toString();
  let detailAttempts = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/ricerca/avanzata')) return new Response(search);
    if (String(url).includes('dettaglio-atto')) { detailAttempts++; return new Response(saved('tuel-enactment-direct-2026-10-06.json.gz')); }
    return new Response(saved(String(url).includes('caricaAKN') ? 'tuel-public.xml.gz' : 'tuel-current-portal.html.gz'));
  };
  try {
    await connected(async client => {
      const found = (await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } })).structuredContent;
      const index = (await client.callTool({ name: 'list_articles', arguments: {
        act_locator: found.traversal.items[0].act_locator, snapshot_date: '2026-10-02', page_size: 1,
      } })).structuredContent;
      assert.equal(index.traversal.items[0].label, '1');
      assert.equal(index.traversal.progress, 'more');
      assert.ok(index.snapshot.evidence.some(e => e.source === 'official_detail' && e.official_url.includes('/eli/id/')));
      assert.equal(detailAttempts, 0);
      const read = (await client.callTool({ name: 'read_article', arguments: {
        article_locator: index.traversal.items[0].article_locator,
      } })).structuredContent;
      assert.equal(read.outcome, 'unresolved');
      assert.equal(read.reason, 'source_content_conflict');
      assert.equal(read.content, undefined);
      assert.equal(detailAttempts, 1);
    });
  } finally { globalThis.fetch = original; }
});

test('conflicting content or validity in the dated rendered first occurrence withholds its index', async () => {
  const original = globalThis.fetch;
  const saved = name => gunzipSync(readFileSync(new URL('./fixtures/acts/' + name, import.meta.url))).toString();
  const search = readFileSync(new URL('./fixtures/discovery/tuel-exact-2026-10-05.json', import.meta.url)).toString();
  const page = saved('tuel-current-portal.html.gz');
  try {
    for (const [mutated, code] of [
      [page.replaceAll('composto di 275 articoli', 'composto di 274 articoli'), 'source_content_conflict'],
      [page.replaceAll('13-10-2000', '13-10-2027'), 'snapshot_conflict'],
    ]) {
      assert.notEqual(mutated, page);
      globalThis.fetch = async url => {
        if (String(url).endsWith('/ricerca/avanzata')) return new Response(search);
        assert.equal(String(url).includes('dettaglio-atto'), false, 'source conflict must not trigger another representation');
        return new Response(String(url).includes('caricaAKN') ? saved('tuel-public.xml.gz') : mutated);
      };
      await connected(async client => {
        const found = (await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } })).structuredContent;
        const result = await client.callTool({ name: 'list_articles', arguments: {
          act_locator: found.traversal.items[0].act_locator, snapshot_date: '2026-10-02', page_size: 1,
        } });
        assert.equal(result.isError, true);
        assert.equal(result.structuredContent.error.code, code);
      });
    }
  } finally { globalThis.fetch = original; }
});

test('list_articles exposes a verified compound official rendering without claiming preamble coverage', async () => {
  const base = new URL('../../../docs/implementation/historical-attachment-controls/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('dpr151-2014-01-01/manifest.json', base)));
  const locator = manifest.results.find(row => row.operation === 'find_acts').result.traversal.items[0].act_locator;
  const page = gunzipSync(readFileSync(new URL('011G0193-2014-01-01/capture-1.gz', base))).toString();
  const source = gunzipSync(readFileSync(new URL('011G0193-2014-01-01/capture-2.gz', base))).toString();
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init?.body });
    assert.equal(init?.body, undefined, 'the rendered first occurrence must verify before detail retrieval');
    return new Response(String(url).includes('caricaAKN') ? source : page);
  };
  try {
    await connected(async client => {
      const result = await client.callTool({ name: 'list_articles', arguments: {
        act_locator: locator, snapshot_date: '2014-01-01', page_size: 1,
      } });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.traversal.items[0].label, '1');
      assert.equal(result.structuredContent.traversal.progress, 'more');
      assert.equal(result.structuredContent.coverage.legal_content_complete, false);
      assert.match(result.structuredContent.coverage.explanation, /preamble/i);
      assert.match(result.structuredContent.snapshot.evidence[0].explanation, /explanatory notes/);
    }, Buffer.alloc(32, 8));
    assert.equal(requests.length, 2);
  } finally { globalThis.fetch = original; }
});
