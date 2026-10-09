import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parse, serialize } from 'parse5';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ActTraversal } from '../dist/traversal.js';
import { UpstreamRuntime } from '../dist/upstream.js';
import { indexPageSchema, articlePageSchema, readingPageSchema } from '../dist/contracts.js';

const publication = { data_gu: '2000-09-28', codice_redazionale: '000G0304' };
const date = '2026-10-02';
const key = Buffer.alloc(32, 7);
const page = `<meta property="eli:id_local" content="000G0304">
<input name="dataVigenza" value="02/10/2026">
<a href="/do/atto/caricaAKN?dataGU=20000928&amp;codiceRedaz=000G0304&amp;dataVigenza=20261002">AKN</a>
<a class="numero_articolo" onclick="return showArticle('/atto/caricaArticolo?art.idArticolo=13&amp;art.idSottoArticolo=1&amp;art.idSottoArticolo1=0&amp;art.flagTipoArticolo=0&amp;art.idGruppo=0&amp;art.progressivo=0&amp;art.versione=1&amp;art.codiceRedazionale=000G0304&amp;art.dataPubblicazioneGazzetta=2000-09-28',this)">Art. 13</a>`;
const xml = `<?xml version="1.0"?><akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"><act name="monovigente"><meta><identification><FRBRWork><FRBRalias name="eli" value="eli/id/2000/09/28/000G0304/CONSOLIDATED/20200101"/></FRBRWork><FRBRExpression><FRBRdate date="2020-01-01"/></FRBRExpression></identification><publication date="2000-09-28"/></meta><body><article eId="art_13"><num>Art. 13.</num><paragraph><content><p>Legal text.</p></content></paragraph></article></body></act></akomaNtoso>`;
const detail = { success: true, data: { atto: { sottoTitolo: '(000G0304)', annoGU: 2000, meseGU: 9, giornoGU: 28,
  articoloHtml: '<h2>Art. 13.</h2><p>Legal text.</p>', articoloDataInizioVigenza: '20200101', articoloDataFineVigenza: '99999999' } } };
async function fixture(work, overrides = {}) {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init?.body && JSON.parse(init.body) });
    return String(url).includes('dettaglio-atto') ? Response.json(typeof overrides.detail === 'function' ? overrides.detail(requests.at(-1).body) : overrides.detail ?? detail)
      : new Response(String(url).includes('caricaAKN') ? overrides.xml ?? xml : overrides.page ?? page);
  };
  try { await work(requests); } finally { globalThis.fetch = original; }
}
test('a dated official link, publication, structure and independent article control produce an exact index', async () => {
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const act_locator = reader.actLocator(publication);
    const result = indexPageSchema.parse(await reader.listArticles({ act_locator, snapshot_date: date }));
    assert.equal(result.coverage.article_inventory_complete, true);
    assert.equal(result.traversal.progress, 'complete');
    assert.equal(result.traversal.items[0].label, '13');
    assert.ok(result.traversal.items[0].article_locator);
    assert.equal(requests[1].url, 'https://www.normattiva.it/do/atto/caricaAKN?dataGU=20000928&codiceRedaz=000G0304&dataVigenza=20261002');
  });
});

test('structured acquisition keeps the website session through its AKN download and reacquires it after restart', async () => {
  const original = globalThis.fetch;
  let session = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('dettaglio-atto')) return Response.json(detail);
    if (String(url).includes('caricaAKN')) {
      if (new Headers(init.headers).get('Cookie') !== `JSESSIONID=fixture-${session}; NCC=lane-${session}`) return new Response('<!DOCTYPE html><html>Session missing</html>');
      return new Response(xml);
    }
    session++;
    const headers = new Headers();
    headers.append('Set-Cookie', `JSESSIONID=fixture-${session}; Path=/; HttpOnly; Secure`);
    headers.append('Set-Cookie', `NCC=lane-${session}; Path=/; HttpOnly; Secure`);
    return new Response(page, { headers });
  };
  try {
    for (let restart = 0; restart < 2; restart++) {
      const reader = new ActTraversal({ signingKey: key, cacheBytes: 0 });
      const index = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
      assert.equal(index.traversal.items[0].label, '13');
    }
    assert.equal(session, 2);
  } finally { globalThis.fetch = original; }
});

export { fixture, publication, date, key, page, xml, detail };

const nav = (label, id, group = 0, suffix = 1, progress = 0) => `<a class="numero_articolo" onclick="showArticle('/atto/caricaArticolo?art.idArticolo=${id}&amp;art.idSottoArticolo=${suffix}&amp;art.idSottoArticolo1=0&amp;art.flagTipoArticolo=0&amp;art.idGruppo=${group}&amp;art.progressivo=${progress}&amp;art.versione=1&amp;art.codiceRedazionale=000G0304&amp;art.dataPubblicazioneGazzetta=2000-09-28')">${/^\d/.test(label) ? 'Art. ' : ''}${label}</a>`;
const article = (label, text = 'Body.') => `<article eId="repeated"><num>Art. ${label}.</num><content><p>${text}</p></content></article>`;

test('index ordering retains suffixes, sparse numbering and repeated occurrences through eviction', async () => {
  const extra = article('13-bis') + article('2-undecies') + `<chapter><num>CAPO II</num>${article('13')}</chapter>` + article('301');
  await fixture(async () => {
    let reader = new ActTraversal({ signingKey: key, cacheBytes: 0 });
    const act_locator = reader.actLocator(publication);
    const labels = [], locators = [], hierarchies = [];
    let result = await reader.listArticles({ act_locator, snapshot_date: date, page_size: 1 });
    do {
      labels.push(...result.traversal.items.map(e => e.label));
      locators.push(...result.traversal.items.map(e => e.article_locator));
      hierarchies.push(...result.traversal.items.map(e => e.hierarchy));
      if (result.traversal.progress === 'complete') break;
      reader = new ActTraversal({ signingKey: key, cacheBytes: 0 });
      result = await reader.listArticles({ cursor: result.traversal.cursor });
    } while (true);
    assert.deepEqual(labels, ['13', '13-bis', '2-undecies', '13', '301']);
    assert.equal(new Set(locators).size, 5);
    assert.equal(hierarchies[3][0].label, 'CAPO II');
  }, { xml: xml.replace('</body>', extra + '</body>'), page: page + nav('13-bis',13,0,2) + nav('2-undecies',2,0,12) + nav('13',13,2,1,1) + nav('301',301),
    detail: request => request.idArticolo === 13 && request.sottoArticolo === 1 && request.progressivo === 0 ? detail
      : { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: `<h2>Art. ${request.sottoArticolo === 2 ? '13-bis' : request.idArticolo === 2 ? '2-undecies' : request.idArticolo}.</h2><p>Body.</p>` } } } });
});

test('exact article references read in one request after restart and continue inside content', async () => {
  await fixture(async requests => {
    const first = new ActTraversal({ signingKey: key, cacheBytes: 0 });
    const index = await first.listArticles({ act_locator: first.actLocator(publication), snapshot_date: date });
    requests.length = 0;
    const restarted = new ActTraversal({ signingKey: key });
    const read = articlePageSchema.parse(await restarted.readArticle({ article_locator: index.traversal.items[0].article_locator, max_chars: 5 }));
    assert.equal(requests.length, 1);
    assert.equal(read.content.text, 'Art. ');
    let all = read.content.text, current = read;
    while (current.progress === 'more') {
      current = await new ActTraversal({ signingKey: key }).readArticle({ cursor: current.cursor });
      all += current.content.text;
    }
    assert.equal(all, 'Art. 13. Legal text.');
    assert.equal(current.progress, 'complete');
  });
});

const saved = name => gunzipSync(readFileSync(new URL('./fixtures/acts/' + name, import.meta.url))).toString();
const retainedDpr = (date, capture) => gunzipSync(readFileSync(new URL(
  `../../../docs/implementation/historical-attachment-controls/011G0193-${date}/capture-${capture}.gz`, import.meta.url,
))).toString();
const retainedDprLocator = () => JSON.parse(readFileSync(new URL(
  '../../../docs/implementation/historical-attachment-controls/dpr151-2014-01-01/manifest.json', import.meta.url,
))).results.find(row => row.operation === 'find_acts').result.traversal.items[0].act_locator;
function* walk(node) { yield node; for (const child of node.childNodes ?? []) yield* walk(child); }
function capturedDetail(html, pub) {
  const nodes = [...walk(parse(html))];
  const body = nodes.find(n => n.attrs?.some(a => a.name === 'class' && a.value === 'bodyTesto'));
  const from = nodes.find(n => n.attrs?.some(a => a.name === 'id' && a.value === 'artInizio'));
  const start = (from.childNodes ?? []).map(n => n.value ?? '').join('').trim().split('-').reverse().map((v,i)=>v.padStart(i === 0 ? 4 : 2,'0')).join('');
  const [year,month,day] = pub.data_gu.split('-').map(Number);
  return { success: true, data: { atto: { sottoTitolo: `(${pub.codice_redazionale})`, annoGU: year, meseGU: month, giornoGU: day,
    articoloHtml: serialize(body), articoloDataInizioVigenza: start, articoloDataFineVigenza: '99999999' } } };
}
test('the saved TUEL capture traverses all 295 occurrences without truncation at 200', async () => {
  const html = saved('tuel-current-portal.html.gz');
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const labels = [];
    let result = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    while (true) {
      labels.push(...result.traversal.items.map(e => e.label));
      if (result.traversal.progress === 'complete') break;
      result = await reader.listArticles({ cursor: result.traversal.cursor });
    }
    assert.equal(labels.length, 295);
    assert.ok(labels.includes('147-bis'));
    assert.equal(labels.at(-1), '275');
  }, { page: html, xml: saved('tuel-public.xml.gz'), detail: request => {
    const controls = JSON.parse(saved('tuel-details.json.gz'));
    return controls[[request.idArticolo,request.sottoArticolo,request.sottoArticolo1,request.flagTipoArticolo,request.idGruppo,request.progressivo].join(':')];
  } });
});

test('table cells and large attachments retain positions and spans over bounded reading pages', async () => {
  const table = '<table><tr><th rowspan="2">Header</th><th colspan="2">Rates</th></tr><tr><td>ABCDEFGHIJK</td><td>LMNOPQRSTUV</td></tr></table><p>Tail.</p>';
  const attachment = `<attachments><attachment><doc name="Tariff table"><meta><identification><FRBRExpression><FRBRdate date="2020-01-01"/></FRBRExpression></identification></meta><mainBody>${table}</mainBody></doc></attachment></attachments>`;
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key, cacheBytes: 0 });
    const act_locator = reader.actLocator(publication);
    const index = await reader.listArticles({ act_locator, snapshot_date: date });
    const attachment_ref = index.traversal.items[1].attachment_ref;
    const segments = [];
    let result = await reader.readAct({ act_locator, attachment_ref, max_chars: 4 });
    for (let calls = 0;; calls++) {
      assert.ok(calls < 30, 'no zero-progress loop');
      readingPageSchema.parse(result);
      const items = result.traversal.items.flatMap(i => i.segments);
      assert.ok(items.reduce((n,s)=>n+(s.kind === 'text' ? s.text.length : s.cells.reduce((n,c)=>n+c.text.length,0)),0) <= 4);
      segments.push(...items);
      if (result.traversal.progress === 'complete') break;
      result = await new ActTraversal({ signingKey: key, cacheBytes: 0 }).readAct({ cursor: result.traversal.cursor });
    }
    const tables = segments.filter(s => s.kind === 'table');
    assert.equal(new Set(tables.map(s => s.table_id)).size, 1);
    assert.ok(tables.every(s => s.row_count === 2 && s.column_count === 3));
    const header = tables.flatMap(s=>s.cells).filter(c=>c.row === 0 && c.column === 0);
    assert.deepEqual(header.map(c=>c.offset), [0, 4]);
    assert.ok(header.every(c=>c.header && c.row_span === 2 && c.column_span === 1));
    assert.equal(tables.flatMap(s=>s.cells).map(c=>c.text).join(''), 'HeaderRatesABCDEFGHIJKLMNOPQRSTUV');
    assert.equal(segments.filter(s=>s.kind === 'text').map(s=>s.text).join(''), 'Tail.');
  }, { xml: xml.replace('</act>', attachment+'</act>'), page: page + nav('Tariff table',900),
    detail: request => request.idArticolo === 900 ? { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: table } } } : detail });
});

test('verified inventory absence differs from an ambiguous HTTP failure', async () => {
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const act_locator = reader.actLocator(publication);
    await reader.listArticles({ act_locator, snapshot_date: date });
    const before = requests.length;
    const missing = await reader.readArticle({ act_locator, article_reference: '999', snapshot_date: date });
    assert.equal(missing.outcome, 'absent');
    assert.equal(missing.absence_basis, 'verified_index');
    assert.equal(requests.length, before);
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('ambiguous coordinates', { status: 404 });
  try {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.readArticle({ act_locator: reader.actLocator(publication), article_reference: '999', snapshot_date: date });
    assert.equal(result.outcome, 'unresolved');
  } finally { globalThis.fetch = original; }
});

test('historical source controls reject current exports, matching counts and forged root dates', async () => {
  const pub = { data_gu: '2003-07-29', codice_redazionale: '003G0218' };
  const html = saved('privacy-2017-01-01-AKN-V-portal.html.gz');
  const historical = saved('privacy-historical.xml.gz');
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.listArticles({ act_locator: reader.actLocator(pub), snapshot_date: '2017-01-01' });
    assert.equal(result.snapshot.snapshot_date, '2017-01-01');
    assert.equal(result.traversal.items[0].label, '1');
  }, { page: html, xml: historical, detail: capturedDetail(html, pub) });
  for (const candidate of [saved('privacy-export-date-control.xml.gz'), historical.replace('Chiunque ha diritto alla protezione', 'Different substantive wording')]) {
    await fixture(async () => {
      const reader = new ActTraversal({ signingKey: key });
      await assert.rejects(reader.listArticles({ act_locator: reader.actLocator(pub), snapshot_date: '2017-01-01' }), error =>
        ['snapshot_conflict','source_content_conflict'].includes(error.detail.code));
    }, { page: html, xml: candidate, detail: capturedDetail(html, pub) });
  }
});

test('compound rendered preamble and identified notes verify without weakening exact content checks', async () => {
  const run = async (date, rendered, source, expectedCode) => {
    const original = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), body: init?.body });
      assert.equal(init?.body, undefined, 'the independently rendered first occurrence must decide before API detail calls');
      return new Response(String(url).includes('caricaAKN') ? source : rendered);
    };
    try {
      const reader = new ActTraversal({ signingKey: Buffer.alloc(32, 8) });
      if (expectedCode) {
        await assert.rejects(reader.listArticles({ act_locator: retainedDprLocator(), snapshot_date: date, page_size: 1 }),
          error => error.detail.code === expectedCode);
      } else {
        const result = indexPageSchema.parse(await reader.listArticles({
          act_locator: retainedDprLocator(), snapshot_date: date, page_size: 1,
        }));
        assert.equal(result.traversal.items[0].label, '1');
        assert.equal(result.traversal.progress, 'more');
        assert.equal(result.coverage.legal_content_complete, false);
        assert.match(result.coverage.explanation, /preamble/i);
        assert.match(result.snapshot.evidence[0].explanation, /explanatory notes/);
      }
      assert.equal(requests.length, 2);
    } finally { globalThis.fetch = original; }
  };
  const historicalPage = retainedDpr('2014-01-01', 1);
  const historicalSource = retainedDpr('2014-01-01', 2);
  await run('2014-01-01', historicalPage, historicalSource);
  await run('2026-10-07', retainedDpr('2026-10-07', 1), retainedDpr('2026-10-07', 2));
  await run('2014-01-01', historicalPage.replace('IL PRESIDENTE DELLA REPUBBLICA', 'IL PRESIDENTE DEL SENATO'), historicalSource, 'source_content_conflict');
  await run('2014-01-01', historicalPage.replace('Comando provinciale dei vigili del fuoco', 'Comando regionale dei vigili del fuoco'), historicalSource, 'source_content_conflict');
  const unmarked = historicalPage.replace(/<div class="bodyTesto">[\s\S]*?<h2 class="article-num-akn"[^>]*>/, '<div class="bodyTesto"><h2 class="unclassified-article">');
  assert.notEqual(unmarked, historicalPage);
  await run('2014-01-01', unmarked, historicalSource, 'source_content_conflict');
  const falseEquivalentPage = historicalPage.replace(/(<h2 class="article-num-akn"[\s\S]*?)attivit&agrave;/, '$1p&ograve;');
  const falseEquivalentSource = historicalSource.replace(/(<article eId="art_1"[\s\S]*?)attivita'/, "$1po'");
  assert.notEqual(falseEquivalentPage, historicalPage);
  assert.notEqual(falseEquivalentSource, historicalSource);
  await run('2014-01-01', falseEquivalentPage, falseEquivalentSource, 'source_content_conflict');
  await run('2012-01-01', retainedDpr('2012-01-01', 1), retainedDpr('2012-01-01', 2), 'source_identity_conflict');
  await run('2014-01-01', historicalPage, retainedDpr('2026-10-07', 2), 'snapshot_conflict');
});

test('changed representations refuse continuation after eviction even with equal article counts', async () => {
  let cursor;
  const extra = article('20');
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    cursor = (await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date, page_size: 1 })).traversal.cursor;
  }, { xml: xml.replace('</body>', extra+'</body>'), page: page+nav('20',20) });
  await fixture(async () => {
    await assert.rejects(new ActTraversal({ signingKey: key }).listArticles({ cursor }), error => error.detail.code === 'representation_changed');
  }, { xml: xml.replace('</body>', article('20','Changed text.')+'</body>'), page: page+nav('20',20) });
});

test('tampering, trust changes, wrong operations and conflicting inputs fail before upstream work', async () => {
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const act_locator = reader.actLocator(publication);
    const result = await reader.listArticles({ act_locator, snapshot_date: date, page_size: 1 });
    const locator = result.traversal.items[0].article_locator;
    const reading = await reader.readArticle({ article_locator: locator, max_chars: 3 });
    const before = requests.length;
    for (const work of [
      () => reader.readArticle({ article_locator: locator.slice(0,-1) + (locator.endsWith('A') ? 'B' : 'A') }),
      () => new ActTraversal({ signingKey: Buffer.alloc(32,8) }).readArticle({ article_locator: locator }),
      () => reader.listArticles({ cursor: reading.cursor }),
      () => reader.readArticle({ article_locator: locator, snapshot_date: '2017-01-01' }),
      () => reader.listArticles({ act_locator, cursor: reading.cursor }),
    ]) await assert.rejects(work(), error => ['invalid_locator','invalid_cursor','invalid_input'].includes(error.detail.category));
    assert.equal(requests.length, before);
  });
});

test('planned verification budgets prepare once and resume with fresh allowances', async () => {
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key, upstream: new UpstreamRuntime({ composedAttempts: 2 }) });
    const prepared = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    assert.equal(prepared.traversal.progress, 'pending');
    assert.deepEqual(prepared.traversal.items, []);
    assert.equal(requests.length, 2);
    const finished = await reader.listArticles({ cursor: prepared.traversal.cursor });
    assert.equal(finished.traversal.progress, 'complete');
    assert.equal(requests.length, 3);
  });
});

test('index and reading interruptions preserve the exact prefix and first unfinished occurrence', async () => {
  const twoXml = xml.replace('</body>', article('20')+'</body>'), twoPage = page+nav('20',20);
  for (const method of ['listArticles','readAct']) {
    let continuation;
    await fixture(async requests => {
      const reader = new ActTraversal({ signingKey: key });
      const original = globalThis.fetch;
      globalThis.fetch = async (url,init) => init?.body && JSON.parse(init.body).idArticolo === 20 ? new Response('generic gateway',{status:503}) : original(url,init);
      const result = await reader[method]({ act_locator: reader.actLocator(publication), snapshot_date: date });
      assert.equal(result.traversal.progress, 'interrupted');
      assert.equal(result.traversal.items.length, 1);
      assert.equal(result.traversal.failure.error.http_status, 503);
      assert.equal(result.coverage.article_inventory_complete, false);
      continuation = result.traversal.cursor;
    }, { xml: twoXml, page: twoPage });
    await fixture(async requests => {
      const result = await new ActTraversal({ signingKey: key })[method]({ cursor: continuation });
      assert.equal(result.traversal.progress, 'complete');
      const item = result.traversal.items[0];
      assert.equal(method === 'listArticles' ? item.label : item.entry.label, '20');
      assert.equal(requests.filter(r=>r.body).length, 1);
    }, { xml: twoXml, page: twoPage, detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 20.</h2><p>Body.</p>' } } } });
  }
});

test('Civil Code 2043 preserves attachment 2, supplied group coordinates and component ancestry', async () => {
  const pub = { data_gu: '1942-04-04', codice_redazionale: '042U0262' }, html = saved('civil-2026-10-02-AKN-V-portal.html.gz');
  const captured = JSON.parse(readFileSync(new URL('./fixtures/acts/civil-direct-coordinate.json',import.meta.url)));
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key, upstream: new UpstreamRuntime({ composedAttempts: 2 }) });
    const act_locator = reader.actLocator(pub);
    const index = await reader.listArticles({ act_locator, snapshot_date: date, page_size: 1 });
    assert.equal(index.coverage.article_inventory_complete, false);
    const result = await reader.readArticle({ act_locator, article_reference: '2043', snapshot_date: date });
    assert.equal(result.outcome, 'found');
    assert.match(result.content.text, /danno ingiusto/);
    const before = requests.length;
    const direct = await new ActTraversal({ signingKey: key }).readArticle({ article_locator: result.requested.article_locator });
    assert.equal(direct.outcome, 'found');
    assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1).body.flagTipoArticolo, '2');
    assert.equal(requests.at(-1).body.idGruppo, 258);
    assert.equal(requests.at(-1).body.sottoArticolo1, 10);
    assert.equal(requests.at(-1).body.dataVigenza, date);
  }, { page: html, xml: saved('civil-current.xml.gz'), detail: captured });
});

test('only identified explanatory-note differences are allowed and disclosed', async () => {
  const notedXml = xml.replace('Legal text.</p>', 'Legal text.</p><p><authorialNote>AKN explanatory note.</authorialNote></p>');
  const notedDetail = { ...detail, data: { atto: { ...detail.data.atto,
    articoloHtml: '<h2>Art. 13.</h2><p>Legal text.</p><div class="note-akn">Direct explanatory note.</div>' } } };
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const index = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    assert.match(index.snapshot.evidence[0].explanation, /explanatory notes/);
    const read = await reader.readArticle({ article_locator: index.traversal.items[0].article_locator });
    assert.equal(read.outcome, 'found');
    assert.match(read.content.text, /Direct explanatory note/);
    assert.match(read.evidence[0].explanation, /explanatory notes/);
  }, { xml: notedXml, detail: notedDetail });
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    await assert.rejects(reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date }), error=>error.detail.code === 'source_content_conflict');
  }, { xml: notedXml, detail: { ...notedDetail, data: { atto: { ...notedDetail.data.atto, articoloHtml: '<h2>Art. 13.</h2><p>Changed legal duty.</p><div class="note-akn">Direct explanatory note.</div>' } } } });
});

test('unknown structure cannot certify absence and identified graphics stay explicitly unread', async () => {
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    await assert.rejects(reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date }), error=>error.detail.code === 'unsupported_structure');
  }, { xml: xml.replace('</body>','<unknownSection>'+article('999')+'</unknownSection></body>') });
  const graphic = '<attachments><attachment><doc name="Scan"><mainBody><p>Caption</p><img src="/official-scan.pdf"/></mainBody></doc></attachment></attachments>';
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const act_locator = reader.actLocator(publication);
    const result = await reader.listArticles({ act_locator, snapshot_date: date });
    assert.equal(result.coverage.article_inventory_complete, false);
    assert.equal(result.coverage.legal_content_complete, false);
    const attachment = result.traversal.items[1];
    assert.equal(attachment.text_available, false);
    assert.equal(attachment.historical_link_verified, false);
    assert.equal(attachment.official_url, 'https://www.normattiva.it/official-scan.pdf');
    await assert.rejects(reader.readAct({ act_locator, attachment_ref: attachment.attachment_ref }),error=>error.detail.code === 'attachment_unread');
  }, { xml: xml.replace('</act>',graphic+'</act>') });
});

test('UTF-8 byte bounds include both MCP copies and continuation never splits a Unicode character', async () => {
  const large = '😀'.repeat(40_000);
  const largeDetail = { ...detail, data:{atto:{...detail.data.atto,articoloHtml:`<h2>Art. 13.</h2><p>${large}</p>`}} };
  await fixture(async () => {
    const reader = new ActTraversal({signingKey:key});
    let result = await reader.readArticle({act_locator:reader.actLocator(publication),article_reference:'13',snapshot_date:date,max_chars:64000}), all='';
    for(let calls=0;;calls++){
      assert.ok(calls<10);
      assert.ok(Buffer.byteLength(JSON.stringify({structuredContent:result,content:[{type:'text',text:JSON.stringify(result)}]})) <= 128*1024);
      assert.equal(result.content.text.isWellFormed(),true);
      all += result.content.text;
      if(result.progress==='complete')break;
      result = await new ActTraversal({signingKey:key}).readArticle({cursor:result.cursor});
    }
    assert.equal(all,'Art. 13. '+large);
  },{detail:largeDetail});
});

test('full-act byte bounds retain escaped Unicode text and exact offsets through eviction', async () => {
  const text = 'é😀"\\&'.repeat(8000);
  const encoded = text.replaceAll('&', '&amp;');
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    let result = await reader.readAct({ act_locator: reader.actLocator(publication), snapshot_date: date, max_chars: 64000 });
    const parts = [];
    for (let pages = 0;; pages++) {
      assert.ok(pages < 12, 'bounded useful continuation');
      assert.ok(Buffer.byteLength(JSON.stringify({ structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] })) <= 128 * 1024);
      for (const segment of result.traversal.items.flatMap(item => item.segments)) {
        assert.equal(segment.kind, 'text');
        assert.ok(segment.text.isWellFormed());
        parts.push(segment);
      }
      if (result.traversal.progress === 'complete') break;
      reader.evict();
      result = await reader.readAct({ cursor: result.traversal.cursor });
    }
    const blocks = new Map();
    for (const part of parts) blocks.set(part.block_id, (blocks.get(part.block_id) ?? '') + part.text);
    assert.equal([...blocks.values()].join(' '), 'Art. 13. ' + text);
    const body = parts.filter(part => part.block_id !== parts[0].block_id);
    let offset = 0;
    for (const part of body) { assert.equal(part.offset, offset); offset += part.text.length; }
    assert.equal(offset, text.length);
  }, { xml: xml.replace('Legal text.', encoded), detail: { ...detail,
    data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2><p>' + encoded + '</p>' } } } });
});

test('production parser, queued preparations, eviction and direct restart fit the 256 MiB working-memory target', async () => {
  const {stdout} = await promisify(execFile)(process.execPath,[new URL('./fixtures/traversal-memory.mjs',import.meta.url).pathname]);
  const measured=JSON.parse(stdout);
  assert.ok(measured.max_rss_kib <= 256*1024,JSON.stringify(measured));
  assert.equal(measured.concurrent_calls,3);
  assert.equal(measured.attempts,6);
});

test('complete TUEL reading, cached first pages and evicted continuation fit the 256 MiB working-memory target', async () => {
  const {stdout} = await promisify(execFile)(process.execPath,
    [new URL('./fixtures/release-runtime.mjs',import.meta.url).pathname, 'tuel-reading']);
  const measured = JSON.parse(stdout);
  assert.equal(measured.memory_gate, 'passed');
  assert.ok(measured.max_rss_kib <= 256 * 1024);
  assert.ok(measured.pages.every(page => page.serialized_bytes <= 128 * 1024));
});

test('source acquisition enforces its decoded limit while receiving and cancellation does no upstream work', async () => {
  const original=globalThis.fetch;
  let sent=0,cancelled=false;
  const block=new Uint8Array(1024*1024);
  globalThis.fetch=async()=>new Response(new ReadableStream({pull(controller){sent++;controller.enqueue(block)},cancel(){cancelled=true}}));
  try {
    const reader=new ActTraversal({signingKey:key});
    await assert.rejects(reader.listArticles({act_locator:reader.actLocator(publication),snapshot_date:date}),error=>error.detail.code==='source_limit_exceeded');
    assert.ok(sent<=26);assert.equal(cancelled,true);
    const controller=new AbortController();controller.abort();
    const before=sent;
    await assert.rejects(reader.readArticle({act_locator:reader.actLocator(publication),article_reference:'13'},controller.signal),error=>error.detail.code==='operation_cancelled');
    assert.equal(sent,before);
  } finally {globalThis.fetch=original;}
});

test('unmatched official addresses prevent complete inventory and false absence', async () => {
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const act_locator = reader.actLocator(publication);
    const index = await reader.listArticles({ act_locator, snapshot_date: date });
    assert.equal(index.coverage.article_inventory_complete, false);
    assert.match(index.coverage.explanation, /navigation|membership/i);
    const missing = await reader.readArticle({ act_locator, article_reference: '20', snapshot_date: date });
    assert.equal(missing.outcome, 'unresolved');
    assert.equal(missing.reason, 'source_membership_conflict');
    assert.equal(requests.filter(r => r.body?.idArticolo === 20).length, 0);
  }, { page: page + nav('20',20), detail: request => request.idArticolo === 20
    ? { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 20.</h2><p>Omitted historical article.</p>' } } } : detail });
});

test('legal sections outside occurrences are checked and their coverage is disclosed', async () => {
  for (const candidate of [xml.replace('</body>', '<p>Omitted legal text.</p></body>'),
    xml.replace('</body>', 'Unassigned legal text.</body>'),
    xml.replace('</body>', '<img src="https://www.normattiva.it/unread.pdf"/></body>'),
    xml.replace('<body>', '<preamble><unknownSection><p>Unknown legal content.</p></unknownSection></preamble><body>')]) {
    await fixture(async () => {
      const reader = new ActTraversal({ signingKey: key });
      await assert.rejects(reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date }), e => e.detail?.code === 'unsupported_structure');
    }, { xml: candidate });
  }
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.readAct({ act_locator: reader.actLocator(publication), snapshot_date: date });
    assert.equal(result.coverage.legal_content_complete, false);
    assert.match(result.coverage.explanation, /preamble|sections/i);
  }, { xml: xml.replace('<body>', '<preamble><p>Enactment formula.</p></preamble><body>') });
});

test('independent table verification rejects changed relationships even when text matches', async () => {
  const table = '<table><tr><th>A</th><th>B</th></tr><tr><td>C</td><td>D</td></tr></table>';
  const changed = '<table><tr><td>A</td><td>B</td><td>C</td><td>D</td></tr></table>';
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    await assert.rejects(reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date }), e => e.detail?.code === 'source_table_conflict');
  }, { xml: xml.replace('<p>Legal text.</p>', table), detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2>'+changed } } } });
});

test('deep detail HTML produces a bounded typed parser error', async () => {
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    await assert.rejects(reader.readArticle({ act_locator: reader.actLocator(publication), article_reference: '13', snapshot_date: date }), e => e.detail?.code === 'parse_limit_exceeded');
  }, { detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<div>'.repeat(10000)+'<h2>Art. 13.</h2><p>Legal text.</p>'+'</div>'.repeat(10000) } } } });
});

test('table verification binds legal values to cells, including after reference restart', async () => {
  const table = '<table><tr><td>A B</td><td></td></tr></table>';
  const changed = '<table><tr><td>A</td><td>B</td></tr></table>';
  const overrides = { xml: xml.replace('<p>Legal text.</p>', table), detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2>'+table } } } };
  let article_locator;
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    article_locator = result.traversal.items[0].article_locator;
  }, overrides);
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    await assert.rejects(reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date }), e => e.detail?.code === 'source_table_conflict');
    const result = await new ActTraversal({ signingKey: key }).readArticle({ article_locator });
    assert.equal(result.outcome, 'unresolved');
    assert.equal(result.reason, 'source_table_conflict');
  }, { ...overrides, detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2>'+changed } } } });
});

test('direct text reading exposes tables and graphics without flattening or extra requests', async () => {
  for (const [html, reason] of [
    ['<h2>Art. 13.</h2><table><tr><td>A</td><td>B</td></tr></table>', 'structured_table_reading_required'],
    ['<h2>Art. 13.</h2><p>Legal text.</p><img src="https://www.normattiva.it/scan.pdf">', 'graphic_content_unread'],
  ]) await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.readArticle({ act_locator: reader.actLocator(publication), article_reference: '13', snapshot_date: date });
    assert.equal(result.outcome, 'unresolved');
    assert.equal(result.reason, reason);
    assert.equal(requests.length, 1);
    assert.ok(result.evidence[0].explanation);
  }, { detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: html } } } });
});

test('healthy direct article continuation binds the actual acquired detail representation', async () => {
  let returnedDetail = detail;
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.readArticle({ act_locator: reader.actLocator(publication), article_reference: '13', snapshot_date: date, max_chars: 5 });
    assert.equal(result.outcome, 'found');
    assert.equal(requests.length, 1);
    assert.equal(result.evidence[0].official_url, requests[0].url);
    requests.length = 0;
    const resumed = await new ActTraversal({ signingKey: key }).readArticle({ cursor: result.cursor });
    assert.equal(resumed.outcome, 'found');
    assert.equal(requests.length, 1);
    returnedDetail = { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2><p>Changed content.</p>' } } };
    const changed = await new ActTraversal({ signingKey: key }).readArticle({ cursor: result.cursor });
    assert.equal(changed.outcome, 'unresolved');
    assert.equal(changed.reason, 'source_content_conflict');
  }, { detail: () => returnedDetail });
});

test('identified table notes and unread article references retain coverage across restart', async () => {
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    assert.match(result.snapshot.evidence[0].explanation, /explanatory notes/);
  }, { xml: xml.replace('<p>Legal text.</p>', '<table><tr><td>A<authorialNote>Old note.</authorialNote></td><td>B</td></tr></table>'),
    detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2><table><tr><td>A<span class="note-akn">New note.</span></td><td>B</td></tr></table>' } } } });
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key });
    const index = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    assert.equal(index.coverage.legal_content_complete, false);
    const before = requests.length;
    const result = await new ActTraversal({ signingKey: key }).readArticle({ article_locator: index.traversal.items[0].article_locator });
    assert.equal(result.outcome, 'unresolved');
    assert.equal(result.reason, 'graphic_content_unread');
    assert.equal(requests.length, before);
  }, { xml: xml.replace('</content>', '<img src="https://www.normattiva.it/scan.pdf"/></content>') });
});

test('official nonarticle attachments missing from AKN remain visible and unresolved after restart', async () => {
  await fixture(async requests => {
    const reader = new ActTraversal({ signingKey: key, cacheBytes: 0 });
    const act_locator = reader.actLocator(publication);
    const first = await reader.listArticles({ act_locator, snapshot_date: date, page_size: 1 });
    assert.equal(first.coverage.article_inventory_complete, false);
    assert.equal(first.coverage.legal_content_complete, false);
    assert.equal(first.traversal.progress, 'more');
    const last = await new ActTraversal({ signingKey: key, cacheBytes: 0 }).listArticles({ cursor: first.traversal.cursor });
    const scan = last.traversal.items[0];
    assert.equal(scan.kind, 'attachment');
    assert.equal(scan.label, 'Scan');
    assert.equal(scan.text_available, false);
    assert.equal(scan.historical_link_verified, false);
    assert.ok(scan.official_url.includes('art.idArticolo=900'));
    assert.match(scan.explanation, /membership.*unresolved/i);
    assert.deepEqual(last.coverage.unread_attachment_refs, [scan.attachment_ref]);
    assert.equal(last.traversal.progress, 'complete');
    assert.equal(last.coverage.legal_content_complete, false);
    await assert.rejects(new ActTraversal({ signingKey: key, cacheBytes: 0 }).readAct({ act_locator, attachment_ref: scan.attachment_ref }), e => e.detail?.code === 'attachment_unread');
    assert.equal(requests.filter(r => r.body?.idArticolo === 900).length, 0);
  }, { page: page + nav('Scan',900) });
});

test('changed supplied addresses reject snapshot continuation with unchanged AKN bytes', async () => {
  const twoXml = xml.replace('</body>', article('20')+'</body>');
  let cursor;
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key, cacheBytes: 0 });
    cursor = (await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date, page_size: 1 })).traversal.cursor;
  }, { xml: twoXml, page: page + nav('20',20) });
  await fixture(async () => {
    await assert.rejects(new ActTraversal({ signingKey: key, cacheBytes: 0 }).listArticles({ cursor }), e => e.detail?.code === 'representation_changed');
  }, { xml: twoXml, page: page + nav('20',20,2) });
});

test('verified index pages expose actual article headings for topic selection without article bodies', async () => {
  await fixture(async () => {
    const reader = new ActTraversal({ signingKey: key });
    const result = await reader.listArticles({ act_locator: reader.actLocator(publication), snapshot_date: date });
    assert.equal(result.traversal.items[0].heading, 'Tutela dei dati');
    assert.equal('segments' in result.traversal.items[0], false);
  }, { xml: xml.replace('<num>Art. 13.</num>', '<num>Art. 13.</num><heading>Tutela dei dati</heading>'),
    detail: { ...detail, data: { atto: { ...detail.data.atto, articoloHtml: '<h2>Art. 13.</h2><p>Tutela dei dati</p><p>Legal text.</p>' } } } });
});
