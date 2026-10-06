# Candidate 0.2.0 release acceptance — incomplete

Initial acceptance recorded on 5 October 2026; live-source correction recorded on 6 October 2026, Node 24.15.0/Linux, against local stages 1–4 through `5be40d2` and the stage-5 working tree. [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22) remains open. The [accepted delivery specification](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865) still governs acceptance. No push, tag, npm publication or deployment was performed.

New prerequisites on the implementation map are [Restore verified live reading against current official sources](https://github.com/adellorto/normattiva-mcp/issues/23) and [Remedy observed model continuation-reference failures](https://github.com/adellorto/normattiva-mcp/issues/24). The new [Preserve complete requests and verified references in model-facing discovery](https://github.com/adellorto/normattiva-mcp/issues/25) prerequisite records the measured routing failures. The live-source prerequisite now has a passing scoped corrective run recorded below. The continuation-reference and discovery prerequisites still block final acceptance through native tracker dependencies.

## Gate status

| Gate | Result and limit of the evidence |
| --- | --- |
| Deterministic regressions, build and public contracts | 102/102 tests pass after the live-source correction, including production stdio/HTTP registration with authenticated discovery identity and migration smoke with synthetic sources. Captured identity and preamble negative controls remain intact. |
| Installed npm consumer | Passed after fixing an omitted parser-worker bundle. Real tarball installed outside the workspace, with runtime dependencies only. |
| Restart and configured npm/HTTP reference transfer | Passed for article, index, whole-act and discovery continuations, including HTTP-to-npm article continuation and different-key rejection. HTTP tests execute fresh processes of the actual handler; this is not deployed Vercel verification. |
| Runtime memory and serialization | Recorded representative saved/synthetic workloads meet the 256 MiB memory target. Full MCP bytes include both copies. This is sample evidence, not universal capacity or complete historical/attachment benchmarking. |
| Direct-read processing overhead | Two paired warm samples remain below +10%; cold comparative distributions remain outstanding. Healthy synthetic direct reads use one upstream request. |
| Schema/result guidance | Both prototype tokenizers pass: 2.00–2.08% schema overhead and at most 58 explanatory tokens counting both MCP copies. Client-native tokenization of individual results remains outstanding. |
| Terminal clients | Sonnet: one passing sample. Terra: fails the literal-cursor gate, despite correct final text and absence explanation. |
| Representative OpenRouter matrix | Failed/incomplete: 78 Qwen and 78 DeepSeek outputs reviewed; Llama first-call provider error 502. 81 rows have automated flags; manual review distinguishes scorer limitations. $0.05119 completion receipts; $0.05667 accounted upper bound including prior attempts, under the $1 software cap. |
| Official-source live canaries | Corrective run: 15/15 paced checks pass on 6 October, 18 attempts, including TUEL direct/index continuation, Civil 2043 and a Privacy historical/change-boundary control. This is local default MCP registration, not deployed transport or full-act/historical traversal acceptance. |
| Deployed packaging and transport cancellation/timeouts | Outstanding. Local Vercel build could not retrieve project settings because its saved token is invalid. Core cancellation/timeouts pass, but dedicated checks through both default transports remain required. |
| Final release approval | Blocked. Version alignment and migration preparation do not establish release acceptance. |

## Packaging correction and version preparation

The first isolated npm run reproduced `parse_limit_exceeded` when `list_articles` started its worker. The original esbuild command bundled only the main entry; `new Worker(new URL('./act-parser-worker.js', import.meta.url))` could not find the sibling in the tarball. [bundle.mjs](../../packages/stdio-server/bundle.mjs) now bundles both entries, including the worker's private core dependencies. The same isolated-consumer check then passed.

The [final npm dry run](release-package-dry-run.json) includes `LICENSE`, `README.md`, `dist/index.js`, `dist/index.d.ts`, `dist/act-parser-worker.js` and `package.json`: 126,302 packed bytes, 539,647 unpacked bytes. Package versions, stdio initialization, API User-Agent and bilingual landing-page candidate labels are aligned at **0.2.0**, a coordinated pre-1.0 breaking candidate. Existing public deployments were not modified.

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

The current local-only wizard is `bash .private/setup-openrouter-release.sh`; it reads a key invisibly and writes ignored, mode-600 `.env.openrouter.local`. If that ephemeral wizard is unavailable, recreate that file outside git with `OPENROUTER_API_KEY`, `OPENROUTER_MODELS=qwen/qwen3-14b,deepseek/deepseek-v4.1-flash,meta-llama/llama-3.1-8b-instruct` and `OPENROUTER_MAX_COST_USD=1`. Prefer a dedicated OpenRouter key limited to $1. No key is embedded in these artifacts.

```bash
node packages/core/test/fixtures/release-model-input.mjs > /tmp/normattiva-release-model-input.json
node --env-file=.env.openrouter.local packages/core/test/fixtures/release-openrouter.mjs /tmp/normattiva-release-model-input.json /tmp/normattiva-release-model-plan.json --plan
# Paid corrective sample, after reviewing the plan and retained spending ledger:
node --env-file=.env.openrouter.local packages/core/test/fixtures/release-openrouter.mjs /tmp/normattiva-release-model-input.json /tmp/normattiva-release-model-results.json
```

When continuing a partially billed evaluation, pass `--prior-report /path/to/previous-report.json` to carry its receipts, unknown-cost reservations and outputs into the next plan; do not reset the spending ledger. The key is now restored in the ignored local file.

For an explicitly requested repeat of a single terminal sample, `node packages/core/test/fixtures/release-cli.mjs claude /tmp/claude-release.json` or the equivalent with `codex` uses the existing login, synthetic MCP fixture and bounded settings. Do not run these inference commands as offline tests. The original curated records remain the authority for the runs above.

After the live route is repaired, `node packages/core/test/fixtures/release-live.mjs /tmp/normattiva-release-live.json` reruns paced canaries and exits nonzero for blocked validation. Vercel credentials must be restored by the user before `vercel build --prod --yes --non-interactive` can inspect actual deployment packaging. Verify the parser worker in the built function; no successful deployed-bundle check is claimed here.

## Conditional publication handoff

**Do not publish this candidate while any mandatory gate above remains open.** Preserve the migration key, complete the remaining acceptance matrix and review, and update these statuses and candidate landing-page labels first. The [migration guide](../migration.md) documents removed calls, literal references and trust setup. Once accepted, the user runs publication themselves:

```bash
git show --stat HEAD
git push origin main
git tag -a v0.2.0 -m "v0.2.0 coordinated interface migration"
git push origin v0.2.0
cd packages/stdio-server
npm pack --dry-run
npm publish --access public
# Return to the linked repository root for Vercel, never the HTTP subdirectory.
cd ../..
vercel deploy --prod
```

Verify npm and hosted initialization both report 0.2.0 and repeat the live migration workflow with the preserved key. Check whether a GitHub push already triggered Vercel before a manual deployment. These are conditional user-run commands; this session did not execute them.

## Review

Two independent reviewers inspected the staged stage-5 changes against completed stage 4 (`5be40d2`). Both confirmed the corrections without additional inference/live traffic.

### Standards

The live-source correction was independently reviewed against `5e0dd85`. No documented-standard breach or material new smell finding. Review confirmed external fixture seams, bilingual documentation, acquisition-only cookies, bounded parsing and evidence limitations.

No documented-standard breaches. Two harness findings were corrected: the Civil Code canary now requires a useful snapshot-bound index entry before recording success; terminal cursor checking now tracks both cursor locations and associates issued references with their continuation tool. No remaining material finding.

The restored OpenRouter continuation was independently reviewed against local checkpoint `19bc790`. No remaining material standards or evidence-integrity finding: frozen hashes, receipt/reservation totals, every-call review coverage and credential exclusions reconcile. All nine staged files belong to this evaluation continuation; unrelated changes were excluded.

### Spec

The live-source correction review found that authenticated issuance fields could override an explicit conflicting editorial subtitle. A captured public MCP negative reproduced `found` for subtitle `(999G9999)`; the verifier now rejects conflicting observed editorial-code forms while retaining missing-code discovery proof. The reviewer verified missing/matching/conflicting code cases after correction. No remaining material spec finding; full release acceptance stays open.

Two findings were corrected: the Civil canary could have falsely passed an unresolved response, and the Privacy probe's label overstated historical evidence. The latter is now explicitly a dated-route availability check; independent historical controls remain an open gate. No remaining material false-pass claim. The incomplete gates in the table are retained rather than reported as successful acceptance.

The OpenRouter continuation review checked all 157 final rows and the retained 16 serial rows against the manual record. No remaining material spec finding. It confirmed the failed/incomplete gate status, unsupported completion statement, scorer exception, family/provider coverage and single-turn limitations; correction/rerun or explicit acceptance revision remains required. Neither reviewer made paid inference or live-source calls.
