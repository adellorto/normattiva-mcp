# Independent historical and attachment controls

Research for [Complete independent historical and attachment benchmark controls](https://github.com/adellorto/normattiva-mcp/issues/29), captured 7 October 2026 UTC against local production revision `d0e1d836cf530684dc5f43300fc341d7235760fc`. The [accepted release gates](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865) remain authoritative. No product code, upstream limits, publishing or deployment changed.

**The representative full historical and official attachment benchmarks remain incomplete.** A small authentic source pair exposes a reproducible first-occurrence source restriction before the reader can emit any useful index/reading page. Official attachment content is retained in XML, but separate attachment detail captures were not acquired. Failed source acquisition and source-validation results are retained, never treated as completeness, absence or a performance pass.

## Candidate and independent evidence

DPR 1 August 2011, n. 151 is small enough for bounded acquisition: 13 main articles followed by Allegato I and Allegato II. The [official Gazette entry](https://www.gazzettaufficiale.it/eli/id/2011/09/22/011G0193/sg) independently identifies GU 221 of 22 September 2011 and entry into force on 7 October 2011. The official API exact-discovery capture additionally confirms publication `2011-09-22 / 011G0193`, issuance and Gazette/supplement identity; its output explicitly leaves current legal force unknown. Its authenticated reference uses a fixed **test-only** signing key, solely for recoverable local replay. [Discovery capture and result](historical-attachment-controls/dpr151-2014-01-01/manifest.json).

Three actual dated website/XML pairs are retained, without changing their metadata or legal text:

| Requested snapshot | Website | XML representation | Decoded XML bytes |
| --- | --- | --- | ---: |
| 2012-01-01 | [Official dated page](https://www.normattiva.it/eli/id/2011/09/22/011G0193/CONSOLIDATED/20120101) | `ORIGINAL`, expression 2011-10-07 | 286,810 |
| 2014-01-01 | [Official dated page](https://www.normattiva.it/eli/id/2011/09/22/011G0193/CONSOLIDATED/20140101) | `CONSOLIDATED/20131031` | 282,265 |
| 2026-10-07 | [Official dated page](https://www.normattiva.it/eli/id/2011/09/22/011G0193/CONSOLIDATED/20261007) | `CONSOLIDATED/20140913` | 283,883 |

Each paired manifest under [the retained capture directory](historical-attachment-controls/) records exact request URL/body, UTC capture date, response status, decoded bytes and SHA-256. `capture-1.gz` is the complete rendered page and `capture-2.gz` its supplied AKN response. The current candidate also retains `capture-3.gz`, the actual first-article OpenData response (87,759 decoded bytes); no detail envelope was synthesized. That initial `a1_` coordinate-only exploratory run withheld the API result as `source_identity_conflict`. The later exact-discovery identity is independently captured rather than inferred from that failure.

[Independent inspection](historical-attachment-controls/inspect-independent.py) uses Python standard-library HTMLParser and ElementTree, importing no production parser. It compares the exact rendered navigation order against XML order at each date: articles **1 through 13, Allegato I, Allegato II**, 15 unique occurrences with no loss/duplication. [The resulting source controls](historical-attachment-controls/independent-source-controls.json.gz) preserve each supplied navigation address, each article eId, XML text hashes/lengths/openings, and table cells in source order. Complete text remains in the raw captured sources. This establishes source crosswalk/order agreement for this candidate, not verified membership or full content equivalence from the production reader. XML content expectations alone cannot independently certify XML content.

The two attachments are readable text rather than graphics: no AKN `img` occurs. Allegato I has a 34,997-character whitespace-folded cell and Allegato II a 40,084-character cell. **Both encode their ASCII tabular layout as one row/one cell**, with unit row/column spans. These are useful real within-cell continuation candidates. They do not supply a real multi-column/rowspan benchmark, and the existing synthetic table/span control remains separately scoped. Missing raw line-break preservation or independent rendered equivalence must not be inferred from the folded inspection text.

## Rejected source controls and legal-change limits

With the independently discovered authenticated identity, the historical consolidated pair fails `source_content_conflict` before the first useful page. The captured rendered `bodyTesto` includes the decree's preamble, then article 1, then extensive Gazette explanatory notes. The AKN article-1 occurrence represents the article separately. This is a concrete compound-body disagreement; it has not been shown to be a notes-only difference. Removing the preamble or unclassified notes merely to force matching is not an accepted remedy. The current pair reproduces the same failure offline using the same independent identity. The isolated current live discovery attempts timed out, so this current offline failure is not claimed as a successful current live reader canary.

The 2012 pair fails `source_identity_conflict` because the parser accepts only a dated `CONSOLIDATED/` Work alias, while the authentic response has the correct publication's `ORIGINAL` alias. This is an unsupported representation of the correct publication, not proof of wrong publication or unavailable history. Supporting it would require concrete snapshot/content evidence; relabelling its root is not verification.

The negative control replays the **actual current XML** against the actual 2014 dated page/request. It fails `snapshot_conflict`: an expression/edition postdates the selected snapshot. This is a useful rejection, but says nothing universal about forged-root dates. The separately retained Privacy forged-date control in [the earlier historical runner](../../packages/core/test/fixtures/release-historical-runtime.mjs) remains required.

DPR article 11 differs between the retained 2014 and current sources by an additional update annotation referencing DL 133/2014 as converted by Law 164/2014. Such legal update material is not automatically disposable explanatory text. It does not by itself provide a clean before/after article-wording boundary. No exact DPR boundary was certified from dates/counts or every note difference.

The existing Privacy substantive control remains the appropriate supplemental boundary: old article 1 versus replacement article 1, independently retained in `packages/core/test/fixtures/acts/privacy-historical.xml.gz` and `privacy-current.xml.gz`. The [official Gazette entry for D.Lgs. 101/2018](https://www.gazzettaufficiale.it/eli/id/2018/09/04/18G00129/sg) confirms publication on 4 September 2018 and entry on **19 September 2018**. Existing paced live results test 18/19 September 2018 and report the expected substantive change; those production outputs are dated checkpoint evidence, not new independent raw boundary-detail captures. Fresh exact before/after detail captures and their legal wording/validity controls still need acquisition. Full Privacy history/export is unnecessary for that focused check.

## Production measurements

[The replay runner](../../packages/core/test/fixtures/release-independent-controls.mjs) exercises `ActTraversal.listArticles/readAct`, the accepted shared-module seam, with streamed unmodified official captures and an actual exact-discovery locator. One mode runs per process. It imports the production TypeScript build; no Python prototype memory is substituted. Failure checks assert the exact typed code and bounded caller-visible envelope. These finite failure assertions passed, while the useful-page/complete-traversal gates are explicitly null/incomplete.

| Mode | Cold index failure ms | Repeat index failure ms | Reading failure ms | Peak process KiB | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Historical consolidated | 374.05 | 231.70 | 216.73 | 149,232 | `source_content_conflict` |
| Current consolidated | 356.25 | 234.84 | 219.10 | 152,064 | `source_content_conflict` |
| Original historical | 304.14 | 225.71 | 212.47 | 152,888 | `source_identity_conflict` |
| Current XML as historical | 287.24 | 204.38 | 173.60 | 149,288 | `snapshot_conflict` |

Every measured call makes two saved-source attempts. Reports retain per-call elapsed, attempts, decoded source bytes, queue/upstream time, residual local time and response serialization bytes: [historical](historical-attachment-controls/runtime-historical.json), [current](historical-attachment-controls/runtime-current.json), [original](historical-attachment-controls/runtime-original.json), [current-as-historical](historical-attachment-controls/runtime-current-as-historical.json). Offline upstream timing measures streamed fixture service, **not real network latency**. Residual local time is subtraction from the runtime counters, not CPU time. The source is rejected before verified cache insertion, so the second attempt is a warmed repeat failure, not a cached useful page. It is inappropriate to call these rejected-workload peaks a passed full-traversal 256 MiB gate. Serialized failure envelopes are under 128 KiB; no successful content envelope was emitted.

Actual live acquisition timing remains separate. Historical exact discovery took 20,560.89 ms over two attempts (first connection timeout, then 200). Its subsequent two website/XML attempts took 10,075.89 ms to the content conflict, with 9,394 ms upstream and no queue time. The current repeat discovery failed after two connection timeouts: 21,713.68 ms, 21,056 ms upstream and 1 ms queue. Complete request records are in the manifests. Across the candidate/discovery runs and the distinct saved initial sandbox precursor, **18 attempts** were made, 11 complete 200 bodies totaling **1,957,881 decoded bytes**, and seven failed attempts. The 2014 `sandbox-precursor.json` duplicates the same run already represented by its manifest and must not be counted twice. Missing failed-attempt byte counts/timings in the initial exploratory records are unknown, not zero. No TCP/TLS wire-byte claim is made.

Traffic was sequential, paced at least 1.1 seconds between request starts, with production runtime deadlines/attempt accounting. An extra attachment-detail acquisition escalation was interrupted before execution; **no attachment request was sent**, and no automatic-approval rejection is claimed. The abandoned exploratory script was replaced with a dry-run recovery that derives every coordinate from the captured official navigation. No pending acquisition process remains.

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
```

The last command sends **zero** requests and prints the four exact historical/current Annex I/II requests, also retained in [recovery-plan.json](historical-attachment-controls/recovery-plan.json). After required execution permission, adding `--execute` performs only those four requests, one at a time, with a 20-second deadline, a receiving-time 24 MiB decoded-body cap, pacing, and a durable per-run manifest; it stops on the first failure rather than repeatedly retrying. It does not promote raw HTTP success to verified legal equivalence. Privacy boundary acquisition needs independently selected dated navigation/validity controls rather than silently reusing an old article version.

Validation on this research branch: the build, all four isolated rejection modes, independent source-order inspection and acquisition dry-run passed; `pnpm test` passed **125/125** regressions (20.68 seconds). These checks preserve existing behavior and the documented blocks. They do not close either missing successful benchmark gate.

Recommended native-blocking follow-up: **Verify first occurrences in compound official renderings without weakening source validation.** Decide/implement an evidence-preserving article/preamble/notes adapter, or select a genuinely independent exact article representation; preserve honest preamble coverage and rejection of unexplained substantive conflicts. Include the authentic original-alias restriction only if original snapshots are deliberately supported with independently proved validity. Re-run these failed controls through the shared module and observable MCP seam after review. This repair blocks the successful DPR benchmark, not the research artifact's truthfulness.

Then complete **Acquire independent detail controls and finish historical/attachment runtime gates**: capture all 13+2 occurrences for the selected supported historical/current sample, independently verify exact legal text and table representations, obtain precise Privacy before/after raw controls, and measure successful cold/cached first useful pages, complete traversals, eviction/continuation, attempts/bytes/queue/upstream and full peak RSS. Keep the 16-attempt composed-call budget and all accepted source/output caps. A graphical/unread result remains a limitation, not a surrogate benchmark pass. Provider/model, named-client, hosting and publication gates remain outside this ticket's findings.
