# normattiva-mcp

**English** · [Italiano](./README.it.md)

[![Listed in italia-mcp-servers](https://img.shields.io/badge/listed%20in-italia--mcp--servers-blue)](https://github.com/bsab/italia-mcp-servers)

A [Model Context Protocol](https://modelcontextprotocol.io) server for official Italian legislation from [Normattiva](https://www.normattiva.it), run by IPZS. Shared discovery, dated article indexing and bounded reading serve both local stdio and Streamable HTTP clients.

## Development status

This source revision implements stages 1–4 of the [accepted remediation](https://github.com/adellorto/normattiva-mcp/issues/6#issuecomment-5992182865). Both default servers now expose the coordinated replacement interface described below. It is **unpublished**: the existing npm package, hosted endpoint and live landing page still reflect the previous release. Examples of the replacement interface apply to a source build now and the coordinated release after publication.

Candidate **0.2.0** is prepared locally; acceptance remains incomplete. Dated live-source canaries and scoped transport/memory remedies pass; the [release acceptance handoff](docs/implementation/release-acceptance.md) records their limits. Current model checks, native guidance and the approved exclusion of **Llama3.1 8B** from validated support are recorded in the [model guidance remedy](docs/implementation/model-guidance-remedy.md). Independent historical/attachment controls and complete named-client/deployed checks remain outstanding. Passing finite offline or model samples does not establish production acceptance or arbitrary model reliability. Implementation records: [validated reading](docs/implementation/validated-reading.md), [act discovery](docs/implementation/act-discovery.md), [public integration](docs/implementation/public-integration.md). See the [breaking migration guide](docs/migration.md) for removed inputs and fields.

## Capabilities

### Tools

| Tool | Purpose |
| --- | --- |
| `find_acts` | First call for an act or article request: copy the entire user message unchanged into `request`, preserving characters, reading instructions and date/status constraints, then wait for the result. Returns `identified`, `candidates`, or `no_candidates`, act locators and separated article intent; never article text. For a next page without a cursor, ask without tools. Empty discovery does not prove absence; use returned official references and never invent sources or URLs. |
| `continue_acts` | Continue discovery with only an actual returned `d1_` cursor, copied literally; placeholders and guesses are invalid. Without one, make no tool call and ask for it in one short sentence. Reading/index cursors belong to their original tool. Search uses a live corpus; completion does not prove exhaustive legal relevance. |
| `list_articles` | Page through verified article occurrences, available headings, hierarchy and attachment references for an `act_locator` at a concrete `snapshot_date`. Continue via `list_articles` with only `cursor` and optionally `page_size`, omitting the original target/date; for an already requested full index, continue without asking again. Inspect coverage separately from progress. |
| `read_article` | Read an already returned exact `article_locator`, or `act_locator` plus `article_reference`, without mandatory indexing. Returns `found`, evidence-backed `absent`, or `unresolved` (existence unknown). Continue via `read_article` with only the literal `cursor` and optionally `max_chars`; for an already requested full article, continue without asking permission. |
| `read_act` | Read bounded text and structured table cells for an `act_locator`, optionally selecting a listed `attachment_ref`. Continue via `read_act` with only `cursor` and optionally `max_chars`, omitting the original target/date; follow cursors without asking again when the whole act was requested. Completion and legal-content coverage are distinct. |
| `recent_updates` | List acts whose **consolidated text was amended** in an inclusive date window of at most twelve months, including act locators. For **new Gazette publications**, use `find_acts` with an explicit publication window. Metadata alone does not explain amendment content. |

### Resources

| URI | Contents |
| --- | --- |
| `normattiva://tipologiche/denominazioni` | Official act-type codes and Italian names; optional reference metadata. |
| `normattiva://tipologiche/classi-provvedimento` | Official version classes: `1` = without amendments, `2` = amended, `3` = repealed; no selected-act currentness evidence. |
| `normattiva://collezioni-predefinite` | Official predefined collections and their counts. |
| `normattiva://ricerche-predefinite` | Official preset searches and upstream filters, for reference rather than direct tool arguments. |

Discovery accepts the user's request directly; reading these catalogs is optional.

### Prompts

| Name | Args | Purpose |
| --- | --- | --- |
| `ricerca-articolo` | `argomento` | Opt-in research: select up to 3 acts using discovery and actual index headings, read up to 10 articles, cite only read content and disclose coverage. Follow further cursors for explicitly exhaustive requests. |
| `monitoraggio-modifiche` | `giorni` (1–365, default `7`) | Group metadata for acts whose consolidated text was amended. Read relevant dated content before describing changes; use `find_acts` for new publications. |

Essential call and interpretation guidance is in tool descriptions/results. No prompt, catalog attachment or initialization instructions are required for ordinary tool use.

## Discovery and reading

Make one discovery call with the complete user request verbatim, including articles/commas, dates, currentness and contradictions. Wait for its result before reading or searching further; do not insert remembered citations, substitute publication for issuance, or silently repair an invalid range. Clarification of an invalid request is also appropriate.

```json
{"name":"find_acts","arguments":{"request":"decreto legislativo 267/2000 articolo 13"}}
```

Select the returned candidate's opaque `act_locator`; never put a human citation or a value constructed from memory in a locator field. Discovery keeps `article_reference` separate. Substitute the actual returned value below:

```json
{"name":"read_article","arguments":{"act_locator":"<returned act_locator>","article_reference":"13","snapshot_date":"2026-10-02"}}
```

For suffixes, structured or repeated occurrences, select an exact `article_locator` from `list_articles`. Never reconstruct internal coordinates or choose a generation from model memory. If discovery remains `candidates`, selection is still required. Alias review/live identity verification does not prove current legal force: candidates currently report `current: "unknown"`.

Discovery pagination uses `continue_acts({cursor})`. Reading/index pagination calls the same tool again with `{cursor}` and an optional new budget. Copy the cursor literally; omit the original target/date. `find_acts` and `continue_acts` take no public page-size argument.

Reading resolves an omitted date to a concrete UTC date on the initial call. Reading references retain that snapshot and acquired representation through restarts and cache eviction. Start a new request to change the date. Search pages remain live and may change membership/order across calls; within-page changes fail explicitly rather than silently shifting position.

## Outcomes, progress and limits

Successful tools expose matching JSON in `structuredContent` and text content. Article `outcome` is independent of execution: `found` has `content.text`; `absent` requires positive evidence and `absence_basis`; `unresolved` cannot establish presence or absence. An ambiguous upstream 404 is unresolved, not absence.

Index, whole-act and discovery progress is in `traversal`; a direct article uses top-level `progress`. `pending` means preparation without useful entries (index/whole-act only), `more` means another bounded page remains, and `complete` ends the observed traversal. `interrupted` preserves the useful prefix with a cursor, `failure.error` and the first unfinished position. A failure before useful progress is `isError: true` with `structuredContent.error`: category, code, safe message and `retryability` (`true`, `false`, or `"unknown"`), plus applicable provider/HTTP/transport/retry timing. Unknown retryability does not authorize automatic retries. Schema-invalid calls may instead receive the MCP SDK's validation error.

| Limit | Default | Maximum |
| --- | --- | --- |
| Discovery candidates per page | 5 | 20 internally configured; public calls use the default |
| Index entries per page | 30 | 50 |
| Reading text characters per page | 16,000 | 64,000 |
| Full serialized response, including both MCP representations | — | 128 KiB UTF-8 |
| Decoded source acquisition | — | 24 MiB |

Text limits count Unicode code points; returned segment offsets address UTF-16 positions. Table IDs, dimensions, cells, spans, headers and offsets survive pagination. Byte limits can reduce a page further; supported content resumes instead of being skipped. Unrepresentable entries and source/parser limits fail explicitly.

All upstream work shares one active attempt per process, a 50-second call deadline, 20-second attempt limit and budgets of two attempts for direct reads or sixteen for composed operations. Retries require replay safety and known transient evidence; continuation gets a fresh allowance. Clients/hosting must allow response overhead beyond the deadline; the HTTP function allows 60 seconds. Cancellation stops queued and active work in stdio and within the same HTTP process.

## Configuration and reference trust

The replacement servers require `NORMATTIVA_REFERENCE_KEY`: exactly 64 hexadecimal characters encoding a cryptographically generated 32-byte key. Generate it **once**, then preserve it in your client environment or deployment secret:

```bash
openssl rand -hex 32
export NORMATTIVA_REFERENCE_KEY='<paste your preserved 64-hex key>'
```

The server reads the process environment; it does not automatically load `.env` files, create a key, or ship a shared secret. Missing/malformed configuration fails explicitly. Compatible processes with the same preserved key can verify signed references across restarts; hosted/npm transfer additionally needs shared trust and compatible versions. Changing or losing the key invalidates signed references and requires new discovery/traversal. Unshared deployments reject references explicitly.

Formats: `a1_` portable, validated publication locators (not existence evidence); `a2_` signed act locators carrying independently returned official discovery identity; `n2_` compact signed exact article/attachment references and reading cursors; `d1_` signed live-discovery cursors. This implementation also reads earlier `n1_` references; older implementations reject `n2_`, so upgrade both ends before transferring new references. Compact cursors share the target's snapshot binding within one authenticated, bounded payload. Signed act identity survives restart and requires shared trust for transfer. Detail responses must independently match that identity and the requested validity interval. Unsupported/tampered/untrusted references fail without silently restarting or redirecting to caller-selected hosts. No cursor database is required.

Upstream destinations are fixed official Normattiva production API/website hosts. The open API requires no authentication. The mTLS PRE environment is excluded.

## Clients and HTTP

After the coordinated release, stdio clients can run `npx normattiva-mcp` with preserved trust. During this unpublished stage use a built source path instead of the published package:

```json
{
  "mcpServers": {
    "normattiva": {
      "command": "node",
      "args": ["/absolute/path/normattiva-mcp/packages/stdio-server/dist/index.js"],
      "env": { "NORMATTIVA_REFERENCE_KEY": "<your preserved 64-hex key>" }
    }
  }
}
```

The existing hosted endpoint is `https://normattiva-mcp.adellorto.com/api/mcp`; it has not received this migration. Remote clients need no signing secret; the operator configures it. Compatible self-hosted copies expose the same six tools over Streamable HTTP, with permissive CORS and no authentication by default.

HTTP initialization returns an opaque `Mcp-Session-Id`; clients must preserve it on subsequent POSTs so cancellation notifications target their own requests. Requests without that header still work, but their notifications cannot cancel an earlier POST. An aborted incoming `Request.signal` also stops its work. A lost connection alone is not an explicit MCP cancellation. The namespace works across restarts with the preserved signing key, while notification routing only reaches active calls on the same process. Multiple instances require affinity or shared cancellation routing before deployed cancellation can be accepted; this has not been verified on the hosted endpoint. Invalid namespaces return HTTP 404 and require fresh initialization. POSTs carry one MCP message; batches are rejected. GET and DELETE return 405; responses use JSON without a resumable SSE stream.

For Vercel self-hosting, configure the preserved key in the deployment environment, build all packages and deploy from the **repository root** where `.vercel/project.json` lives. Use `vercel deploy --prod` only when ready to publish. The user controls push, npm publication and deployment. Existing live landing page/configs: [English](https://normattiva-mcp.adellorto.com/), [Italian](https://normattiva-mcp.adellorto.com/it/).

## Building and checking source

Requires Node.js ≥20 and pnpm. Deterministic tests are currently exercised on Node 24; the actual HTTP-handler test uses Node's TypeScript support.

```bash
pnpm install
pnpm build
# Set the preserved NORMATTIVA_REFERENCE_KEY first.
pnpm start
pnpm test
```

`pnpm test` makes no public API calls. With a configured key, `node tests/smoke.mjs` runs a small live stdio canary: handshake, discovery-to-reading, literal continuation, index/whole-act pages, resources/prompts, updates and typed errors. An upstream outage fails the canary; it never counts as a passing absence check. The canary is not full release acceptance.

## Coverage and limitations

Dated website AKN and supplied navigation addresses are checked against independent detail content. Historical membership is not inferred from navigation, root dates or counts. Substantive source conflicts withhold results; identified explanatory-note differences are disclosed. Article headings are returned when available and validated; no heading is invented from a law title.

Inspect `coverage.article_inventory_complete`, `coverage.legal_content_complete` and unread attachment references even when traversal is `complete`. Unread graphics/PDFs remain visible and linked where the source supplies a link; no automatic scan interpretation or historical-link guarantee is added. Preface, preamble and conclusion reading lacks independent controls and remains disclosed outside supported coverage. Automatic full-history exports and source switching are excluded.

Tables use `read_act`; direct plain-text article reads containing tables return unresolved with that guidance. Legal text retains supported amendment/citation structure. Retrieval cannot guarantee that an external model reproduces every returned word. Upstream constraints and model behavior are distinguished from verified connector findings in the [planning map](https://github.com/adellorto/normattiva-mcp/issues/1).

## License

Source: [MIT](./LICENSE). Legislative content: IPZS [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); downstream use must attribute Normattiva / IPZS. Normattiva is an IPZS trademark; this project is not affiliated with or endorsed by IPZS.
