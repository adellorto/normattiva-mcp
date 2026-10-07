// Dry-run by default. --execute performs four paced official attachment requests.
// Every coordinate comes from the retained official HTML navigation, never inference.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { parse } from '../../../packages/core/node_modules/parse5/dist/index.js';

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
  return { supplied_navigation_file: path, supplied_navigation_url: address.href,
    request: { dataGU: parameters.get('art.dataPubblicazioneGazzetta'),
      codiceRedazionale: parameters.get('art.codiceRedazionale'), dataVigenza: date,
      tipoDettaglio: 'singolavigenza', idArticolo: number('idArticolo'),
      sottoArticolo: number('idSottoArticolo'), sottoArticolo1: number('idSottoArticolo1'),
      flagTipoArticolo: parameters.get('art.flagTipoArticolo'), idGruppo: number('idGruppo'),
      progressivo: number('progressivo'), versione: number('versione') } };
}
const plan = [];
for (const date of ['2014-01-01', '2026-10-07']) for (const label of ['Allegato I', 'Allegato II']) {
  plan.push({ name: `dpr151-${date}-${label.replaceAll(' ', '-')}`,
    ...requestFromPortal(`011G0193-${date}/capture-1.gz`, label, date) });
}
const url = 'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto';
if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ scope: 'Dry-run; no requests sent.', url, plan }, null, 2));
} else {
  const directory = new URL(`independent-details-${new Date().toISOString().replaceAll(':', '-')}/`, root);
  mkdirSync(directory, { recursive: true });
  const captures = [];
  const save = () => writeFileSync(new URL('manifest.json', directory), JSON.stringify({ url, captures }, null, 2) + '\n');
  for (const entry of plan) {
    const record = { ...entry, captured_at: new Date().toISOString() };
    captures.push(record); save();
    const at = performance.now();
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json',
        Origin: 'https://dati.normattiva.it', 'User-Agent': 'normattiva-mcp/0.2.0 research' },
        body: JSON.stringify(entry.request), signal: AbortSignal.timeout(20000) });
      record.status = response.status;
      const chunks = []; record.decoded_bytes = 0;
      for await (const chunk of response.body) {
        record.decoded_bytes += chunk.length;
        assert.ok(record.decoded_bytes <= 24 * 1024 * 1024, 'Decoded source limit exceeded');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      record.file = entry.name + '.json.gz';
      record.sha256 = createHash('sha256').update(body).digest('hex');
      writeFileSync(new URL(record.file, directory), gzipSync(body));
      assert.equal(response.status, 200);
      const envelope = JSON.parse(body.toString());
      assert.equal(envelope.success, true);
      assert.ok(envelope.data?.atto?.articoloHtml);
    } catch (error) {
      record.failure = error.cause?.code ?? error.message;
      process.exitCode = 1;
    } finally { record.elapsed_ms = performance.now() - at; save(); }
    if (record.failure) break; // Retain a block; never repeatedly retry the provider.
    await setTimeout(1100);
  }
  console.log(JSON.stringify({ directory: directory.pathname, attempted: captures.length, completed: captures.filter(row => !row.failure).length }));
}
