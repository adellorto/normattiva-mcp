// Large within-attachment/table paging through the production TypeScript seam.
// Independent synthetic literal controls; not live legal or historical evidence.
import assert from 'node:assert/strict';
import { ActTraversal } from '../../dist/index.js';
import { UpstreamRuntime } from '../../dist/upstream.js';
import { jsonContent } from '../../dist/serialization.js';
import { publication, signingKey, installTraversalBoundary } from './traversal-upstream.mjs';
installTraversalBoundary();
const boundary = globalThis.fetch;
const portal = await (await boundary('https://www.normattiva.it/fixture')).text();
const xml = await (await boundary('https://www.normattiva.it/caricaAKN')).text();
const firstCell = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(4096), secondCell = '0123456789'.repeat(4096);
const table = `<table><tr><th rowspan="2">Header</th><th colspan="2">Rates</th></tr><tr><td>${firstCell}</td><td>${secondCell}</td></tr></table><p>Tail.</p>`;
const attachment = `<attachments><attachment><doc name="Tariff table"><meta><identification><FRBRExpression><FRBRdate date="2020-01-01"/></FRBRExpression></identification></meta><mainBody>${table}</mainBody></doc></attachment></attachments>`;
const nav = `<a class="numero_articolo" onclick="showArticle('/atto/caricaArticolo?art.idArticolo=900&amp;art.idSottoArticolo=1&amp;art.idSottoArticolo1=0&amp;art.flagTipoArticolo=0&amp;art.idGruppo=0&amp;art.progressivo=0&amp;art.versione=1&amp;art.codiceRedazionale=000G0304&amp;art.dataPubblicazioneGazzetta=2000-09-28')">Tariff table</a>`;
let bodyBytes = 0;
globalThis.fetch = async (url, init) => {
  let response;
  if (String(url).includes('caricaAKN')) response = new Response(xml.replace('</act>', attachment + '</act>'));
  else if (String(url).startsWith('https://www.normattiva.it/')) response = new Response(portal + nav);
  else if (JSON.parse(init.body).idArticolo === 900) response = Response.json({ success: true, data: { atto: {
    sottoTitolo: '(000G0304)', annoGU: 2000, meseGU: 9, giornoGU: 28,
    articoloHtml: table, articoloDataInizioVigenza: '20200101', articoloDataFineVigenza: '99999999',
  } } });
  else response = await boundary(url, init);
  bodyBytes += Buffer.byteLength(await response.clone().text());
  return response;
};
const runtime = new UpstreamRuntime(), calls = [], run = runtime.call.bind(runtime);
runtime.call = (kind, signal, work) => run(kind, signal, async scope => {
  const started = performance.now();
  try { return await work(scope); }
  finally { calls.push({ elapsed_ms: performance.now() - started, attempts: scope.attempts,
    queue_ms: scope.queueMs, upstream_ms: scope.upstreamMs }); }
});
const reader = new ActTraversal({ signingKey, upstream: runtime });
const act_locator = reader.actLocator(publication), snapshot_date = '2026-10-02';
const started = performance.now(), pages = [], segments = [];
const index = await reader.listArticles({ act_locator, snapshot_date });
assert.equal(index.traversal.progress, 'complete');
const entry = index.traversal.items.find(item => item.kind === 'attachment');
assert.ok(entry?.attachment_ref);
const args = { act_locator, snapshot_date, attachment_ref: entry.attachment_ref, max_chars: 4000 };
let result = await reader.readAct(args);
const firstCursor = result.traversal.cursor;
while (true) {
  const bytes = Buffer.byteLength(JSON.stringify(jsonContent(result)));
  assert.ok(bytes <= 128 * 1024);
  pages.push({ serialized_bytes: bytes, elapsed_ms: performance.now() - started,
    progress: result.traversal.progress, items: result.traversal.items.length });
  segments.push(...result.traversal.items.flatMap(item => item.segments));
  if (result.traversal.progress === 'complete') break;
  assert.equal(result.traversal.progress, 'more');
  assert.ok(pages.length < 100 && result.traversal.cursor);
  result = await reader.readAct({ cursor: result.traversal.cursor });
}
const cells = segments.filter(s => s.kind === 'table').flatMap(s => s.cells);
assert.equal(cells.map(c => c.text).join(''), 'HeaderRates' + firstCell + secondCell);
assert.ok(cells.filter(c => c.row === 0 && c.column === 0).every(c => c.header && c.row_span === 2));
assert.equal(segments.filter(s => s.kind === 'text').map(s => s.text).join(''), 'Tail.');
const cachedAt = performance.now(); await reader.readAct(args); const cachedMs = performance.now() - cachedAt;
reader.evict();
const evictedAt = performance.now(); await reader.readAct({ cursor: firstCursor }); const evictedMs = performance.now() - evictedAt;
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
  source_basis: 'Synthetic 147,467-character table and tail. Clone buffers belong to this small fixture, counted in RSS. Not official full-attachment evidence.',
  pages, calls, acquisition_bytes: bodyBytes, total_ms: performance.now() - started, cached_first_page_ms: cachedMs,
  evicted_continuation_ms: evictedMs, max_rss_kib: process.resourceUsage().maxRSS,
  gate: process.resourceUsage().maxRSS <= 256 * 1024 ? 'passed' : 'failed' }, null, 2));
if (process.resourceUsage().maxRSS > 256 * 1024) process.exitCode = 1;
