# Independent historical and attachment controls

Research for [Complete independent historical and attachment benchmark controls](https://github.com/adellorto/normattiva-mcp/issues/29), begun 7 October 2026 UTC and continued by [Acquire independent details and finish historical attachment runtime gates](https://github.com/adellorto/normattiva-mcp/issues/31) on 9 October. The [accepted release gates](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865) remain authoritative. No upstream limits, publishing or deployment changed.

**The representative DPR historical and official attachment benchmarks now pass, but the combined prerequisite remains incomplete.** All 15 DPR occurrences pass independent detail and production-runtime controls for the selected historical and current snapshots. The required fresh raw Privacy 18/19 September 2018 boundary capture remains upstream-blocked. Failed source acquisition and source-validation results are retained, never treated as completeness, absence or a performance pass.

## 9 October resumed follow-up: DPR passes; fresh Privacy raw boundary remains blocked

Baseline `676e47ebc6096bbb22b2cd428d6221e95c8d2720` includes the reviewed compound-rendering adapter described by [Verify compound official renderings without weakening source validation](https://github.com/adellorto/normattiva-mcp/issues/30). The resumed candidate adds narrowly evidenced adapters for the remaining official-copy differences: an enumerated set of actual Normattiva ASCII-apostrophe/Unicode-accent equivalents; a last-article suffix accepted only when its digest matches the separately parsed AKN conclusion; and a flat direct rendering accepted only for an AKN table that is exactly one row, one cell and unit spans with identical legal text. Multi-cell/table-relationship conflicts remain rejected.

The first exact-coordinate attachment attempt remains retained: 2014 Allegato I failed before a response with `UND_ERR_CONNECT_TIMEOUT` after 10,583.25 ms, and that run stopped without retry. On resumption, [four annex requests](historical-attachment-controls/independent-details-2026-10-09T10-56-21.125Z/manifest.json) completed 4/4, followed by [24 article 2–13 requests](historical-attachment-controls/independent-details-2026-10-09T10-57-56.003Z/manifest.json) completing 24/24. Traffic was sequential, paced at least 1.1 seconds, used exact retained navigation addresses, a 20-second deadline and 24 MiB receiving cap, and made no automatic retries. Article 1 remains independently controlled by the rendered portal occurrence, so each production snapshot requires exactly two portal/AKN attempts plus fourteen direct details: the accepted 16-attempt composed-call ceiling.

The independent standard-library inspection verifies all 28 captured direct details against their exact supplied addresses, raw SHA-256, publication metadata, validity coverage and paired AKN legal text. For article 13, the direct response appends the closing formula; the suffix matches the separately parsed AKN conclusion before the article-only result is accepted. Allegato I/II direct HTML contains flat ASCII text without HTML table elements, while AKN wraps the same text in one row/one cell. The runtime retains only that literal one-cell relationship. It does not infer columns, rows or spans from ASCII separators.

The fresh Privacy acquisition reused the exact successful 2026 checkpoint request provenance. Its first request, 18 September 2018, failed before status/body with `UND_ERR_CONNECT_TIMEOUT` after 10,542.64 ms; the stop-on-first-failure contract sent neither a retry nor the 19 September request. [The manifest](historical-attachment-controls/privacy-boundary-2026-10-09T10-59-26.911Z/manifest.json) records the exact body and failure. Existing processed checkpoint outputs still show the expected old/new wording and effective boundary, but they are not relabelled as the missing fresh raw controls.

| Snapshot | Cold/cached full index | Cold/cached reading page | Complete traversal | Annex I first/complete | Evicted continuation | Peak RSS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2014-01-01 | 525.54 / 12.87 ms | 322.96 / 6.67 ms | 529.65 ms | 346.68 / 352.62 ms | 309.28 ms | 199,128 KiB |
| 2026-10-07 | 537.64 / 9.56 ms | 328.42 / 6.14 ms | 526.40 ms | 339.00 / 343.43 ms | 300.77 ms | 200,580 KiB |

The exact pages, attempts, decoded bytes, queue/upstream/residual time, serialization sizes and per-process peak RSS are retained in [historical measurements](historical-attachment-controls/runtime-historical-complete.json) and [current measurements](historical-attachment-controls/runtime-current-complete.json). These are offline streamed-replay timings, not live network latency. Historical/current runs decoded 2,660,781/2,670,579 bytes across all measured phases. Every call stayed at or below 16 attempts, cached continuation calls used zero attempts, all caller-visible responses stayed below 128 KiB, and both complete workloads passed 256 MiB.

The independent source-order control and runtime both reach the same 15 supplied occurrences in order. The original-alias and current-as-historical negative replays continue to return `source_identity_conflict` and `snapshot_conflict` respectively.

Accordingly, [Acquire independent details and finish historical attachment runtime gates](https://github.com/adellorto/normattiva-mcp/issues/31) still does **not** pass its combined acceptance gate. DPR acquisition/traversal/attachment/runtime controls pass; the precise fresh raw Privacy boundary remains blocked by upstream connection availability.

## Candidate and independent evidence

DPR 1 August 2011, n. 151 is small enough for bounded acquisition: 13 main articles followed by Allegato I and Allegato II. The [official Gazette entry](https://www.gazzettaufficiale.it/eli/id/2011/09/22/011G0193/sg) independently identifies GU 221 of 22 September 2011 and entry into force on 7 October 2011. The official API exact-discovery capture additionally confirms publication `2011-09-22 / 011G0193`, issuance and Gazette/supplement identity; its output explicitly leaves current legal force unknown. Its authenticated reference uses a fixed **test-only** signing key, solely for recoverable local replay. [Discovery capture and result](historical-attachment-controls/dpr151-2014-01-01/manifest.json).

Three actual dated website/XML pairs are retained, without changing their metadata or legal text:

| Requested snapshot | Website | XML representation | Decoded XML bytes |
| --- | --- | --- | ---: |
| 2012-01-01 | [Official dated page](https://www.normattiva.it/eli/id/2011/09/22/011G0193/CONSOLIDATED/20120101) | `ORIGINAL`, expression 2011-10-07 | 286,810 |
| 2014-01-01 | [Official dated page](https://www.normattiva.it/eli/id/2011/09/22/011G0193/CONSOLIDATED/20140101) | `CONSOLIDATED/20131031` | 282,265 |
| 2026-10-07 | [Official dated page](https://www.normattiva.it/eli/id/2011/09/22/011G0193/CONSOLIDATED/20261007) | `CONSOLIDATED/20140913` | 283,883 |

Each paired manifest under [the retained capture directory](historical-attachment-controls/) records exact request URL/body, UTC capture date, response status, decoded bytes and SHA-256. `capture-1.gz` is the complete rendered page and `capture-2.gz` its supplied AKN response. The current candidate also retains `capture-3.gz`, the actual first-article OpenData response (87,759 decoded bytes); no detail envelope was synthesized. That initial `a1_` coordinate-only exploratory run withheld the API result as `source_identity_conflict`. The later exact-discovery identity is independently captured rather than inferred from that failure.

[Independent inspection](historical-attachment-controls/inspect-independent.py) uses Python standard-library HTMLParser and ElementTree, importing no production parser. It compares the exact rendered navigation order against XML order at each date: articles **1 through 13, Allegato I, Allegato II**, 15 unique occurrences with no loss/duplication. For the 2014/current snapshots it additionally verifies every non-anchor request against its supplied navigation coordinates, raw hash, validity interval, Gazette identity and exact AKN legal text after the finite recorded typography equivalents. [The resulting source controls](historical-attachment-controls/independent-source-controls.json.gz) retain those findings and the fresh Privacy failure. Complete text remains in the raw captured sources.

The two attachments are readable text rather than graphics: no AKN `img` occurs. Allegato I has a 34,997-character whitespace-folded cell and Allegato II a 40,084-character cell. **Both encode their ASCII tabular layout as one row/one cell**, with unit row/column spans, while the independently captured direct HTML has no actual table nodes. Exact legal text matches. These are useful real within-cell continuation candidates, not a real multi-column/rowspan benchmark; the synthetic table/span control remains separately scoped.

## Rejected source controls and legal-change limits

With the independently discovered authenticated identity, the historical consolidated pair fails `source_content_conflict` before the first useful page. The captured rendered `bodyTesto` includes the decree's preamble, then article 1, then extensive Gazette explanatory notes. The AKN article-1 occurrence represents the article separately. This is a concrete compound-body disagreement; it has not been shown to be a notes-only difference. Removing the preamble or unclassified notes merely to force matching is not an accepted remedy. The current pair reproduces the same failure offline using the same independent identity. The isolated current live discovery attempts timed out, so this current offline failure is not claimed as a successful current live reader canary.

The 2012 pair fails `source_identity_conflict` because the parser accepts only a dated `CONSOLIDATED/` Work alias, while the authentic response has the correct publication's `ORIGINAL` alias. This is an unsupported representation of the correct publication, not proof of wrong publication or unavailable history. Supporting it would require concrete snapshot/content evidence; relabelling its root is not verification.

The negative control replays the **actual current XML** against the actual 2014 dated page/request. It fails `snapshot_conflict`: an expression/edition postdates the selected snapshot. This is a useful rejection, but says nothing universal about forged-root dates. The separately retained Privacy forged-date control in [the earlier historical runner](../../packages/core/test/fixtures/release-historical-runtime.mjs) remains required.

DPR article 11 differs between the retained 2014 and current sources by an additional update annotation referencing DL 133/2014 as converted by Law 164/2014. Such legal update material is not automatically disposable explanatory text. It does not by itself provide a clean before/after article-wording boundary. No exact DPR boundary was certified from dates/counts or every note difference.

The existing Privacy substantive control remains the appropriate supplemental boundary: old article 1 versus replacement article 1, independently retained in `packages/core/test/fixtures/acts/privacy-historical.xml.gz` and `privacy-current.xml.gz`. The [official Gazette entry for D.Lgs. 101/2018](https://www.gazzettaufficiale.it/eli/id/2018/09/04/18G00129/sg) confirms publication on 4 September 2018 and entry on **19 September 2018**. Existing paced live results test 18/19 September 2018 and report the expected substantive change; those production outputs are dated checkpoint evidence, not new independent raw boundary-detail captures. Fresh exact before/after detail captures and their legal wording/validity controls still need acquisition. Full Privacy history/export is unnecessary for that focused check.

## Production measurements

[The replay runner](../../packages/core/test/fixtures/release-independent-controls.mjs) exercises `ActTraversal.listArticles/readAct`, the accepted shared-module seam, with streamed unmodified official captures and an actual exact-discovery locator. One mode runs per process. It imports the production TypeScript build; no Python prototype memory is substituted. Historical/current modes now verify and read all 15 occurrences; original/current-as-historical modes preserve their exact typed negative controls.

| Mode | Cold index failure ms | Repeat index failure ms | Reading failure ms | Peak process KiB | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Historical consolidated | 374.05 | 231.70 | 216.73 | 149,232 | `source_content_conflict` |
| Current consolidated | 356.25 | 234.84 | 219.10 | 152,064 | `source_content_conflict` |
| Original historical | 304.14 | 225.71 | 212.47 | 152,888 | `source_identity_conflict` |
| Current XML as historical | 287.24 | 204.38 | 173.60 | 149,288 | `snapshot_conflict` |

The table above is retained pre-remedy evidence. Its reports remain at [historical](historical-attachment-controls/runtime-historical.json), [current](historical-attachment-controls/runtime-current.json), [original](historical-attachment-controls/runtime-original.json), and [current-as-historical](historical-attachment-controls/runtime-current-as-historical.json). Offline upstream timing measures streamed fixture service, **not real network latency**. Residual local time is subtraction from the runtime counters, not CPU time. The earlier rejected-workload peaks are not retroactively called passing traversal measurements; the new complete artifacts are separate.

Actual live acquisition timing remains separate. Historical exact discovery took 20,560.89 ms over two attempts (first connection timeout, then 200). Its subsequent two website/XML attempts took 10,075.89 ms to the content conflict, with 9,394 ms upstream and no queue time. The current repeat discovery failed after two connection timeouts: 21,713.68 ms, 21,056 ms upstream and 1 ms queue. The resumed direct-detail acquisition added **28 successful bodies / 770,011 decoded bytes** in 23,367.30 ms of request elapsed time, after retaining the distinct failed annex precursor. The fresh Privacy attempt added one connection timeout and zero decoded bytes. Complete request records are in the manifests; no TCP/TLS wire-byte claim is made.

Traffic was sequential, paced at least 1.1 seconds between request starts, with bounded deadlines and receiving caps. Each run stopped on its first failure and never automatically retried the provider. No pending acquisition process remains.

## Reproduction and precise next work

From the repository root:

```bash
pnpm -r build
python3 docs/implementation/historical-attachment-controls/inspect-independent.py
node packages/core/test/fixtures/release-independent-controls.mjs historical
node packages/core/test/fixtures/release-independent-controls.mjs current
node packages/core/test/fixtures/release-independent-controls.mjs original
node packages/core/test/fixtures/release-independent-controls.mjs current-as-historical
node docs/implementation/historical-attachment-controls/acquire-independent.mjs
node docs/implementation/historical-attachment-controls/acquire-privacy-boundary.mjs
```

Both acquisition commands default to dry-run and send **zero** requests. The DPR command prints the 28 exact non-anchor requests; `--only=articles` or `--only=attachments` narrows it. The Privacy command derives its two exact request bodies from the retained successful dated checkpoint. Adding `--execute` uses sequential 1.1-second pacing, a 20-second deadline, a receiving-time 24 MiB decoded-body cap and a durable manifest, stopping on the first failure without retry. Raw HTTP success alone is never promoted to verified legal equivalence.

Validation on the resumed branch: the build, both full runtime modes, both isolated rejection modes, independent source/detail inspection and both acquisition dry-runs pass; `pnpm test` passes **136/136** regressions. The DPR gates pass without changing source/output/memory/attempt limits. These checks do not cure the missing fresh Privacy raw boundary.

The only remaining requirement in this ticket is a fresh successful raw Privacy article-1 pair for 18/19 September 2018 with wording and effective-to/from controls. Do not repeatedly retry the blocked provider or substitute the older processed checkpoint. Provider/model, named-client, hosting and publication gates remain outside this ticket's findings.
