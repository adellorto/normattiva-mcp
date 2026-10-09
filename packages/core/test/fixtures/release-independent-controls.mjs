// Paced official captures replayed at the accepted production traversal seam.
// The rendered first occurrence plus fourteen exact direct details fit the
// accepted sixteen-attempt composed-call budget for each complete snapshot.
import assert from 'node:assert/strict';
import { createReadStream, readFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { ActTraversal } from '../../dist/index.js';
import { UpstreamRuntime } from '../../dist/upstream.js';
import { jsonContent } from '../../dist/serialization.js';

const mode = process.argv[2] ?? 'historical';
const configurations = {
  historical: { date: '2014-01-01', corpus: '011G0193-2014-01-01', xmlCorpus: '011G0193-2014-01-01' },
  current: { date: '2026-10-07', corpus: '011G0193-2026-10-07', xmlCorpus: '011G0193-2026-10-07' },
  original: { date: '2012-01-01', corpus: '011G0193-2012-01-01', xmlCorpus: '011G0193-2012-01-01',
    expectedCode: 'source_identity_conflict' },
  'current-as-historical': { date: '2014-01-01', corpus: '011G0193-2014-01-01', xmlCorpus: '011G0193-2026-10-07',
    expectedCode: 'snapshot_conflict' },
};
assert.ok(Object.hasOwn(configurations, mode));
const { date, corpus, xmlCorpus, expectedCode } = configurations[mode];
const base = new URL('../../../../docs/implementation/historical-attachment-controls/', import.meta.url);
const saved = path => new URL(path, base);
const discovery = JSON.parse(readFileSync(saved('dpr151-2014-01-01/manifest.json')))
  .results.find(row => row.operation === 'find_acts').result;
const act_locator = discovery.traversal.items[0].act_locator;

const detailDirectories = [
  'independent-details-2026-10-09T10-56-21.125Z',
  'independent-details-2026-10-09T10-57-56.003Z',
];
const detailKey = request => [request.dataVigenza, request.idArticolo, request.sottoArticolo,
  request.sottoArticolo1, request.flagTipoArticolo, request.idGruppo, request.progressivo,
  request.versione].join(':');
const details = new Map();
for (const directory of detailDirectories) {
  const manifest = JSON.parse(readFileSync(saved(`${directory}/manifest.json`)));
  for (const capture of manifest.captures) {
    assert.equal(capture.status, 200);
    assert.ok(capture.file && !capture.failure);
    details.set(detailKey(capture.request), { directory, capture });
  }
}
assert.equal(details.size, 28);

let sourceBytes = 0;
const attempts = [];
globalThis.fetch = async (url, init) => {
  let file;
  if (init?.body) {
    const request = JSON.parse(init.body);
    const detail = details.get(detailKey(request));
    assert.ok(detail, `No independent direct detail for ${detailKey(request)}`);
    file = `${detail.directory}/${detail.capture.file}`;
  } else {
    const isXml = String(url).includes('caricaAKN');
    file = `${isXml ? xmlCorpus : corpus}/capture-${isXml ? 2 : 1}.gz`;
  }
  const record = { url: String(url), file, decoded_bytes: 0 };
  attempts.push(record);
  const stream = createReadStream(saved(file)).pipe(createGunzip());
  stream.on('data', bytes => { sourceBytes += bytes.length; record.decoded_bytes += bytes.length; });
  return new Response(Readable.toWeb(stream));
};

const calls = [];
const runtime = new UpstreamRuntime();
const run = runtime.call.bind(runtime);
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

const pages = [];
async function measure(phase, work) {
  const at = performance.now();
  const value = await work();
  const elapsed_ms = performance.now() - at;
  const serialized_bytes = Buffer.byteLength(JSON.stringify(jsonContent(value)));
  assert.ok(serialized_bytes <= 128 * 1024);
  pages.push({ phase, elapsed_ms, serialized_bytes,
    returned_items: value.traversal.items.length, progress: value.traversal.progress });
  return { value, elapsed_ms };
}

if (expectedCode) {
  const reader = new ActTraversal({ signingKey: Buffer.alloc(32, 8), upstream: runtime });
  const at = performance.now();
  let failure;
  await assert.rejects(reader.listArticles({ act_locator, snapshot_date: date, page_size: 1 }), error => {
    assert.equal(error.detail.code, expectedCode);
    failure = { phase: 'cold-index', time_to_typed_failure_ms: performance.now() - at,
      error: error.detail, serialized_bytes: Buffer.byteLength(JSON.stringify(jsonContent({ error: error.detail }))) };
    return true;
  });
  console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version, mode,
    candidate_baseline: '676e47ebc6096bbb22b2cd428d6221e95c8d2720', snapshot_date: date,
    source_basis: 'Unmodified captured official portal/XML negative control; streamed replay, no network.',
    measurements: [failure], calls, attempts, decoded_source_bytes: sourceBytes,
    full_historical_traversal_gate: 'incomplete', full_official_attachment_gate: 'incomplete' }, null, 2));
} else {
  const indexReader = new ActTraversal({ signingKey: Buffer.alloc(32, 8), upstream: runtime });
  const coldIndex = await measure('cold-index-first-page', () => indexReader.listArticles({
    act_locator, snapshot_date: date, page_size: 15,
  }));
  assert.equal(coldIndex.value.traversal.items[0].label, '1');
  assert.equal(coldIndex.value.traversal.progress, 'complete', JSON.stringify(coldIndex.value.traversal.failure));
  assert.equal(coldIndex.value.traversal.items.length, 15);
  const cachedIndex = await measure('cached-index-first-page', () => indexReader.listArticles({
    act_locator, snapshot_date: date, page_size: 15,
  }));

  const readingReader = new ActTraversal({ signingKey: Buffer.alloc(32, 8), upstream: runtime });
  const completeStarted = performance.now();
  const coldReading = await measure('cold-reading-first-page', () => readingReader.readAct({
    act_locator, snapshot_date: date, max_chars: 16_000,
  }));
  assert.equal(coldReading.value.traversal.items[0].entry.label, '1');
  assert.equal(coldReading.value.traversal.progress, 'more');
  const cachedReading = await measure('cached-reading-first-page', () => readingReader.readAct({
    act_locator, snapshot_date: date, max_chars: 16_000,
  }));
  assert.equal(cachedReading.value.traversal.cursor, coldReading.value.traversal.cursor);
  let reading = coldReading.value, readingPage = 1;
  const completedOccurrences = [];
  while (true) {
    completedOccurrences.push(...reading.traversal.items
      .filter(item => item.content_complete).map(item => item.entry.label));
    if (reading.traversal.progress === 'complete') break;
    assert.ok(reading.traversal.cursor && readingPage < 200);
    reading = (await measure(`reading-continuation-${readingPage++}`,
      () => readingReader.readAct({ cursor: reading.traversal.cursor }))).value;
  }
  const completeTraversalMs = performance.now() - completeStarted;
  assert.deepEqual(completedOccurrences, coldIndex.value.traversal.items.map(item => item.label));

  const attachment = coldIndex.value.traversal.items.find(item => item.label === 'Allegato I');
  assert.ok(attachment?.attachment_ref);
  const attachmentReader = new ActTraversal({ signingKey: Buffer.alloc(32, 8), upstream: runtime });
  const attachmentStarted = performance.now();
  let attachmentReading = (await measure('attachment-first-useful-page', () => attachmentReader.readAct({
    act_locator, snapshot_date: date, attachment_ref: attachment.attachment_ref, max_chars: 16_000,
  }))).value;
  const attachmentFirstUsefulPageMs = performance.now() - attachmentStarted;
  let attachmentPage = 1;
  while (attachmentReading.traversal.progress !== 'complete') {
    assert.ok(attachmentReading.traversal.cursor && attachmentPage < 200);
    attachmentReading = (await measure(`attachment-continuation-${attachmentPage++}`,
      () => attachmentReader.readAct({ cursor: attachmentReading.traversal.cursor }))).value;
  }
  const attachmentCompleteMs = performance.now() - attachmentStarted;

  readingReader.evict();
  const evictedContinuation = await measure('evicted-reading-continuation', () => readingReader.readAct({
    cursor: coldReading.value.traversal.cursor,
  }));
  assert.equal(evictedContinuation.value.traversal.items[0].entry.label, '1');

  const maxRss = process.resourceUsage().maxRSS;
  const report = { recorded_at: new Date().toISOString(), node: process.version, mode,
    candidate_baseline: '676e47ebc6096bbb22b2cd428d6221e95c8d2720',
    source_basis: 'Unmodified captured official portal/XML and exact direct details with independently captured exact-discovery identity; streamed replay, no network.',
    snapshot_date: date,
    occurrence_set: { expected: 15, source_order_independently_checked: 15, runtime_verified: 15,
      detail_capture_status: 'complete' },
    completed_occurrences: completedOccurrences,
    pages, calls, attempts, decoded_source_bytes: sourceBytes,
    cold_first_useful_page_ms: coldIndex.elapsed_ms,
    cached_first_useful_page_ms: cachedIndex.elapsed_ms,
    cold_reading_first_useful_page_ms: coldReading.elapsed_ms,
    cached_reading_first_useful_page_ms: cachedReading.elapsed_ms,
    evicted_continuation_ms: evictedContinuation.elapsed_ms,
    complete_traversal_ms: completeTraversalMs,
    attachment_first_useful_page_ms: attachmentFirstUsefulPageMs,
    attachment_complete_ms: attachmentCompleteMs,
    max_rss_kib: maxRss,
    memory_target: maxRss <= 256 * 1024 ? 'passed' : 'failed',
    full_historical_traversal_gate: 'passed',
    full_official_attachment_gate: 'passed',
  };
  console.log(JSON.stringify(report, null, 2));
  if (maxRss > 256 * 1024) process.exitCode = 1;
}
