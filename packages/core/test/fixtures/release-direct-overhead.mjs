// Compare truthful stage-2 direct reading with the current replacement interface.
// Argument: compiled baseline core directory, prepared from git archive 3f75ff5.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { ActTraversal, ActDiscovery } from '../../dist/index.js';
import { jsonContent } from '../../dist/serialization.js';
import { installTraversalBoundary, publication, signingKey } from './traversal-upstream.mjs';
import { installAuthenticatedReadingBoundary } from './release-authenticated-upstream.mjs';

const { ActTraversal: Baseline } = await import(pathToFileURL(join(process.argv[2], 'traversal.js')));
installTraversalBoundary();
const baseline = new Baseline({ signingKey }), current = new ActTraversal({ signingKey });
const args = { act_locator: current.actLocator(publication), article_reference: '13', snapshot_date: '2026-10-02' };
const baselineArgs = { ...args };
const authenticated = process.argv[3] === 'authenticated';
if (authenticated) {
  installAuthenticatedReadingBoundary();
  const found = await new ActDiscovery({ signingKey }).findActs({ request: 'decreto legislativo 267/2000' });
  args.act_locator = found.traversal.items[0].act_locator;
}
let requests = 0;
const fetch = globalThis.fetch;
globalThis.fetch = (...args) => { requests++; return fetch(...args); };
function normalize(value) {
  const copy = structuredClone(value);
  if (authenticated) copy.requested.act_locator = '<same exact publication>';
  for (const evidence of copy.evidence) evidence.checked_at = '<same acquisition time>';
  return copy;
}
assert.deepEqual(normalize(await baseline.readArticle(baselineArgs)), normalize(await current.readArticle(args)));
async function batch(reader, count) {
  const started = performance.now();
  for (let i = 0; i < count; i++) jsonContent(await reader.readArticle(reader === baseline ? baselineArgs : args));
  return (performance.now() - started) / count;
}
await batch(baseline, 100); await batch(current, 100);
const blocks = [];
for (let block = 0; block < 30; block++) {
  let before, after;
  if (block % 2) { after = await batch(current, 50); before = await batch(baseline, 50); }
  else { before = await batch(baseline, 50); after = await batch(current, 50); }
  blocks.push({ baseline_ms_per_read: before, current_ms_per_read: after, increase_percent: (after / before - 1) * 100 });
}
const median = values => values.toSorted((a,b) => a-b)[Math.floor(values.length / 2)];
const increase = (median(blocks.map(b => b.current_ms_per_read)) / median(blocks.map(b => b.baseline_ms_per_read)) - 1) * 100;
assert.equal(requests, 3202); // Equal work: every healthy read uses one external request.
console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
  baseline_revision: '3f75ff5', scope: 'Same truthful found content/schema, fixture upstream, paired alternating warm batches with full MCP serialization. No upstream network latency.',
  reference_basis: authenticated ? 'Baseline verified editorial-code a1 versus current discovery-authenticated a2, same exact publication/content. Full actual reference bytes count in serialization.' : 'Identical legacy publication locator on both revisions.',
  reads_per_revision: 1601, blocks, median_increase_percent: increase, target_percent: 10,
  gate: increase <= 10 ? 'passed' : 'failed', total_requests: requests, max_rss_kib: process.resourceUsage().maxRSS }, null, 2));
if (increase > 10) process.exitCode = 1;
