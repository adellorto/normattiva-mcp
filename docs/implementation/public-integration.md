# Focused public tools and migration

Stage 4 of [the accepted delivery sequence](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865), tracked by [Integrate focused tools and migrate public guidance](https://github.com/adellorto/normattiva-mcp/issues/21). The [model-facing safeguards](https://github.com/adellorto/normattiva-mcp/issues/15#issuecomment-5948234461) and earlier discovery/reading decisions remain the authority.

## Integrated behavior

`registerTools(server, context)` selects `find_acts`, `continue_acts`, `list_articles`, `read_article`, `read_act` and `recent_updates` for both production entrypoints. Discovery and traversal share upstream execution and deployment trust; all legal logic remains in core. Legacy search/coordinate probing code is removed, without compatibility or v2 tools. Strict input schemas reject obsolete reading fields rather than discard a historical date. Well-shaped invalid references, mixed inputs and impossible dates still fail through the typed contracts before upstream work; SDK schema failures retain SDK validation behavior.

Default registration requires `NORMATTIVA_REFERENCE_KEY`, exactly 64 hex characters encoding a cryptographically generated, preserved 32-byte signing key. Explicit `ToolContext.signingKey` injection supports the accepted shared/MCP testing seams. There is no process-random fallback, file store or npm secret. The same preserved environment key is read by both entrypoints; actual packaged cross-deployment transfer remains a stage-5 gate. See [migration](../migration.md) for formats, key preservation and rejected references.

Index entries now include available article headings from the dated AKN, emitted after the existing independent content checks; an index still excludes legal bodies. Ordinary direct reads keep their one-request path. Updates now hand off act locators; missing/inconsistent upstream publication metadata fails as an upstream error rather than a caller-reference or internal error.

Tools state initial input alternatives, dates and literal continuation. Results explain empty discovery, unknown currentness, exact occurrence requirements, page-only contents, pending verification and retained interrupted prefixes. Ordinary successful reads add no general disclaimer or upstream request. Guidance reuses existing explanation/evidence/progress fields. No initialization instructions are added.

The opt-in research prompt uses discovery and real index headings, bounds ordinary selection to three acts and ten articles, cites only read content and discloses coverage. It follows further cursors for explicitly exhaustive requests without promising exhaustive legal relevance. Monitoring distinguishes consolidated amendments from new publication and cannot infer amendment content from metadata. Catalogs remain optional reference resources rather than directions to reconstruct removed search arguments.

Both READMEs and the migration guide describe new calls, outcomes/progress/errors, frozen snapshots versus live search, literal references, deployment trust, limits and unreadable content. They explicitly distinguish these unpublished sources from current npm/hosted/landing-page deployments. Versions are not bumped in this stage. Deployment landing-page updates and publication belong to final release preparation.

## Verification and measurements

Before edits, `pnpm test` rebuilt the three packages and passed all 83 baseline tests on Node 24.15.0 / Linux, including the isolated parser memory gate. New regressions first failed for public tool selection, silently discarded legacy fields, opt-in research, missing situational explanations, missing article headings and misclassified updates metadata. Existing contract tests migrated to the replacement inputs instead of preserving an obsolete test surface.

The integration tests exercise the **built default stdio entrypoint** and the **actual production HTTP handler**, including initialization/version metadata, six tool definitions, resources/prompts, discovery-to-direct-reading, literal article/index continuation, whole-act output and typed invalid references. HTTP uses stateless requests and verifies CORS. Its dependency owns a persistent cleanup timer, so the test isolates the handler in a short-lived child process. The migrated smoke workflow also crosses the built server with synthetic upstream controls; this is not a live canary.

Optional token measurement is reproducible after building:

```bash
node packages/core/test/fixtures/measure-guidance.mjs > /tmp/guidance-input.json
# Install tiktoken only in a throwaway environment; an optional third argument
# supplies its installation directory without changing production dependencies.
python3 packages/core/test/fixtures/guidance-tokens.py /tmp/guidance-input.json
```

The [measurement record](guidance-measurements.json) uses the prototype's tiktoken 0.14.0, `o200k_base` and `cl100k_base`, with real default MCP schemas and synthetic risky-result samples. The conservative schema baseline removes every tool description from the same replacement interface; the difference is about 2%, under 10%. Risky-result explanation/error-message counts include both duplicated MCP representations. The first interrupted-index sample measured 78 explanatory tokens and failed the 60-token gate; repeated progress text was shortened before the final measurement. Full payload counts include locators/metadata and are not characterized as negligible. These sample counts exclude client wrappers and are not representative-model tokenizer or behavioral acceptance.

After integration on 5 October 2026, `pnpm test` rebuilt all three packages and passed **91/91 tests**, with no skipped or cancelled tests, including the isolated 256 MiB parser-memory gate. Independent Standards and Specification reviewers found no remaining issues; the Specification reviewer also replayed the nine public/transport tests. The final two tokenizer measurements used twelve synthetic risky-result samples: descriptions added **2.00–2.08%**, and the largest explanation/error-message sample was **58 tokens** counting both MCP representations. Detailed resolution is recorded on the implementation ticket. No paced live official request, deployed acceptance, model/client run, package publication, push or deployment is performed in stage 4.

## Next gate

[Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22) owns broader result/token coverage, representative supported models/client runs, actual runtime distributions and memory/cache/queue measurements, packaged hosted/npm restart/transfer/rejection, paced official-surface canaries, landing-page guidance, version synchronization, package/release review and concrete publication commands. Its accepted gates must pass or receive an explicit evidence-backed revision before release. This stage does not reopen decisions or resolve that next ticket.
