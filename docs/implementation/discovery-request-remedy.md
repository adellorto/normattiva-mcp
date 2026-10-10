# Complete discovery requests and returned read references

Scoped implementation for [Preserve complete requests and verified references in model-facing discovery](https://github.com/adellorto/normattiva-mcp/issues/25), measured on 6 October 2026 against local `4b1bf80`. The [accepted delivery specification](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865) remains authoritative. Final coordinated release acceptance is separate; no push, publication or deployment was performed.

## Diagnosis and correction

The original [model review](release-model-review.json) and [OpenRouter trace](release-openrouter-results.json.gz) show shortened discovery requests losing article/paragraph clauses, currentness, contradictions and issuance intent. DeepSeek also generated parallel speculative searches and human citations in `act_locator` before a discovery result existed. These are model-facing optimization findings; the connector still rejects invented locators rather than accepting remembered coordinates.

Default `find_acts` guidance now requests one complete verbatim handoff and a wait for its result. The `request` field itself requires the entire original message, including reading instructions and article/comma clauses after a colon, without repair, translation or inserted citations. Locator-field guidance requires a tool-returned opaque reference, and `read_article` describes the discovery prerequisite. Both READMEs carry the same workflow. Reading semantics, reference authentication, source verification and the one-request healthy direct path are unchanged. No opt-in prompt or initialization/system instruction was added.

One independent verified connector finding was reproduced through `ActDiscovery.findActs`: the observed plural research wording `decreti legislativi 2023 contratti pubblici` retained the type but lost the year facet. The regression failed with `annoProvvedimento: undefined`; the planner now recognizes a year immediately after a supported plural act type. It does not infer missing issuance/vigenza intent, convert an issuance window to publication, or treat an incomplete singular citation as research. Those require a faithful complete request or clarification. Spec review additionally reproduced first-year selection from `2023–2024` and `2023 e 2024`; a failing shared-module regression showed unexpected upstream traffic. Year ranges/lists now require local clarification with zero requests, including explicit `del 2023 al 2024` wording.

The earlier DeepSeek repetition asking the user to clarify an inverted date range is appropriate behavior. Its historical automatic wrong-route flag remains in the evidence, with a manual reclassification in [the original review](release-model-review.json). The evaluation runner now treats no-call invalid-input clarification separately, leaving prose acceptance to manual review; silent range repair still fails. Deterministic external-provider controls cover both outcomes.

## Measured model iterations

Both runs use Qwen `qwen/qwen3-14b` and DeepSeek `deepseek/deepseek-v4.1-flash`, two repetitions, temperature 0, 1,536 maximum completion tokens, four concurrent requests, actual default MCP descriptions/input schemas, and no system/initialization/opt-in instructions. Exact provider/model IDs, usage, input/schema hashes and every output are retained in the ledgers. The adapter records a first model output; it does not execute a complete legal research conversation or establish deployed/client acceptance.

| Run | Evidence and result |
| --- | --- |
| Initial correction, 26 routing cases × two models × two repetitions | [Input](release-discovery-input.json.gz), [plan](release-discovery-plan.json.gz), [trace](release-discovery-attempt.json.gz), [every-call review](release-discovery-attempt-review.json). **93/104 pass**, with all 52 DeepSeek outputs passing. Eleven Qwen outputs still shorten or alter the request; two omit article 2043 after the colon. Some other deviations drop request wording or punctuation without losing the legal facts, but remain failed complete-handoff checks. Failures are retained. |
| Stronger input-field correction, eight affected cases × two models × two repetitions | [Input](release-discovery-correction-input.json.gz), [plan](release-discovery-correction-plan.json.gz), [cumulative trace](release-discovery-results.json.gz), [every-call review](release-discovery-correction-review.json). **32/32 pass** literal complete-request, public-contract and manual semantic checks. Every generated discovery call was replayed through production MCP with empty external-source controls; contradictory requests fail locally. No invented reference, false legal absence or unsupported completion claim was observed in these outputs. |

The stronger field instruction is a second measured remedy, not a relabelling of the failed precursor. Final latest-schema full routing/risk, native tokenizer and named client acceptance remain on [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22). Passing finite samples does not guarantee arbitrary model behavior.

The newest cumulative OpenRouter ledger is [release-discovery-results.json.gz](release-discovery-results.json.gz): **$0.421192806878 accounted upper bound**, **$0.134543173280 receipts**, retaining every earlier reservation and failed attempt, within the unchanged **$1 cap** and the user's €10 total ceiling. This ticket adds $0.033989783460 of receipted inference. Plan-only catalog checks reserved $0.390657621432 and $0.120708808960 before their respective dispatches, each including prior spending. No uncertain-cost reservation was reset.

## Contracts and bounds

**109/109 deterministic tests pass**, including build/typechecking. Tests remain at the accepted shared-module and default stdio/HTTP MCP seams with external upstream controls. They verify literal request/interpretation agreement, separated article/comma intent, unknown current force, local contradiction/range rejection, rejection of human citations in each reading tool's locator field, and appropriate clarification versus silent repair. Earlier authenticated-reference/source negative controls remain intact.

[Final guidance measurements](release-discovery-guidance-measurements.json), tiktoken 0.14.0 `o200k_base`/`cl100k_base`, record **5.32–5.54%** schema overhead against the same schemas without descriptions and at most **60 explanatory tokens counting both MCP copies**. Full schema totals are recorded; locator/metadata costs count in full payload measurements. These prototype encodings do not establish native Qwen/DeepSeek token counts.

[Paired truthful warm direct-read measurements](release-discovery-direct-overhead.json) compare stage 2 `3f75ff5` with the current reader, alternating 30 batches of 50 after warm-up, 1,601 reads per revision and full MCP serialization: **+0.36% median**, below +10%, exactly **3,202 upstream attempts** for 3,202 reads. Cold and real-network distributions remain part of final acceptance.

[Request/result bounds](release-discovery-bounds.json) replay the 26 routing cases plus three size controls through default MCP using empty external-source responses. A 4,096-character ASCII request and a 2,048-character Unicode request survive intact; a 4,096-character Unicode request cannot fit the signed discovery reference and fails explicitly as `request_reference_limit` before traffic. A 4,097-character request is rejected before traffic. Largest complete response is **8,752 UTF-8 bytes**, counting both copies; process peak RSS is **99,060 KiB**. These are bounded handoff controls, not full-act memory or legal-source performance evidence.

Reproduction after `pnpm build`:

```bash
pnpm test
node packages/core/test/fixtures/release-discovery-bounds.mjs
node packages/core/test/fixtures/release-model-input.mjs > /tmp/discovery-input.json
.venv/bin/python packages/core/test/fixtures/guidance-tokens.py /tmp/discovery-input.json /path/to/tiktoken
node packages/core/test/fixtures/release-discovery-review.mjs /tmp/discovery-input.json /tmp/discovery-results.json
```

For a future authorized inference run, decompress `release-discovery-results.json.gz` for `--prior-report`, keep a durable checkpoint, select a bounded case list with `OPENROUTER_CASES`, and run `release-openrouter.mjs --plan` before dispatch. Do not reset the ledger. Reviewing an earlier run requires its retained input, whose hash must match the trace.

## Standards

Parallel review against local `4b1bf80`: no documented-standard violations. Registration remains in `core`; both READMEs reflect the guidance changes; domain terminology and retained failure evidence remain consistent. One optional possible Duplicated Code smell identifies the plural-only type spellings repeated alongside the general type patterns. This small grammar remains explicit to distinguish plural year research from incomplete singular citations; consolidating those definitions is a future maintenance option, not a correctness blocker.

## Spec

Parallel review initially reproduced silent first-year selection from year ranges/lists. The subsequent red/green shared-module correction rejects those inputs before traffic. Re-review reports no remaining Spec findings; scoped evidence, spending and outstanding final-release gates are accurate.

Review totals: Standards **0 hard violations, 1 optional maintenance smell**; Spec **0 remaining findings** after resolving the temporal-intent defect.
