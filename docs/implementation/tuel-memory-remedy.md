# Full TUEL memory remedy, 7 October 2026

[Bring full TUEL reading within the accepted memory target](https://github.com/adellorto/normattiva-mcp/issues/27) addresses the candidate-only 256 MiB process-memory gate in the [accepted delivery specification](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865). The measured scope includes full reading, cached first pages and continuation after eviction. Final coordinated acceptance remains on [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22).

## Diagnosis and selected change

`node packages/core/test/fixtures/release-runtime.mjs tuel-reading` reproduces the failure before edits: **332,480 KiB** peak RSS. A profiled repeat reaches **342,940 KiB**. Initial cold parsing stays below 159,000 KiB; repeated reading reaches 300,944 KiB and reacquisition after eviction establishes the final peak. Host heap and external buffers grow during reading. An isolated checkout of pre-remedy `d811e68`, compiled with the same installed TypeScript/dependencies, reproduces **333,376 KiB** using the final measurement harness.

Repeated page-size probes create and compress the same cursor and serialize the same content repeatedly. Cursor reuse alone lowers the peak to **266,160 KiB**, still failing. Incremental segment-size accounting reaches **263,668 KiB**, also failing. Adding smaller compressor output buffers then passes. The selected implementation discards incremental accounting and retains ordinary full serialization, with three small allocation reductions:

- Reuse only the last authenticated cursor position within one `readAct` call. A changed index, segment or offset produces a new cursor; nothing persists across calls.
- Reuse the result of an unchanged size probe while shrinking a candidate text chunk.
- Allocate deflate output in **1 KiB chunks**, instead of the default 16 KiB. Larger references can still span chunks; decoded/encoded limits, HMAC validation and compressed wire bytes remain unchanged.

All source validation, parser/source/cache limits, attempt budgets, exact character positions and the final full MCP response-size assertion remain intact. No forced garbage collection, process heap flags, worker-limit increase or reduced memory target is used. The [raw measurement artifact](tuel-memory-measurements.json.gz) retains failed distributions and the discarded experiment alongside corrective samples. The [red regression output](tuel-memory-red.txt.gz) preserves the failing shared-module test before the fix.

## Corrective evidence

Measurements use Node **24.15.0 / Linux** and isolated production TypeScript runtimes. TUEL XML/portal are captured official sources; per-occurrence detail envelopes are synthetic independently rendered controls. They measure allocation, traversal and source-agreement behavior; they are not full live or historical legal correctness evidence.

| Selected workload | Peak RSS | Result |
| --- | --- | --- |
| Full reading, profile enabled | 232,048 KiB (226.6 MiB) | Pass |
| Full reading, repeat 1 | 226,544 KiB (221.2 MiB) | Pass |
| Full reading, repeat 2 | 227,632 KiB (222.3 MiB) | Pass |
| Index, cached page and evicted continuation | 218,420 KiB (213.3 MiB) | Pass |
| 2,000 ordinary direct reads | 244,052 KiB (238.3 MiB) | Pass, exactly one attempt per read |

The three selected full-reading runs each complete **295 distinct occurrences** in **38 initial pages** plus cached/evicted probes: **40 measured pages**, **300 total attempts**, largest complete MCP response **83,908 bytes**, below 128 KiB. All 40 page fingerprints match pre-remedy `d811e68` exactly across text/table segments, locators, hierarchy, continuation positions, coverage, progress, item counts and bytes, after replacing only `checked_at` timestamps. Timing fields are separate from the fingerprints. This verifies unchanged wire payloads, including compressed references, for the captured workload.

In repeat 1 the first useful cold page takes **1,374.5 ms**, the cached first page **94.5 ms / zero attempts**, and evicted continuation **1,020.5 ms / three attempts**. Total traversal plus probes takes **5,615.2 ms**. Profile-enabled total is **6,598.7 ms**; repeat 2 total is **6,567.0 ms**. Per-call queue/upstream/attempt accounting and per-page times remain in the artifact. These are local fixture observations, not upstream-network latency promises.

Ordinary direct processing uses the existing truthful stage-2 `3f75ff5` comparison, equal fixture content and full MCP serialization: **30 alternating warm batches** and **30 alternating fresh-process cold pairs** per reference type. Legacy warm overhead is **+0.83%**; legacy cold is **−1.55%**, within +10%. Authenticated warm overhead is **−8.02%**; authenticated cold is **+3.75%**, also within +10%. The full build and regression suite passes **121/121**, with no skips or cancellations. Combined baseline/current warm comparison RSS is retained as comparison-harness memory and is not a candidate-only memory pass.

The regression seams remain the already accepted `ActTraversal` shared-module interface and observable serialized MCP results with external upstream controls. A new isolated full-TUEL regression drives all 295 occurrences, cached first pages and evicted continuation and fails above 256 MiB. A second control checks escaped multibyte Unicode text, exact offsets, useful progress and the complete 128 KiB MCP bound across eviction. Existing table/span, source-conflict, historical-negative, both-transport, cancellation and parser-memory controls remain required.

## Reproduction and scope

```bash
pnpm test
node packages/core/test/fixtures/release-runtime.mjs tuel-reading
node packages/core/test/fixtures/release-runtime.mjs tuel-reading --profile-memory
node packages/core/test/fixtures/release-runtime.mjs tuel-reading --core=/absolute/baseline/packages/core/dist
```

The optional baseline imports traversal, serialization and upstream runtime from the same compiled revision so request scopes remain coherent. `--profile-memory` samples process RSS, host heap and external allocation by workload phase; maxRSS remains the acceptance gate without profiling. Each page snapshot is hashed separately and only compact hashes/measurements are retained by the fixture.

No official-source calls, paid inference, push, publication or deployment were performed. Previous final-release failures remain in their dated checkpoint and artifacts. This closes only the scoped memory prerequisite; independent complete historical/attachment controls, model/native guidance, deployed transport and the complete named-client matrix remain open. Sample ceilings do not establish universal supported capacity.

## Standards review

Independent review of all nine scoped staged files against CLAUDE.md, CONTEXT.md, domain guidance and the code-review smell baseline found **0 findings**. Cursor reuse remains local to one call; compressor tuning remains in the shared authentication module. No documented-standard breach or material heuristic smell remains.

## Spec review

Independent review found **0 findings** against the memory ticket and accepted delivery gates. The reviewer replayed full TUEL reading, cached pages and evicted continuation at **230,660 KiB** peak RSS, and separately verified all 40 retained baseline page fingerprints against each of the three corrective runs. No missing requirement, scope creep or incorrect implementation was found. Review totals: Standards 0; Spec 0; no outstanding issue within either axis.
