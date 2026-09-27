# Normattiva missing-article and error semantics

Research date: 2026-09-27  
Wayfinder ticket: [Verify missing-article and error semantics](https://github.com/adellorto/normattiva-mcp/issues/2)  
Code under test: commit [`90af053`](https://github.com/adellorto/normattiva-mcp/tree/90af05371bafdbb72ae870255e1ee2f9788b27cc)

## Answer

The reported `read_article` defect is real in both the local stdio server and the hosted HTTP server. With a valid act and publication date, a nonexistent article number or suffix produces an MCP tool-error payload instead of the documented `{ "found": false, ... }`. The immediate cause is narrower than “Normattiva returns the wrong status”: the upstream API returns HTTP 404 for several materially different situations, while the MCP soft-fails only errors whose flattened message matches the Italian phrase `non trovato`/`non trovata`.

The upstream distinctions are not a sufficient future contract by themselves. The live service uses:

- HTTP 404 plus `{"message":"Atto non trovato","code":null}` for unknown act coordinates and a wrong publication date;
- HTTP 404 plus a coordinate-dump message for a missing article, missing suffix, negative article number, and a known-existing article that cannot be addressed through the old structural selectors;
- HTTP 404 plus a gateway “Status report” body for an invalid route;
- HTTP 500/code `1000`, HTTP 429/code `1000`, and connection failures for other invalid or transient cases.

Consequently, in the observed service the coordinate-dump 404 establishes only that the requested coordinate tuple did not resolve. It does **not** prove specifically that the article number does not exist. The official contract documents a generic lookup 404 and the `Atto non trovato` example, but does not promise the finer live-body distinction. See the [current IPZS API specification](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf) and [official OpenAPI descriptor](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json).

This research establishes the facts a later error-contract decision must preserve; it deliberately does not choose that contract.

## Red-capable minimized reproduction

The smallest local feedback loop launched the built stdio server, called `read_article` twice with identical TUEL coordinates, and changed only `articolo`:

```text
data_gu:             2000-09-28
codice_redazionale:  000G0304
id_gruppo:           0
sotto_articolo:      1
control articolo:    1
missing articolo:    9999
```

Command run twice:

```bash
node tests/error-semantics-repro.mjs
```

Both runs were red. After tightening the temporary harness, it completed in about one second:

```text
FAIL: MCP error -32600: Normattiva API 404: dataPubblicazioneGazzetta:Thu Sep 28 00:00:00 CEST 2000 codiceRedazionale:000G0304 idArticolo:9999 idSottoArticolo:1 idSottoArticolo1:null flagTipoArticolo:0
```

The same run first asserted that article 1 returned `found:true`, so this is not a failed-act or failed-date repro. The failing result was an MCP `tools/call` result with `isError:true`; the text shown above is the error content that clients surface. The throwaway harness was removed after the matrix was captured and was not committed as product code.

The corresponding direct upstream request is:

```bash
curl -i -sS \
  'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto' \
  -H 'Content-Type: application/json' \
  --data '{"dataGU":"2000-09-28","codiceRedazionale":"000G0304","idArticolo":9999,"sottoArticolo":1,"sottoArticolo1":0,"dataVigenza":"2026-09-27","idGruppo":0,"progressivo":0,"versione":0}'
```

It returned HTTP 404 and:

```json
{"message":"dataPubblicazioneGazzetta:Thu Sep 28 00:00:00 CEST 2000 codiceRedazionale:000G0304 idArticolo:9999 idSottoArticolo:1 idSottoArticolo1:null flagTipoArticolo:0","code":null}
```

## Minimized behavior matrix

Each semantic row was run against all three layers. Local means the stdio build at commit `90af053`; hosted means `https://normattiva-mcp.adellorto.com/api/mcp`; upstream means the production `dettaglio-atto` endpoint above. Serial runs were paced by eight seconds after the API began throttling an earlier burst.

| Case; one variable changed from a verified control | Local MCP | Hosted MCP | Official upstream |
|---|---|---|---|
| TUEL article 1, valid coordinates | `found:true` | `found:true` | HTTP 200, `success:true` |
| Unknown `codice_redazionale` | `found:false` | `found:false` | HTTP 404, `Atto non trovato` |
| TUEL with GU date changed from `2000-09-28` to `2000-09-29` | `found:false` | `found:false` | HTTP 404, `Atto non trovato` |
| TUEL article changed from 1 to 9999 | tool error containing `-32600` | same | HTTP 404, coordinate dump |
| Existing TUEL article 274 changed from base suffix 1 to suffix 2 | tool error containing `-32600` | same | HTTP 404, coordinate dump |
| Existing Civil Code article 2043 via old endpoint, `id_gruppo=0` | tool error containing `-32600` | same | HTTP 404, coordinate dump |
| TUEL article 1 with arbitrary `id_gruppo=9999` | `found:true` | `found:true` | HTTP 200; group is ignored here |
| L. 400/1988 article 13-bis, `id_gruppo=6` control | `found:true` | `found:true` | HTTP 200 |
| Same L. 400/1988 article with `id_gruppo=0` | `found:true` | `found:true` | HTTP 200; this group is not required live |
| Negative TUEL article `-1` | tool error containing `-32600` | same | HTTP 404, coordinate dump |
| Non-date `data_gu="not-a-date"` | schema/tool error containing `-32602` | same | HTTP 404, `Atto non trovato` |
| Shape-valid but impossible `data_gu="2000-99-99"` | `found:false` | `found:false` | HTTP 404, `Atto non trovato` |
| Non-date `data_vigenza="not-a-date"` | schema/tool error containing `-32602` | same | HTTP 500, code `1000` |
| Shape-valid but impossible `data_vigenza="2026-99-99"` | `found:true` | `found:true` | HTTP 200; upstream silently accepts it |

Two controls sharpen the structural-selector row:

1. The old coordinate endpoint returned the same 404 for Civil Code article 2043 with `idGruppo:0`, `idGruppo:2`, `progressivo:2`, or both selectors set to 2.
2. The official URN endpoint added in revision 10 returned HTTP 200 and the full “Art. 2043 — Risarcimento per fatto illecito” for `urn:nir:stato:regio.decreto:1942-03-16;262:2~art2043`.

That proves the article exists while the old coordinate tuple remains unresolved; it does not prove which old selector value would work. Revision 10 formally defines `:<allegato>~art<numero>` syntax for this newer endpoint in the [official specification](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf). A live reproduction is:

```bash
curl -i -sS \
  'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto-urn' \
  -H 'Content-Type: application/json' \
  --data '{"urn":"urn:nir:stato:regio.decreto:1942-03-16;262:2~art2043"}'
```

The hosted server reports `serverInfo.version=0.1.0`, while stdio reports `0.1.4`. That is not evidence that the hosted core is older: the current HTTP package manifest itself remains version 0.1.0 ([source](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/http-server/package.json)), and the observed semantics match local behavior row for row.

## Transient and infrastructure cases are separate

The first rapid local matrix produced HTTP 429/code `1000` for every call, including the known-good control. A later paced run succeeded. Another run saw `Network error contacting Normattiva: fetch failed` on its first two calls and then normal semantic responses. A three-request direct burst also produced a connection reset before any HTTP response; the same request later succeeded serially.

A deliberately wrong API route produced HTTP 404 with the distinct gateway body:

```json
{"code":"404","type":"Status report","message":"Runtime Error","description":"No matching resource found for given API Request"}
```

These observations demonstrate that 429, connection/reset/timeout failures, 5xx responses, and gateway-route 404s are not semantic absence. They also validate the user report's observation that immediate retry can recover, but this ticket did not measure a stable failure rate and therefore does **not** validate the reported “about one in four” frequency.

## Why the current behavior occurs

The generic request layer turns 400, 404, and 422 into `McpError(ErrorCode.InvalidRequest)` and flattens the upstream body to one detail string ([`api.ts` lines 27–74](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/api.ts#L27-L74)). `dettaglioAtto` then converts only messages matching `/non\s+trovat[oa]/i` into `{success:false}` ([`api.ts` lines 89–103](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/api.ts#L89-L103)).

That regular expression matches `Atto non trovato`; it cannot match the coordinate dump. `read_article` returns `{found:false}` only after `dettaglioAtto` has produced `{success:false}` ([`tools.ts` lines 151–177](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L151-L177)). Its description nevertheless promises that wrong article, suffix, or group returns structured absence ([`tools.ts` lines 119–149](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L119-L149)). Git blame shows that this inconsistency has existed since the initial commit.

The local date validator checks only the `YYYY-MM-DD` string shape, not calendar validity ([`tools.ts` date schema](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L11-L14)); `articolo` and `id_gruppo` are integers without lower bounds ([`tools.ts` input schema](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L125-L148)). This explains why some invalid inputs are blocked before I/O while negative numbers and impossible calendar dates reach upstream.

## What is and is not established

Established:

- The report is correct for a nonexistent article number; the same defect was independently reproduced for a nonexistent suffix.
- Missing act coordinates and wrong GU dates currently return structured absence.
- The same upstream 404 body can mean missing article/suffix, invalid numeric input, or an unresolved structural selector.
- `id_gruppo` is not uniformly enforced: arbitrary/nonzero values are ignored for at least the TUEL control, and zero still works for the documented L. 400/1988 13-bis example.
- Local and hosted behavior agree despite different reported package versions.
- Transport/throttling/server failures are observationally distinct from semantic lookup misses.
- The repository's bundled API specification stops at revision 08, while the [current official PDF](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf) includes revision 10 dated 2026-03-10 and the new URN endpoint. The [official OpenAPI descriptor](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json) declares both detail endpoints and 400/404/422/500 responses, but does not constrain the coordinate request fields beyond primitive types.

Not established:

- That the two live 404 body families are a stable, versioned IPZS contract.
- That a coordinate-dump 404 identifies the article number, suffix, or group as the failing field.
- That any guessed `id_gruppo` maps directly to the URN annex number. Live probes show that `:2~art2043` works through URN while `idGruppo:2` does not work through the old endpoint.
- A reliable transient-failure frequency or rate-limit window.
- The future MCP distinction among “act absent,” “requested unit unresolved,” and caller-invalid input; that belongs in a later decision ticket.

## Constraints for the later contract decision

These are evidence constraints, not a selected solution:

1. HTTP status alone is insufficient: lookup absence, invalid numbers, malformed publication dates, and gateway errors can all be 404.
2. Italian wording alone is insufficient: the current regex misses the reported case, while `Atto non trovato` can also result from a shape-valid but impossible date.
3. A future result must not claim “this article does not exist” when only the full coordinate tuple is known not to resolve.
4. Network failures, resets/timeouts, 429, and 5xx responses must remain distinguishable from semantic absence.
5. If caller-invalid input is to remain separate, validation must cover semantics that the current shape-only schemas allow, including positive article bounds and real calendar dates.
6. The URN endpoint is a newly available option for structural addressing, but its adoption and how to discover/bound annex selectors remain separate design questions.

## Sources

- User-supplied report: `docs/Normattiva MCP – Report di test e proposte di miglioramento.docx` (received 2026-09-27; read from the main working copy).
- [Current IPZS Normattiva OpenData API specification, revision history through revision 10](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf).
- [Official OpenAPI descriptor](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json).
- [Official Normattiva API access page](https://dati.normattiva.it/Come-scaricare-i-dati).
- [Official Normattiva FAQ on URNs and annex selectors](https://www.normattiva.it/staticPage/faq).
- [Production detail endpoint](https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/atto/dettaglio-atto), exercised by POST with the request bodies documented above.
- [Hosted MCP endpoint](https://normattiva-mcp.adellorto.com/api/mcp), exercised with the MCP SDK Streamable HTTP client.
- [`request` and `dettaglioAtto` implementation](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/api.ts#L27-L103).
- [`read_article` schema, description, and result mapping](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L119-L193).
