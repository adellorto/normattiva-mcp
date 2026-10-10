# Vercel client-disconnect cancellation research, 10 October 2026

This note investigates the platform question raised by [issue #33](https://github.com/adellorto/normattiva-mcp/issues/33): whether the reviewed 0.2.0 candidate can reliably observe a downstream HTTP client disconnect in its Vercel Node Function. It records current first-party documentation, the reviewed repository state and the corrected non-production Preview. Production was not changed.

## Conclusion

Vercel documents a supported mechanism for this exact case. Request cancellation is **opt-in per function path** in the Node.js runtime. A matching `functions` entry in `vercel.json` must set `"supportsCancellation": true`; after that, Vercel says a downstream client disconnect fires the Web `Request.signal` and terminates the function. The live Vercel configuration schema describes the property's default as `false`.

The reviewed commit `db2b7781bac4a6f6268ecd6d703a06019ea05845` uses the Web Handler signature and already listens to `req.signal`, but its matching `packages/http-server/vercel.json` entry contains only `"maxDuration": 60`. It does not opt in to cancellation. The immutable preview's HTTP 200 completion therefore does not disprove Vercel's documented cancellation facility: that deployment did not enable the facility.

The implemented correction adds `"supportsCancellation": true` beside `maxDuration` for the exact `api/mcp.ts` function entry. A new non-production Preview validated the documented path. Changing runtimes, switching to Node request events, enabling streaming, or changing Fluid Compute is not a documented substitute for that opt-in.

## Official Vercel contract

The current [Vercel Functions API reference](https://vercel.com/docs/functions/functions-api-reference#cancel-requests), last updated 11 August 2026, says all of the following:

- Cancellation is available only in the Node.js runtime.
- It is opt-in. A matching function path in `vercel.json` must set `supportsCancellation: true`.
- When enabled, Vercel notifies the function through the standard `AbortSignal` at `request.signal` when the client disconnects.
- Vercel also terminates the function on disconnect, whether or not application code listens to the signal.
- Execution can be reclaimed after cancellation. Work that must complete after the disconnect must be protected with `waitUntil` or Next.js `after`.
- The signal can be passed directly to abort-aware work such as `fetch`, or relayed synchronously through a separate `AbortController`.

This is also announced in Vercel's first-party [per-path request-cancellation changelog](https://vercel.com/changelog/node-js-vercel-functions-now-support-per-path-request-cancellation), which shows the same `functions.api/*.supportsCancellation` configuration and `Request.signal` listener.

Two configuration sources remove ambiguity about the default and path matching:

- The official [static `vercel.json` reference](https://vercel.com/docs/project-configuration/vercel-json#functions) defines function keys as globs over function source paths and lists `supportsCancellation` as a Node-only function option.
- The live [Vercel JSON schema](https://openapi.vercel.sh/vercel.json) defines `supportsCancellation` as a boolean and states that its default is `false`.

Accordingly, a Web `Request` having a `signal` property is not enough. Vercel only documents downstream-disconnect propagation after the matching route opts in.

## Reviewed candidate state

At reviewed commit `db2b7781bac4a6f6268ecd6d703a06019ea05845`, `packages/http-server/api/mcp.ts` exports method-named Web Handlers accepting a standard `Request`. The handler:

- registers an `abort` listener on `req.signal`;
- closes the MCP server when the signal aborts, which starts cancellation of the active/queued upstream work;
- races normal handling against a local cancellation response; and
- removes the listener and active-request registrations in `finally`.

The matching configuration at that same commit is:

```json
"functions": {
  "api/mcp.ts": {
    "maxDuration": 60
  }
}
```

The function glob is already exact, but `supportsCancellation` is absent. Because the documented default is false, the observed immutable Preview was not configured to propagate a downstream disconnect to that existing listener. This is a repository observation and causal inference from Vercel's documented default; the corrected Preview evidence below confirms the supported behavior through Vercel Authentication.

## Status of possible alternatives

### Node request events

Vercel's [Node.js runtime reference](https://vercel.com/docs/functions/runtimes/node-js#cancelled-requests) documents `request.on('error', ...)` with an `aborted` error for the legacy `VercelRequest`/`VercelResponse` callback signature. The same section first says that request cancellation must be enabled per route. Thus this event surface is supported for that handler form, but it does not bypass `supportsCancellation`, and it is not exposed by this project's Web Handler `Request` object.

Node itself documents lower-level disconnect surfaces on `http.IncomingMessage`, but they do not supply an independent Vercel guarantee:

- In the current [Node 24 HTTP reference](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpincomingmessage), `IncomingMessage`'s old `aborted` event and property are deprecated, while its `close` event also occurs when the request completes normally.
- Node 24.16 added [`IncomingMessage.signal`](https://nodejs.org/docs/latest-v24.x/api/http.html#messagesignal), which aborts if a native HTTP message is destroyed or its socket closes prematurely. That is an API on a Node `IncomingMessage`, not on this project's Web `Request`, and Vercel's own route opt-in still governs platform cancellation delivery.

Switching handler signatures merely to use Node events would therefore add surface area without removing the required Vercel configuration.

### Streaming responses

Vercel supports streaming, but the official cancellation example in the Functions API reference still uses `request.signal`. Its streaming cleanup example combines that signal with `waitUntil` and a `TransformStream`; it does not document streaming as a separate disconnect-notification channel. The general [streaming guide](https://vercel.com/docs/functions/streaming-functions) discusses response streaming and duration, not an alternative cancellation contract.

This project currently returns ordinary JSON MCP responses. Converting them to streaming is neither required nor documented as a workaround for downstream cancellation.

### `waitUntil` / `after`

These APIs preserve work that must complete after cancellation; they do not detect cancellation. The Functions API reference warns that, because the function can be reclaimed after the signal fires, post-cancellation work is not guaranteed unless it is placed in `waitUntil` or `after`.

The project's immediate upstream abort is initiated synchronously in its signal listener, which matches Vercel's example. If a diagnostic depends on durable telemetry or asynchronous cleanup after the disconnect, that work must use `waitUntil`/`after` or an independently observable upstream; a bare `console.log` or awaited cleanup after abort is not a documented reliable oracle.

### Fluid Compute

The current [Fluid Compute documentation](https://vercel.com/docs/fluid-compute) describes enabling Fluid, in-function concurrency, instance sharing, duration, and background work. It does not define a different downstream-cancellation API. Conversely, the Functions cancellation contract is conditioned on the Node runtime and per-path opt-in, not on Fluid Compute mode.

The supported conclusion is therefore to configure `supportsCancellation`, not to toggle Fluid Compute. Treating Fluid and non-Fluid cancellation internals as otherwise identical would go beyond the published guarantee.

### Process termination and other APIs

Vercel documents `SIGTERM` for instance termination such as scale-down, with a short cleanup window. It is not documented as a per-request client-disconnect signal. The current `@vercel/functions` helper list has no separate `onCancellation` API; its relevant helper is `waitUntil`, which extends required cleanup after the request lifecycle event.

## What is and is not guaranteed

Documented after a matching Node route opts in:

- a downstream client disconnect fires `request.signal`;
- the function is terminated;
- the signal can be forwarded to abort-aware downstream work; and
- `waitUntil`/`after` is required for work that must finish after cancellation.

Not documented:

- a maximum latency between the downstream disconnect and signal delivery;
- a grace period in which ordinary handler code may finish after the signal;
- delivery of a new HTTP response to the client that already disconnected; or
- a specific status code that Vercel runtime logs must record for a cancelled request.

In particular, the handler's local `Response` with status 202 is meaningful for a synthetic `Request.signal` abort and for MCP cancellation paths where a peer remains connected. It cannot be a supported acceptance oracle for a real downstream disconnect: the caller has already closed that request, and Vercel says the function may be terminated/reclaimed. The observed HTTP 200 in the old Preview is evidence that the unconfigured function completed normally, but a corrected deployment need not record HTTP 202 to prove cancellation.

## Implemented resolution and validation

This evidence supports and implements outcome A: use Vercel's documented mechanism rather than narrowing the hosted cancellation promise.

The existing exact `api/mcp.ts` entry now sets `supportsCancellation: true`; the Web handler continues to use its existing `Request.signal` listener. A focused deterministic test fails if the setting disappears, and the isolated Vercel build check asserts that the generated Node function metadata retains it.

Preview deployment `dpl_3dHEoErZjE2v5gX2JSj5MqakaWTj` is `READY` at `normattiva-mcp-http-j66swsai8-adellorto-s-projects.vercel.app`, target Preview. It is a prebuilt artifact from the isolated issue-33 worktree based on reviewed commit `db2b778` plus the staged correction; no new commit or push existed at deployment time. Vercel Authentication was completed before each application run, and one persistent Node client reused the short-lived bypass cookie. No credential appears in the retained evidence.

Two function-level probes are correlated in stable runtime logs. At requested abort delays of 255 ms and 750 ms, the clients received `AbortError` after 260 ms and 760 ms; Vercel recorded the corresponding function invocations with status `0`, rather than the old unconfigured Preview's completed HTTP 200. Each subsequent ping and literal continuation completed with HTTP 200 and traversal progress `more`. A middle 255 ms attempt was cancelled before a function invocation was retained; it is recorded but does not strengthen the function-level conclusion. The [redacted machine-readable evidence](release-vercel-cancellation-preview.json) retains all three runs.

The reusable driver is `packages/core/test/fixtures/release-vercel-cancellation.mjs`. It accepts the Preview URL and a temporary Netscape cookie jar established by authenticated `vercel curl`, never prints the cookie, and reports only hashes and non-secret outcomes. The cookie jar must be deleted immediately after the run.

The local Preview build carries `supportsCancellation: true` into the `nodejs24.x` function metadata. Its isolated function passes the public contracts and aborts the synthetic upstream in 7 ms. The full deterministic suite passes 144/144 after adding the configuration regression.

This validates the documented hosted mechanism without inventing a 202 guarantee. Remaining risk is bounded: Vercel publishes no maximum propagation latency, and separate MCP cancellation notifications still cannot cross stateless instances without affinity or shared routing. Work that must survive termination would still require `waitUntil`/`after`; this handler's cancellation cascade is initiated synchronously.
