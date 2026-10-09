# Candidate 0.2.0 pre-publication acceptance and handoff

Initial acceptance work began on 5 October 2026; the coordinated pre-publication decision was completed on 9 October 2026, Node 24.15.0/Linux, against local candidate `e284be4` plus the release-handoff documentation. [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22) is ready to close with a **prepared publication handoff**. The [accepted delivery specification](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865) still governs acceptance. No push, tag, npm publication or deployment was performed.

Every native prerequisite on the implementation map is closed. Their failed precursors, scoped corrections and limits remain recorded below; the terminal decision relies on the integrated evidence, not on relabelling any earlier failure.

## Gate status

Latest evidence: [Final release validation checkpoint, 6 October 2026](final-release-validation.md), supplemented by the [HTTP cancellation remedy](http-cancellation-remedy.md), [TUEL memory remedy](tuel-memory-remedy.md), [model guidance remedy](model-guidance-remedy.md), and [historical/attachment controls](historical-attachment-controls.md), last continued on 9 October 2026. The user explicitly excluded the exact model Llama3.1 8B from this candidate's validated support scope; no replacement Llama model is assessed, and Qwen/DeepSeek plus named-client gates remain mandatory. Earlier measurements and failed samples below remain historical evidence; the following table governs the current candidate.

| Gate | Result and limit of the evidence |
| --- | --- |
| Deterministic regressions/build | **143/143 pass** on the integrated candidate, including lowercase-cursor exact continuation and legacy cursor consumption, complete DPR and Privacy controls, full-TUEL memory and escaped-Unicode/eviction regressions, nine public HTTP cancellation/isolation controls, model-evaluation safeguards, inference-safe terminal-client modes and retained Claude-over-HTTP evidence. |
| Installed npm consumer and reference portability | **Pass** on 9 October: the actual 0.2.0 tarball installs outside the workspace and passes parser-worker execution, public contracts, same-key restart, configured npm/fresh-HTTP transfer and different-key rejection. The final dry run contains the six expected files; its manifest is recorded below. |
| Vercel built-function packaging | **Local pre-publication pass** on 9 October: `vercel build --prod --yes --non-interactive` completes, and the isolated Node 24/60-second function contains the parser worker, restores its 18 declared file mappings, passes public contracts and aborts same-instance upstream work in 4 ms before healthy follow-up. This is deliberately not called deployed verification. |
| Direct-read processing overhead | Same truthful work/full serialization: warm legacy −7.81%; warm authenticated −1.90%; legacy process-cold +0.42%; authenticated process-cold +3.89%, all below +10%. The memory remedy rechecks the same targets: warm legacy +0.83%, authenticated −8.02%; cold legacy −1.55%, authenticated +3.75%, all passing. Raw distributions remain in the checkpoint and [memory artifact](tuel-memory-measurements.json.gz). |
| Runtime memory/serialized bytes | The [TUEL memory remedy](tuel-memory-remedy.md) passes three full 295-occurrence runs at **226.6/221.2/222.3 MiB**, including cached pages and evicted continuation; all 40 page fingerprints match pre-remedy payloads, largest response 83,908 bytes. Complete DPR historical/current 15-occurrence and attachment workloads pass at **199,128/200,580 KiB** peak RSS, at most 16 attempts per call and less than 128 KiB per caller-visible response. Earlier failures remain retained. |
| Schema/result guidance | Final native Qwen schema **+6.48%** and risky-result explanations/error messages at most **60 tokens** pass, counting both MCP copies. Prototype encodings pass at **+6.68% / +7.02%**, at most 56 explanatory tokens. Earlier 64-token failure remains retained. |
| Terminal client samples | Fresh Claude and restored Codex stdio runs pass literal tool continuation and deny absence from unresolved 404. The final **Claude Code 2.1.295 / claude-sonnet-5-5 local HTTP** sample crosses the actual production handler, copies its issued continuation literally, completes the article and denies that unresolved 404 proves absence. Representative Qwen/DeepSeek provider samples pass their accepted scoped gates. Codex-over-HTTP and a full client × transport cross-product are not claimed. Earlier Claude final quotation limitations remain retained. |
| Representative OpenRouter matrix | Earlier failures remain retained. The [model guidance remedy](model-guidance-remedy.md) records the exact Llama3.1 8B exclusion, 36/36 targeted Qwen routing, 14/14 continuation controls and 2/2 empty-search correction; the failed full-Qwen invented-source precursor remains explicit. The complete paced DeepSeek sample and exact-copy wording correction both retain their mixed-case cursor failures. After approved lowercase-only `n3_`/`d2_` issuance, the single bounded DeepSeek correction copies both 602-character cursors exactly and passes **2/2** fresh-MCP replays with no provider error, truncation, automatic flag or caller-visible prose. This clears the retained model/native-guidance prerequisite without guaranteeing future behavior or completing named-client/deployed gates. |
| Official-source canaries | **Pass for pre-publication**: the final scoped live rerun passes 15/15 checks in 18 paced attempts. Independent DPR controls verify all 15 historical/current occurrences and both annexes. The bounded Privacy resolution then obtains both raw 18/19 September 2018 bodies in two new sequential requests after retaining the earlier timeout; independent inspection verifies exact wording and the `20101124–20180918` / `20180919–99999999` validity boundary. Acquisition dry-runs now send zero requests. Local registration, not a deployed-revision canary. |
| Default transport cancellation/timeouts | Both default transports pass real 20-second/two-attempt timeout probes. Stdio and same-process HTTP cancellation abort upstream and allow healthy follow-up work; incoming HTTP Request abort and queued cancellation pass separately. A separate protocol notification routed to another stateless instance cannot cancel local work, so no cross-instance guarantee is made. The deployed Request-signal path remains a required post-deployment check. [Remedy and limits](http-cancellation-remedy.md). |
| Spending | OpenRouter ledger: [release-model-gates-results.json.gz](release-model-gates-results.json.gz); **$0.676770222678 accounted upper bound**, **$0.344793909080 returned receipts**, under unchanged $1 cap. The intended HTTP client run reports **$0.0515098** Claude list price. A failed-plan stdio precursor reports **$0.069257**; both are retained. Cumulative recorded Claude list price is **$0.2605718**. Existing subscriptions reported no separate API charge. |
| Final release approval | **Prepared publication handoff accepted.** Every gate executable without publishing or deploying passes. Actual hosted revision/environment, deployed Request abort and a small deployed live workflow are user-only post-deployment gates and remain explicitly unpassed. Candidate 0.2.0 must not be called production-accepted until those checks pass. No push, tag, publication or deployment occurred here. |

## Terminal decision, 9 October 2026

Candidate 0.2.0 is accepted for **publication handoff**. This is the terminal outcome of the release-preparation ticket, not a claim about a deployment that does not yet exist. Local build/tests, installed-package behavior, local configured hosted packaging, reference portability and trust rejection, migration/version alignment, runtime/serialization/resource limits, independent official controls, bounded model evidence and representative named-client paths all pass their accepted pre-publication gates.

The remaining actions require authority this session explicitly does not have: push the reviewed commits, create the release/tag, publish npm, deploy the hosted function and observe the deployed environment. A deployed revision can fail because of environment configuration, topology or provider state even when its local artifact passes. Therefore deployed version/worker availability, incoming Request abort, literal continuation and a small paced official workflow must be checked after deployment and before describing the release as production-accepted. Cross-instance protocol-notification cancellation remains unsupported unless the deployment supplies affinity or shared cancellation delivery; ordinary HTTP Request abort is the supported hosted cancellation path.

One new named-client run was justified by final review because prior evidence explicitly left HTTP open. [Claude Code 2.1.295 over local HTTP](release-final-claude-http.json) used the existing subscription, low effort and a $0.50 execution cap; it reports $0.0515098 list price, zero web search/fetch use and no client error. It made four MCP calls over loopback to the production handler with synthetic upstream data. The issued continuation is copied literally and succeeds; the final answer reconstructs the complete fixture article and correctly denies that the unresolved 404 proves absence.

The test-first red phase discovered that the legacy evaluator ignored the new `--plan` argument and performed one ordinary stdio session before the assertion failed. That [precursor](release-final-claude-plan-precursor.json) is retained rather than hidden: $0.069257 list price, literal continuation and honest absence language, but it does not count as HTTP evidence. The corrected plan mode is deterministically verified to write no result and dispatch no inference. OpenRouter spending is unchanged at **$0.676770222678 accounted / $0.344793909080 returned receipts**; cumulative recorded Claude list price is **$0.2605718**, still well below the user's overall €10 ceiling.

### Explicit client-path scope decision

The accepted specification asked for representative model families and client paths, while the earlier checkpoint subsequently described a “complete named-client/HTTP matrix” as open. That phrase was broader than the specification and had no finite matrix definition. The smallest genuine missing path is now covered: 0.2.0 validates Qwen/DeepSeek tool-use behavior through the provider adapter, Claude/Codex interoperability through stdio, **Claude Code through local HTTP**, and hosted HTTP contracts through the production handler plus the official MCP SDK.

This closes one representative named-client HTTP path without a needless client × model × transport cross-product. It does not validate Codex over HTTP, a deployed named-client path or arbitrary future client/model behavior, so release claims must stay within that boundary. A claim naming Codex or a particular deployed client path requires its own bounded run against an immutable preview or deployed revision.

### Final local verification

All commands below ran from the isolated release worktree on 9 October. They made no official-source request and no remote-state change. The two explicitly retained Claude subscription runs are the only new inference; their settings, usage and list-price figures are recorded above and in their linked artifacts.

| Command | Result |
| --- | --- |
| `pnpm test` | Build plus **143/143** deterministic tests pass; zero failed, skipped or cancelled. |
| `node packages/core/test/fixtures/release-package.mjs` | Actual tarball install, contracts, restart, npm/HTTP transfer and different-trust rejection pass. |
| `npm pack --dry-run --json` in `packages/stdio-server` | 0.2.0 and the six expected files; exact volatile values are retained only in the [machine-readable manifest](release-package-dry-run.json). |
| `vercel build --prod --yes --non-interactive` | Configured production build completes locally. |
| `node packages/core/test/fixtures/release-vercel-package.mjs` | Isolated built function passes contracts, worker execution and same-instance cancellation; Node 24, 60-second duration, 18 declared mappings, 4 ms abort. |
| `python3 docs/implementation/historical-attachment-controls/inspect-independent.py` | DPR 15-occurrence order and 28 details verified; Privacy 18/19 September wording and effective ranges verified. |
| `node packages/core/test/fixtures/release-independent-controls.mjs historical` | Full 15-occurrence/attachment traversal passes: 201,036 KiB RSS, 59,104-byte largest page, 16 attempts maximum. |
| `node packages/core/test/fixtures/release-independent-controls.mjs current` | Full 15-occurrence/attachment traversal passes: 201,240 KiB RSS, 59,586-byte largest page, 16 attempts maximum. |
| Both acquisition scripts without `--execute` | Dry-run only; Privacy reports the terminal passing manifest and requires zero execution. |
| `node packages/core/test/fixtures/release-cli.mjs claude /tmp/result.json http --execute` | One bounded local-HTTP Claude run passes literal continuation and absence honesty; synthetic upstream, no Normattiva traffic. |

## Packaging correction and version preparation

The first isolated npm run reproduced `parse_limit_exceeded` when `list_articles` started its worker. The original esbuild command bundled only the main entry; `new Worker(new URL('./act-parser-worker.js', import.meta.url))` could not find the sibling in the tarball. [bundle.mjs](../../packages/stdio-server/bundle.mjs) now bundles both entries, including the worker's private core dependencies. The same isolated-consumer check then passed.

The [final npm dry run](release-package-dry-run.json) is the canonical machine-readable manifest and includes `LICENSE`, `README.md`, `dist/index.js`, `dist/index.d.ts`, `dist/act-parser-worker.js` and `package.json`. Package versions, stdio initialization, API User-Agent and bilingual landing-page candidate labels are aligned at **0.2.0**, a coordinated pre-1.0 breaking candidate. Existing public deployments were not modified.

The queue-deadline regression previously assumed adjacent deadlines expired in the same millisecond. Under the release test workload the active call could release before the queued deadline, legitimately allowing a second attempt. Its controlled fixture now holds the lane through cancellation until the queued call expires; production timeout policy is unchanged.

## Runtime and token evidence

[Full runtime measurements](release-runtime-measurements.json.gz) retain per-call latency, attempts, queue/upstream time and per-page bytes/items/progress where available. Each memory workload ran in its own process.

| Workload | Observed result |
| --- | --- |
| TUEL, 295 ordered occurrences | First useful page: 14 items, 38,146 bytes, 1,232 ms cold. Traversal completes in 2,096 ms; traversal plus cached/evicted reacquisition takes 3,203 ms and 300 attempts. Cached call: 26.3 ms, zero attempts. Peak RSS: 209,280 KiB. |
| Sustained ordinary direct reading | 2,000 reads, exactly one attempt each; median 0.98 ms, p95 1.88 ms, 3,674 ms including serialization; peak RSS 234,600 KiB. |
| Civil Code concurrent/coalesced preparation | Three queued calls plus eviction/fresh reader; six attempts, 10,613,106 source bytes, 3,336 ms preparation; peak RSS 221,520 KiB. This sample records pending preparation and two returned articles, not a full Civil Code crawl. |
| Paired truthful direct-read comparison | Stage-2 `3f75ff5` versus current, same content/schema/full MCP serialization, 30 alternating batches of 50 after warm-up; 1,601 reads per revision including the equality check. Median changes +5.78% and −7.92%; retain the distribution rather than interpreting the negative sample as an optimization. |

TUEL XML/portal are captured sources, but its independently rendered detail envelopes are synthetic. In particular their editorial identity metadata cannot establish that the current live API supplies the same evidence. Paired overhead processes load **two** revisions and peak at approximately 283–284 MiB; they are latency comparisons, not single-runtime memory acceptance samples. The remaining cold comparisons and historical/attachment timing workloads must still be measured.

[Guidance measurements](release-guidance-measurements.json) use tiktoken 0.14.0, `o200k_base` and `cl100k_base`. The baseline removes descriptions from the same replacement schemas. Total schemas are 16,130 and 15,528 tokens, respectively; the small guidance percentage does not make the full schemas negligible. Risky output explanations range to 58 tokens across both representations; full payloads include locators and metadata.

## Live-source findings and restoration

[Paced live trace](release-live-canaries.json): nine MCP calls, twelve upstream attempts, at least one second between request starts. Exact TUEL/Civil/Privacy discovery, CAD alias verification and official relevance search pass. There was no full crawl or load test.

The ordinary TUEL article-13 detail returned HTTP 200 but its actual `sottoTitolo` omits editorial code `000G0304`. The current verifier requires that code and withholds the result as `unresolved / source_identity_conflict`; Gazette and issuance fields alone did not satisfy its selected identity proof. This reveals an incompatibility between the synthetic controls and the live response, not a legal absence. The preserved [captured detail](../../packages/core/test/fixtures/acts/tuel-direct-2026-10-05.json.gz) is replayed through the public MCP seam to retain withholding as a negative control. A remedy must establish independent identity without treating echoed request coordinates as evidence.

Dated TUEL, Civil Code and 2017 Privacy website routes returned HTTP 409. The historical/attachment readings and continuations could not be validated. The original trace names the Privacy probe an independent historical control, but date/label assertions only test dated-route availability; the runner now names that scope correctly. Independent historical legal-content/change-boundary controls remain required. Unclassified failures did not authorize retries or weaker source validation. Restore/verify the supported official route, then rerun the paced canaries; do not treat saved fixtures as a substitute for this gate.

### Corrective live run, 6 October 2026

[Restore verified live reading against current official sources](https://github.com/adellorto/normattiva-mcp/issues/23) remedies three verified connector findings without relaxing source agreement or retries:

- The website rejects the OpenData portal Origin. A one-variable probe returned HTTP 409 with Origin and HTTP 200 without it; changing Accept alone retained HTTP 409. Website navigation now omits that Origin. The AKN link depends on the dated page's servlet session and load-balancer affinity; JSESSIONID and NCC are carried only within each acquisition, never in evidence, locators, cache entries or persisted state. A missing session previously produced an HTML page with HTTP 200, correctly rejected by the XML parser. Source-size and attempt limits are unchanged.
- Complete official discovery metadata now yields an authenticated `a2_` act locator. It carries exact publication, issuance type/date/number, Gazette issue and supplied supplement identity. The detail must match every field and independently cover the requested date. Signed article/continuation references retain this proof across restart. Missing or conflicting metadata, explicit contradictory editorial codes, forged locators and different trust are rejected; no echoed coordinates establish proof. Partial discovery metadata retains `a1_`, and the original coordinate-only TUEL withholding control remains intact. Healthy ordinary reading and each article continuation remain one upstream request.
- The TUEL enactment article-1 API rendering bundles a substantive preamble into its article body. Rather than normalize that away, acquisition verifies the first occurrence against the independently rendered dated website, including its validity interval, entire article text/notes and table relationships. Snapshot evidence names that detail URL. Conflicting renderings withhold the index, and a direct read of the conflicting API body still remains unresolved. The captured preamble response is retained as a negative control.

[Corrective paced trace](release-live-canaries-2026-10-06.json): **15/15 calls pass, 18 upstream attempts**, at least one second between attempt starts. TUEL direct article-13 continuation remains date-bound; dated index continuation returns the second distinct article-1 occurrence, rather than guessing article 2. Civil's index returns useful verified content and its supplied attachment address reads article 2043. Privacy's dated index and exact first occurrence agree for 2017; independent article-1 readings at 18/19 September 2018 distinguish the old right-to-protection text from the GDPR wording and verify the end/start boundaries. The amendment's independent [Gazette publication](https://www.gazzettaufficiale.it/eli/id/2018/09/04/18G00129/sg) records entry into force on 19 September 2018. The 2017 index's repeated labels require its exact returned locator; a bare article-1 request after indexing correctly stays unresolved.

Earlier investigative runs retained HTTP 500/1000, HTML-instead-of-XML and source-conflict failures. They did not authorize automatic retries or changes to supplied article coordinates. The final passing run follows corrections to request headers, session affinity and independent verification. It is bounded sample evidence; it does not certify every historical occurrence, attachment, whole-act completion or upstream availability. Remaining live historical/attachment performance and deployed transport/package checks remain on final acceptance.

[Paired direct overhead](release-direct-overhead-2026-10-06.json) repeats the same truthful warm synthetic reads against stage 2 `3f75ff5`: 1,601 reads per revision, 3,202 total upstream attempts, full MCP serialization, alternating batches. The median comparison is +0.08%, below the +10% target; timing noise means this is not an optimization claim. Cold comparisons and the cost of the larger authenticated references remain to be evaluated in stage 5. The signed proof changes corrective model input payloads; the earlier frozen model sample remains failed/incomplete and must not be relabelled as a passing run.

No paid inference, push, publication or deployment was performed during this correction. The previous spending ledger remains authoritative.

## Continuation-reference correction

The [remedy record](continuation-reference-remedy.md) documents compact authenticated `n2_` reading references, continued `n1_` decoding, shared target binding and authenticated inflation limited to 16 KiB. No trust, source, frozen-date or position checks are relaxed. Real-tarball restart and configured npm/fresh-HTTP transfer checks pass, with different-trust rejection; these are local synthetic controls.

The bounded Terra correction passes literal continuation and exact joined article text. A 24-call Qwen/DeepSeek precursor copies all twenty returned references literally and clarifies all four missing-cursor cases, but **remains failed** because Qwen adds act/date arguments to both interrupted-index continuations. Initial-only field guidance remedies those observed failures in the final **4/4** focused rerun. Every compatible generated call is replayed through fresh production MCP, and every caller-visible response is manually inspected. These single-next-action samples do not establish complete autonomous traversal or a passing full latest-schema matrix. The final coordinated client/model matrix remains required.

Current prototype guidance counts include nested input-field descriptions: 4.27–4.45% overhead, at most 60 explanatory tokens across both MCP copies. The same-source wire comparison reduces the article cursor from 2,057 to 765 characters and full MCP bytes from 8,430 to 4,986. Warm direct-read overhead is +3.28%; healthy direct reads remain one request. Full deterministic tests pass 105/105.

Use [release-continuation-results.json.gz](release-continuation-results.json.gz) as the latest cumulative OpenRouter ledger, decompressed for `--prior-report`: **$0.387203023418 accounted upper bound**, **$0.10055338982 receipts**. It retains unknown-cost reservations and all earlier attempts, including conservatively reserved interrupted plans. Original failures below remain historical evidence, not current pass claims. No official legal-source requests, push, publication or deployment were made for this correction.

## Model/client evidence and spending

[Curated terminal results](release-client-results.json) preserve exact arguments, returned text, token usage and cursor checks while excluding account/session initialization metadata. Both clients used synthetic controls with the actual built stdio server, without opt-in research prompts or initialization instructions. The prompt requests article 13 in a four-character first page, then a 100-character continuation, and an unresolved article 999 without indexing.

- Claude Code 2.1.289, `sonnet` resolving to `claude-sonnet-5-5`, low effort: literal continuation passes; joined text is `Art. 13. Fixture text 13.`; HTTP 404 is explicitly not proof of absence. Reported list-price cost $0.0711992 with a $0.50 execution cap.
- Codex CLI 0.160.0, requested `gpt-5.6-terra`, low effort: a 1,695-character cursor was altered to 1,667 characters and rejected as `invalid_cursor`. The model reread the ordinary article directly and gave correct final text and absence reporting. This recovery **does not erase** the failed release gate. The requested backend name is recorded; the event stream does not independently attest a resolved model ID.

One earlier Codex model turn was blocked by MCP approval configuration; it is excluded from acceptance but its token usage is retained. For the final run, built-in apps were disabled and only this synthetic server was preapproved. Two earlier startup attempts produced no useful MCP work. An exploratory `gpt-4.1-mini` API request returned HTTP 429 and produced no completion; it is excluded too.

The CLI runs used existing subscription logins. Separate API charges were not demonstrated, and Codex reported tokens rather than a monetary cost. This does not mean the sessions consumed no quota. OpenRouter inference was subsequently run after the user restored the key. The user's total ceiling is €10; the runner imposes a $1 software cap. The restored key has a separate $10 limit, so it is not the tighter spending guard. No additional CLI runs were used to hide the Terra failure.

[OpenRouter plan](release-model-plan.json) and [frozen production MCP inputs](release-model-input.json.gz) cover the 28 accepted routing cases plus empty search, unresolved targets, pending/more/interrupted, literal cursor, changed-content rejection, unread attachment coverage and unknown currentness: Qwen3 14B, DeepSeek v4.1 Flash and Llama3.1 8B, two repetitions each, 1,536 maximum output tokens, temperature zero. The plan checks live model availability and prices before dispatch. It caps provider prices, reserves conservatively before each request, retains reservations for unknown billed failures and stops dispatching further cases for a family after an API failure. Four concurrent workers checkpoint reservations atomically before dispatch; a 120-second per-request deadline bounds waiting. Offline provider fixtures verify the cap, credential redaction, unsupported-parameter omission and durable concurrent reservations. [OpenRouter documents price ceilings in USD per million tokens](https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/provider-selection.mdx).

Automatic checks cover routing, factual constraints and literal cursors in the first tool call. The separate [model review](release-model-review.json) inspects caller-visible outputs and every tool call, with offline public-schema and literal-reference comparisons; generated tool calls were not executed against legal sources. A zero-error finite sample cannot guarantee arbitrary model behavior; any observed failure needs a measured correction and rerun, or an explicit acceptance revision.

## Executed OpenRouter sample

[Raw results](release-openrouter-results.json.gz) retain every output and billed usage, plus nested setup/timeout attempts. The [executed plan](release-model-plan.json) records the frozen input/schema hashes, live catalog prices and settings. Production tool definitions were unchanged by this evaluation.

| Requested / resolved family | Completed outputs | Rows with automatic flags | Result |
| --- | ---: | ---: | --- |
| Qwen3 14B | 78/78 | 40 | Dropped article/paragraph and temporal constraints; invented a missing cursor; altered the long article cursor in both repetitions; incompatible continuation arguments. |
| DeepSeek v4.1 Flash | 78/78 | 41 | Invented read locators before discovery; speculative multiple searches; changed issuance to publication intent; altered the pending-index cursor and selected the wrong continuation tool. |
| Llama3.1 8B | 0/78 | — | First request returned provider completion error 502; remaining family calls were skipped. No model acceptance conclusion. |

These are 28 routing cases and 11 caller-visible risk controls, repeated twice per completed family: 156 completed responses, not 234. Eligible providers varied; raw rows retain their names and resolved model IDs. Final completions consumed 264,206 prompt and 66,478 completion tokens, with `stop` or `tool_calls` endings throughout. The adapter sends input schemas only; full MCP schema token counts above also include output schemas and therefore differ from provider prompt usage. The 1,536-token output ceiling and single model turn limit what the sample demonstrates; this is not a multi-turn legal workflow or full client-path matrix.

The two Qwen article continuations shortened the 1,695-character cursor to 1,663; two DeepSeek pending-index continuations shortened 547 to 546. Qwen also invented `next_page_cursor` twice. Literal cursors plus conflicting coordinates and wrong continuation tools are separately identified in the review. DeepSeek used human citations as read locators in 13 calls before any discovery reference was returned. The server's validation remains intact; this experiment does not execute or accept these fabricated references.

All 12 targeted empty/unresolved/suffixed outputs reject proof of legal absence. Most incomplete/changed/attachment responses also acknowledge their limits, but Qwen's second attachment answer claims the main text is completed while the article inventory is incomplete; count this conservatively as unsupported completion language. DeepSeek's second unknown-currentness case starts a read without a final answer, so it remains inconclusive. Some prose proposes unsupported recovery, broadened exact searches or unverified sources. DeepSeek's clarification of a reversed range is semantically sound even though the automatic route scorer expects a call; retain the flag but do not call it silent constraint repair. Automatic flag totals are not counts of fabricated cursors or false legal claims.

An initial strict request using `parallel_tool_calls:false` returned HTTP 404 because eligible providers did not support that parameter. The corrected serial attempt completed 15 Qwen outputs before a 60-second timeout. Both attempts remain nested in the final evidence. Removing the unsupported flag allows model responses with multiple tool calls; API worker concurrency is a separate setting. No automatic paid retry was made, and earlier outputs remain part of the ledger and review.

Completion receipts across all attempts total **$0.0511943572**; retained failed-request reservations give **$0.0566696372** as the accounted upper bound. Post-run key usage is **$0.051474554**, including $0.0002801968 not itemized in returned completion receipts, still within that bound. The whole final plan reserved $0.89071932 plus $0.00831984 for prior attempts before dispatch. Prior Claude list-price usage adds $0.0711992; Codex used subscription quota without a monetary report. No further inference is needed to demonstrate the observed failures. Consult this ledger before any corrective rerun under the user's overall €10 ceiling.

## Reproduction and credential restoration

From the repository root, after installing dependencies:

```bash
pnpm build
pnpm test
node packages/core/test/fixtures/release-package.mjs
node packages/core/test/fixtures/release-runtime.mjs tuel
node packages/core/test/fixtures/release-runtime.mjs direct
node packages/core/test/fixtures/traversal-memory.mjs
node packages/core/test/fixtures/measure-guidance.mjs
```

The package check installs a real local tarball into a temporary consumer using runtime dependencies from npm. Run it separately from builds/tests because pack lifecycle scripts rewrite the built stdio entry.

For the direct comparison, create a temporary baseline checkout from `git archive 3f75ff5`, restore that revision's `packages/core/package.json`, provide the current core's dependency symlink at its `packages/core/node_modules`, and compile with the workspace TypeScript binary. Then pass its compiled `packages/core/dist` directory to `release-direct-overhead.mjs`. The output explicitly records its baseline and comparison scope. The recovered routing prototype remains at local commit `8f1f824` on `prototype/issue-18`; its removed temporary worktree was not recoverable as a credential source.

The current local-only wizard is `bash .private/setup-openrouter-release.sh`; it reads a key invisibly and writes ignored, mode-600 `.env.openrouter.local`. If that ephemeral wizard is unavailable, recreate that file outside git with `OPENROUTER_API_KEY`, `OPENROUTER_MODELS=qwen/qwen3-14b,deepseek/deepseek-v4.1-flash` and `OPENROUTER_MAX_COST_USD=1`. The exact Llama3.1 8B model is excluded from current validated support by the recorded user decision; keep its earlier traces as historical failures. Prefer a dedicated OpenRouter key limited to $1. No key is embedded in these artifacts.

```bash
node packages/core/test/fixtures/release-model-input.mjs > /tmp/normattiva-release-model-input.json
gzip -dc docs/implementation/release-model-gates-results.json.gz > /tmp/normattiva-release-prior.json
OPENROUTER_MODELS=qwen/qwen3-14b,deepseek/deepseek-v4.1-flash node --env-file=.env.openrouter.local packages/core/test/fixtures/release-openrouter.mjs /tmp/normattiva-release-model-input.json /tmp/normattiva-release-model-plan.json --plan --prior-report /tmp/normattiva-release-prior.json
# Paid corrective sample, after reviewing the plan and retained spending ledger:
OPENROUTER_MODELS=qwen/qwen3-14b,deepseek/deepseek-v4.1-flash node --env-file=.env.openrouter.local packages/core/test/fixtures/release-openrouter.mjs /tmp/normattiva-release-model-input.json /tmp/normattiva-release-model-results.json --prior-report /tmp/normattiva-release-prior.json
```

When continuing a partially billed evaluation, pass `--prior-report /path/to/previous-report.json` to carry its receipts, unknown-cost reservations and outputs into the next plan; do not reset the spending ledger. The key is now restored in the ignored local file.

For an explicitly requested repeat of a single terminal sample, `node packages/core/test/fixtures/release-cli.mjs claude /tmp/claude-release.json stdio --execute` or the equivalent with `codex` uses the existing login, synthetic MCP fixture and bounded settings. The evaluator requires exactly one of `--plan` or `--execute`; missing/unknown modes reject before launching a client. Do not run inference commands as offline tests. The original curated records remain the authority for the runs above.

After the live route is repaired, `node packages/core/test/fixtures/release-live.mjs /tmp/normattiva-release-live.json` reruns paced canaries and exits nonzero for blocked validation. Vercel credentials must be restored by the user before `vercel build --prod --yes --non-interactive` can inspect actual deployment packaging. Verify the parser worker in the built function; no successful deployed-bundle check is claimed here.

## Superseded historical and attachment checkpoint, earlier 9 October 2026

This subsection preserves the earlier blocked decision exactly as evidence. The later bounded Privacy run and terminal decision above supersede its open-ticket status; they do not erase the retained timeout.

The resumed [independent controls](historical-attachment-controls.md) acquired and retained 28 exact official detail bodies for DPR 151/2011: articles 2–13 plus Allegato I/II for both 2014-01-01 and 2026-10-07. Article 1 remains independently controlled by the dated rendered occurrence. Production replay reaches all 15 occurrences in source order within the 16-attempt composed-call ceiling, completes both annexes, stays below the 128 KiB response and 256 MiB process limits, and preserves the original/current-as-historical rejection controls. Historical/current peak RSS is 199,128/200,580 KiB. No table spans are inferred from the one-row/one-cell ASCII annex representations.

The same bounded run attempted the fresh Privacy boundary exactly once. The 18 September 2018 request failed with `UND_ERR_CONNECT_TIMEOUT` after 10,542.64 ms before status/body; no retry was made and the stop-on-first-failure rule left 19 September unsent. The older processed checkpoint still demonstrates the substantive boundary but is not relabelled as the missing fresh raw pair. Both independent review axes report no actionable findings, and the integrated suite passes 137/137. Local branch commit `3f3bf86` is integrated on `main` as `cf29a13`; neither commit was pushed. Ticket #31 and its dependent release ticket #22 therefore remain open, with #22 unclaimed. No paid inference, publication or deployment occurred.

## User-run publication and deployed verification

The candidate is ready for this handoff, but the commands below change remote state and are intentionally left to the user. Preserve the migration key before deployment. The [migration guide](../migration.md) documents removed calls, literal references and trust setup.

First build and deploy an immutable **preview**, never production, from the reviewed commit:

```bash
git show --stat HEAD
cd packages/stdio-server
npm pack --dry-run
cd ../..
vercel deploy
```

Ensure the Vercel preview environment has the preserved `NORMATTIVA_REFERENCE_KEY`; do not generate a different key for the preview. Against that immutable preview deployment, verify version 0.2.0, the six expected tools/four resources/two prompts, one discovery-to-read literal continuation, a typed invalid-cursor error, and Request abort without a blocked healthy follow-up. Repeat only the small paced official workflow; do not rerun full historical acquisition. Record the preview URL and immutable commit. A preview failure stops the release without exposing the breaking interface on the production endpoint.

After those deployed checks pass:

```bash
git push origin main
git tag -a v0.2.0 -m "v0.2.0 coordinated interface migration"
git push origin v0.2.0
cd packages/stdio-server
npm publish --access public
cd ../..
vercel promote <verified-preview-url>
```

Confirm before `git push` whether repository automation would independently deploy production; disable the duplicate path or use that immutable preview instead. The tag, npm package and promoted preview must all name the same reviewed commit/version. Immediately verify npm and hosted initialization both report 0.2.0 and repeat the small production workflow. On a post-promotion failure, retain the trace and roll back/withdraw explicitly; do not call the release production-accepted. This session did not execute any remote-state command.

## Review

Two independent reviewers inspected the staged stage-5 changes against completed stage 4 (`5be40d2`). Both confirmed the corrections without additional inference/live traffic.

### Standards

The continuation-reference correction was independently reviewed against `b4f98fc`, including final retained evidence and bilingual documentation. No remaining documented-standard violation or actionable smell; hashes, guidance measurements and cumulative ledger reconcile.

The live-source correction was independently reviewed against `5e0dd85`. No documented-standard breach or material new smell finding. Review confirmed external fixture seams, bilingual documentation, acquisition-only cookies, bounded parsing and evidence limitations.

No documented-standard breaches. Two harness findings were corrected: the Civil Code canary now requires a useful snapshot-bound index entry before recording success; terminal cursor checking now tracks both cursor locations and associates issued references with their continuation tool. No remaining material finding.

The restored OpenRouter continuation was independently reviewed against local checkpoint `19bc790`. No remaining material standards or evidence-integrity finding: frozen hashes, receipt/reservation totals, every-call review coverage and credential exclusions reconcile. All nine staged files belong to this evaluation continuation; unrelated changes were excluded.

### Spec

The continuation-reference correction has no remaining material Spec finding. Review confirms the failed 22/24 precursor is preserved, the measured 4/4 rerun satisfies the bounded failing-sample remedy requirement, and final coordinated acceptance remains open. Lost-control and earlier-terminal-schema limitations are explicit. Neither review made inference or official-source calls.

The live-source correction review found that authenticated issuance fields could override an explicit conflicting editorial subtitle. A captured public MCP negative reproduced `found` for subtitle `(999G9999)`; the verifier now rejects conflicting observed editorial-code forms while retaining missing-code discovery proof. The reviewer verified missing/matching/conflicting code cases after correction. No remaining material spec finding; full release acceptance stays open.

Two findings were corrected: the Civil canary could have falsely passed an unresolved response, and the Privacy probe's label overstated historical evidence. The latter is now explicitly a dated-route availability check; independent historical controls remain an open gate. No remaining material false-pass claim. The incomplete gates in the table are retained rather than reported as successful acceptance.

The OpenRouter continuation review checked all 157 final rows and the retained 16 serial rows against the manual record. No remaining material spec finding. It confirmed the failed/incomplete gate status, unsupported completion statement, scorer exception, family/provider coverage and single-turn limitations; correction/rerun or explicit acceptance revision remains required. Neither reviewer made paid inference or live-source calls.

## Complete-request discovery correction, 6 October 2026

[Scoped remedy and reproduction](discovery-request-remedy.md) records the production bare-year facet regression, default field/tool guidance, both-transport public controls, and every generated call in the 104-output precursor and 32-output correction. The latter passes without lost request constraints or invented reading references; the precursor and original failures remain retained. Appropriate inverted-range clarification is separately classified, with a durable scorer regression against silent repair. The latest ledger for further inference is `release-discovery-results.json.gz`, including all prior attempts. This completes the scoped discovery prerequisite; full latest-schema client/model, cold/historical/attachment performance, deployed transport and package gates remain required before publication.

## Model/native-guidance checkpoint, 7 October 2026

[Model guidance remedy](model-guidance-remedy.md) retains every corrective and failed precursor, the explicit exact-model support exclusion, final native/prototype measurements and newest cumulative ledger. The 7 October review clearance did not establish model or release acceptance: the Qwen semantic failure remained preserved and DeepSeek was then incomplete after repeated provider 429s.

## Complete DeepSeek checkpoint, 9 October 2026

The unchanged 1,536-token full plan is preserved as a pre-dispatch cap rejection. A test-driven evaluator seam permits only a 1,520–1,536 completion ceiling; 1,520 keeps all 39 cases and both repetitions within the cumulative $1 bound, while any length finish still fails. The paced DeepInfra run completes 78/78 with zero provider errors and zero truncations. It nevertheless fails the mandatory exact-reference gate: both `index_interrupted` outputs make the same lowercase-to-uppercase change at character 156 of the 502-character issued cursor. Every generated call is replayed through fresh MCP and both changed cursors return `invalid_cursor`. The inspected prose contains no explicit false-absence or unsupported-completion conclusion, but includes speculative corpus/HTTP recovery claims, and one no-candidates repetition ends in another search rather than a final answer. The ticket remains open; finite provider success is not a guarantee and no retry, push, publication or deployment occurred.

A follow-up model-facing safeguard labels every cursor a case-sensitive opaque value, forbids retyping, normalization, repair, decoding or case changes, and gives the same exact-copy cue in an interrupted-index result. Native and prototype measurements remain inside the accepted schema/result budgets. One bounded two-repetition DeepSeek correction was then run against only the failed case, with the same pinned provider, serial pacing and completion ceiling. Both outputs again altered the cursor and fresh MCP rejected both as `invalid_cursor`; no retry followed. The correction adds $0.000786391200 of receipts, bringing the cumulative accounted upper bound to $0.675808674678 and returned receipts to $0.343832361080. The safeguard is retained, but it does not satisfy the gate and the ticket stays open.

With explicit scope approval, new reading/discovery cursors use authenticated lowercase-only `n3_`/`d2_` formats while the decoder continues to consume `n1_`/`n2_`/`d1_`. The final 128/128 suite preserves exact continuation, trust, operation, version, decoded-size and 256 MiB memory gates. Native guidance is 6.48% with a 60-token maximum; prototype encodings are 6.68%/7.02% with a 56-token maximum. Exactly one further bounded DeepSeek correction used the retained failed case, two repetitions, pinned DeepInfra FP8, serial 15-second pacing and the 1,520-token ceiling. Both calls copy the issued 602-character cursor exactly and both fresh-MCP replays succeed. The run adds $0.000961548000 of receipts for cumulative $0.676770222678 accounted / $0.344793909080 returned. This finite pass clears the remaining model/native-guidance prerequisite but is not a guarantee or final release acceptance.
