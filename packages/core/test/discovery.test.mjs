import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import * as core from '../dist/index.js';
import { UpstreamRuntime } from '../dist/upstream.js';

const key = Buffer.alloc(32, 19);
const cad = JSON.parse(readFileSync(new URL('./fixtures/discovery/cad-exact-2026-10-05.json', import.meta.url)));
function discovery(options = {}) { return new core.ActDiscovery({ signingKey: key, upstream: new UpstreamRuntime(), ...options }); }
async function fixture(handler, work) {
  const previous = globalThis.fetch, requests = [];
  globalThis.fetch = async (url, init) => {
    const request = { url: String(url), body: init?.body ? JSON.parse(init.body) : undefined };
    requests.push(request); return handler(request, requests.length);
  };
  try { return await work(requests); } finally { globalThis.fetch = previous; }
}

test('a complete citation selects a live exact act without retrieving its articles', async () => {
  await fixture(() => Response.json(cad), async requests => {
    const result = await discovery().findActs({ request: 'Passami l’articolo 52 del D.Lgs. 82/2005' });
    assert.equal(result.match, 'identified');
    assert.equal(result.article_reference, '52');
    assert.equal(result.ordering, 'exact_citation');
    assert.equal(result.traversal.progress, 'complete');
    const reader = new core.ActTraversal({ signingKey: key });
    assert.equal(result.traversal.items[0].act_locator, reader.actLocator({ data_gu: '2005-05-16', codice_redazionale: '005G0104' }));
    assert.equal(result.traversal.items[0].current, 'unknown');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.numeroProvvedimento, '82');
    assert.equal(requests[0].body.denominazioneAtto, 'DECRETO LEGISLATIVO');
    assert.match(requests[0].url, /ricerca\/avanzata$/);
    core.discoveryPageSchema.parse(result);
  });
});

const citations = [
  ['Mi serve l’art. 3, comma 1, della L. 241/90.', 'LEGGE', '1990', '241', '3, comma 1'],
  ['Mostrami l’articolo 46 del D.P.R. 28 dicembre 2000, n. 445.', 'DECRETO DEL PRESIDENTE DELLA REPUBBLICA', '2000', '445', '46'],
  ['R.D. 16 marzo 1942, n. 262: cosa prevede l’art. 2043?', 'REGIO DECRETO', '1942', '262', '2043'],
  ['Cerca l’articolo 7-bis del decreto-legge n. 76/2020.', 'DECRETO-LEGGE', '2020', '76', '7-bis'],
  ['Trova la legge 241 del 1990.', 'LEGGE', '1990', '241', undefined],
];
test('accepted citation spellings preserve article intent and use exact search', async () => {
  for (const [request, type, year, number, article] of citations) {
    await fixture(({ body }) => Response.json({ listaAtti: [], numeroAttiTrovati: 0, numeroPagine: 0, paginaCorrente: 1 }), async requests => {
      const result = await discovery().findActs({ request });
      assert.equal(result.match, 'no_candidates');
      assert.equal(result.article_reference, article);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].body.denominazioneAtto, type);
      assert.equal(requests[0].body.annoProvvedimento, year);
      assert.equal(requests[0].body.numeroProvvedimento, number);
    });
  }
});

test('reviewed aliases are verified live and never confuse an article with an act number', async () => {
  await fixture(() => Response.json(cad), async requests => {
    const result = await discovery().findActs({ request: 'Mi serve l’articolo 52 del CAD, non so il numero della legge' });
    assert.equal(result.match, 'identified');
    assert.equal(result.article_reference, '52');
    assert.equal(result.ordering, 'reviewed_alias');
    assert.equal(result.traversal.items[0].alias.name, "Codice dell'amministrazione digitale");
    assert.match(result.traversal.items[0].alias.provenance, /normattiva\.it\/staticPage\/codici/);
    assert.equal(result.traversal.items[0].current, 'unknown');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.numeroProvvedimento, '82');
  });
});

test('contradictory common names and citations fail locally instead of choosing remembered coordinates', async () => {
  await fixture(() => { throw new Error('unexpected traffic'); }, async requests => {
    for (const request of ['Cerca l’art. 2043 del Codice civile, cioè della Legge 262/1942.',
      'Cerca l’articolo 2043 del Codice civile come LEGGE n. 2043 del 1942.']) {
      await assert.rejects(discovery().findActs({ request }), error => error.detail.category === 'invalid_input');
    }
    assert.equal(requests.length, 0);
  });
});

test('topics use observed relevance while supported date and status research preserves its constraints', async () => {
  const cases = [
    ['Quali norme riguardano la trasparenza amministrativa?', 'semplice', { testoRicerca: 'trasparenza amministrativa' }],
    ['Cerca decreti legislativi del 2023 sui contratti pubblici.', 'avanzata', { denominazioneAtto: 'DECRETO LEGISLATIVO', annoProvvedimento: '2023', testoRicerca: 'contratti pubblici' }],
    ['Quali atti sono stati pubblicati in Gazzetta Ufficiale dal 1° al 7 settembre 2026?', 'avanzata', { dataInizioPubProvvedimento: '2026-09-01', dataFinePubProvvedimento: '2026-09-07' }],
    ['Quali decreti legislativi sono stati emanati tra il 1° e il 31 marzo 2023?', 'avanzata', { denominazioneAtto: 'DECRETO LEGISLATIVO', dataInizioEmanazione: '2023-03-01', dataFineEmanazione: '2023-03-31' }],
    ['Quali norme sulla protezione dei dati risultavano in vigore il 25 maggio 2018?', 'avanzata', { testoRicerca: 'protezione dei dati', vigenza: '2018-05-25' }],
    ['Trova i codici dei contratti pubblici abrogati.', 'avanzata', { classeProvvedimento: '3', testoRicerca: 'codici dei contratti pubblici' }],
  ];
  for (const [request, route, expected] of cases) {
    await fixture(() => Response.json({ listaAtti: [], numeroAttiTrovati: 0, numeroPagine: 0, paginaCorrente: 1 }), async requests => {
      const result = await discovery().findActs({ request });
      assert.equal(result.match, 'no_candidates');
      assert.equal(result.ordering, route === 'semplice' ? 'observed_relevance' : 'chronological');
      assert.equal(requests.length, 1);
      assert.ok(requests[0].url.endsWith('/' + route));
      for (const [field, value] of Object.entries(expected)) assert.equal(requests[0].body[field], value, request);
      assert.equal(requests[0].body.numeroProvvedimento, undefined);
    });
  }
});

test('invalid dates, missing continuation and incomplete citations cannot become broad searches', async () => {
  await fixture(() => { throw new Error('unexpected traffic'); }, async requests => {
    for (const request of ['', 'Cerca gli atti emanati dal 31 dicembre 2024 al 1° gennaio 2024.',
      'pubblicati dal 2026-02-30 al 2026-03-01', 'Vai alla pagina successiva dei risultati sul TUEL.',
      'Continua con il cursore eyJxIjoiVFVFTCIsInAiOjJ9.', 'legge 241', 'decreti del 2023 emanati recentemente',
      'norme in vigore il 32 maggio 2018', 'articolo 3']) {
      await assert.rejects(discovery().findActs({ request }), error => error.detail.category === 'invalid_input', request);
    }
    assert.equal(requests.length, 0);
  });
});

function searchPage(items, page = 1, pages = 1, total = items.length) {
  return { listaAtti: items, numeroAttiTrovati: total, numeroPagine: pages, paginaCorrente: page };
}
const candidate = (n, title = `Synthetic act ${n}`) => ({ ...cad.listaAtti[0], codiceRedazionale: `SYN${n}`, titoloAtto: title });
const procurement = body => ({ ...candidate(Number(body.numeroProvvedimento)), numeroProvvedimento:body.numeroProvvedimento,
  annoProvvedimento:body.annoProvvedimento, dataEmanazione:({'36':'2023-03-31T00:00:00Z','50':'2016-04-18T00:00:00Z','163':'2006-04-12T00:00:00Z','82':'2005-03-07T00:00:00Z'})[body.numeroProvvedimento] });
test('literal discovery cursors resume the exact live-search position in a fresh reader', async () => {
  await fixture(({ body }) => Response.json(body.paginazione.paginaCorrente === 1
    ? searchPage([1,2,3,4,5].map(n => candidate(n)), 1, 2, 7)
    : searchPage([6,7].map(n => candidate(n)), 2, 2, 7)), async requests => {
    const first = await discovery().findActs({ request: 'trasparenza amministrativa' });
    assert.equal(first.traversal.progress, 'more');
    assert.equal(first.match, 'candidates');
    const next = await discovery().continueActs({ cursor: first.traversal.cursor });
    assert.equal(next.traversal.progress, 'complete');
    assert.deepEqual([...first.traversal.items, ...next.traversal.items].map(item => item.publication.codice_redazionale),
      ['SYN1','SYN2','SYN3','SYN4','SYN5','SYN6','SYN7']);
    assert.equal(next.ordering, 'observed_relevance');
    assert.equal(next.corpus, 'live');
    assert.equal(requests[1].body.paginazione.paginaCorrente, 2);
    const before = requests.length;
    for (const input of [{ cursor: 'invented' }, { cursor: first.traversal.cursor, request: 'different' },
      { cursor: first.traversal.cursor.slice(0,-1) + 'x' }]) {
      await assert.rejects(discovery().continueActs(input), error => ['invalid_input','invalid_cursor'].includes(error.detail.category));
    }
    await assert.rejects(discovery({ signingKey: Buffer.alloc(32, 20) }).continueActs({ cursor: first.traversal.cursor }), error => error.detail.category === 'invalid_cursor');
    assert.equal(requests.length, before);
  });
});

test('only a specifically unavailable relevance endpoint authorizes disclosed chronological fallback', async () => {
  for (const status of [404,405,501]) {
    await fixture(({ url }) => url.endsWith('/semplice') ? Response.json({ message: 'unavailable' }, { status })
      : Response.json(searchPage([candidate(1)])), async requests => {
      const page = await discovery().findActs({ request: 'trasparenza amministrativa' });
      assert.equal(page.ordering, 'degraded_chronological');
      assert.match(page.explanation, /unavailable/);
      assert.equal(page.match, 'candidates');
      assert.equal(requests.length, 2);
      assert.equal(requests[1].body.orderType, 'recente');
    });
  }
  for (const response of [Response.json({}, { status: 400 }), Response.json({}, { status: 422 }),
    Response.json({}, { status: 429 }), Response.json({}, { status: 500 }), Response.json({}, { status: 502 }),
    Response.json({ listaAtti: [{}], numeroAttiTrovati: 1, numeroPagine: 1, paginaCorrente: 1 }), Response.json({})]) {
    await fixture(() => response.clone(), async requests => {
      await assert.rejects(discovery().findActs({ request: 'trasparenza amministrativa' }), error => error.detail.retryability !== undefined);
      assert.equal(requests.length, 1);
      assert.ok(requests[0].url.endsWith('/semplice'));
    });
  }
});

test('multiple alias generations and uncertain currentness remain explained candidates', async () => {
  const request = 'Cerco l’articolo 108 del codice dei contratti oggi vigente.';
  await fixture(({ body }) => Response.json(searchPage([procurement(body)])), async requests => {
    const result = await discovery().findActs({ request });
    assert.equal(result.match, 'candidates');
    assert.equal(result.article_reference, '108');
    assert.equal(result.traversal.items.length, 3);
    assert.match(result.explanation, /status.*unknown/);
    assert.ok(result.traversal.items.every(item => item.current === 'unknown'));
    assert.deepEqual(requests.map(request => request.body.numeroProvvedimento), ['36','50','163']);
    const cadToday = await discovery().findActs({ request: 'CAD oggi vigente' });
    assert.equal(cadToday.match, 'candidates');
  });
});

test('search byte caps resume within an oversized page and never skip a candidate', async () => {
  const records = [candidate(1, 'è'.repeat(17000)), candidate(2, 'è'.repeat(17000)), candidate(3, 'third')];
  await fixture(() => Response.json(searchPage(records)), async () => {
    const first = await discovery().findActs({ request: 'trasparenza amministrativa' });
    assert.equal(first.traversal.progress, 'more');
    assert.equal(first.traversal.items.length, 1);
    assert.ok(Buffer.byteLength(JSON.stringify({ structuredContent: first, content: [{ type: 'text', text: JSON.stringify(first) }] })) <= 128 * 1024);
    const next = await discovery().continueActs({ cursor: first.traversal.cursor });
    assert.equal(next.traversal.progress, 'complete');
    assert.deepEqual([...first.traversal.items, ...next.traversal.items].map(item => item.publication.codice_redazionale), ['SYN1','SYN2','SYN3']);
    records[1] = candidate(2, 'changed title');
    await assert.rejects(discovery().continueActs({ cursor: first.traversal.cursor }), error => error.detail.code === 'live_search_page_changed');
  });
  await fixture(() => Response.json(searchPage([candidate(1, 'x'.repeat(70000))])), async () => {
    await assert.rejects(discovery().findActs({ request: 'topic' }), error => error.detail.code === 'response_limit_exceeded');
  });
});

test('interrupted alias verification keeps its exact useful prefix and resumes the unfinished generation', async () => {
  let fail = true;
  await fixture(({ body }) => {
    if (body.numeroProvvedimento === '50' && fail) return Response.json({}, { status: 429 });
    return Response.json(searchPage([procurement(body)]));
  }, async requests => {
    const first = await discovery().findActs({ request: 'codice dei contratti' });
    assert.equal(first.traversal.progress, 'interrupted');
    assert.equal(first.traversal.failure.error.category, 'rate_limited');
    assert.deepEqual(first.traversal.items.map(item => item.publication.codice_redazionale), ['SYN36']);
    fail = false;
    const next = await discovery().continueActs({ cursor: first.traversal.cursor });
    assert.equal(next.traversal.progress, 'complete');
    assert.deepEqual(next.traversal.items.map(item => item.publication.codice_redazionale), ['SYN50','SYN163']);
    assert.deepEqual(requests.map(request => request.body.numeroProvvedimento), ['36','50','50','163']);
  });
});

test('exact misses are never relaxed and mismatched or incomplete successful data is an operational failure', async () => {
  const bad = [searchPage([{ ...cad.listaAtti[0], numeroProvvedimento: '52' }]),
    searchPage([{ ...cad.listaAtti[0], dataGU: '2005-02-30' }]),
    { ...searchPage([candidate(1)]), numeroPagine: undefined },
    searchPage([], 1, 2, 7), searchPage([candidate(1),candidate(1)]),
    searchPage([candidate(1)], 2, 2, 1)];
  for (const response of bad) await fixture(() => Response.json(response), async requests => {
    await assert.rejects(discovery().findActs({ request: 'D.Lgs. 82/2005' }), error => error.detail.code === 'malformed_upstream_response');
    assert.equal(requests.length, 1);
  });
  await fixture(() => Response.json(searchPage([])), async requests => {
    const result = await discovery().findActs({ request: 'Legge 99999/1990' });
    assert.equal(result.match, 'no_candidates');
    assert.match(result.explanation, /does not prove legal absence/);
    assert.equal(requests.length, 1);
  });
});

test('full-date citations verify the supplied date and coherent alias citations remain usable', async () => {
  await fixture(() => Response.json(cad), async requests => {
    const found = await discovery().findActs({ request: 'CAD, D.Lgs. 82/2005, articolo 52' });
    assert.equal(found.match, 'identified');
    await assert.rejects(discovery().findActs({ request: 'D.Lgs. 8 marzo 2005, n. 82' }), error => error.detail.code === 'malformed_upstream_response');
    assert.equal(requests[1].body.giornoProvvedimento, '8');
    assert.equal(requests[1].body.meseProvvedimento, '3');
  });
});

test('historical alias context does not become an act-year filter and exact citations do not discard research constraints', async () => {
  await fixture(() => Response.json(cad), async requests => {
    const page = await discovery().findActs({ request: 'CAD nel 2018' });
    assert.equal(page.match,'candidates');
    assert.equal(requests[0].body.annoProvvedimento,'2005');
    assert.match(page.explanation,/historical.*status.*unknown/);
    const before = requests.length;
    for (const request of ['D.Lgs. 82/2005 pubblicato dal 2020-01-01 al 2020-02-01',
      'D.Lgs. 82/2005 in vigore il 2026-02-30', 'D.Lgs. 82/2005 abrogato', 'D.Lgs. 82/2005 nel 2018', 'Legge 241/1990 e DPR 445']) {
      await assert.rejects(discovery().findActs({ request }), error => error.detail.category === 'invalid_input', request);
    }
    assert.equal(requests.length,before);
  });
});

test('the accepted routing prototype requests replay through the production discovery seam', async () => {
  const cases = JSON.parse(readFileSync(new URL('./fixtures/discovery/routing-cases.json',import.meta.url)));
  for (const example of cases) {
    await fixture(() => Response.json(searchPage([])), async requests => {
      if (['reject','clarify','continue'].includes(example.route) || example.conflict) {
        await assert.rejects(discovery().findActs({request:example.prompt}),error=>error.detail.category==='invalid_input',example.id);
        assert.equal(requests.length,0,example.id); return;
      }
      const result=await discovery().findActs({request:example.prompt});
      assert.equal(result.match,'no_candidates',example.id);
      for (const token of example.articleTokens ?? (example.article ? [example.article] : [])) {
        assert.ok(result.article_reference?.toUpperCase().includes(token.toUpperCase()),example.id);
      }
      if (example.exact) {
        assert.equal(result.ordering,'exact_citation',example.id);
        assert.equal(requests[0].body.denominazioneAtto,example.exact.actType,example.id);
        assert.equal(requests[0].body.annoProvvedimento,String(example.exact.year),example.id);
        assert.equal(requests[0].body.numeroProvvedimento,example.exact.number,example.id);
      }
      if (example.published) {
        assert.equal(requests[0].body.dataInizioPubProvvedimento,example.published.from,example.id);
        assert.equal(requests[0].body.dataFinePubProvvedimento,example.published.to,example.id);
      }
      if (example.issued) {
        assert.equal(requests[0].body.dataInizioEmanazione,example.issued.from,example.id);
        assert.equal(requests[0].body.dataFineEmanazione,example.issued.to,example.id);
      }
      if (example.inForceOn) assert.equal(requests[0].body.vigenza,example.inForceOn,example.id);
      if (example.versionClass) assert.equal(requests[0].body.classeProvvedimento,'3',example.id);
    });
  }
});

test('malformed exact metadata is a typed upstream failure and preserves any validated prefix', async () => {
  const bad = { ...candidate(2), denominazioneAtto: 42 };
  await fixture(() => Response.json(searchPage([bad])), async () => {
    await assert.rejects(discovery().findActs({request:'D.Lgs. 82/2005'}),error=>error.detail?.code==='malformed_upstream_response');
  });
  await fixture(() => Response.json(searchPage([candidate(1),bad])), async () => {
    const page=await discovery().findActs({request:'D.Lgs. 82/2005'});
    assert.equal(page.traversal.progress,'interrupted');
    assert.equal(page.traversal.items[0].publication.codice_redazionale,'SYN1');
    assert.equal(page.traversal.failure.error.code,'malformed_upstream_response');
  });
});

test('unsupported or negated constraints and contradictory alias families fail before discovery traffic', async () => {
  await fixture(() => {throw new Error('unexpected traffic')},async requests=>{
    for(const request of ['R.D. 262','DPCM 12','norme non abrogate','norme non aggiornate',
      'CAD e Codice civile, D.Lgs. 82/2005']) {
      await assert.rejects(discovery().findActs({request}),error=>error.detail?.category==='invalid_input',request);
    }
    assert.equal(requests.length,0);
  });
});

test('article suffixes separated by spaces remain part of the retrieval intent',async()=>{
  await fixture(()=>Response.json(cad),async()=>{
    const page=await discovery().findActs({request:'Cerca articolo 52 bis del CAD'});
    assert.equal(page.article_reference,'52-bis');
  });
});

test('pagination totals must agree with page count and the final-page size',async()=>{
  for(const response of [searchPage([candidate(1)],1,2,1),searchPage([candidate(1)],1,1,6)]) {
    await fixture(()=>Response.json(response),async()=>{
      await assert.rejects(discovery().findActs({request:'topic'}),error=>error.detail?.code==='malformed_upstream_response');
    });
  }
  await fixture(({body})=>Response.json(searchPage([1,2,3,4,5].map(n=>candidate(n+10*body.paginazione.paginaCorrente)),body.paginazione.paginaCorrente,2,6)),async()=>{
    const first=await discovery().findActs({request:'topic'});
    await assert.rejects(discovery().continueActs({cursor:first.traversal.cursor}),error=>error.detail?.code==='malformed_upstream_response');
  });
});

test('reviewed alias URNs cannot contradict the live issuance identity',async()=>{
  await fixture(()=>Response.json(searchPage([{...cad.listaAtti[0],dataEmanazione:'2005-03-08T00:00:00Z'}])),async()=>{
    await assert.rejects(discovery().findActs({request:'CAD'}),error=>error.detail?.code==='malformed_upstream_response');
  });
});

test('planned attempt caps return more and continuations receive fresh shared allowances',async()=>{
  await fixture(({body})=>Response.json(searchPage([procurement(body)])),async requests=>{
    const upstream=new UpstreamRuntime({composedAttempts:1});
    let page=await discovery({upstream}).findActs({request:'codice dei contratti'});
    const ids=[];
    for(let count=0;;count++) {
      assert.ok(count<4);
      ids.push(...page.traversal.items.map(item=>item.publication.codice_redazionale));
      if(page.traversal.progress==='complete')break;
      assert.equal(page.traversal.progress,'more');
      page=await discovery({upstream}).continueActs({cursor:page.traversal.cursor});
    }
    assert.deepEqual(ids,['SYN36','SYN50','SYN163']);
    assert.equal(requests.length,3);
  });
});

test('continuation keeps its chosen ordering and never switches after a relevance page',async()=>{
  await fixture(({body})=>body.paginazione.paginaCorrente===1
    ?Response.json(searchPage([1,2,3,4,5].map(n=>candidate(n)),1,2,6))
    :Response.json({}, {status:404}),async requests=>{
    const page=await discovery().findActs({request:'topic'});
    await assert.rejects(discovery().continueActs({cursor:page.traversal.cursor}),error=>error.detail.http_status===404);
    assert.equal(requests.length,2);
    assert.ok(requests.every(request=>request.url.endsWith('/semplice')));
  });
  await fixture(({url,body})=>url.endsWith('/semplice')?Response.json({}, {status:404})
    :Response.json(body.paginazione.paginaCorrente===1?searchPage([1,2,3,4,5].map(n=>candidate(n)),1,2,6):searchPage([candidate(6)],2,2,6)),async requests=>{
    const first=await discovery().findActs({request:'topic'});
    const next=await discovery().continueActs({cursor:first.traversal.cursor});
    assert.equal(next.ordering,'degraded_chronological');
    assert.equal(next.traversal.progress,'complete');
    assert.deepEqual(requests.map(request=>request.url.split('/').at(-1)),['semplice','avanzata','avanzata']);
  });
});

test('captured official CAD, TUEL and relevance responses cross the production discovery interface',async()=>{
  const tuel=JSON.parse(readFileSync(new URL('./fixtures/discovery/tuel-exact-2026-10-05.json',import.meta.url)));
  const topic=JSON.parse(readFileSync(new URL('./fixtures/discovery/transparency-simple-2026-10-05.json',import.meta.url)));
  await fixture(({url,body})=>Response.json(url.endsWith('/semplice')?topic:body.numeroProvvedimento==='267'?tuel:cad),async()=>{
    const local=await discovery().findActs({request:'Cosa dice l’art. 42 del TUEL?'});
    assert.equal(local.match,'identified');
    assert.equal(local.article_reference,'42');
    assert.equal(local.traversal.items[0].publication.codice_redazionale,'000G0304');
    const digital=await discovery().findActs({request:'CAD'});
    assert.equal(digital.traversal.items[0].official_urn,'urn:nir:stato:decreto.legislativo:2005-03-07;82');
    const topical=await discovery().findActs({request:'trasparenza amministrativa'});
    assert.equal(topical.ordering,'observed_relevance');
    assert.equal(topical.match,'candidates');
    assert.equal(topical.traversal.progress,'more');
  });
});

test('incompatible signed cursor plans and operations fail before continuation traffic',async()=>{
  await fixture(()=>Response.json(searchPage([1,2,3,4,5].map(n=>candidate(n)),1,2,6)),async requests=>{
    const first=await discovery().findActs({request:'topic'});
    const original=JSON.parse(Buffer.from(first.traversal.cursor.slice(3).split('.')[0],'base64url').toString());
    const before=requests.length;
    for(const change of [data=>{data.v=2},data=>{data.operation='read_act'},data=>{delete data.plan.query},
      data=>{data.plan.route='exact';data.plan.citation={type:'LEGGE',year:'1990',number:'241'}},data=>{data.plan.filters={classeProvvedimento:'3'}}]) {
      const data=structuredClone(original);change(data);
      const body=Buffer.from(JSON.stringify(data)).toString('base64url');
      const cursor='d1_'+body+'.'+createHmac('sha256',key).update(body).digest('base64url');
      await assert.rejects(discovery().continueActs({cursor}),error=>error.detail?.category==='invalid_cursor');
    }
    assert.equal(requests.length,before);
  });
});
