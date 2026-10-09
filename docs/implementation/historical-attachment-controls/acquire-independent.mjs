// Dry-run by default. --execute performs paced official detail requests.
// Article 1 is independently controlled by the rendered portal occurrence, so the
// plan captures the other fourteen entries and keeps full traversal at 16 attempts.
// Every coordinate comes from the retained official HTML navigation, never inference.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parse } from '../../../packages/core/node_modules/parse5/dist/index.js';
import { captureDetails } from './capture-details.mjs';

const root = new URL('./', import.meta.url);
function* nodes(node) { yield node; for (const child of node.childNodes ?? []) yield* nodes(child); }
const source = path => gunzipSync(readFileSync(new URL(path, root))).toString();
function requestFromPortal(path, label, date) {
  const candidates = [...nodes(parse(source(path)))].filter(node => node.tagName === 'a'
    && node.attrs.some(attribute => attribute.name === 'class' && attribute.value.split(/\s+/).includes('numero_articolo'))
    && [...nodes(node)].map(child => child.value ?? '').join('').trim() === label);
  assert.equal(candidates.length, 1, `Expected one supplied address for ${label}`);
  const onclick = candidates[0].attrs.find(attribute => attribute.name === 'onclick').value;
  const supplied = /showArticle\('([^']+)'/.exec(onclick)?.[1];
  assert.ok(supplied);
  const address = new URL(supplied, 'https://www.normattiva.it');
  assert.equal(address.origin, 'https://www.normattiva.it');
  assert.equal(address.pathname, '/atto/caricaArticolo');
  const parameters = address.searchParams;
  const number = name => {
    const value = parameters.get('art.' + name);
    assert.match(value ?? '', /^\d+$/);
    return Number(value);
  };
  return { label, supplied_navigation_file: path, supplied_navigation_url: address.href,
    request: { dataGU: parameters.get('art.dataPubblicazioneGazzetta'),
      codiceRedazionale: parameters.get('art.codiceRedazionale'), dataVigenza: date,
      tipoDettaglio: 'singolavigenza', idArticolo: number('idArticolo'),
      sottoArticolo: number('idSottoArticolo'), sottoArticolo1: number('idSottoArticolo1'),
      flagTipoArticolo: parameters.get('art.flagTipoArticolo'), idGruppo: number('idGruppo'),
      progressivo: number('progressivo'), versione: number('versione') } };
}
const requestedScope = process.argv.find(argument => argument.startsWith('--only='))?.slice('--only='.length);
assert.ok(!requestedScope || ['articles', 'attachments'].includes(requestedScope), 'Expected --only=articles or --only=attachments');
const labels = [...Array.from({ length: 12 }, (_, index) => String(index + 2)), 'Allegato I', 'Allegato II'];
const url = 'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto';
const plan = [];
for (const date of ['2014-01-01', '2026-10-07']) for (const label of labels) {
  const kind = /^\d+$/.test(label) ? 'articles' : 'attachments';
  if (requestedScope && kind !== requestedScope) continue;
  plan.push({ name: `dpr151-${date}-${label.replaceAll(' ', '-')}`, url,
    ...requestFromPortal(`011G0193-${date}/capture-1.gz`, label, date) });
}
if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ scope: 'Dry-run; no requests sent.', selection: requestedScope ?? 'all non-anchor occurrences', url, plan }, null, 2));
} else {
  await captureDetails({ root, directoryPrefix: 'independent-details', plan,
    manifest: { url, selection: requestedScope ?? 'all non-anchor occurrences' } });
}
