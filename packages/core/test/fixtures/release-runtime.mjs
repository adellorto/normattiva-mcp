// Isolated production-runtime measurements with saved/synthetic upstream controls.
// One workload per process so maxRSS is attributable. No official network traffic.
import assert from 'node:assert/strict';
import { createReadStream, readFileSync } from 'node:fs';
import { createGunzip, gunzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const corePath = process.argv.find(arg => arg.startsWith('--core='))?.slice(7);
const moduleUrl = name => corePath ? pathToFileURL(corePath + '/' + name) : new URL('../../dist/' + name, import.meta.url);
const { ActTraversal } = await import(moduleUrl('index.js'));
const { UpstreamRuntime } = await import(moduleUrl('upstream.js'));
const { jsonContent } = await import(moduleUrl('serialization.js'));
import { signingKey, publication, installTraversalBoundary } from './traversal-upstream.mjs';

const mode = process.argv[2] ?? 'tuel';
const memory = [];
let phase = 'setup';
function sampleMemory() {
  const usage = process.memoryUsage();
  memory.push({ phase, elapsed_ms: performance.now() - started, rss_kib: usage.rss / 1024,
    heap_used_kib: usage.heapUsed / 1024, external_kib: usage.external / 1024,
    max_rss_kib: process.resourceUsage().maxRSS });
}
const calls = [], runtime = new UpstreamRuntime();
let bodyBytes = 0;
const call = runtime.call.bind(runtime);
runtime.call = (kind, signal, work) => call(kind, signal, async scope => {
  const started = performance.now();
  try { return await work(scope); }
  finally { calls.push({ elapsed_ms: performance.now() - started, attempts: scope.attempts,
    queue_ms: scope.queueMs, upstream_ms: scope.upstreamMs }); }
});
const saved = name => new URL('./acts/' + name, import.meta.url);
let pub = publication;
if (mode === 'direct') installTraversalBoundary();
else if (mode === 'tuel' || mode === 'tuel-reading') {
  const controls = JSON.parse(gunzipSync(readFileSync(saved('tuel-details.json.gz'))));
  globalThis.fetch = async (url, init) => {
    if (init?.body) {
      const r = JSON.parse(init.body);
      const value = controls[[r.idArticolo,r.sottoArticolo,r.sottoArticolo1,r.flagTipoArticolo,r.idGruppo,r.progressivo].join(':')];
      bodyBytes += Buffer.byteLength(JSON.stringify(value));
      return Response.json(value);
    }
    const file = String(url).includes('caricaAKN') ? 'tuel-public.xml.gz' : 'tuel-current-portal.html.gz';
    const stream = createReadStream(saved(file)).pipe(createGunzip());
    stream.on('data', value => { bodyBytes += value.byteLength; });
    return new Response(Readable.toWeb(stream));
  };
} else throw new Error('Use direct, tuel or tuel-reading; Civil concurrent parser run has its own fixture.');

const reader = new ActTraversal({ signingKey, upstream: runtime });
const act_locator = reader.actLocator(pub), snapshot_date = '2026-10-02';
const pages = [], started = performance.now();
sampleMemory();
const sampler = process.argv.includes('--profile-memory') ? setInterval(sampleMemory, 10) : undefined;
function page(value) {
  sampleMemory();
  const result = jsonContent(value);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 128 * 1024);
  pages.push({ serialized_bytes: Buffer.byteLength(JSON.stringify(result)),
    content_sha256: createHash('sha256').update(JSON.stringify(value, (key, value) => key === 'checked_at' ? '<acquisition time>' : value)).digest('hex'),
    items: value.traversal?.items.length ?? 1, progress: value.traversal?.progress ?? value.progress,
    elapsed_ms: performance.now() - started });
}
if (mode === 'direct') {
  for (let i = 0; i < 2000; i++) {
    const result = await reader.readArticle({ act_locator, article_reference: '13', snapshot_date });
    assert.equal(result.content.text, 'Art. 13. Fixture text 13.'); page(result);
  }
  assert.ok(calls.every(c => c.attempts === 1));
} else {
  const method = mode === 'tuel-reading' ? 'readAct' : 'listArticles';
  phase = 'cold-first-page';
  let result = await reader[method]({ act_locator, snapshot_date });
  const labels = [];
  while (true) {
    page(result); labels.push(...result.traversal.items.filter(e => mode !== 'tuel-reading' || e.content_complete).map(e => mode === 'tuel-reading' ? e.entry.article_locator : e.label));
    if (result.traversal.progress === 'complete') break;
    assert.ok(result.traversal.cursor); assert.ok(pages.length < 1000);
    phase = 'reading-continuation';
    result = await reader[method]({ cursor: result.traversal.cursor });
  }
  assert.equal(labels.length, 295);
  if (mode === 'tuel-reading') assert.equal(new Set(labels).size, 295);
  else assert.equal(labels.at(-1), '275');
  // Cached first page, then explicit eviction and reacquisition with old cursor.
  phase = 'cached-first-page';
  page(await reader[method]({ act_locator, snapshot_date }));
  phase = 'cached-small-page';
  const cursor = (await reader[method]({ act_locator, snapshot_date, ...(mode === 'tuel-reading' ? { max_chars: 4 } : { page_size: 1 }) })).traversal.cursor;
  reader.evict();
  phase = 'evicted-continuation';
  page(await reader[method]({ cursor }));
}
clearInterval(sampler);
sampleMemory();
const sorted = calls.map(c => c.elapsed_ms).sort((a,b) => a-b);
const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version, workload: mode,
  source_basis: mode.startsWith('tuel') ? 'Captured TUEL XML/portal; synthetic independently rendered details, not live historical API evidence.' : 'Synthetic ordinary article.',
  calls, pages, memory, total_ms: performance.now() - started, body_bytes: bodyBytes,
  attempts: calls.reduce((n,c) => n+c.attempts,0), max_rss_kib: process.resourceUsage().maxRSS,
  median_ms: percentile(.5), p95_ms: percentile(.95), p99_ms: percentile(.99),
  memory_target_kib: 256 * 1024, memory_gate: process.resourceUsage().maxRSS <= 256 * 1024 ? 'passed' : 'failed' }, null, 2));
if (process.resourceUsage().maxRSS > 256 * 1024) process.exitCode = 1;
