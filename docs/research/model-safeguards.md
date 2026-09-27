# Low-overhead model-facing safeguards: evidence and option space

Research for [Audit low-overhead model-facing safeguards](https://github.com/adellorto/normattiva-mcp/issues/13), against repository revision `90af05371bafdbb72ae870255e1ee2f9788b27cc` and the hosted endpoint on 2026-09-27.

## Question

Which model failures in the September 2026 report are plausibly enabled by this MCP's interface, and which remain behavior of the external Open WebUI/Qwen prompt/model stack? What safeguard families could reduce those failures without materially increasing general latency, payload size, or model-token use?

This note establishes evidence and options. It deliberately does **not** choose or implement a remedy; that is the job of [Choose low-overhead model-facing safeguards](https://github.com/adellorto/normattiva-mcp/issues/15).

## Bottom line

The behavioral failures are mixed, but the final false statements and article shortening are not server-output failures:

- The MCP **does permit** the two invalid arguments seen in the report. `search_acts.denominazione` is an unconstrained string even though valid values come from a 30-entry official catalog, and `numero` is described only as “Number of the provvedimento.” An invalid common name plus an article number therefore validates, reaches Normattiva, and returns an ordinary empty search page. The response does not distinguish “this query matched nothing” from evidence that an act or article does not exist.
- The MCP **does encourage an unnecessarily expensive call order**. `read_article` says to prefer `search_acts → list_articles → read_article`, even for a user-supplied article number. On the live D.Lgs. 36/2023 case, the middle step made 30 upstream probes and returned a 7,158-byte compact data object before the one requested article was read. The handlers keep no cross-tool state, so listing is not a technical prerequisite after exact act resolution.
- The MCP **already signals list incompleteness** with `truncated: true` and `probed_up_to: 30`. Calling the 30 returned entries the act's total is an inference made after ignoring those fields. The missing continuation mechanism makes that inference easier to mishandle, but it does not make the returned count complete.
- The MCP returned article 119 with all numbered paragraphs 1–20: 17,111 article-text characters in a 17,663-byte compact `CallToolResult`. The model's answer stopped after paragraph 2. The report's prompt-only retest then produced all 20 paragraphs with the MCP unchanged. That strongly locates this symptom downstream of retrieval, although it is only a single-session A/B observation.
- The supplied MCP prompts and resources cannot be assumed to govern arbitrary chats. MCP defines prompts as user-controlled and resources as application-driven; tools are the model-controlled primitive. The report says Open WebUI attached the five functions, not that it invoked this server's prompts or injected its resources. Therefore changing `ricerca-articolo` or the denominations resource alone would not reliably change those chats. [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools), [prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts), and [resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) define those control boundaries.

The appropriate project boundary is therefore the one requested by the user: treat model behavior as an optimization target, not as a guarantee the MCP owns. Server-side validation, explicit epistemic status, less costly workflow guidance, and concise cross-tool instructions can make misuse less likely. They cannot guarantee that an external model will not ignore a result or invent a final-answer claim.

## Evidence and method

Evidence was kept in three tiers:

1. **Observed:** a deterministic in-memory MCP audit of the checked-out server, two successful live API runs of the report cases, and a normalized parity check against `https://normattiva-mcp.adellorto.com/api/mcp`.
2. **Primary source:** this repository's code, the official Normattiva endpoint, and the MCP 2025-06-18 specification.
3. **Reported, not independently replayed:** Open WebUI/Qwen final answers and their prompt-only retests in `docs/Normattiva MCP – Report di test e proposte di miglioramento.docx` in the main worktree. No Open WebUI instance, model weights, exact client version, or trace export is present in the repository, so those final-answer behaviors were not independently reproduced.

The deterministic feedback loop asserted the exact relevant surface twice with identical output:

```text
$ node tests/audit-model-surface-offline.mjs
{
  "tools_list_bytes": 10809,
  "tool_count": 5,
  "descriptions_chars": 3366,
  "has_any_output_schema": false,
  "has_server_instructions": false,
  "denominazione_has_enum": false,
  "numero_description": "Number of the provvedimento.",
  "list_default": 30,
  "list_maximum": 200,
  "resources_list_bytes": 1157,
  "prompts_list_bytes": 778,
  "ricerca_articolo_rendered_bytes": 555
}
```

The throwaway audit scripts were deleted after capturing the results. The checked-in source remains the reproducible basis: tool definitions and outputs are in [`tools.ts`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts), prompts in [`prompts.ts`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/prompts.ts), and resources in [`resources.ts`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/resources.ts).

One initial live run failed because the sandbox blocked outbound access; it is not evidence for the report's transient-Normattiva claim. The same harness succeeded outside that sandbox twice. Live results were stable across the two successful runs.

## Current model-facing surface

Sizes below are exact compact UTF-8 serializations of the named protocol result or data object. A client may rename tools, omit fields, add wrappers, or serialize them differently before placing them in model context. Token counts are consequently tokenizer- and client-specific; `10,797 / 4 ≈ 2,700` is only a rough character heuristic, not a measured Qwen token count.

| Surface | Measured size | Material facts |
| --- | ---: | --- |
| `tools/list` | 10,809 bytes; 10,797 characters | 5 tools; 3,366 description characters; no `outputSchema`; no annotations |
| `resources/list` | 1,157 bytes | 4 resources |
| Denominations resource content | 2,165 text characters | 30 current values from the official endpoint |
| `prompts/list` | 778 bytes | 2 prompts |
| Rendered `ricerca-articolo` | 555 bytes | Included only if the client/user gets this prompt |
| Rendered `monitoraggio-modifiche` | 464 bytes | Included only if the client/user gets this prompt |
| Initialization instructions | 0 | Neither transport configures the optional `instructions` field |

The hosted endpoint's normalized wire JSON for tool, resource, and prompt lists was identical to the audited local registrations. Their SHA-256 hashes were respectively `0947e6480244eb27bd0809866dfad4a41fef790bd384b3fb18a094eb76cda43a`, `7604b4cb4cd8c3f988d4eaa28d48d3b68ad68d7953b567fb55a9921d934f6768`, and `ce173bf11f7cee0a01671dc067f0ef4c7443c72ffadec04e5af601b815e57198`. The hosted handler identifies itself as version `0.1.0`; that is the HTTP package version, while the exposed registrations matched this revision.

### Tools and result shapes

All five tools return one `TextContent` block containing pretty-printed JSON. They do not return `structuredContent`, and they publish no output schema; this follows directly from the shared `jsonContent` helper. The MCP specification permits text results, but says output schemas can guide clients and models in parsing and that structured output should also be serialized to text for backward compatibility. Full structured output may therefore duplicate payload unless the client deliberately forwards only one representation. [MCP structured content and output schemas](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#structured-content).

Relevant schema and semantic facts:

- `search_acts.denominazione` is `string`, with examples and a pointer to the resource but no `enum` or runtime pre-validation. `numero` is also `string`; its short description does not explicitly contrast the act number with an article number. [Current search schema](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L28-L73).
- A zero-match search returns only `totale_atti`, pagination fields, and an empty `atti` array. It does not echo the interpreted filters or qualify what can be inferred from zero results. [Current search response](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L98-L115).
- `list_articles` declares itself a best-effort sequential probe and explicitly returns `truncated`, `probed_up_to`, and `stopped_early`. It does not currently return a continuation field. [Current list description and schema](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L197-L220), [current response](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L403-L414).
- A successful `read_article` returns `found: true` and the article text, but no explicit retrieval-completeness flag or character/paragraph count. [Current read response](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L180-L193).

### Prompts, resources, and cross-tool ordering

The denominations resource correctly says its values are valid act-type labels. Its full content is useful reference data but costs 2,165 characters when fetched, and MCP leaves attachment to the application. A tool description that merely points at the URI cannot establish that a model has read it.

The server prompt `ricerca-articolo` is not involved unless explicitly invoked. It also contains an independent design problem: it asks the model to search for acts and then call `read_article` on up to ten articles “chosen based on titles/descriptions,” but `search_acts` returns act-level titles/descriptions, not article numbers. It neither calls `list_articles` nor uses `read_act`. This can encourage article guessing when the prompt is used. [Current prompt](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/prompts.ts#L5-L33).

Conversely, the `read_article` tool description recommends `search_acts → list_articles → read_article` broadly. Listing is useful when the caller needs a range or does not know the article, but it is costly and unreliable as a mandatory existence gate for a specific requested article. The live D.Lgs. 36/2023 control quantified the cost:

| Call | Observed result |
| --- | --- |
| Invalid `denominazione="CODICE CIVILE", numero="2043"` | Ordinary zero page: `totale_atti: 0`, no warning |
| Exact D.Lgs. 36/2023 search | One correct act: `23G00044`, G.U. `2023-03-31` |
| Default `list_articles` | `probed_up_to: 30`, 30 found, `truncated: true`, no continuation; compact parsed object 7,158 bytes |
| `read_article` for article 119 | `found: true`; paragraphs 1 through 20 present; 17,111 text characters; compact call result 17,663 bytes |

The correct exact search and read do not depend on list output in code or protocol state. Rewording the workflow could therefore reduce both API traffic and model context rather than adding overhead.

## Ranked causal hypotheses and results

### 1. Weak input semantics plus an unqualified empty result enable the false-negative path

**Prediction:** the reported `CODICE CIVILE` / `2043` arguments validate and return an ordinary empty page, while exact act coordinates succeed.

**Result:** confirmed live twice. This is an MCP affordance issue. The subsequent claims that article 2043 does not exist and that the Civil Code has five books are external model claims absent from all tool outputs. The MCP permitted the bad query and supplied too little epistemic guidance; it did not supply those false facts.

### 2. Mandatory list-before-read guidance adds cost and creates a misleading count

**Prediction:** default listing stops at 30 with explicit truncation, adds substantial calls/context, and is not required for a known article after exact act resolution.

**Result:** confirmed. The output contains `truncated: true`; the model's “30 articles” conclusion ignored it. The lack of continuation is a real structural issue owned by [Choose the article-discovery and continuation interface](https://github.com/adellorto/normattiva-mcp/issues/9), but using that list as a mandatory gate is a separate model-facing workflow problem.

### 3. Long-article shortening occurs after successful retrieval

**Prediction:** article 119 arrives complete at the MCP boundary even though the final answer is shortened.

**Result:** confirmed at the MCP boundary: all 20 paragraph labels were present. The report's unchanged-MCP, prompt-only retest produced all 20 in the answer. This is primarily external model/prompt response behavior. A small completion signal could reinforce the evidence, but the server cannot force verbatim final-answer generation.

### 4. Server prompts/resources did not automatically protect the reported chat

**Prediction:** only the five tool definitions are reliably model-discoverable; using a server prompt or denominations resource requires client/user action.

**Result:** confirmed by the protocol control model. The report further says the Open WebUI custom model attached five functions. It does not report selecting the MCP prompt or attaching resource content. Improvements to those primitives can help their explicit users but are not general safeguards.

### 5. Missing output schemas are not the direct cause of the reported failures

**Prediction:** the failures will be semantic misuse or ignored status, not inability to parse JSON.

**Result:** consistent with every trace. The model successfully formed calls, read fields, and cited tool errors; it chose wrong inputs or unsupported conclusions. Output schemas remain a valid integration option, but no reported trace demonstrates a parsing failure they would cure.

## Classification of reported model behaviors

| Reported behavior | MCP contribution | External contribution | Classification |
| --- | --- | --- | --- |
| Used `CODICE CIVILE` as `denominazione` and article 2043 as act `numero` | Schema accepts both; resource is not automatically included; field descriptions are not explicit enough to reject the confusion | Model selected wrong values | Mixed; deterministically preventable or reducible server-side |
| Concluded article 2043 does not exist and invented “five books” | Empty result has no epistemic qualifier | Model converted a failed query into certainty and invented a fact despite its prompt | Primarily external final-answer behavior |
| Called 30 listed articles the act's total | Field name `articoli_trovati` can be read as a total and there is no continuation | Model ignored `truncated: true` and `probed_up_to: 30` | Mixed; structural continuation ticket is relevant |
| Returned only paragraphs 1–2 of article 119 | No explicit `complete`/`char_count`; payload is long | MCP returned paragraphs 1–20; prompt-only retest fixed final output | Primarily external |
| Could not resolve CAD, then invented “legge 765/2003” | No common-name resolver; chronological search and closed act-type filter are awkward; resource is opt-in | Invented citation absent from results | Mixed; discovery belongs with [Choose how callers find acts from common names and topics](https://github.com/adellorto/normattiva-mcp/issues/3) |
| Treated D.Lgs. 50/2016 as the current contracts code | No current common-name/alias resolution | Model used stale memory and asserted a failed search parameter as fact | Mixed; do not solve by blindly embedding a static municipality table |

The same connector succeeding under Claude does not isolate “the model” from “the client” because the model, client, and system prompt all differ. It does establish that the MCP alone is not a sufficient cause. The prompt-only retests within Open WebUI/Qwen are stronger evidence for prompt influence, but they are single retests rather than a repeated controlled evaluation.

## Safeguard option families

These are alternatives and composable families, not a recommendation.

| Option family | Mechanism | Default overhead | Evidence, limitation, or dependency |
| --- | --- | --- | --- |
| Tighten existing parameter descriptions | Say `denominazione` is a closed act-type label, never a common name/citation; say `numero` is the act number, never the requested article | Roughly 100–200 extra always-visible characters for representative wording, under 2% of current `tools/list`; a wording replacement can be smaller | Directly addresses two observed wrong arguments, but remains a probabilistic hint |
| Deterministically validate `denominazione` | Validate against the 30 official values and return an actionable invalid-filter result | No normal-result token cost; possible first-call lookup/cache latency; static enum adds persistent schema bytes and update responsibility | Prevents the exact invalid value rather than asking the model not to use it; dynamic vs cached/static ownership must be decided |
| Qualify negative search evidence | Echo interpreted filters and add a compact status such as “zero matches for this query; not proof that the act/article does not exist” | Only on search results, especially empty ones; tens to low hundreds of characters | Directly addresses false certainty without a general prompt; avoid verbose prose on every successful page |
| Make retrieval scope/completeness machine-visible | Add small discriminants (`complete`, `scope`, `next_*`, counts with unambiguous names) | Tens of characters per relevant result | `list_articles` continuation and truthful completion semantics depend on [Choose the article-discovery and continuation interface](https://github.com/adellorto/normattiva-mcp/issues/9); `read_article` can separately identify complete upstream retrieval |
| Correct tool-order guidance | For a known article: exact act resolution, then direct `read_article`; use `list_articles` only for discovery/range work | Can be token-neutral and saves 30 probes plus at least 7 KB in the measured default case | Depends on reliable missing-article semantics from [Choose the missing-content and upstream-error contract](https://github.com/adellorto/normattiva-mcp/issues/14) |
| Correct the opt-in MCP prompt | Give `ricerca-articolo` a realizable workflow rather than asking it to guess article numbers from act metadata | No arbitrary-chat token cost; only explicit prompt invocation changes | MCP prompts are user-controlled, so this cannot protect ordinary Open WebUI tool chats by itself |
| Concise server `instructions` | Put two to four cross-tool rules in the optional initialization instructions: field meanings, zero-result uncertainty, truncation semantics, and error handling | A few hundred characters when a client chooses to inject them; no API round trip | The protocol allows optional initialize instructions, but client use varies. It must be integration-tested in Open WebUI. [Lifecycle initialize result](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle#initialization). Official MCP maintainer guidance also warns that instructions are hints, not guarantees, and should not compensate for poor tool design. [MCP server-instructions guidance](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/) |
| Publish output schemas and structured content | Add discriminated result schemas; return matching `structuredContent` plus compatible text | Permanent schema growth in `tools/list`; potentially near-duplicate result payload on the wire | The spec says schemas help clients/LLMs parse results, but the report shows semantic misuse rather than parse failure. Prototype and measure concrete schemas before calling this “low overhead” |
| Keep aliases/reference data as a resource | Offer curated common-name mappings without putting them into every tool schema | No model-context cost unless the app attaches/reads it | Cannot protect autonomous model calls in clients that do not expose resources; static “current law” aliases can go stale |
| Add a common-reference resolver tool | Resolve CAD/TUEL/common names to verified act coordinates before search/read | Adds another always-visible tool descriptor and usually a call, but may replace several failed searches | Belongs with [Choose how callers find acts from common names and topics](https://github.com/adellorto/normattiva-mcp/issues/3) and official/peer-surface research; do not assume a static table is optimal |

### Options that should not be mistaken for general safeguards

- Copying the municipality's long production system prompt into every tool description would substantially increase an already 10.8 KB tool surface, duplicate rules, and still be non-binding.
- Making “always reproduce the entire article verbatim” a global MCP rule would conflict with users asking for summaries. The server should state retrieval completeness; the client/model owns presentation unless a dedicated verbatim mode is deliberately designed.
- Adding the five currently popular acts as permanent “current” facts can become stale and addresses only one organization's vocabulary. If aliases are adopted, they need provenance, currency semantics, and a maintenance owner.
- Tool annotations describe operational properties such as read-only/idempotent behavior. They do not encode the epistemic distinctions implicated by this report.

## Evaluation needed before choosing

The decision ticket should compare concrete variants with the same recorded prompts and tool traces, not rely on description quality by inspection.

1. Run a fresh-chat matrix in the actual supported clients, at minimum the reported Open WebUI/Qwen configuration and one other client/model, with the exact five behavioral prompts.
2. For each variant record invalid calls, upstream call count, `tools/list` bytes, result bytes, final-answer unsupported claims, use of truncation/continuation, and whether requested article text is complete.
3. Separate deterministic guards from probabilistic hints. A schema/runtime rejection can be unit-tested; description and instructions changes require repeated model trials because one success is not a rate.
4. Confirm how each client treats initialization instructions, resources, prompts, `structuredContent`, text fallback, and output schemas before budgeting tokens. The MCP specification intentionally leaves interaction patterns to implementations.
5. Coordinate outcomes with [Choose how callers find acts from common names and topics](https://github.com/adellorto/normattiva-mcp/issues/3), [Choose the article-discovery and continuation interface](https://github.com/adellorto/normattiva-mcp/issues/9), and [Choose the missing-content and upstream-error contract](https://github.com/adellorto/normattiva-mcp/issues/14) so model guidance describes the eventual deterministic behavior rather than papering over it.

No regression test or implementation was added because this research ticket is constrained to causal evidence and option families.
