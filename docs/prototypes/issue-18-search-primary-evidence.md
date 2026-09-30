# Issue 18: primary evidence for Normattiva lookup and search routing

## Scope and method

This note isolates what the official Normattiva interfaces document and what the production service did in bounded live controls for [Prototype exact lookup and discovery search routing](https://github.com/adellorto/normattiva-mcp/issues/18). It does not decide the tool design by itself and does not treat an observed production quirk as a contract.

- Test date: **2026-09-30** (workspace date, Europe/Rome).
- Repository source baseline: commit `90af05371bafdbb72ae870255e1ee2f9788b27cc`
  (the isolated issue-18 worktree; production source was not modified).
- Production response `Date` headers: **2026-09-30 13:51:31–14:05:48 GMT**.
- Production base URL: `https://api.normattiva.it/t/normattiva.api`; endpoints: `POST /bff-opendata/v1/api/v1/ricerca/semplice`, `POST /bff-opendata/v1/api/v1/ricerca/avanzata`, and `POST /bff-opendata/v1/api/v1/atto/dettaglio-atto`.
- Requests used `Content-Type: application/json`, `Accept: application/json`, and `Origin: https://dati.normattiva.it`.
- Results below retain the exact request body and the response fields relevant to the routing question. Titles are abbreviated only where their full text is immaterial.

Primary sources are the [official API manual](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf), [generated OpenAPI reference](https://dati.normattiva.it/assets/come_fare_per/Normattiva%20OpenData.html), [OpenData guide](https://dati.normattiva.it/Come-scaricare-i-dati), [curated code list](https://www.normattiva.it/staticPage/codici), and current repository source ([`api.ts`](../../packages/core/src/api.ts), [`tools.ts`](../../packages/core/src/tools.ts), [`types.ts`](../../packages/core/src/types.ts)). “Documented” means an official artifact says it; “observed” means production returned it on the test date; “inference” is a design implication rather than a guarantee.

## What is actually documented

The manual documents simple search as free words in title and/or body (`testoRicerca`), an ordering field, and pagination. It documents advanced search as the conjunction of zero or more of: act denomination, title text, body text, act date components, enactment range, publication range, in-force date, provision class, ordering, and pagination. The September 2025 revision added `annoProvvedimento`, `giornoProvvedimento`, `meseProvvedimento`, and `numeroProvvedimento` to advanced search.

The manual says `orderType` admits only `"recente"` and `"vecchio"`. The generated OpenAPI schema weakens this to an unconstrained string. Neither official artifact documents `"rilevante"` as a value.

The manual documents only these input facets in `filtriMap`:

- `codice_tipo_provvedimento`
- `anno_provvedimento`

Responses expose three facet dimensions: those two plus `descrizione_emettitore`. The generated OpenAPI schema models `filtriMap` as a string-valued map but does not enumerate semantically valid keys.

The production typological endpoints returned denomination mappings `PLL` -> `DECRETO LEGISLATIVO`, `PLE` -> `LEGGE`, and `PRD` -> `REGIO DECRETO`; the class mappings were `1` -> “senza aggiornamenti”, `2` -> “aggiornato”, and `3` -> “abrogato”.

Therefore `denominazioneAtto` takes the Italian label (`"DECRETO LEGISLATIVO"`), while `filtriMap.codice_tipo_provvedimento` takes the typological code (`"PLL"`). Treating a common name such as `"CODICE CIVILE"` as a denomination is not valid.

The manual documents normal JSON response metadata (`numeroAttiTrovati`, `numeroPagine`, `paginaCorrente`, `numeroElementiPerPagina`) and generic 4xx/5xx errors. It does not promise uniqueness for an exact tuple, relevance ranking, rejection of unknown order values, or a particular behavior for an out-of-range page.

## Exact numbered-act lookup

All exact controls used the advanced endpoint and the exact input shape `{"denominazioneAtto":"<official denomination label>","annoProvvedimento":"<year>","numeroProvvedimento":"<number>","orderType":"recente","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":5}}`.

The live requests intentionally mirror the current repository and sent the date
components and act number as JSON strings. Production accepted them. The current
generated OpenAPI schema instead declares `annoProvvedimento`,
`meseProvvedimento`, `giornoProvvedimento`, and `numeroProvvedimento` as JSON
integers. String acceptance is therefore an observation, not a documented input
guarantee; a future public schema should not infer its scalar types from these
successful requests alone.

Observed production results:

| Exact tuple | HTTP | Total | Sole result | `codiceRedazionale` | `dataGU` |
| --- | ---: | ---: | --- | --- | --- |
| `REGIO DECRETO`, `1942`, `262` | 200 | 1 | REGIO DECRETO 16 marzo 1942, n. 262 (Codice civile) | `042U0262` | `1942-04-04` |
| `DECRETO LEGISLATIVO`, `2005`, `82` | 200 | 1 | DECRETO LEGISLATIVO 7 marzo 2005, n. 82 (CAD) | `005G0104` | `2005-05-16` |
| `DECRETO LEGISLATIVO`, `2023`, `36` | 200 | 1 | DECRETO LEGISLATIVO 31 marzo 2023, n. 36 | `23G00044` | `2023-03-31` |
| `DECRETO LEGISLATIVO`, `2016`, `50` | 200 | 1 | DECRETO LEGISLATIVO 18 aprile 2016, n. 50 | `16G00062` | `2016-04-19` |
| `LEGGE`, `1990`, `241` | 200 | 1 | LEGGE 7 agosto 1990, n. 241 | `090G0294` | `1990-08-18` |

Negative exact control: `{"denominazioneAtto":"LEGGE","annoProvvedimento":"1990","numeroProvvedimento":"99999","orderType":"recente","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":3}}`.

returned HTTP 200 with `numeroAttiTrovati: 0`, `numeroPagine: 0`, and `listaAtti: []`.

**Inference:** an exact-lookup operation has a sound upstream primitive: the advanced triple. The client still has to impose strict result semantics (zero = no exact search match, one matching row = success, more than one = ambiguity) because the API does not document tuple uniqueness. A zero-result search is not, by itself, verified legal absence. Exact lookup must not weaken constraints automatically after a zero.

## Simple `rilevante` discovery

The following shared shape was tested against the simple endpoint: `{"testoRicerca":"<query>","orderType":"rilevante","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":10}}`.

Although `"rilevante"` is not a documented order value, production accepted it with HTTP 200.

| Query | Total | Relevant canonical result in first 10 |
| --- | ---: | --- |
| `Codice civile` | 22,573 | Codice civile (`042U0262`) rank 1 |
| `Codice dell amministrazione digitale` | 2,930 | CAD (`005G0104`) rank 3 |
| `codice dei contratti pubblici` | 1,663 | D.Lgs. 36/2023 rank 3; D.Lgs. 50/2016 rank 5; D.Lgs. 163/2006 rank 6 |
| `intelligenza artificiale` | 93 | D.Lgs. 160/2026 rank 1; Legge 132/2025 rank 2 |

The equivalent `Codice civile` request with `orderType: "recente"` returned the same 22,573-hit corpus but put recent, unrelated acts first; the Civil Code was not in the first five. Thus relevance ordering is materially useful for clean common-name and topical discovery.

Article-bearing phrases behaved differently:

| Query | Total | Intended act in first 10 |
| --- | ---: | --- |
| `articolo 2043 codice civile` | 3,050 | No; Civil Code absent |
| `CAD articolo 52` | 2,289 | No; CAD absent |

The first ten for `articolo 2043 codice civile` were other acts whose text mentions some of the terms. The first ten for `CAD articolo 52` were likewise unrelated to the requested CAD article. This is consistent with broad full-text retrieval rather than semantic parsing of an act alias plus article reference.

A topical control worked better. For `intelligenza artificiale`, rank 1 was D.Lgs. 9 settembre 2026, n. 160, whose title directly concerns the EU Artificial Intelligence Act; rank 2 was Legge 23 settembre 2025, n. 132, the national AI law.

Ordering negative controls:

- Advanced title query `titoloRicerca: "contratti pubblici"` returned the same total (2,328) and the same first ten in the same order for `"rilevante"` and `"recente"`.
- Simple `Codice civile` with `orderType: "banana"` was accepted with HTTP 200 and produced relevance-like ordering, including the Civil Code at rank 1.

**Inference:** `rilevante` is valuable but observational. A discovery tool can use it behind the interface, with regression controls and an explicit, observably weaker fallback to a documented chronological order if production starts rejecting it. The tool must not expose arbitrary order strings or claim a documented relevance contract. Mixed alias-plus-article prompts need routing/decomposition before search; merely sending the whole utterance to simple search is unreliable.

## Supported facets and advanced filters

**Documented facets.** This exact simple request exercised both documented facet keys: `{"testoRicerca":"codice","orderType":"rilevante","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":5},"filtriMap":{"codice_tipo_provvedimento":"PLL","anno_provvedimento":2023}}`.

Observed output: HTTP 200, 33 hits, seven pages, all five first-page rows were 2023 decreti legislativi, and D.Lgs. 36/2023 was rank 1. The response returned facet keys `anno_provvedimento`, `codice_tipo_provvedimento`, and `descrizione_emettitore`.

**Undocumented emitter facet.** Exact input: `{"testoRicerca":"Codice civile","orderType":"rilevante","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":5},"filtriMap":{"descrizione_emettitore":"MINISTERO DELLA GIUSTIZIA"}}`.

Observed output: HTTP 200 and 95 hits, compared with 22,573 unfiltered hits. Production therefore honored the response-only facet key on the test date. This behavior is not listed among supported input facets in the manual.

Unknown-key negative control:

Exact unknown-key negative control: `{"testoRicerca":"Codice civile","orderType":"rilevante","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":5},"filtriMap":{"not_a_facet":"x"}}`.

returned HTTP 500 with `{ "message": "Errore generico della chiamata, riprovare più tardi", "code": "1000" }`.

**Inference:** use an allow-list. Type and year survive as supported facets. Emitter may be kept experimental/internal only if its value is worth the compatibility risk; the generic OpenAPI map is not permission to forward arbitrary keys.

**Full advanced-filter conjunction.** The following exact request exercised every advanced field relevant to the existing wrapper: `{"denominazioneAtto":"DECRETO LEGISLATIVO","titoloRicerca":"Codice","testoRicerca":"contratti","annoProvvedimento":"2023","meseProvvedimento":"3","giornoProvvedimento":"31","numeroProvvedimento":"36","dataInizioEmanazione":"2023-03-31","dataFineEmanazione":"2023-03-31","dataInizioPubProvvedimento":"2023-03-31","dataFinePubProvvedimento":"2023-03-31","vigenza":"2026-09-30","classeProvvedimento":"2","orderType":"recente","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":5}}`.

Observed output: HTTP 200, exactly one result, D.Lgs. 36/2023 (`23G00044`). Together with the conflicting controls below, this supports conjunctive treatment of populated advanced fields.

## Pagination

The bounded query was `testoRicerca: "TUEL"`, `orderType: "rilevante"`, three items per page.

Page 1 exact request: `{"testoRicerca":"TUEL","orderType":"rilevante","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":3}}`.

Page 1 returned total 4, pages 2, and codes `000G0304`, `011G0160`, `14G00138`. Page 2, with only `paginaCorrente` changed to 2, returned `24G00035`. Page 3 returned HTTP 200, total 4, pages 2, `paginaCorrente: 3`, and an empty `listaAtti`.

Every successful search response tested echoed `numeroElementiPerPagina: 0`, despite honoring the requested page size (page counts and row counts were consistent with the request).

**Inference:** pagination should trust the requested size and `numeroPagine`/actual rows, not the echoed `numeroElementiPerPagina`. An out-of-range page is a normal empty result, not an error. A client should stop at `numeroPagine`, and discovery consumers should preserve the requested page in their own response envelope.

## Civil Code article 2043 and CAD article 52

Exact act lookup found both parent acts, but article retrieval exposes a separate structural limitation.

**CAD article 52.** This documented-shape exact request succeeded: `{"dataGU":"2005-05-16","codiceRedazionale":"005G0104","idArticolo":52,"sottoArticolo":1,"sottoArticolo1":0,"dataVigenza":"2026-09-30","idGruppo":0,"progressivo":0,"versione":0}`.

Observed output: HTTP 200, `success: true`, title D.Lgs. 82/2005, article heading `Art. 52`, current-version interval `20180127`–`99999999`, and text headed “Accesso telematico e riutilizzo dei dati”. The URN endpoint also accepted `urn:nir:stato:decreto.legislativo:2005-03-07;82~art52` and returned the article.

**Civil Code article 2043.** The same normal shape with `idGruppo: 0` returned HTTP 404. Supplying the correct group alone (`idGruppo: 258`) still returned 404 because the service defaulted `flagTipoArticolo` to 0.

The official public Normattiva act tree exposed this navigation record for article 2043: `art.versione=1`, `art.idGruppo=258`, `art.flagTipoArticolo=2`, `art.codiceRedazionale=042U0262`, `art.idArticolo=2043`, `art.idSottoArticolo=1`, `art.idSottoArticolo1=10`, `art.dataPubblicazioneGazzetta=1942-04-04`, `art.progressivo=0`.

The generated OpenAPI schema, unlike the prose manual and current repository type, includes `flagTipoArticolo` and `tipoDettaglio`. With those fields added, this exact request succeeded: `{"dataGU":"1942-04-04","codiceRedazionale":"042U0262","idArticolo":2043,"sottoArticolo":1,"sottoArticolo1":10,"flagTipoArticolo":"2","dataVigenza":"2026-09-30","idGruppo":258,"progressivo":0,"versione":0,"tipoDettaglio":"singolavigenza"}`.

Observed output: HTTP 200, `success: true`, title R.D. 262/1942, and article text beginning “Art. 2043. (Risarcimento per fatto illecito). Qualunque fatto doloso o colposo…”.

The current repository's `DettaglioAttoBody` and `read_article` input omit `flagTipoArticolo` and `tipoDettaglio`; search results also do not reveal `idGruppo` or `flagTipoArticolo`. Therefore an exact act hit is not sufficient, by itself, to make Civil Code article retrieval work through the current tool surface.

**Inference:** route `Civil Code article 2043` as (1) resolve the common act name to the exact act, then (2) read the article with structure metadata if available. Do not interpret `2043` as an act number. Article structure discovery is a separate concern from the search split and remains unresolved by a strict `lookup_act` alone.

## Current versus superseded procurement codes

Unqualified exact lookup returned one result for both D.Lgs. 36/2023 and D.Lgs. 50/2016. Adding `vigenza: "2026-09-30"` also returned one result for each, so `vigenza` did **not** discriminate current from superseded in this control.

Provision-class controls did discriminate:

| Exact act | `classeProvvedimento: "2"` | `classeProvvedimento: "3"` |
| --- | ---: | ---: |
| D.Lgs. 36/2023 | 1 hit | 0 hits |
| D.Lgs. 50/2016 | 0 hits | 1 hit |

The official [curated code list](https://www.normattiva.it/staticPage/codici) independently labels:

- D.Lgs. 36/2023 as “Nuovo Codice dei contratti pubblici”;
- D.Lgs. 50/2016 as in force until 31 March 2023;
- D.Lgs. 163/2006 as in force until 18 April 2016.

**Inference:** a common-name discovery can legitimately return several generations, but a “current code” request needs an explicit currentness policy. For these controls, class 3 and the official curated list were useful; `vigenza` alone was not. `classeProvvedimento: "2"` is documented as “updated”, not generically as “currently in force”, so do not silently redefine it beyond the evidence.

## Publication-date research

Exact request: `{"dataInizioPubProvvedimento":"2026-09-25","dataFinePubProvvedimento":"2026-09-30","orderType":"recente","paginazione":{"paginaCorrente":1,"numeroElementiPerPagina":10}}`.

Observed output: HTTP 200, three hits, one page:

1. D.L. 29 settembre 2026, n. 168, `dataGU: 2026-09-29`, `26G00188`;
2. D.L. 28 settembre 2026, n. 167, `dataGU: 2026-09-28`, `26G00186`;
3. Legge 25 settembre 2026, n. 166, `dataGU: 2026-09-25`, `26G00184`.

This matches the manual's publication-range fields and shows inclusive boundary behavior in this sample. The official documentation does not explicitly guarantee inclusivity, so that detail remains observational.

**Inference:** “published in the Gazzetta Ufficiale during a window” belongs to advanced discovery, preserving `dataInizioPubProvvedimento`/`dataFinePubProvvedimento`; it is not an exact lookup and should not be rerouted to the changed-acts endpoint.

## Conflicting inputs, rejection, and fallback

All controls used the advanced endpoint unless stated otherwise.

| Exact input delta | HTTP/output | Meaning |
| --- | --- | --- |
| `LEGGE`, year `2023`, number `36` | 200, zero hits | Wrong denomination is a normal miss. |
| Exact D.Lgs. 36/2023 plus `titoloRicerca: "trasparenza"` | 200, zero hits | Populated advanced fields combine rather than falling back. |
| `denominazioneAtto: "CODICE CIVILE"`, year `1942`, number `262` | 200, zero hits | Common name is not a valid denomination label. |
| `numeroProvvedimento: "2043"` alone | 200, 29 hits | Article number misrouted as act number produces plausible but unrelated acts. |
| Exact nonexistent Legge 99999/1990 | 200, zero hits | “Not found” is not an HTTP error. |
| Empty body `{}` | 500 with timestamped generic Internal Server Error | Client-side validation is required. |
| Reversed enactment range (`2024-12-31` to `2024-01-01`) | 200 with an empty body | The transport can succeed without usable JSON. |
| Simple unknown facet key | 500, code `1000` | Do not forward arbitrary facets. |
| Simple unknown `orderType: "banana"` | 200, relevance-like results | Do not treat server acceptance as validation. |

For the `numeroProvvedimento: "2043"` control, the first results included D.P.R. n. 2043 from 1963, 1962, and 1952 and R.D. n. 2043 from 1940 and 1939. They are valid numbered acts and therefore especially dangerous as a silent fallback for “article 2043”.

**Inference:**

- Validate before calling production: at least one criterion, coherent date ranges, recognized denomination labels/facet keys, and a closed ordering enum.
- Treat explicit coordinates as constraints, not hints. If an exact tuple misses or conflicts, return a structured miss/conflict; never retry after dropping the conflicting field.
- Fallback from exact routing to discovery is safe only when the input was genuinely non-exact (a common name, acronym, or topic), not when an explicit exact tuple failed.
- Separate `article` from `act number` at the interface or routing layer. A single undifferentiated `numero` field invites convincing false positives.
- Because HTTP 200 can contain empty or malformed-for-the-schema content, validate the response body, not just status.

## Implications for the issue-18 prototype

The primary-source evidence supports these shapes and rules:

1. **Strict exact lookup:** denomination + year + act number, with optional exact date parts only when provided. Validate the denomination against the official typological catalog. Interpret 0/1/>1 explicitly; do not weaken on a miss.
2. **Exploratory discovery:** a simple free-text path using relevance ordering internally, plus the documented advanced filters and facets. Keep publication-date research here. Preserve pagination explicitly.
3. **Routing:**
   - numbered citation such as `D.Lgs. 82/2005` -> exact lookup;
   - common name/acronym such as `CAD` or `Codice civile` -> relevance discovery or a small canonical-name resolver, then exact metadata;
   - common name plus article -> resolve the act without the article tokens, then article retrieval;
   - topic -> relevance discovery;
   - explicit filters/date window -> advanced discovery;
   - conflicting explicit inputs -> report conflict/miss, no fallback.
4. **Currentness:** do not use `vigenza` alone to select the current procurement code. Surface multiple generations or apply an explicit, documented currentness rule.
5. **Closed capabilities:** allow-list documented facets and order values at the public interface. If the implementation uses observational `rilevante` internally, monitor it and retain a documented-order fallback.

What remains uncertain from first-party evidence alone:

- Whether `rilevante` is intentionally supported and stable; it is valuable in production but undocumented.
- The exact ranking algorithm, tie stability, and whether relevance works consistently outside simple search.
- Whether exact denomination/year/number is globally unique across all historical material.
- General semantics of `vigenza` when some but not all of an act has ceased to apply.
- Stable support for the emitter facet.
- How to discover article structure metadata (`idGruppo`, `flagTipoArticolo`) synchronously for arbitrary structured codes.

The current one-tool implementation always calls advanced search and restricts order to documented `recente`/`vecchio`, so it cannot reproduce the useful common-name ranking observed with simple `rilevante`. It also lets exact and exploratory fields coexist in one flat schema without imposing strict no-fallback semantics. These facts make the two-route experiment technically meaningful; whether two public tools are better than one discriminated public tool still depends on the model/tool-call comparison outside this note.

## Reproducibility limitations

- Search corpora, publication counts, ranking, and act status can change after 2026-09-30.
- Only bounded first pages and a few controlled later pages were inspected; the note does not claim corpus-wide precision or recall.
- No load, latency, rate-limit, or concurrent-pagination characterization was performed.
- The production service sometimes accepts values outside the prose manual and sometimes returns HTTP 200 with no JSON body. Such behavior is reported as observation, not endorsed as an API guarantee.
- Normattiva itself states that electronic texts are informational and that the printed Gazzetta Ufficiale prevails in case of discrepancy; this prototype evidence concerns retrieval behavior, not legal authenticity.
