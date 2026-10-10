# HTTP cancellation remedy, 7 October 2026

This implements [Restore cancellation through the default HTTP transport](https://github.com/adellorto/normattiva-mcp/issues/26), a prerequisite of [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22). It corrected the local default handler. The later [Vercel client-disconnect investigation](vercel-client-disconnect-research.md) found and validated the missing hosted opt-in; the original local evidence below remains unchanged.

## Reproduction and cause

`node packages/core/test/fixtures/release-transport-limits.mjs http cancellation` failed against the preceding checkpoint: the caller rejected, but the stalled upstream recorded only `started`; a healthy authenticated article read timed out waiting for the lane. The corresponding [6 October traces](release-final-transports.json) remain unchanged. A second public HTTP regression, using an incoming `Request.signal` without a cancellation notification, also failed before the correction (`HTTP Request abort must reach upstream`). Both use synthetic upstream stalls and an act locator issued by real default discovery registration; they do not infer cancellation from a rejected client promise or weaken publication proof.

Installed `mcp-handler` 1.1.0 reconstructed the request without its signal, and created a separate SDK server for each POST. The first drops request-lifecycle aborts; the second prevents a later protocol notification from reaching the original SDK request controller. The shared core already propagates SDK cancellation to active/queued upstream work and releases its FIFO lane.

## Implementation and observable contract

The HTTP wrapper now uses the installed MCP SDK's Web Standard Streamable HTTP transport directly, with one server per POST and JSON responses. Both wrappers use `createServer` in core to construct and register tools, resources and prompts against one SDK instance. This also fixes the duplicate nominal SDK types encountered by Vercel's preserved-symlink tracing. The [initial Vercel log](release-http-cancellation-vercel-precursor.txt) is retained: it printed TS2345 diagnostics while still reporting overall build success; that success alone was insufficient evidence.

HTTP initialization issues a cryptographically random, authenticated `h1_` namespace in `Mcp-Session-Id`. Its HMAC uses the preserved reference key with a separate domain string. Subsequent POSTs validate it without a session database; only active request callbacks are retained, indexed by namespace and typed JSON-RPC id. A valid cancellation closes that request's SDK server, which aborts its request handlers and therefore the shared core call. The original HTTP call ends with no JSON-RPC response (HTTP 202 with empty body); the notification also returns 202. An incoming `Request.signal` abort follows the same cleanup path, including when aborted before dispatch.

Cleanup removes the callback and request listener and closes the server on completion, cancellation, or transport validation failure. Duplicate active ids within one namespace return 409 without overwriting the original call. String and numeric ids remain distinct. Unknown/completed ids and malformed or unscoped cancellation notifications cannot affect another request; an invalid authenticated namespace returns 404 without upstream traffic. Initialization is never registered as cancellable. HTTP batches are rejected before dispatch so closing a single POST cannot cancel unrelated requests grouped into that POST. GET and DELETE remain unsupported (405), OPTIONS retains permissive CORS, and successful responses remain ordinary MCP JSON with the same structured results and tool schemas.

No attempt, source, snapshot, output, or reference validation budget was raised. The process-wide lane, 50-second shared deadline, 20-second attempt limit and two/sixteen attempt allowances remain in the existing core. No legal or traversal contract changes are made.

## Stateless and deployment limits

The namespace identifies cancellation traffic; it is not an authentication system, cursor, snapshot or persisted SDK session. Calls without it continue to work but cannot be cancelled by a later unscoped notification. A namespace survives process replacement with the preserved signing key; changing the key requires fresh HTTP initialization, alongside the already documented consequences for legal references. GET offers no resumable SSE stream, DELETE does not revoke namespaces, and no idle SDK servers are kept alive.

In-flight callbacks belong to one process. A valid notification delivered to another instance is acknowledged but cannot reach the original work. The public regression explicitly demonstrates this using distinct handler module state, and then cancels on the originating handler. Multi-instance deployment needs routing affinity or shared cancellation delivery; neither is implemented or claimed for separate protocol notifications. Vercel's downstream-disconnect path is different: `supportsCancellation` delivers the lifecycle abort to the function handling that same HTTP request.

An incoming request signal is a host-delivered invocation lifecycle abort and is honored for resource cleanup. It does not establish that a user intentionally cancelled an MCP operation. Vercel delivers downstream disconnects through this signal only when the matching Node function opts in with `supportsCancellation: true`; the configuration now does so. This lifecycle event is still distinct from an explicit MCP cancellation notification. These distinctions follow the [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) and [cancellation requirements](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation).

## Validation

Nine public HTTP regressions cover SDK client notification cancellation with a healthy follow-up, active Request abort, queued notification cancellation, queued Request abort, client/id isolation and cleanup, rejection of batches, separate-instance limitations, pre-dispatch abort, and rejection of request-shaped cancellation. They exercise the real production handler and mock only the external official source; source identity and full observable MCP outcomes remain checked.

The last negative control failed on the first correction: the SDK's notification payload schema also parses a JSON-RPC request with an id, stripping that id. Treating that parse alone as a notification cancelled the original operation and left the new request without its own reply. The wrapper now verifies the JSON-RPC message kind before routing a cancellation. The request receives the SDK's method-not-found response and cannot cancel another call; the new public regression then passes.

Production timeout probes retain two actual 20-second stalled attempts and typed `upstream_timeout` results through both stdio and HTTP. The synthetic source honors upstream aborts; these runs demonstrate propagation to the fetch signal and lane release, not control over an arbitrary upstream implementation that ignores abort. The Vercel function probe tests its traced worker/default contracts and separately observes upstream cancellation plus a healthy follow-up from an isolated output copy.

Reproduction:

```bash
pnpm test
pnpm --filter @normattiva/http-server exec tsc --noEmit --preserveSymlinks true
node packages/core/test/fixtures/release-transport-limits.mjs http cancellation
node packages/core/test/fixtures/release-transport-limits.mjs stdio cancellation
node packages/core/test/fixtures/release-transport-limits.mjs http timeout
node packages/core/test/fixtures/release-transport-limits.mjs stdio timeout
vercel build --prod --yes --non-interactive
node packages/core/test/fixtures/release-vercel-package.mjs
```

The [final evidence](release-http-cancellation.json) retains the prior failed HTTP trace, corrected default-transport traces, timeout results, installed npm check, isolated Vercel output, source hashes and limitations. The [full regression log](release-http-cancellation-regressions.txt) records **119/119 passing tests**, including all nine new public HTTP controls; normal and preserved-symlink typechecks pass. Final source-handler cancellation reaches upstream in **11 ms** over HTTP and **5 ms** over stdio, with healthy follow-ups returning found. The unchanged-policy timeout probes return typed errors after **40,764 ms / 41,132 ms**, with exactly two starts and two aborts each. These timeout probes preceded the server-assembly move; the underlying execution policy/module remained unchanged, and the final suite verifies both wrappers after that move.

The latest [Vercel build log](release-http-cancellation-vercel-build.txt) has no TypeScript diagnostics. Its isolated `nodejs24.x`/60-second function restores 18 declared filesystem mappings, executes the parser worker/default contracts and observes same-instance cancellation in **8 ms**, followed by a healthy read. The real npm tarball passes outside the workspace, including preserved-key restart, configured npm/HTTP legal-reference transfer and rejection with different trust. It was checked after the server-assembly move and before the final HTTP message-kind guard; that guard changes neither the npm wrapper nor legal-reference portability. No live official-source canaries or paid model requests were required by this scoped transport correction.

## Standards review

The independent [review record](release-http-cancellation-review.json) reports **0 hard violations and 1 optional Duplicated Code finding**: the source-handler and isolated Vercel fixtures repeat abort-aware upstream/polling setup. Their local setup is retained so each driver stays explicit, with separate observable assertions and handler loading. The reviewer considers this a reasonable tradeoff and finds no new material issue after the message-kind correction. Shared registration, bilingual documentation and public testing seams follow the repository requirements.

## Spec review

The other independent review reports **0 remaining findings**, including its follow-up on request-shaped cancellation. Prompt active/queued cancellation and lane release, unchanged deadline/attempt budgets, public failing/passing controls, isolation and cleanup, and explicit stateless/deployment limits meet this ticket's scope. Neither read-only review made network, inference or deployment calls. Review totals: Standards 0 hard / 1 optional; Spec 0 remaining.

The earlier failed traces and the Vercel precursor remain retained. On 10 October, the unconfigured immutable Preview reproduced a normally completed HTTP 200 after client abort. The corrected Preview with `supportsCancellation: true` instead produced two correlated cancelled invocations (runtime status `0`) while authenticated persistent clients received `AbortError`; each healthy ping and literal continuation completed afterward. [Research and guarantee boundary](vercel-client-disconnect-research.md) and [redacted Preview evidence](release-vercel-cancellation-preview.json) supersede only the open deployed-disconnect gate, not the other retained release evidence or the separate cross-instance notification limitation.
