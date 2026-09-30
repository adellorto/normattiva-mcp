# Issue 18 routing prototype: verdict

Status: **accepted prototype decision; no production implementation**

Test date: **2026-09-30**

Source baseline: `90af05371bafdbb72ae870255e1ee2f9788b27cc`

The user accepted this direction on 2026-09-30. The prototype branch remains the
primary source for the experiment; implementation belongs in subsequent design
and delivery work.

## Verdict

Expose two shallow public calls:

```text
find_acts({ request: string })
continue_acts({ cursor: string })
```

`request` is a compact factual restatement that preserves every act name or
citation, article, date, constraint, intent, and contradiction. The model must
not classify the legal route, resolve aliases, repair conflicts, or construct
Normattiva parameters. `continue_acts` is valid only when the user supplied a
literal opaque cursor.

Put a deterministic, tested planner behind that surface. The planner owns
parsing, alias normalization, validation, exact/discovery/advanced selection,
fallback policy, and Normattiva response validation.

This was the most efficient design for both small and larger models. It reduced
the public OpenRouter tool schema from 2,520 to 1,478 bytes (41.3%), avoided an
extra classification turn, and improved all three tested model families. A
larger model does less redundant endpoint work; a smaller model no longer has
to reproduce Normattiva's search grammar.

## Why not the apparent exact/discovery split?

The intuitive split makes the model decide whether `CAD`, `article 2043 of the
Civil Code`, a publication window, a contradictory citation, and a missing
cursor are exact lookup, discovery, advanced search, or clarification. That is
precisely the unstable part of the task.

Neither a pair of endpoint-shaped tools nor a discriminated one-of schema was
consistently better than the current wide tool. A shallow ingress plus a deep
server module establishes a cleaner seam: the model preserves user facts; code
applies legal and upstream invariants.

## Model evidence

All measurements are first-call tool-routing evaluations with a neutral system
prompt. Tool calls were captured but never executed. Every cell contains three
repetitions per scenario. The retained JSONL traces preserve the emitted tool
name and argument object.

The spend-limited key was configured with a $9 ceiling. The final validation
reported $8.80 remaining, so the complete exploration consumed about $0.20.

### Core suite

Ten representative prompts, 30 calls per model:

| Model | Current wide | Original split | One-of | Final shallow |
| --- | ---: | ---: | ---: | ---: |
| Qwen 3 14B, thinking | 25/30 | 19/30 | 21/30 | **30/30** |
| DeepSeek V4.1 Flash | 13/30 | 21/30 | 19/30 | **27/30** |
| Llama 3.1 8B Instruct | 15/30 | 18/30 | 6/30 | **30/30** |

The final Llama run was pinned to Groq. The final Qwen run used thinking mode
with a 2,048-token output ceiling. DeepSeek used a 192-token ceiling and still
showed some auto-tool variability, so the server must validate that a tool call
exists and that its arguments parse.

### Edge suite

The second round added 18 prompts spanning historical/abbreviated citations,
common names, topics, supported facets, publication versus issuance dates,
in-force and repealed intent, conflicts, reversed ranges, nonexistent exact
acts, literal cursors, and missing cursors. With three repetitions each:

| Model | Citation-first split | Decomposed router | Final shallow |
| --- | ---: | ---: | ---: |
| Qwen 3 14B, thinking | 39/54 | 42/54 | **54/54** |
| DeepSeek V4.1 Flash | 28/54 | 31/54 | **44/54** |
| Llama 3.1 8B Instruct | 31/54 | 33/54 | **54/54** |

### Efficiency of the second optimization

Average input/output tokens per edge call and total cost for each 54-call run:

| Model | Decomposed prompt -> final | Decomposed completion -> final | Decomposed cost -> final |
| --- | ---: | ---: | ---: |
| Qwen | 719 -> **500** | 523 -> **335** | $0.011436 -> **$0.008570** |
| DeepSeek | 875 -> **629** | 166 -> **143** | $0.007179 -> **$0.005867** |
| Llama | 755 -> **696** | 44 -> **35** | $0.002061 -> **$0.001376** |

The optimization did not trade accuracy for token savings: edge accuracy and
all measured efficiency dimensions improved together.

## Server planner contract

1. Preserve facts and contradictions from `request`; do not silently repair
   them.
2. Validate at least one criterion, coherent date ranges, a closed act-type and
   ordering vocabulary, supported facets, and cursor provenance.
3. A complete numbered citation becomes strict advanced lookup by official
   denomination, year, and number. Interpret zero as no exact search match, one
   matching row as identified, and more than one as ambiguous. Never weaken a
   missed exact citation.
4. Resolve a common name, acronym, or name-plus-article through discovery.
   Separate the article reference before resolving the parent act.
5. Route topics to simple relevance discovery. Only documented type/year facets
   are public. Do not combine relevance ordering with advanced-only filters.
6. Route issuance/publication windows, status, and other structured research to
   validated advanced search with chronological ordering.
7. Do not equate provision class 2 ("updated") with generally "currently in
   force". Return multiple code generations or apply a separately documented
   currentness policy.
8. Continue only with a literal opaque cursor. A request for the next page with
   no cursor returns `needs_cursor`.
9. Validate the response envelope and content, not just HTTP status.

The result vocabulary should make the semantic outcome explicit:

```text
identified | candidates | no_candidates | ambiguous | invalid_request |
needs_cursor | upstream_error
```

It should also return the selected route, any separated article reference, the
opaque next cursor, and `degraded`/fallback metadata.

## Fallback boundary

There is one safe automatic fallback in this prototype: if the observational
relevance capability is specifically classified as unavailable, retry discovery
with documented chronological ordering and mark the result `degraded: true`.

Do **not** fall back after:

- an exact miss or empty result;
- contradictory or invalid input;
- a missing cursor;
- rate limiting;
- a generic upstream 5xx; or
- a syntactically successful response with an invalid body.

Those cases must remain visible. Relaxing them can produce plausible but legally
wrong matches.

## Upstream findings that constrain the design

- Normattiva's advanced type/year/number triple identified each exact control;
  an impossible exact act returned a normal empty result.
- Simple relevance ordering ranked clean common names and topics usefully, but
  relevance is not in the documented ordering enum.
- Article-bearing free text was unreliable. Resolve the act and article as
  separate concepts.
- Only type and year are documented search facets. Arbitrary facet forwarding
  can cause generic server errors.
- Pagination is resumable, but the response's page-size echo was unreliable.
- `vigenza` alone did not distinguish current from superseded procurement codes.
- Civil Code article 2043 needs article-tree metadata absent from the current
  tool surface; the routing split alone does not solve article retrieval.

The full requests, observations, and source distinctions are in
[`issue-18-search-primary-evidence.md`](../issue-18-search-primary-evidence.md).

## Limitations and implementation handoff

This prototype tests tool selection and argument preservation, not legal answer
quality. It does not implement the deterministic planner, execute the emitted
calls, or reproduce every host application's full prompt. Provider behavior can
also change. The relevance path remains an observed production capability, not
an official contract.

The next work should specify the planner as a deep module, build it test-first
against this prompt/edge corpus and recorded Normattiva controls, and keep
provider-specific model advice out of the public MCP contract.

## Retained artifacts

- Interactive simulation: [`search-routing-prototype.html`](search-routing-prototype.html)
- Evaluation harness: [`openrouter-routing-eval.mjs`](openrouter-routing-eval.mjs)
- Curated raw and summarized runs: [`runs/`](runs/)
- Primary-source/API evidence: [`issue-18-search-primary-evidence.md`](../issue-18-search-primary-evidence.md)
