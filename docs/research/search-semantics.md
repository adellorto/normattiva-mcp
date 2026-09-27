# Normattiva search semantics and relevance signals

Research for [Determine Normattiva search semantics and relevance signals](https://github.com/adellorto/normattiva-mcp/issues/8), performed 2026-09-27 against commit `90af053`, the hosted MCP, the production Normattiva OpenData API, and the current official IPZS documentation.

## Answer

The reported relevance limitation is real **for the current MCP path**, but not for every Normattiva search surface. `search_acts` always calls the synchronous advanced endpoint and exposes only `order: "recente" | "vecchio"`; that endpoint returned chronological results even when given `rilevante`. In contrast, the live official simple-search endpoint accepted `orderType: "rilevante"` and ranked the report's common-name and topical targets near the top.

That relevance behavior is not part of the published OpenData contract. The current IPZS manual documents only `recente` and `vecchio`, while the OpenAPI schema declares `orderType` merely as a string. The live simple endpoint also treated missing, empty, and unknown order values as relevance-like requests, and relevance ties moved between repeated calls. It is therefore a material upstream capability to evaluate, not an unconditional guarantee.

The report understates a more important semantic detail: in the tested advanced-search fields, multiple words behaved as an **OR**, not as an exact/literal phrase. Quotation marks did not change the results. Thus a title search for `contratti pubblici` means, in observed behavior, roughly “title contains *contratti* OR *pubblici*,” then orders the union chronologically. This makes common-name and topical discovery much noisier than a mere lack of relevance sorting would suggest.

The report also combines two independent causes in some model tests:

1. `denominazione` and `numero` identify the **act type** and **act number**, not a common name and article number. Model-generated values such as `CODICE CIVILE` / `2043` are invalid for that purpose.
2. Even correctly placed advanced title/body keywords can produce thousands of OR-matched results, with no relevance order on that endpoint.

Exact identifier search remains reliable. On the same date, exact type/year/act-number controls returned exactly the expected CAD, public-contracts code, Civil Code, and Law 241/1990.

## Classification of the report's claims

| Claim | Finding |
|---|---|
| `search_acts` offers only `recente` and `vecchio`; no relevance order exists. | **Confirmed for the MCP and advanced endpoint; false for Normattiva as a whole.** The live simple endpoint has an undocumented relevance order. |
| `titolo: "contratti pubblici"` returns 2,328 results and not D.Lgs. 36/2023 in the first five recent results. | **Reproduced exactly** through both the production API and hosted MCP. |
| `testo: "trasparenza amministrativa"` returns 16,869 results and not the transparency code in the first five. | **Reproduced exactly** against the production API. |
| Text/title searches are “literal.” | **Not supported; live controls contradict it.** Tested multiword inputs behaved as token OR queries. |
| Exact `denominazione` + year + number search works. | **Confirmed.** Four controls each returned one correct act. |
| `CODICE CIVILE` and `D.Lgs. 50/2016` are invalid `denominazione` values. | **Confirmed.** Neither is among the 30 live values from the official denomination typology. |
| The CAD common-name attempt failed because text search has no relevance. | **Mixed cause.** `denominazione: "LEGGE"` excludes the CAD, which is a `DECRETO LEGISLATIVO`; separately, the keyword input produces thousands of chronological matches. The same live request currently returns 5,569 laws, not a clean “no match.” |
| Zero search results prove that an act or article does not exist. | **False.** Invalid filters return HTTP 200 with zero results, while article numbers used as act numbers can also return unrelated but plausible acts. |

The source of the first two numeric claims is the user report, `Normattiva MCP – Report di test e proposte di miglioramento.docx`. The independent reproduction below obtained the same counts.

## Officially documented surface

The current [IPZS API manual, revision 10, §§1.2.5 and 1.3.1–1.3.4](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf) defines:

- a simple search whose `testoRicerca` covers title and/or body;
- an advanced search with separate `titoloRicerca` and `testoRicerca` fields;
- `denominazioneAtto` as an act type;
- `annoProvvedimento` and `numeroProvvedimento` as the act's year and number;
- page number and elements per page;
- only `recente` and `vecchio` as order choices; and
- optional facet filters for act-type code and year.

The repository's converted Markdown stops at revision 08; the linked official PDF is revision 10 dated 2026-03-10. The search contract is materially consistent, while revision 10 adds a separate URN-detail endpoint.

The [official OpenAPI descriptor](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json) confirms those request fields, but declares `orderType` as an unconstrained string rather than an enum. Its search response contains:

- `listaAtti`;
- `numeroPagine`, `numeroAttiTrovati`, and `paginaCorrente`;
- `facetMap`; and
- optional `hlTitoli` and `hlArticoli` highlight fields.

It defines no relevance score, rank reason, exact-match flag, or documented relevance order. It also declares the search strings simply as strings and does not document Boolean or quotation syntax. Consequently, the OR, quoting, and simple-search relevance observations below are live behavior, not a promised query language.

The live [denomination typology endpoint](https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/tipologiche/denominazione-atto) returned 30 allowed values. They include `REGIO DECRETO`, `DECRETO LEGISLATIVO`, and `LEGGE`, but not common names or free citations.

## Reproduction and controls

### Tight MCP-level loop

A temporary stdio MCP harness built the current source, initialized the server, inspected the emitted `search_acts` schema, and ran three calls. It was run twice and produced the same verdict:

```text
PASS: broad-search symptom reproduced; exact and invalid-filter controls distinguish the causes
```

The corresponding hosted-MCP calls returned:

| Call | Total | First result |
|---|---:|---|
| `titolo="contratti pubblici", per_page=5` | 2,328 | `26G00101`, a 2026 regulation mentioning “giochi pubblici” |
| `denominazione="DECRETO LEGISLATIVO", anno=2023, numero="36"` | 1 | `23G00044`, the public-contracts code |
| `denominazione="CODICE CIVILE", numero="2043"` | 0 | none |

The production API returned the same values. The broad query's first five publication dates were 2026-05-22, 2026-05-21, 2026-05-08, 2026-02-05, and 2026-01-09; D.Lgs. 36/2023 was rank 21. `orderType: "vecchio"` returned 1861 acts first. This verifies chronological behavior at both ends without assuming an undocumented tie-break rule. The reported body search `trasparenza amministrativa` placed D.Lgs. 33/2013 at rank 1,395.

### Undocumented simple-search relevance

Direct bounded calls to the official simple endpoint with `orderType: "rilevante"` produced:

| Query | Results | Target | Rank |
|---|---:|---|---:|
| `contratti pubblici` | 4,601 | D.Lgs. 36/2023 | 2–3 across repeats |
| `Codice dei contratti pubblici` | 1,662 | D.Lgs. 36/2023 | 3 |
| `trasparenza amministrativa` | 653 | D.Lgs. 33/2013 | 5 |
| `Codice dell amministrazione digitale` | 2,929 | D.Lgs. 82/2005 | 3 |
| `Testo unico enti locali` | 4 | D.Lgs. 267/2000 | 1 |
| `Codice civile` | 22,571 | R.D. 262/1942 | 1 |

The order was visibly non-chronological. Missing, empty, `rilevante`, and an unknown value such as `banana` all yielded the same relevance-like family of results, while `recente` and `vecchio` switched to chronological order. Repeated identical relevance calls moved the contracts code between ranks 2 and 3, and no score or tie-break metadata was returned.

The advanced endpoint behaved differently: `recente`, `rilevante`, and `banana` all returned the same 2,328-result chronology for `titoloRicerca: "contratti pubblici"`. Therefore merely adding another enum value to the existing advanced call would not expose the live relevance behavior.

### Multiword semantics

The following controlled counts establish OR behavior for the tested inputs:

| Advanced field | First token | Second token | Both tokens | Derived intersection |
|---|---:|---:|---:|---:|
| title | `contratti`: 568 | `pubblici`: 1,791 | `contratti pubblici`: 2,328 | 31 |
| title | `codice`: 671 | `civile`: 2,004 | `codice civile`: 2,531 | 144 |
| body | `trasparenza`: 1,502 | `amministrativa`: 16,405 | `trasparenza amministrativa`: 16,869 | 1,038 |

In each row, `first + second - both` gives the intersection, exactly as expected for a set union. Surrounding `contratti pubblici` or `trasparenza amministrativa` with double quotes did not change the advanced-search counts.

An attempted SQL/search-style `AND` was not a supported alternative: the live endpoint returned HTTP 200 with an empty body for `contratti AND pubblici`. Because the official documents specify no query-language operators, such syntax must not be treated as contractual.

### Common names and bounded narrowing

Common-name title searches were broad even before body search:

| Advanced title input | Results | Correct act on first page? |
|---|---:|---|
| `Codice dell'Amministrazione Digitale` | 2,753 | no |
| `codice civile` | 2,531 | no |
| `codice dei contratti pubblici` | 35,855 | no |

Adding a known year made the sets bounded but did not add semantic ordering. With `per_page=50`, the correct acts appeared at these zero-based chronological positions:

| Input plus year | Results | Target position |
|---|---:|---:|
| `contratti pubblici`, 2023 | 9 | 8 |
| `Codice dell'Amministrazione Digitale`, 2005 | 16 | 12 |
| `codice civile`, 1942 | 23 | 16 |

This means existing pagination and a known year can make retrieval tractable, but they do not solve resolution when the user does not know the act's year or type.

### Pagination behavior

Pagination is numbered and resumable. In a live simple-relevance control, pages 1 and 2 at five results were disjoint; an out-of-range advanced page returned HTTP 200 with an empty `listaAtti`. The production API accepted 100 results per page even though the current MCP deliberately caps `per_page` at 50.

The upstream response's `numeroElementiPerPagina` was `0` for every tested nonzero requested size, consistent with the official examples. It is not a usable echo of the page size; callers should rely on the requested size, returned list length, page number, and total-page count.

### Exact identifier controls

Each exact advanced search returned one result and the expected editorial code:

| Type / year / act number | Code | Act |
|---|---|---|
| `DECRETO LEGISLATIVO` / 2005 / 82 | `005G0104` | CAD |
| `DECRETO LEGISLATIVO` / 2023 / 36 | `23G00044` | current public-contracts code |
| `REGIO DECRETO` / 1942 / 262 | `042U0262` | Civil Code |
| `LEGGE` / 1990 / 241 | `090G0294` | administrative-procedure law |

### Invalid model filters are not search misses

The API silently accepts an invalid act-type string and returns a normal empty result:

- `denominazioneAtto: "CODICE CIVILE"` alone: 0 results, HTTP 200;
- `denominazioneAtto: "D.Lgs. 50/2016"` alone: 0 results, HTTP 200.

Using an article number as `numeroProvvedimento` has a different and potentially more dangerous effect:

- `numeroProvvedimento: "2043"` alone returned 29 acts, including several DPR and royal decrees numbered 2043;
- `REGIO DECRETO` plus number 2043 returned 18 royal decrees;
- `numeroProvvedimento: "108"` alone returned 163 acts, headed by recent acts numbered 108.

Therefore a malformed call can yield either zero results or plausible unrelated results. Search output alone cannot validate the caller's interpretation of its filters.

## Current MCP behavior

The current tool description correctly says that `denominazione` is an act-type label and points clients to the denomination resource. It also describes `numero` as the number of the *provvedimento* ([source](../../packages/core/src/tools.ts#L29-L44)). However:

- `denominazione` remains an unrestricted string in the emitted JSON Schema, so invalid common names and citations pass validation;
- `numero` is not machine-distinguishable from an article number;
- the MCP always calls the official advanced-search endpoint ([source](../../packages/core/src/api.ts#L85-L87)); it does not expose simple search or its live relevance ordering;
- `page` and `per_page` are supported, with a connector-side maximum of 50, and totals/current page are returned ([source](../../packages/core/src/tools.ts#L70-L102)); and
- `facetMap`, `hlTitoli`, and `hlArticoli` are discarded when the response is mapped to MCP output ([source](../../packages/core/src/tools.ts#L98-L114)).

The hosted tool schema and output matched this source on 2026-09-27.

The built-in `ricerca-articolo` prompt asks the model to identify the “most relevant” acts from `search_acts` results ([source](../../packages/core/src/prompts.ts#L7-L28)). The current tool provides only an advanced chronological page, so that instruction asks the model to infer relevance without the better upstream ordering. This is a connector/model-facing mismatch, not proof that Normattiva lacks all relevance capability.

## Upstream signals and adjacent capabilities

### Facets are real, populated, and currently omitted

Every tested response returned populated `facetMap` entries for:

- `anno_provvedimento`;
- `codice_tipo_provvedimento`; and
- `descrizione_emettitore`.

The manual documents type and year as accepted facet filters, while emitter appears in responses but is not documented as an input filter. Broad queries produce very large facet arrays, so exposing the raw map would materially increase tokens; the existence of the signal does not by itself choose how it should be surfaced.

### Highlight fields are not yet a demonstrated ranking signal

The official response schema includes `hlTitoli` and `hlArticoli`, but they were `null` for all sampled title, body, exact, simple, and advanced searches. They cannot be treated as a usable relevance signal without a separate successful reproduction.

### Simple search exposes useful but undocumented relevance

The official simple endpoint is not wrapped by `search_acts`. Its live default/relevance ordering materially outperformed advanced chronological search for all tested common-name and topical controls, as shown above. However:

- the manual documents only `recente` and `vecchio`;
- OpenAPI provides no enum, score, rank reason, or tie-break;
- unknown order strings silently fall into the same relevance-like behavior; and
- repeated calls can reorder tied results.

Simple search also has different matching semantics from the advanced title/body fields. For example, `contratti`, `pubblici`, and `contratti pubblici` returned 9,415, 38,211, and 4,601 results respectively, so it should not be described as the same advanced OR operation with a different sort. This is a real candidate surface for later design, not a drop-in contractual guarantee.

### The public portal has richer match controls than synchronous OpenData advanced search

The official [Normattiva advanced-search page](https://www.normattiva.it/ricerca/avanzata) exposes `ALL_WORDS`, `ENTIRE_STRING`, and `SOME_WORDS` modes for title and body, title/body exclusions, and an article-number field. Its own help text defines all-words, ordered-phrase, and any-word behavior.

Those controls are not declared by the synchronous `RicercaAvanzataRequestFrontEnd` schema. Live synchronous calls with `titoloContainsType` set to each of `ALL_WORDS`, `ENTIRE_STRING`, and `SOME_WORDS` all returned the unchanged 2,328-result chronology for `contratti pubblici`. The portal capability therefore cannot be assumed to work by passing its form fields to the current OpenData endpoint.

### Official presets do not resolve common names

The live predefined-search resource contained only broad date/class presets such as “Atti Repubblica” and “Atti abrogati”; it supplied no alias map. The current MCP already exposes that metadata resource ([source](../../packages/core/src/resources.ts#L59-L69)).

The live predefined collections included an official `Codici` collection with 40 acts. The MCP exposes collection names and counts but not the collection download ([source](../../packages/core/src/resources.ts#L47-L57)).

Separately, the official public [Costituzione e Codici page](https://www.normattiva.it/staticPage/codici) is a human-readable curated resolver. It links canonical URNs for the Civil Code, CAD, road code, and other common codes, and explicitly distinguishes the current D.Lgs. 36/2023 procurement code from superseded D.Lgs. 50/2016 and 163/2006. It does not cover every common name (TUEL was absent), and no documented JSON feed was found. Its authority is useful evidence; its HTML delivery is a constraint, not a selected implementation.

## Implications for later decisions

These are constraints, not a chosen design:

- A first-page reranker over the current advanced chronology cannot surface an authoritative act that appears at rank 21 or 1,395.
- Pagination is already bounded and resumable for search; the unresolved problem is candidate discovery/ranking, not reachability of pages.
- Validating act-type labels can prevent one class of false negative but cannot translate `CAD`, `TUEL`, or `Codice civile` into identifiers.
- Facets can support bounded narrowing, but raw facets can be token-heavy and do not supply semantic relevance.
- Live simple-search relevance can surface tested targets cheaply, but it needs a documented fallback and regression probes if a later decision relies on behavior absent from the published contract.
- The public portal's richer match modes and curated code URNs are authoritative clues, but neither is directly available through the current synchronous advanced request schema.
- Common-name resolution and topical discovery are different operations: the former seeks one known canonical act; the latter may legitimately return many acts.
- Exact type/year/act-number lookup is the reliable control path and should remain distinguishable from heuristic discovery.
- Any model-facing safeguard should treat zero results as “this query matched nothing,” never as evidence that an act or article does not exist.

No future MCP interface or ranking strategy is selected here.

## Sources and reproducibility notes

Primary sources:

- [Normattiva OpenData portal](https://dati.normattiva.it/)
- [IPZS Normattiva OpenData API manual](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf)
- [IPZS OpenAPI descriptor](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json)
- [IPZS rendered OpenAPI reference](https://dati.normattiva.it/assets/come_fare_per/Normattiva%20OpenData.html)
- [Production advanced-search endpoint](https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/avanzata)
- [Production simple-search endpoint](https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/semplice)
- [Production denomination typology](https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/tipologiche/denominazione-atto)
- [Official public advanced search and help](https://www.normattiva.it/ricerca/avanzata)
- [Official curated Costituzione e Codici page](https://www.normattiva.it/staticPage/codici)
- [Hosted MCP endpoint](https://normattiva-mcp.adellorto.com/api/mcp)
- Repository source links cited inline above.

All live calls used the production endpoints, HTTP JSON bodies matching the official schema, and bounded page sizes of 1, 5, 50, or 100. One targeted control requested page 14 to verify the reported transparency target's chronological rank. No credentials were used. Counts are snapshots of a changing corpus and should be rechecked when implementing regression tests; the semantic controls compare relationships and target identity, not only frozen totals.
