# Candidate 0.2.0 release acceptance — incomplete

Recorded on 5 October 2026, Node 24.15.0/Linux, against local stages 1–4 through `5be40d2` and the stage-5 working tree. [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22) remains open. The [accepted delivery specification](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865) still governs acceptance. No push, tag, npm publication or deployment was performed.

New prerequisites on the implementation map are [Restore verified live reading against current official sources](https://github.com/adellorto/normattiva-mcp/issues/23) and [Remedy the observed Terra literal-cursor failure](https://github.com/adellorto/normattiva-mcp/issues/24). They block final acceptance through native tracker dependencies.

## Gate status

| Gate | Result and limit of the evidence |
| --- | --- |
| Deterministic regressions, build and public contracts | 92/92 tests pass, including production stdio/HTTP registration and migration smoke with synthetic sources. A captured live-detail negative control was added. |
| Installed npm consumer | Passed after fixing an omitted parser-worker bundle. Real tarball installed outside the workspace, with runtime dependencies only. |
| Restart and configured npm/HTTP reference transfer | Passed for article, index, whole-act and discovery continuations, including HTTP-to-npm article continuation and different-key rejection. HTTP tests execute fresh processes of the actual handler; this is not deployed Vercel verification. |
| Runtime memory and serialization | Recorded representative saved/synthetic workloads meet the 256 MiB memory target. Full MCP bytes include both copies. This is sample evidence, not universal capacity or complete historical/attachment benchmarking. |
| Direct-read processing overhead | Two paired warm samples remain below +10%; cold comparative distributions remain outstanding. Healthy synthetic direct reads use one upstream request. |
| Schema/result guidance | Both prototype tokenizers pass: 2.00–2.08% schema overhead and at most 58 explanatory tokens counting both MCP copies. Client-native tokenization of individual results remains outstanding. |
| Terminal clients | Sonnet: one passing sample. Terra: fails the literal-cursor gate, despite correct final text and absence explanation. |
| Representative OpenRouter matrix | Prepared, not run: restored environment lacks the key. 234 planned calls, three families, two repetitions, $1 maximum and $0.893 conservative reservation at captured prices. |
| Official-source live canaries | Blocked: five discovery checks pass; direct reading lacks independently verified editorial identity and three dated website requests return HTTP 409. |
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

## Live-source blockers

[Paced live trace](release-live-canaries.json): nine MCP calls, twelve upstream attempts, at least one second between request starts. Exact TUEL/Civil/Privacy discovery, CAD alias verification and official relevance search pass. There was no full crawl or load test.

The ordinary TUEL article-13 detail returned HTTP 200 but its actual `sottoTitolo` omits editorial code `000G0304`. The current verifier requires that code and withholds the result as `unresolved / source_identity_conflict`; Gazette and issuance fields alone did not satisfy its selected identity proof. This reveals an incompatibility between the synthetic controls and the live response, not a legal absence. The preserved [captured detail](../../packages/core/test/fixtures/acts/tuel-direct-2026-10-05.json.gz) is replayed through the public MCP seam to retain withholding as a negative control. A remedy must establish independent identity without treating echoed request coordinates as evidence.

Dated TUEL, Civil Code and 2017 Privacy website routes returned HTTP 409. The historical/attachment readings and continuations could not be validated. The original trace names the Privacy probe an independent historical control, but date/label assertions only test dated-route availability; the runner now names that scope correctly. Independent historical legal-content/change-boundary controls remain required. Unclassified failures did not authorize retries or weaker source validation. Restore/verify the supported official route, then rerun the paced canaries; do not treat saved fixtures as a substitute for this gate.

## Model/client evidence and spending

[Curated terminal results](release-client-results.json) preserve exact arguments, returned text, token usage and cursor checks while excluding account/session initialization metadata. Both clients used synthetic controls with the actual built stdio server, without opt-in research prompts or initialization instructions. The prompt requests article 13 in a four-character first page, then a 100-character continuation, and an unresolved article 999 without indexing.

- Claude Code 2.1.289, `sonnet` resolving to `claude-sonnet-5-5`, low effort: literal continuation passes; joined text is `Art. 13. Fixture text 13.`; HTTP 404 is explicitly not proof of absence. Reported list-price cost $0.0711992 with a $0.50 execution cap.
- Codex CLI 0.160.0, requested `gpt-5.6-terra`, low effort: a 1,695-character cursor was altered to 1,667 characters and rejected as `invalid_cursor`. The model reread the ordinary article directly and gave correct final text and absence reporting. This recovery **does not erase** the failed release gate. The requested backend name is recorded; the event stream does not independently attest a resolved model ID.

One earlier Codex model turn was blocked by MCP approval configuration; it is excluded from acceptance but its token usage is retained. For the final run, built-in apps were disabled and only this synthetic server was preapproved. Two earlier startup attempts produced no useful MCP work. An exploratory `gpt-4.1-mini` API request returned HTTP 429 and produced no completion; it is excluded too.

The CLI runs used existing subscription logins. Separate API charges were not demonstrated, and Codex reported tokens rather than a monetary cost. This does not mean the sessions consumed no quota. No OpenRouter inference was run. The user's total ceiling is €10; future OpenRouter work is deliberately capped at $1, with a key spending limit as a second guard. No additional CLI runs were used to hide the Terra failure.

[OpenRouter plan](release-model-plan.json) and [frozen production MCP inputs](release-model-input.json.gz) cover the 28 accepted routing cases plus empty search, unresolved targets, pending/more/interrupted, literal cursor, changed-content rejection, unread attachment coverage and unknown currentness: Qwen3 14B, DeepSeek v4.1 Flash and Llama3.1 8B, two repetitions each, 1,536 maximum output tokens, temperature zero. The plan checks live model availability and prices before dispatch. It caps provider prices, reserves conservatively before each request, retains reservations for unknown billed failures and stops on an API failure. [OpenRouter documents price ceilings in USD per million tokens](https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/provider-selection.mdx).

Automatic checks cover routing, factual constraints and literal cursors. Every output still needs semantic review for false absence, fabricated references and false completion. A zero-error finite sample cannot guarantee arbitrary model behavior; any observed failure needs a measured correction and rerun, or an explicit acceptance revision.

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
# Paid sample, only after reviewing the plan and restoring the key:
node --env-file=.env.openrouter.local packages/core/test/fixtures/release-openrouter.mjs /tmp/normattiva-release-model-input.json /tmp/normattiva-release-model-results.json
```

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

No documented-standard breaches. Two harness findings were corrected: the Civil Code canary now requires a useful snapshot-bound index entry before recording success; terminal cursor checking now tracks both cursor locations and associates issued references with their continuation tool. No remaining material finding.

### Spec

Two findings were corrected: the Civil canary could have falsely passed an unresolved response, and the Privacy probe's label overstated historical evidence. The latter is now explicitly a dated-route availability check; independent historical controls remain an open gate. No remaining material false-pass claim. The incomplete gates in the table are retained rather than reported as successful acceptance.
