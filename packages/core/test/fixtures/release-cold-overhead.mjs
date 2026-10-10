// Process-cold paired ordinary reads against truthful stage 2. No network.
// Usage: node .../release-cold-overhead.mjs BASELINE_DIST
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { publication, signingKey, installTraversalBoundary } from './traversal-upstream.mjs';
import { installAuthenticatedReadingBoundary } from './release-authenticated-upstream.mjs';
const baseline = process.argv[2], revision = ['baseline', 'current'].includes(process.argv[3]) ? process.argv[3] : undefined;
const authenticated = process.argv.includes('--authenticated');
if (revision) {
  const { ActTraversal } = await import(revision === 'baseline'
    ? pathToFileURL(join(baseline, 'traversal.js')) : new URL('../../dist/traversal.js', import.meta.url));
  const { jsonContent } = await import(revision === 'baseline'
    ? pathToFileURL(join(baseline, 'serialization.js')) : new URL('../../dist/serialization.js', import.meta.url));
  installTraversalBoundary();
  let actLocator;
  if (authenticated) {
    installAuthenticatedReadingBoundary();
    if (revision === 'current') actLocator = process.argv[5];
    if (revision === 'current') assert.ok(actLocator?.startsWith('a2_'));
  }
  const boundary = globalThis.fetch; let attempts = 0, fixtureMs = 0;
  globalThis.fetch = async (...args) => {
    attempts++; const started = performance.now();
    try { return await boundary(...args); } finally { fixtureMs += performance.now() - started; }
  };
  const started = performance.now(), reader = new ActTraversal({ signingKey });
  const value = await reader.readArticle({ act_locator: actLocator ?? reader.actLocator(publication),
    article_reference: '13', snapshot_date: '2026-10-02' });
  const bytes = Buffer.byteLength(JSON.stringify(jsonContent(value)));
  assert.equal(value.content.text, 'Art. 13. Fixture text 13.');
  assert.equal(attempts, 1);
  console.log(JSON.stringify({ elapsed_ms: performance.now() - started, fixture_upstream_ms: fixtureMs,
    serialized_bytes: bytes, attempts, max_rss_kib: process.resourceUsage().maxRSS }));
} else {
  const exec = promisify(execFile), blocks = [];
  let authenticatedLocator;
  if (authenticated) {
    // Issue once in the parent, so neither measured fresh process is warmed
    // by discovery/Response construction before its first reading call.
    installTraversalBoundary(); installAuthenticatedReadingBoundary();
    const { ActDiscovery } = await import('../../dist/index.js');
    const found = await new ActDiscovery({ signingKey }).findActs({ request: 'decreto legislativo 267/2000' });
    authenticatedLocator = found.traversal.items[0].act_locator;
  }
  for (let repetition = 0; repetition < 30; repetition++) {
    const block = {};
    for (const name of repetition % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
      const started = performance.now();
      const { stdout } = await exec(process.execPath, [fileURLToPath(import.meta.url), baseline, name,
        ...(authenticated ? ['--authenticated', authenticatedLocator] : [])]);
      block[name] = { ...JSON.parse(stdout), process_wall_ms: performance.now() - started };
    }
    if (!authenticated) assert.equal(block.current.serialized_bytes, block.baseline.serialized_bytes);
    blocks.push(block);
  }
  const median = values => values.toSorted((a,b) => a-b)[Math.floor(values.length / 2)];
  const increase = (median(blocks.map(b => b.current.elapsed_ms)) / median(blocks.map(b => b.baseline.elapsed_ms)) - 1) * 100;
  console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version, baseline_revision: '3f75ff5',
    reference_basis: authenticated ? 'Truthful editorial-code baseline versus current discovery-authenticated reference, same publication and article. Discovery preparation is outside read timings; larger actual reference bytes are included.' : 'Same legacy locator on both revisions.',
    scope: '30 alternating fresh-process pairs, same fixture content and full MCP serialization. In-read fixture response construction shown separately; zero actual network or queue latency.',
    blocks, median_increase_percent: increase, target_percent: 10, gate: increase <= 10 ? 'passed' : 'failed' }, null, 2));
  if (increase > 10) process.exitCode = 1;
}
