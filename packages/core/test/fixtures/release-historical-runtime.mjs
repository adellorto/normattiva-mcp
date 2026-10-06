// Captured historical first occurrence, with explicit fixture coverage limits.
// No fabricated independent details for the rest of this historical inventory.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parse, serialize } from 'parse5';
import { ActTraversal } from '../../dist/index.js';
import { UpstreamRuntime } from '../../dist/upstream.js';
import { jsonContent } from '../../dist/serialization.js';
import { signingKey } from './traversal-upstream.mjs';
const saved = name => gunzipSync(readFileSync(new URL('./acts/' + name, import.meta.url))).toString();
const portal = saved('privacy-2017-01-01-AKN-V-portal.html.gz'), xml = saved('privacy-historical.xml.gz');
function* walk(node) { yield node; for (const child of node.childNodes ?? []) yield* walk(child); }
const nodes = [...walk(parse(portal))];
const body = nodes.find(n => n.attrs?.some(a => a.name === 'class' && a.value === 'bodyTesto'));
const from = nodes.find(n => n.attrs?.some(a => a.name === 'id' && a.value === 'artInizio'));
const start = from.childNodes.map(n => n.value ?? '').join('').trim().split('-').reverse()
  .map((value, i) => value.padStart(i === 0 ? 4 : 2, '0')).join('');
let bodyBytes = 0, calls = [], currentXml = xml;
globalThis.fetch = async (url, init) => {
  let response;
  if (!init?.body) response = new Response(String(url).includes('caricaAKN') ? currentXml : portal);
  else if (JSON.parse(init.body).idArticolo === 1) response = Response.json({ success: true, data: { atto: {
    sottoTitolo: '(003G0218)', annoGU: 2003, meseGU: 7, giornoGU: 29,
    articoloHtml: serialize(body), articoloDataInizioVigenza: start, articoloDataFineVigenza: '99999999',
  } } });
  else response = new Response('No independent historical fixture for this occurrence', { status: 404 });
  bodyBytes += Buffer.byteLength(await response.clone().text());
  return response;
};
const runtime = new UpstreamRuntime(), run = runtime.call.bind(runtime);
runtime.call = (kind, signal, work) => run(kind, signal, async scope => {
  const started = performance.now();
  try { return await work(scope); }
  finally { calls.push({ elapsed_ms: performance.now() - started, attempts: scope.attempts,
    queue_ms: scope.queueMs, upstream_ms: scope.upstreamMs }); }
});
const reader = new ActTraversal({ signingKey, upstream: runtime });
const act_locator = reader.actLocator({ data_gu: '2003-07-29', codice_redazionale: '003G0218' });
const args = { act_locator, snapshot_date: '2017-01-01', page_size: 1 }, started = performance.now();
const first = await reader.listArticles(args), firstUsefulMs = performance.now() - started;
assert.equal(first.traversal.items[0].label, '1');
const article = await reader.readArticle({ article_locator: first.traversal.items[0].article_locator });
assert.equal(article.outcome, 'found'); assert.equal(article.progress, 'complete');
assert.match(article.content.text, /Chiunque ha diritto alla protezione/);
const cachedAt = performance.now(); const cached = await reader.listArticles(args); const cachedMs = performance.now() - cachedAt;
let remainingError;
await assert.rejects(reader.listArticles({ cursor: first.traversal.cursor }), error => {
  remainingError = error.detail;
  return error.detail.code === 'upstream_http_error';
});
reader.evict();
const evictedAt = performance.now(); const evicted = await reader.listArticles(args); const evictedMs = performance.now() - evictedAt;
reader.evict(); currentXml = saved('privacy-export-date-control.xml.gz');
await assert.rejects(reader.listArticles(args), error => error.detail.code === 'snapshot_conflict');
const pages = [first, article, cached, evicted].map(value => ({ serialized_bytes: Buffer.byteLength(JSON.stringify(jsonContent(value))),
  returned_items: value.traversal?.items.length ?? 1, progress: value.traversal?.progress ?? value.progress }));
assert.ok(pages.every(page => page.serialized_bytes <= 128 * 1024));
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
  scope: 'Captured historical Privacy article 1 and portal/XML. Remaining independent detail captures unavailable: full traversal is explicitly incomplete. Export with forged/request root date is rejected.',
  first_useful_ms: firstUsefulMs, cached_first_page_ms: cachedMs, evicted_first_page_ms: evictedMs,
  total_ms: performance.now() - started, acquisition_bytes: bodyBytes, calls, pages, remaining_fixture_error: remainingError,
  max_rss_kib: process.resourceUsage().maxRSS, full_historical_traversal_gate: 'incomplete',
  measured_first_occurrence_gate: process.resourceUsage().maxRSS <= 256 * 1024 ? 'passed' : 'failed' }, null, 2));
