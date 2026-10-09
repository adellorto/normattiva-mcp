// Dry-run by default. --execute resumes the bounded, paced official detail
// acquisition at the exact 18/19 September 2018 boundary.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { captureDetails } from './capture-details.mjs';

const root = new URL('./', import.meta.url);
const provenanceFile = 'release-live-canaries-2026-10-06.json';
const provenance = JSON.parse(readFileSync(new URL(`../${provenanceFile}`, root)));
const retainedManifestFile = 'privacy-boundary-2026-10-09T10-59-26.911Z/manifest.json';
const retained = JSON.parse(readFileSync(new URL(retainedManifestFile, root)));
const terminalManifestFile = 'privacy-boundary-2026-10-09T12-11-29.625Z/manifest.json';
const terminalUrl = new URL(terminalManifestFile, root);
const terminal = existsSync(terminalUrl) ? JSON.parse(readFileSync(terminalUrl)) : undefined;
if (terminal) assert.equal(terminal.outcome, 'complete');
const dates = ['2018-09-18', '2018-09-19'];
const plan = dates.map(date => {
  const matches = provenance.attempts
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.request?.dataVigenza === date
      && row.request.codiceRedazionale === '003G0218'
      && row.request.idArticolo === 1
      && row.http_status === 200);
  assert.equal(matches.length, 1, `Expected one successful retained Privacy detail attempt for ${date}`);
  const [{ row, index }] = matches;
  assert.equal(row.url, 'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto');
  return { name: `privacy-article-1-${date}`, provenance_file: provenanceFile,
    provenance_attempt: index, url: row.url, request: row.request };
});
const [retainedCapture] = retained.captures;
assert.equal(retained.captures.length, 1);
assert.equal(retainedCapture.name, plan[0].name);
assert.equal(retainedCapture.failure, 'UND_ERR_CONNECT_TIMEOUT');
const retainedAttempts = [{ name: retainedCapture.name, attempts: 1,
  lastOutcome: 'transient_failure', failure: retainedCapture.failure }];
const trafficPolicy = { maxAttemptsPerCoordinate: 3, maxNewRequests: 5,
  transientCircuitBreaker: 3, retryBackoffMs: [15_000, 60_000], coordinatePaceMs: 1_100 };

if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ scope: 'Dry-run; no requests sent.', retained_manifest: retainedManifestFile,
    retained_attempts: retainedAttempts, traffic_policy: trafficPolicy, terminal_manifest: terminalManifestFile,
    execution_required: terminal?.outcome !== 'complete', plan }, null, 2));
} else if (terminal?.outcome === 'complete') {
  console.log(JSON.stringify({ outcome: 'complete', requests_sent: 0,
    terminal_manifest: terminalManifestFile, scope: 'Retained terminal controls already pass; no traffic sent.' }));
} else {
  await captureDetails({ root, directoryPrefix: 'privacy-boundary', plan,
    manifest: { retained_manifest: retainedManifestFile }, priorAttempts: retainedAttempts,
    policy: trafficPolicy });
}
