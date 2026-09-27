# Inventory of authoritative Normattiva data surfaces

Research date: 27 September 2026

Question: which current first-party Normattiva surfaces, beyond the five tools
already wrapped by this repository, can supply act structure, complete text,
stable locators, citations, aliases, or search results, and under what access,
licensing, payload, stability, and operational constraints?

This is a factual inventory, not a remediation proposal. “Documented” below
means that IPZS publishes a contract for the surface. “Observable” means that
the official public site uses the route, but IPZS does not publish it as an API
contract.

## Bottom line

The existing wrapper does not exhaust the official platform.

- The most consequential omitted synchronous surface is
  `POST /atto/dettaglio-atto-urn`, added to the official specification on
  10 March 2026. It resolves a NIR URN to one article (or an ambiguity list),
  accepts annex and point-in-time syntax, and can address the Civil Code without
  knowing Normattiva's internal `idGruppo`.
- Normattiva still documents no synchronous table-of-contents or group-listing
  endpoint. The 15 paths in the current OpenAPI description contain search,
  single-article detail, typologies, update search, and collection export, but
  no structural-index operation.
- Complete, machine-structured acts are officially available through collection
  export, especially Akoma Ntoso (AKN). This is a stateful ZIP-export workflow,
  not a small synchronous lookup.
- The public act page exposes a complete structural tree, including the internal
  `idGruppo`, article type, suffix coordinates, and version number, in its HTML.
  That is real and useful data, but its routes and query contract are not a
  documented API and the initial page can be megabytes.
- NIR URNs and ELI URLs provide two different official locator systems. NIR URNs
  can address annexes and articles; ELI `id` URLs are unique act/version
  permalinks, while ELI `stato` URLs are human-coordinate aliases and can be
  ambiguous.
- There is no documented SPARQL service, RDF dump, or RDF content-negotiation
  endpoint. Linked-data material is exposed as ELI URLs, RDFa-like metadata in
  HTML/AKN, and a bulk `URI` export whose files contain ELI links.

## Source currency and authority

The repository's `docs/Normattiva_API_OpenData_Specifiche.md` ends at revision
08 (30 October 2025). The current first-party
[API specification PDF](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf)
is 82 pages, has revision history through revision 10 (10 March 2026), and the
served file had `Last-Modified: Wed, 20 May 2026`. Revision 10 adds the URN detail
API. The local copy is therefore not current enough to inventory the platform.

The first-party
[OpenAPI descriptor](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json)
also contains the URN route and 14 other paths. It has two machine-integration
caveats: its version is only `v0`, and its sole `servers` entry is
`http://localhost:9090/bff-opendata`; the production gateway base URL must be
taken from the PDF (`https://api.normattiva.it/t/normattiva.api`). It declares
no security scheme.

The portal pages
[How to download the data](https://dati.normattiva.it/Come-scaricare-i-dati),
[Available data](https://dati.normattiva.it/Dati-disponibili), and
[The project](https://dati.normattiva.it/Il-progetto) are first-party descriptions
of the collection formats, delivery workflow, licence, and scope. The
[AKN implementation specification](https://dati.normattiva.it/assets/come_fare_per/Portale_Normattiva_2.0-Strutturazione_degli_atti_in_Akoma_Ntoso_26-07-2021.pdf)
and
[ELI implementation document](https://dati.normattiva.it/assets/come_fare_per/ELI_implementation_in_Italy.pdf)
describe the structured and linked-data models. The public site's
[Utilities page](https://www.normattiva.it/staticPage/utilita) and
[FAQ](https://www.normattiva.it/staticPage/faq) document NIR URN linking.

## Surface inventory

| Surface | Contract and access | Payload and relevant capabilities | Constraints observed or documented |
|---|---|---|---|
| Synchronous simple and advanced search | Documented `POST /ricerca/semplice` and `/ricerca/avanzata`; production calls succeeded without credentials | Paginated act metadata, total/page counts, facets, exact act coordinates, title/text query, type/class/date filters. The response schema includes title/article highlight fields. | No act body or TOC. Ordering is only `recente` or `vecchio`, not relevance. A live simple search for `danno ingiusto` returned 10 of 86 acts over 9 pages, newest first; `numeroElementiPerPagina` was echoed as `0` despite honoring the requested page size of 10. `hlArticoli` was null in both simple and narrowed advanced probes. |
| Typologies and presets | Documented unauthenticated GETs for extensions, act denominations, classes, predefined searches, and predefined collections | Enumerates accepted act-type labels/codes, export formats, class codes, and available collection names/counts. | These are vocabularies and presets, not aliases from common names to acts. The live extension list was AKN, XML, PDF, EPUB, RTF, URI/ELI, JSON, and HTML. |
| Coordinate-based article detail | Documented `POST /atto/dettaglio-atto`; already wrapped | One article as HTML plus act/publication metadata. Inputs expose `idGruppo`, article/suffix coordinates, `progressivo`, `versione`, and `dataVigenza`. | It supplies no way to discover the coordinates it requires. A point-in-time reliability probe is described below: for one suffixed article, the endpoint ignored both a historical date and the tested version values and returned the current text. |
| URN-based article detail | Documented `POST /atto/dettaglio-atto-urn`; added in revision 10 and not in the repository's local API note | Accepts `urn:nir:...` with optional annex/article and `@originale` or `!vig=YYYY-MM-DD`; returns one article as HTML or a list when the act reference is ambiguous. If no article is present, the contract says it returns the first article, not a TOC. | The correct annex number still matters. `...;262:2~art2043` retrieved Civil Code article 2043 without `idGruppo`; omitting `:2` returned 404. A burst of probes produced HTTP 429 with a generic retry-later body, although 429 is absent from the published response tables. |
| Updated-acts search | Documented `POST /ricerca/aggiornati`; already wrapped | Metadata for acts changed between two dates, including last-modification fields | At most 12 months and 7,000 acts (`1501` and `1502`); inconsistent date order is `1503`. It is not a structural or full-text feed. |
| Asynchronous dynamic export | Documented POST-new, PUT-confirm, GET-status, GET-download workflow | ZIP collections in AKN, HTML, JSON, URI/ELI, or Normeinrete XML. The asynchronous search model has richer word-match modes (`ALL_WORDS`, `SOME_WORDS`, `ENTIRE_STRING`, `NEITHER_WORDS`) and can filter by article number and act metadata. | Creates server-side state, returns a token, requires confirmation, then polling until a 303 supplies `x-ipzs-location`. Email is optional in the current schema. The portal says emailed download links last at most 10 days. OpenAPI declares overload outcomes 529 at creation and 503 during confirmation/status. There is no page/cursor result: the unit of delivery is a ZIP collection. No job was created during this research. |
| Preconfigured collection download | Documented direct GET after enumerating collection names | ZIP in AKN, XML, JSON, HTML, PDF, EPUB, RTF, or URI/ELI. At research time the list had 56 name/version variants; examples ranged from 32 to 124,043 acts, and the `Codici` original collection reported 40 acts. | Payload size varies drastically by collection and format. HEAD is not supported (405), so clients cannot rely on it to price a download. A live `Codici`/URI/original GET was only 14,215 bytes and contained one text ELI URL per act; full-text formats will be much larger. |
| AKN export | Documented format on both dynamic and preconfigured collection paths | Complete legal-document XML: metadata plus preface, preamble, body, conclusions; body structure includes chapters, articles, paragraphs, points, annexes, references, lifecycle, and ELI metadata. This is the richest supported source for complete structure. | Export-only; there is no documented per-act synchronous AKN endpoint. Multi-version exports can contain multiple files per act, so processing/storage scale with acts and versions. |
| Public NIR URN resolver | Publicly documented `https://www.normattiva.it/uri-res/N2Ls?<URN>` | Persistent act links with original/current/date/multivigente selection; syntax can target annex, article, comma, and letter. A Civil Code `:2~art2043` URL returned the requested article and the full act page. | HTML intended for users, not a compact API. The targeted Civil Code response was 2,591,983 bytes and took 7.4 s in one probe because it included the full structural page. Ambiguous act references can produce a result list. |
| ELI `id` and `stato` URLs | Publicly documented and live | `eli/id/<GU date>/<codiceRedazionale>/...` is the unique local-id permalink; `eli/stato/<type>/<act date>/<number>/...` is an alias based on human act coordinates and may lead to a choice list. Supports ORIGINAL and CONSOLIDATED, optionally at a date. HTML carries ELI metadata such as title, local id, document type/date, version/date, language, format, and consolidates relation. | Legal-act representation is HTML only in the published implementation. Live requests with `Accept: application/rdf+xml`, `text/turtle`, and `application/ld+json` all still returned `text/html`; there is no demonstrated RDF content negotiation. The linked 2018 ELI document calls part of its design an extension proposal, so live behavior was checked rather than inferred from the PDF alone. |
| Public act page and article AJAX route | Observable official-site routes: `/atto/caricaDettaglioAtto` and `/atto/caricaArticolo` | The act page's server-rendered tree contains every article link and the otherwise opaque `idGruppo`, `flagTipoArticolo`, version, article/suffix fields, publication date, and progressivo. The AJAX route returns the selected article HTML. | Not documented as an integration API. On the Civil Code page, the initial HTML was 1,641,979 bytes/4.1 s and contained 3,284 article links across 406 distinct group IDs; article 2043 carried `idGruppo=258`. The AJAX URL returned a 3,912-byte article only after first establishing the page session/cookies; a standalone call rendered an error page. Query names and session coupling are therefore a fragile contract. |
| Public site's `/suggester/<term>` | Observable unauthenticated JSON call used by the search box's JavaScript | Lexical phrase suggestions. Live examples: `Codice civile` suggested “codice civile” and related phrases; `amministrazione` suggested “codice amministrazione digitale”. | It returns phrases, not act coordinates, identifiers, or proof that a named act exists. `CAD` and `TUEL` returned empty arrays. It is undocumented and unsuitable as an authoritative alias registry. |

The current OpenAPI path set contains no table-of-contents, group enumeration,
alias registry, SPARQL, RDF, or DCAT endpoint. The Available data page says
DCAT-AP_IT metadata was planned during the experimental phase, but neither the
current OpenAPI description nor the current portal navigation exposes such a
surface. This records what was found, not proof that no unpublished service
exists.

## Stable-locator systems

The locator systems should not be conflated:

1. **Normattiva internal coordinates** use `dataGU`, `codiceRedazionale`,
   `idArticolo`, suffix fields, `idGruppo`, `progressivo`, and `versione`. They
   are the coordinate-detail API's native addressing model. `codiceRedazionale`
   is stable and useful, while group/version coordinates are exposed by the web
   tree but not by a supported discovery API.
2. **NIR URNs** are logical persistent names. The documented form can identify
   an act, annex, article, and finer fragments on the public resolver. For the
   Civil Code, `urn:nir:stato:regio.decreto:1942-03-16;262:2~art2043`
   identifies article 2043 in annex 2. The new OpenData URN endpoint maps that
   stable name to compact JSON without exposing `idGruppo`.
3. **ELI URLs** identify an act/version in web space. The `id` pattern includes
   the GU publication date and `codiceRedazionale` and is the unique permalink;
   the `stato` pattern uses type/date/number and is explicitly an alias. The
   bulk `URI` format exports these `stato` URLs. It does not export article-level
   locators.

The adjacent Gazzetta Ufficiale ELI surface described in the official ELI
document identifies the original publication using GU date and local id. It is
HTML-only for individual legal acts and does not provide Normattiva's
consolidated history.

## Live verification details

All calls below targeted production without an API key, bearer token, `Origin`,
or client certificate. PRE/test is different: the official PDF's Postman
appendix says PRE may require mutual TLS with a client certificate.

| Probe | Result |
|---|---|
| GET export extensions | 200 JSON, 311 bytes; eight formats including HTML and URI/ELI. |
| GET act-denomination and class typologies | 200 JSON; 30 act types and three act classes. |
| GET predefined collections | 200 JSON; 56 collection/version entries dated through the research day. |
| POST simple search, `danno ingiusto`, page 1 size 10 | 200 JSON; 10 returned, 86 total, 9 pages, chronological first result from 2026. |
| POST narrowed advanced search for R.D. 262/1942 with `danno ingiusto` | 200 JSON; one Civil Code act, but no populated article-highlight coordinates. |
| POST URN detail for `...;262:2~art2043` | 200 JSON in 0.61 s; 592 characters of article HTML and the correct article 2043 text. |
| POST the same URN without annex `:2` | 404 JSON; the resolver did not infer the annex. |
| POST URN detail for D.Lgs. 267/2000 article 274 | 200 with a two-item ambiguity list (the act and its republication), confirming that URN coordinates do not always select a unique publication. |
| GET public Civil Code detail page | 200 HTML; 1,641,979 bytes, 3,284 article links, 406 distinct `idGruppo` values. |
| GET public Civil Code NIR URL targeting article 2043 | 200 HTML; 2,591,983 bytes and the requested article. |
| GET preconfigured `Codici`, `formato=URI`, `formatoRichiesta=O` | 200 octet-stream; 14,215-byte ZIP with per-act text files containing ELI ORIGINAL URLs. |
| GET async status with a nonexistent UUID | 404 JSON code `1204`, demonstrating that the production status path is reachable without credentials; no job was created. |
| Burst behavior | After several rapid article-detail POSTs, two requests received 429 with `{"message":"Errore generico della chiamata, riprovare più tardi"}`. A later identical request succeeded. This establishes transient throttling, not a threshold; IPZS publishes no numeric quota in the inspected sources. |

### Point-in-time behavior: coordinate detail versus URN detail

A controlled probe used D.Lgs. 196/2003, article 2-undecies. The documented
coordinate-detail request was:

```json
{
  "dataGU": "2003-07-29",
  "codiceRedazionale": "003G0218",
  "idArticolo": 2,
  "sottoArticolo": 11,
  "sottoArticolo1": 0,
  "dataVigenza": "2017-01-01",
  "idGruppo": 0,
  "progressivo": 0,
  "versione": 0
}
```

Changing `dataVigenza` from `2017-01-01` to `2026-09-27` produced byte-identical
responses (SHA-256
`2e12f22e43479233147409fd18f07020c83b636ed9767a87f96f12a013270159`), both
labelled with the current interval `20230330`–`99999999` and 6,860 characters
of article HTML. At date `2019-01-01`, changing `versione` from 0 to 2 was also
byte-identical and current.

The URN-detail endpoint was then called with
`urn:nir:stato:decreto.legislativo:2003-06-30;196~art2undecies!vig=<date>`.
The 2017 request returned interval `0`–`20180918` and 324 HTML characters; the
2026 request returned `20230330`–`99999999` and 6,860 characters, with distinct
response hashes. This is a verified case-specific difference in current
production behavior: the newer URN surface honored point-in-time selection
where the coordinate surface did not. It is not evidence that every article or
date behaves the same way.

## Access, licence, and authenticity

- The production OpenData endpoints tested here were open without credentials;
  the inspected GET typology response also allowed cross-origin access. Neither
  the current OpenAPI descriptor nor the official production examples require
  an authentication scheme. PRE/test may use mTLS.
- The Available data page states that from 1 January 2026 all Normattiva acts in
  original, any point-in-time, and multivigente form may be downloaded and used
  under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) with the same
  attribution. This supersedes the earlier experimental CC BY-NC phase for
  current downloads.
- The Project page states that Normattiva texts are informational, not official;
  the definitive official text is the printed Gazzetta Ufficiale. Reproduction
  must mention the source and the non-authentic, free character of the text.
  Those provenance qualifications remain relevant even though reuse is CC BY
  4.0.

## What each need can actually obtain today

| Need | Current authoritative sources | Residual factual gap |
|---|---|---|
| Find acts by known coordinates | Advanced synchronous search; ELI `stato` alias; NIR URN | Coordinate aliases can be ambiguous; common-name aliases are not a formal dataset. |
| Search by topic/text | Simple/advanced synchronous search; public search UI; richer async search operators | Only chronological ordering is documented; no relevance score/order. |
| Fetch one flat-act article | Coordinate detail or URN detail | Coordinate detail needs internal fields and showed a historical-version failure in one controlled case. |
| Fetch an article inside a structured code | URN detail with annex syntax; public NIR resolver; public tree plus article AJAX | The annex number must still be known; there is no documented annex/TOC discovery call. |
| Enumerate a complete act and its hierarchy | AKN/JSON/HTML collection export; observable public act tree | No supported compact synchronous TOC; public-tree contract is internal and can be megabytes. |
| Obtain complete current/historical text in bulk | Dynamic or preconfigured exports in AKN/JSON/HTML/XML and other preconfigured formats | Stateful jobs, polling, potentially very large ZIPs, expiry, and overload outcomes. |
| Cite an act stably | Unique ELI `id`; NIR URN; `codiceRedazionale` plus GU date | Bulk URI export is act-level, not article-level; NIR act references can be ambiguous. |
| Consume linked metadata | ELI metadata embedded in HTML/AKN; URI/ELI ZIP exports | No documented SPARQL/RDF/DCAT endpoint or RDF content negotiation found. |

## Scope limits

This inventory did not create an asynchronous export job or download a large
full-text collection. Those operations mutate server-side state or can transfer
unbounded data; their contracts and constraints were verified from current
first-party documentation, while the small preconfigured URI collection was
downloaded as a safe representative sample. No conclusions here depend on the
user report's proposed remediations.
