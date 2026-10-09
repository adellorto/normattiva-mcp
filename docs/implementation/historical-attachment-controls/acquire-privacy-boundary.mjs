// Dry-run by default. --execute performs the two paced official detail requests
// previously observed to succeed at the exact 18/19 September 2018 boundary.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureDetails } from './capture-details.mjs';

const root = new URL('./', import.meta.url);
const provenanceFile = 'release-live-canaries-2026-10-06.json';
const provenance = JSON.parse(readFileSync(new URL(`../${provenanceFile}`, root)));
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

if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ scope: 'Dry-run; no requests sent.', plan }, null, 2));
} else {
  await captureDetails({ root, directoryPrefix: 'privacy-boundary', plan });
}
