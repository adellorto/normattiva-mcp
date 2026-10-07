// Paced official captures replayed at the accepted production traversal seam.
// These rejected sources yield no useful page; timings are failure measurements.
import assert from 'node:assert/strict';
import { createReadStream, readFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { ActTraversal } from '../../dist/index.js';
import { UpstreamRuntime } from '../../dist/upstream.js';
import { jsonContent } from '../../dist/serialization.js';

const mode = process.argv[2] ?? 'historical';
assert.ok(['historical', 'current', 'original', 'current-as-historical'].includes(mode));
const base = new URL('../../../../docs/implementation/historical-attachment-controls/', import.meta.url);
const saved = path => new URL(path, base);
const discovery = JSON.parse(readFileSync(saved('dpr151-2014-01-01/manifest.json')))
  .results.find(row => row.operation === 'find_acts').result;
const act_locator = discovery.traversal.items[0].act_locator;
const date = mode === 'current' ? '2026-10-07' : mode === 'original' ? '2012-01-01' : '2014-01-01';
const corpus = mode === 'historical' || mode === 'current-as-historical'
  ? '011G0193-2014-01-01' : `011G0193-${date}`;
const xmlCorpus = mode === 'current-as-historical' ? '011G0193-2026-10-07' : corpus;
const expectedCode = mode === 'original' ? 'source_identity_conflict'
  : mode === 'current-as-historical' ? 'snapshot_conflict' : 'source_content_conflict';
let sourceBytes = 0;
const attempts = [];
globalThis.fetch = async (url, init) => {
  // No guessed detail envelopes: a missing independent control is an error.
  assert.equal(init?.body, undefined, 'The rejected first control should precede API details');
  const isXml = String(url).includes('caricaAKN');
  const file = `${isXml ? xmlCorpus : corpus}/capture-${isXml ? 2 : 1}.gz`;
  const record = { url: String(url), file, decoded_bytes: 0 };
  attempts.push(record);
  const stream = createReadStream(saved(file)).pipe(createGunzip());
  stream.on('data', bytes => { sourceBytes += bytes.length; record.decoded_bytes += bytes.length; });
  return new Response(Readable.toWeb(stream));
};
const calls = [], runtime = new UpstreamRuntime(), run = runtime.call.bind(runtime);
runtime.call = (kind, signal, work) => run(kind, signal, async scope => {
  const at = performance.now(), before = sourceBytes;
  try { return await work(scope); }
  finally {
    const elapsed_ms = performance.now() - at;
    calls.push({ elapsed_ms, attempts: scope.attempts, decoded_bytes: sourceBytes - before,
      queue_ms: scope.queueMs, upstream_ms: scope.upstreamMs,
      residual_local_ms: Math.max(0, elapsed_ms - scope.queueMs - scope.upstreamMs) });
  }
});
const reader = new ActTraversal({ signingKey: Buffer.alloc(32, 8), upstream: runtime });
const measurements = [];
for (const [phase, method] of [['cold-index', 'listArticles'], ['repeat-index', 'listArticles'], ['cold-reading', 'readAct']]) {
  const at = performance.now();
  await assert.rejects(reader[method]({ act_locator, snapshot_date: date }), error => {
    assert.equal(error.detail.code, expectedCode);
    const envelope = jsonContent({ error: error.detail });
    const serialized_bytes = Buffer.byteLength(JSON.stringify(envelope));
    assert.ok(serialized_bytes <= 128 * 1024);
    measurements.push({ phase, time_to_typed_failure_ms: performance.now() - at,
      error: error.detail, serialized_bytes, returned_items: 0, useful_page: false });
    return true;
  });
}
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version, mode,
  production_revision: 'd0e1d836cf530684dc5f43300fc341d7235760fc',
  source_basis: 'Unmodified captured official portal/XML with independently captured exact-discovery identity; streamed replay, no network.',
  snapshot_date: date, measurements, calls, attempts, decoded_source_bytes: sourceBytes,
  cold_first_useful_page_ms: null, cached_first_useful_page_ms: null, complete_traversal_ms: null,
  cache_status: 'Source rejected before verified cache insertion; repeat-index is not a cached useful-page benchmark.',
  max_rss_kib: process.resourceUsage().maxRSS,
  failure_workload_memory_target: process.resourceUsage().maxRSS <= 256 * 1024 ? 'passed' : 'failed',
  full_historical_traversal_gate: 'incomplete', full_official_attachment_gate: 'incomplete' }, null, 2));
