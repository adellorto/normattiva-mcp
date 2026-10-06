# Continuation-reference remedy

This records the work for [Remedy observed model continuation-reference failures](https://github.com/adellorto/normattiva-mcp/issues/24), following local `b4f98fc`. It is a model-facing optimization with unchanged trust and source verification requirements. Final coordinated release acceptance remains a separate gate.

## Diagnosis and scope

The [original classified calls](release-continuation-original-failures.json) distinguish altered references, conflicting arguments, wrong continuation tools and invented missing cursors. Terra and Qwen shortened the 1,695-character article cursor; DeepSeek shortened the 547-character pending-index cursor. These were copying failures: rejecting the altered values was correct connector behavior. Extra targets/dates and sending an index cursor to `continue_acts` were separate model errors.

The old article cursor embedded another signed, base64-encoded locator containing the same publication, snapshot, source and representation binding. The outer cursor repeated that binding and authenticated the nested token again. Removing this duplication and compressing the authenticated payload lowers copying and serialization costs without discarding information. The same failure occurred through a terminal client and through the OpenRouter function-tool adapter, so it was not specific to the terminal path.

Guidance now names the correct continuation tool and explicitly excludes original targets/dates, including initial-only annotations on the input fields. Discovery guidance in both tools and the continuation input field asks for an actual returned cursor when it is missing, without making a new tool call. Whole-act guidance follows already requested full reading without asking again. Situational result explanations replace existing explanations; they do not add initialization instructions or an opt-in prompt dependency.

The interrupted exploratory comparison observed literal compact copies followed by Qwen's conflicting arguments, and a subsequent whole-act permission question. Those observations motivated the separate guidance changes. Its temporary raw outputs were lost on interruption, so they are **not retained acceptance evidence or proof of causal attribution**. The original witnesses, mechanical size comparison and retained corrective samples establish the narrower conclusion. They cannot quantify each change's independent causal contribution or guarantee arbitrary model behavior.

## Reference contract

Current code issues `n2_` reading references and continues to accept `n1_`. The wire version is explicit. `n2_` contains raw-DEFLATE JSON plus a SHA-256 HMAC, using the existing configured signing key. Authentication precedes inflation, whose output is limited to 16 KiB. A cursor embeds the target's fields under its shared snapshot binding instead of nesting another encoded token. The codec restores the existing internal reference contract, keeping the change local to reference representation.

Publication and independent discovery identity, concrete date, exact official source, representation digest, operation, article/attachment selection and within-content position remain bound. Key changes, alterations, unsupported versions, wrong operations and invalid sources reject explicitly. Existing legal-content, note/table and changed-source checks still apply after decoding. There is no cursor database, universal secret, relaxed validation, implicit restart or extra upstream request for guidance.

Older code rejects `n2_`; upgrade both transfer endpoints. Compatible npm and HTTP installations also need the same preserved trust configuration. See the [migration guide](../migration.md).

## Measurements and regressions

[Size measurements](release-continuation-size-measurements.json) compare identical current synthetic MCP outputs and signed identity, changing reading-reference encoding only. Article continuation shrinks **2,057 → 765 characters**, pending index **669 → 501**, and whole-act reading **661 → 495**. Full article MCP serialization, including both copies, shrinks **8,430 → 4,986 bytes**. All recorded payloads fit the 128 KiB ceiling; these are sample lengths, not universal cursor limits. The existing byte-bound and Unicode/table pagination regressions remain in the full suite.

[Guidance measurements](release-continuation-guidance-measurements.json), using tiktoken 0.14.0 and both prototype encodings, record **4.27–4.45%** schema guidance overhead and **at most 60 explanatory tokens across both MCP representations**. Total schemas are 16,489/15,888 tokens; full references and metadata count in complete payload measurements. Native Qwen/DeepSeek tokenizer counts are not established by these prototype encodings.

New shared-module regressions retain frozen-date exact text across fresh readers, resume saved `n1_` article/index/whole-act references, and reject altered/unsupported/untrusted references, a signed inflation bomb, invalid sources, operation mismatch and conflicting dates before acquisition. The initial size regression failed at 1,695 characters before implementation. The complete deterministic suite passes **105/105**; provider-budget regressions additionally pass after the evaluator connection correction.

[Paired warm direct-read measurements](release-continuation-direct-overhead.json) retain 30 alternating batches of equal truthful work against stage 2 `3f75ff5`: 1,601 reads per revision, 3,202 requests, full MCP serialization. Median overhead is **+3.28%**, within +10%. Two loaded revisions make this a latency comparison, not a single-runtime memory gate. Cold/historical acceptance remains with the final release ticket.

[Isolated package checks](release-continuation-package.json) pass real-tarball contracts, preserved-key restart, configured npm/fresh-production-HTTP transfer and different-trust rejection. This is synthetic upstream and local production handler evidence, not deployed Vercel verification.

## Model validation and spending

The [retained terminal sample](release-continuation-client.json) requests `gpt-5.6-terra`, low effort, through Codex CLI 0.160.1 and the built production stdio server. Its continuation is literal and completes the exact fixture article. Its final answer states that article 999's upstream HTTP 404 does not establish absence. The event stream records the requested backend, not an independently attested resolved model ID. Reported usage is 127,299 input tokens (107,776 cached), 1,283 output tokens and 195 reasoning output tokens, using the existing subscription without a demonstrated separate API charge.

Codex 0.160.1 reads an open piped stdin even with a positional prompt; the evaluator now closes it. The read-only sandbox could not initialize its local app-server client, so the authorized sample ran outside that filesystem sandbox. Startup failures produced no useful MCP work. The earlier interrupted subscription attempt has unavailable output/usage and is not treated as acceptance evidence or free usage.

The retained [24-call precursor](release-continuation-argument-attempt.json.gz) uses six continuation scenarios, Qwen3 14B and DeepSeek v4.1 Flash, twice each. It is **failed: 22/24 pass**, with Qwen supplying the original act/date alongside a literal interrupted-index cursor in both repetitions. All twenty returned references are literal; all four missing-cursor controls ask for the returned cursor without a tool call. Initial-only target/date annotations and cursor-only guidance were then added to the reading input fields. The [four-call interrupted-index correction](release-continuation-results.json.gz) against the [latest schema](release-continuation-input.json) passes **4/4**: literal references, correct tool and cursor-only arguments, accepted by fresh production MCP instances with frozen dates. These are bounded corrective samples, not a passing full latest-schema or coordinated release matrix. Temperature zero, maximum 1,536 output tokens and the 120-second overall request deadline remain in force.

The offline [precursor review](release-continuation-argument-review.json) and [corrective review](release-continuation-review.json) check every generated call literally and execute compatible calls through fresh production MCP with synthetic sources, checking both representations, byte bounds and frozen dates. Input/schema hashes must match. Manual inspection of every caller-visible response finds no false absence or completion claim: missing-cursor responses ask for the actual cursor, while the final four responses contain only tool calls. The terminal answer correctly separates its unresolved 404 from proof of absence. OpenRouter samples generate one next action and do not consume the resumed MCP result for another model turn; they are not complete autonomous traversals. The terminal sample predates the final discovery/reading-field annotations. Final coordinated client/model acceptance remains open.

Spending is cumulative. The [interruption ledger](release-continuation-interrupted-ledger.json.gz) carries all four lost plans' **$0.251677363512** reservations in addition to the prior **$0.0566696372** upper bound: **$0.308347000712**, even for calls that might never have dispatched. The retained [connection-failure attempt](release-continuation-network-attempt.json.gz), [serial attempt](release-continuation-serial-attempt.json.gz), [first guidance attempt](release-continuation-guidance-attempt.json.gz) and [missing-cursor failure](release-continuation-missing-cursor-attempt.json.gz) carry every further receipt and unknown-cost reservation. The guidance runs completed all twenty referenced continuation calls but failed the missing-cursor controls: exhausted output budgets or an invented placeholder. The stronger shared input/tool guidance then passed a [four-call focused correction](release-continuation-missing-cursor-correction.json.gz), with no tool calls and requests for the actual returned cursor; the next full precursor run still exposes the separately recorded conflicting-argument failure described above. No failed call is counted as free. The [final report](release-continuation-results.json.gz), including all prior ledgers, is the next session's spending authority: **$0.387203023418 accounted upper bound**, including **$0.10055338982 completion receipts**. Use the upper bound, not receipts alone. The existing **$1** software cap and user's **€10** total ceiling remain in force; prior Claude list-price usage was $0.0711992.

The evaluator's default 250 ms connection-family attempts produced approximately 650 ms `ETIMEDOUT` failures before any model output. It now permits 2,000 ms per address, within the unchanged overall request deadline. A separate retained 120-second provider timeout is not a model acceptance result. Production Normattiva deadlines and retry policy are unchanged.

## Reproduction

After a build, run offline checks and generate current inputs:

```bash
pnpm test
node packages/core/test/fixtures/release-model-input.mjs > /tmp/continuation-input.json
node packages/core/test/fixtures/release-reference-control.mjs /tmp/continuation-input.json > /tmp/continuation-legacy.json
.venv/bin/python packages/core/test/fixtures/guidance-tokens.py /tmp/continuation-input.json /path/to/tiktoken
node packages/core/test/fixtures/release-package.mjs
```

The reference-control runner changes only reading references and their text representation. It does not alter discovery references, source proof or schema guidance, and it does not run inference.

For an explicitly authorized inference rerun, decompress the latest retained OpenRouter report to a prior-report file, select the six recorded cases via `OPENROUTER_CASES`, and pass `--prior-report` to `release-openrouter.mjs`. Keep results/checkpoints in the repository so interruption cannot discard the ledger. A plan-only run checks the current catalog, provider ceilings and whole-plan reservation before dispatch. Never reset the ledger to repeat a sample.

Decompress `release-continuation-results.json.gz`, then run `release-continuation-review.mjs INPUT RESULTS CLIENT` offline for every-call MCP validation. The failed precursor's matching input is `release-continuation-argument-input.json.gz`; the earlier failed guidance inputs are retained separately.

## Standards

Independent review against `b4f98fc`: no documented-standard violations or actionable baseline smells. Shared registration remains in core; bilingual tool tables reflect the final guidance; migration documentation explains `n2_` issuance and `n1_` compatibility. Evidence preserves the failed 22/24 precursor, limits the passing correction to 4/4 and leaves coordinated acceptance open. Final hashes, guidance and spending figures agree with the artifacts.

## Spec

Independent review against `b4f98fc`: no remaining material findings. Configured trust, source/date/representation/position binding, restart portability and explicit rejection remain intact. Retained evidence separates the failure classes; both conflicting-argument failures receive a measured correction and passing bounded rerun. Guidance/byte limits and portability checks cover the changes. Documentation preserves lost-control and single-next-action limits without a full-release or unsupported causal claim. Neither reviewer made paid inference or live-source calls.

Standards: 0 findings; Spec: 0 findings. No remaining issue on either axis.
