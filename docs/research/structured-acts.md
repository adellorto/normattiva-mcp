# Structured acts in Normattiva: official coordinates and discovery paths

_Observed against the production services on 2026-09-27. This is a research finding, not a remedy decision._

## Question

The user report says that `list_articles` reaches only the two articles of the approval decree for R.D. 16 March 1942, no. 262, while Civil Code article 2043 returns 404, and infers that an undiscoverable non-zero `id_gruppo` is required. This investigation asks:

- whether that diagnosis matches the live service;
- what `idGruppo`, `flagTipoArticolo`, `progressivo`, the two sub-article fields, and `versione` actually select;
- which official surfaces disclose the hierarchy and coordinates of a structured act;
- how the other Normattiva-oriented MCPs listed by the repository's catalogue deal with the same boundary.

The official sources used here are Normattiva's [OpenData OpenAPI description](https://dati.normattiva.it/assets/come_fare_per/Normattiva%20OpenData.html), [API specification PDF](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf), [FAQ on URNs and article links](https://www.normattiva.it/staticPage/faq.html), [portal guide](https://www.normattiva.it/staticPage/guidaInLinea.html), [download documentation](https://dati.normattiva.it/Come-scaricare-i-dati), [AKN modelling guide](https://dati.normattiva.it/assets/come_fare_per/Portale_Normattiva_2.0-Strutturazione_degli_atti_in_Akoma_Ntoso_26-07-2021.pdf), and [Italian ELI implementation guide](https://dati.normattiva.it/assets/come_fare_per/ELI_implementation_in_Italy.pdf). All endpoint observations below used the production host documented by Normattiva, `https://api.normattiva.it/t/normattiva.api/bff-opendata/v1`.

## Answer

The reported 404 is real, but the proposed cause is not. Civil Code article 2043 is selected by `flagTipoArticolo: "2"`, the second annex/document layer of R.D. 262/1942. It does **not** require the portal's non-zero `idGruppo` in the tested `dettaglio-atto` call. With the correct flag, group values `0`, `-1`, `4`, `257`, `258`, `259`, and `999999` all returned article 2043. With flags `0`, `1`, or `3`, all returned 404. The current MCP never sends `flagTipoArticolo`, so the upstream default `0` addresses the approval decree rather than the Civil Code attachment.

This distinction is visible in official data:

- the full public portal page links article 2043 with `art.flagTipoArticolo=2` and `art.idGruppo=258`;
- the current official JSON export represents the article with `tipoNir: "2"` and its title group with `idInterno: "258"`;
- the official URN form is `urn:nir:stato:regio.decreto:1942-03-16;262:2~art2043`;
- both the official URN resolver and the OpenData `dettaglio-atto-urn` endpoint return the article from that URN.

There is no documented synchronous OpenData table-of-contents endpoint. There are, however, three official discovery surfaces that the initial report did not test: the public portal's full-act HTML, precompiled JSON/AKN collections, and the documented asynchronous export flow. The last was live-tested for exactly R.D. 262/1942 and returned a one-act JSON archive containing the complete hierarchy and article coordinates. These paths have different stability, latency, and payload properties; the evidence does not choose among them.

## Diagnostic loop

### Ranked hypotheses

Before broadening the search, the symptom was reduced to four falsifiable hypotheses:

1. The wrapper omits a load-bearing article-layer coordinate. **Confirmed:** `flagTipoArticolo` changes the result from 404 to article 2043.
2. The caller has the wrong or unknown `idGruppo`. **Falsified for the tested detail lookup:** arbitrary group values return the same article when the flag is correct.
3. Article 2043 is absent or unavailable through the production OpenData service. **Falsified:** both coordinate and URN endpoints return it.
4. Structure is available only through an unbounded portal scrape or a hand-maintained table. **Falsified:** official JSON exports disclose the coordinates; a one-act asynchronous export also works.

### Minimal positive and negative controls

The endpoint was:

```text
POST https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto
Content-Type: application/json
```

The Civil Code control held every field constant except `flagTipoArticolo`:

```json
{
  "dataGU": "1942-04-04",
  "codiceRedazionale": "042U0262",
  "idArticolo": "2043",
  "sottoArticolo": "1",
  "sottoArticolo1": "0",
  "dataVigenza": "",
  "idGruppo": "0",
  "progressivo": "0",
  "versione": "0",
  "flagTipoArticolo": "2"
}
```

| Act/article | Negative control | Positive control | Result |
| --- | --- | --- | --- |
| Civil Code 2043, `042U0262` | flag `0` | flag `2` | 404 vs 200, “Risarcimento per fatto illecito” |
| Civil Code 2043 | flag `2`, group `999999` | flag `2`, group `258` | both 200 and same article |
| Civil Code 1 | flags `0`, `1`, `2`, `3` | — | approval decree art. 1; preliminary provisions art. 1; Civil Code art. 1; 404 |
| Penal Code 575, `030U1398` | flag `0` | flag `1` | 404 vs 200 |
| Code of Civil Procedure 163, `040U1443` | flag `0` | flag `1` | 404 vs 200 |
| Highway Code 204, `092G0306` | flag `1` | flag `0` | 404 vs 200 |

These controls also falsify the broader claim that “codes require a non-zero group.” The Highway Code article is main-body type `0`; the older codes tested above place their code text in attachments `1` or `2`.

The paired Civil Code control was repeatable while the matrix was collected. After the wider live investigation and export completed, a later rerun returned the same generic HTTP 500 / Normattiva code `1000` for **both** flags instead of distinguishing them, so testing stopped rather than retrying through an upstream failure. That later result does not support either coordinate hypothesis; it does show that a live diagnostic must distinguish service failure from “article absent” and cannot be considered deterministic solely because the payload is fixed.

The OpenAPI request schema lists both `flagTipoArticolo` and `tipoDettaglio`; the prose input list in the PDF specification omits both. This is a documentation inconsistency, not evidence that the production fields are private: they are in Normattiva's official OpenAPI document and are accepted by the production endpoint.

## What the identifiers represent

The current Civil Code JSON export supplies the clearest official crosswalk. Article 2043 is under a parent whose `idInterno` is `258` and whose `numNir` encodes `TITOLO IX / DEI FATTI ILLECITI`. The article node contains:

```json
{
  "nomeNir": "allegato",
  "idNir": "2043",
  "idDettNir": "1",
  "idDett1Nir": "10",
  "idProgrNir": "0",
  "tipoNir": "2",
  "numNir": "CODICE CIVILE-art. 2043",
  "rubricaNir": "Risarcimento per fatto illecito."
}
```

The public portal emits the same coordinates as `idArticolo=2043`, `idSottoArticolo=1`, `idSottoArticolo1=10`, `progressivo=0`, `flagTipoArticolo=2`, and `idGruppo=258`.

| Request field | Official/export counterpart | Tested meaning and caveat |
| --- | --- | --- |
| `flagTipoArticolo` | JSON `tipoNir`; URN `:<n>` after the act number | Selects main body/attachment document layer. It is load-bearing for the old codes. The name “flag” understates that it is an ordinal and is not bounded to 0/1: the Codici collection includes an act with layers through `39`. |
| `idGruppo` | JSON parent `idInterno`; portal hierarchy link | Identifies a title/book/chapter grouping for navigation. It matched `258` for the title containing art. 2043, but changing it did not change the tested detail response. This finding does not prove it is ignored by every endpoint or act. |
| `idArticolo` | JSON `idNir` | Base article number. |
| `sottoArticolo` | JSON `idDettNir` | Suffix ordinal. Civil Code 2497 used `1` base, `2` bis, `3` ter, through `7` septies; `8` returned 404. |
| `sottoArticolo1` | JSON `idDett1Nir` | Slash/extended-number coordinate. For Civil Code 314 the export used `10` base, `30` for 314/2, `40` for 314/3, and `290` for 314/28. Direct calls reproduced those values; `20` and `300` returned 404. The detail endpoint also accepted `0` as the base article. The FAQ renders such targets in URNs with a dot, for example `~art314.15`. |
| `progressivo` | JSON `idProgrNir` | Marks parts when a very long article/attachment is split, as the portal guide says. The original Codici JSON contained real non-zero values for D.Lgs. 104/2010 art. 4 (`1` and `2`). The detail endpoint returned the same already-aggregated article for progressivi `0`, `1`, and `2`; `3` also returned that aggregate. It therefore was not a selector in that control. |
| `versione` | portal links use `art.versione=<n>` | Portal HTML enumerates version indices, but changing this field in the OpenData detail request did not affect the response in the tested cases. Historical selection is described below. |

The ranges matter. A blind scan of “small” flag values happens to find Civil Code `2`, but it is not a general model of structured acts. A static mapping can encode the old codes, but the official exports show that the value belongs to act structure and that structures can be much wider and can change.

## Official paths to the structure

### 1. Coordinate detail endpoint

`dettaglio-atto` is the lightest positive lookup once the coordinate is known. The official OpenAPI exposes every field above, including `flagTipoArticolo`. It does not expose a sibling synchronous endpoint that enumerates all groups, layers, headings, or articles. Search results return act metadata, not this hierarchy.

### 2. URN endpoint and public resolver

The FAQ defines an annex ordinal before the article component:

```text
urn:nir:stato:regio.decreto:1942-03-16;262~art2    body article
urn:nir:stato:regio.decreto:1942-03-16;262:1~art2  first annex
urn:nir:stato:regio.decreto:1942-03-16;262:2~art7  second annex
```

Live controls behaved accordingly:

- `...;262:2~art2043` returned Civil Code article 2043 through both `POST /api/v1/atto/dettaglio-atto-urn` and `https://www.normattiva.it/uri-res/N2Ls?...`;
- `...;262:1~art1` returned preliminary provisions article 1;
- `...;262:2~art1` returned Civil Code article 1;
- `...;262~art2043` returned 404 from the OpenData URN endpoint;
- the alias `urn:nir:stato:codice.civile:1942-03-16;262` used in portal prose links was not accepted by that OpenData endpoint.

URNs are therefore a supported direct locator, but a caller still needs the annex ordinal. The FAQ also warns that a wrong article extension can resolve to the first article, so a 200 alone is not sufficient validation; the returned heading must agree with the requested article.

### 3. Public portal full-act page

The official portal's `caricaDettaglioAtto` page exposes the complete current hierarchy—books, titles, chapters, headings, attachments, article links, and version links—in one synchronous HTML response. For Civil Code article 2043 its link disclosed group `258` and flag `2`. The observed response was about 2.59 MB decompressed (about 159 KB compressed) and took about four seconds in one measurement. This is an official live discovery surface, but it is an HTML application surface rather than a documented OpenData response contract.

The portal guide explicitly describes the left pane as the list of all articles and annexes and says it selects the version in force for the chosen date. It also explains that `progressivo` exists for text divided into parts.

### 4. Precompiled collections

The documented `collection-preconfezionata` endpoint currently exposes a curated `Codici` collection of 40 acts. Original (`O`), current (`V`), and multivigente (`M`) download variants responded during testing, even though the catalogue response displayed only the original variant. JSON, AKN, and URI formats were available.

The current JSON Civil Code file carried the full hierarchy and all coordinate fields shown above. The AKN file modelled each code article as a document inside `<attachment>`, consistent with Normattiva's AKN guide. Its attachment sequence IDs are not the same values as `idGruppo` or `flagTipoArticolo`, so the JSON export is the more direct coordinate crosswalk. The collection is curated coverage, not a general per-act synchronous API.

Payload scale differs sharply. Range probes of the complete Codici downloads observed approximately 7.8 MB compressed for original JSON, 9.0 MB for current JSON, and 1.11 GB for multivigente JSON. Those collection-wide figures should not be mistaken for the cost of a one-act export.

### 5. Asynchronous export for an exact act

The official API specification documents this sequence:

1. `POST /api/v1/ricerca-asincrona/nuova-ricerca` returns a token.
2. `PUT /api/v1/ricerca-asincrona/conferma-ricerca` confirms it.
3. `GET /api/v1/ricerca-asincrona/check-status/{token}` is polled until the download is ready.
4. `GET /api/v1/collections/download/collection-asincrona/{token}` downloads the archive.

This path was exercised with JSON/current output and an advanced query constrained to `REGIO DECRETO`, 16 March 1942, no. 262. The preceding synchronous advanced search returned exactly one act. The export job completed with `totAtti: 1` and produced one 6,500,754-byte JSON file in a ZIP. Its article 2043 node contained `idNir=2043`, `idDettNir=1`, `idDett1Nir=10`, `idProgrNir=0`, and `tipoNir=2`. This is a live positive control that arbitrary single-act structure can be discovered through an official export rather than inferred from integer probes.

The export is asynchronous and stateful, so it does not erase the product distinction between a low-latency article read and structure discovery. Only the current one-act JSON case was tested here; timing, expiry, rate limits, historical payload size, and concurrent-job behaviour remain unmeasured.

## Versions and dates

The version controls exposed by the production detail endpoint do not behave as the current wrapper and PDF prose imply.

Civil Code article 5 provides several historical periods. Holding the article coordinate constant gave:

| `tipoDettaglio` | `dataVigenza` behaviour | Observed period |
| --- | --- | --- |
| omitted | date ignored | latest, `20180131`–`99999999` |
| `originario` | date ignored | original, `19420419`–`19570511` |
| `multivigenza` or `vigente` | date ignored in this endpoint response | latest |
| `singolavigenza` | date applied | 1942 returned original; 2010 returned `20071124`–`20100304`; 2026 returned latest |

Changing `versione` among `0`, `1`, `2`, `10`, `14`, and `99` did not affect those responses. Portal multivigente HTML, by contrast, linked multiple versions with `art.versione=<n>`. The current JSON export contains an act history, while ELI identifies original and consolidated expressions, including date-specific consolidated expressions as documented in the ELI guide.

The present MCP sends `dataVigenza` and `versione` but omits `tipoDettaglio`. For this control, its advertised historical date cannot select a historical response. That is adjacent evidence about the same identifier model, not a selected fix.

## How neighbouring MCPs handled it

The catalogue linked from this repository lists three other Normattiva-related servers. Their source shows three distinct strategies, none of which validates the report's `idGruppo` theory:

- [avvocati-e-mac/normattiva-mcp](https://github.com/avvocati-e-mac/normattiva-mcp) uses the official `dettaglio-atto-urn` endpoint and a verified local source table. Its Civil Code entry explicitly stores `allegato: 2`, preliminary provisions `allegato: 1`, and the other historical codes' annex ordinals. Its architecture calls that table the only path it currently uses for historical codes. This demonstrates the correct discriminator and a deliberately bounded static strategy; it does not provide general discovery. See the pinned [source table](https://github.com/avvocati-e-mac/normattiva-mcp/blob/fc61a6e91e5532d2bd811b2322b2b5a18d3c49ff/src/normattiva_mcp/data/fonti.json) and [architecture](https://github.com/avvocati-e-mac/normattiva-mcp/blob/fc61a6e91e5532d2bd811b2322b2b5a18d3c49ff/ARCHITETTURA.md).
- [SimonBerg255/gov-it-legal-mcp](https://github.com/SimonBerg255/gov-it-legal-mcp) delegates full-act and per-article conversion to the third-party `normattiva2md` package, then extracts a table of contents from the converted full act and caps returned text at 25,000 characters. It thereby avoids exposing upstream coordinates, at the cost of a full-act conversion path and an extra dependency. Its comment that no public REST API exists is contradicted by the current official OpenData documentation and live service. See the pinned [tool implementation](https://github.com/SimonBerg255/gov-it-legal-mcp/blob/369dd73908fdb267e81c8ca124e9aecb61eb24f7/tools.py).
- [giuliogarofalo/open-parlamento-mcp](https://github.com/giuliogarofalo/open-parlamento-mcp) answers modification-graph questions from pre-harvested Normattiva AKN/JSONL files and normalizes codes into local ELI-like slugs. That is an offline corpus strategy for a different query surface; its repository does not contain a live structured-act locator. See the pinned [graph module](https://github.com/giuliogarofalo/open-parlamento-mcp/blob/2a3d0b08d9211af178961107c07de1970cd13d6a/open_parlamento_mcp/norme_graph.py).

## Constraints that remain for a design decision

- `flagTipoArticolo`/attachment ordinal, not `idGruppo`, explains the reproduced old-code failure.
- A detail call can verify a known coordinate cheaply, but the documented synchronous OpenData surface does not enumerate structure.
- URNs are authoritative locators and remove the need for `idGruppo`, but still require a discoverable or supplied annex ordinal.
- Portal HTML, one-act asynchronous JSON export, and curated bulk collections all disclose structure, with materially different latency, payload, stability, and coverage.
- Correctness safeguards need to validate the returned heading/article, because the FAQ documents resolver fallback behaviour for an invalid extension.
- The live detail endpoint's historical selection depends on `tipoDettaglio: "singolavigenza"`; `versione` did not select history in the tested controls.
- `progressivo` is present in exports but was not a selector in the one real split-article control; broader semantics should not be inferred from its name.
- No observation here establishes service quotas or authorizes unbounded probing. The one-act export test and the few positive/negative article controls were intentionally bounded.

These facts narrow the later solution space, but do not select a remedy. In particular, a change premised only on discovering `idGruppo`, scanning a few integers, or embedding the Civil Code's current value would solve the wrong coordinate model.
