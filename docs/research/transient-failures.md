# Transient failures and safe request budgets

Research for [Characterize transient failures and safe request budgets](https://github.com/adellorto/normattiva-mcp/issues/16), performed 2026-09-27 (Europe/Rome).

## Answer

The reported error is real, but the reported frequency and proposed cause are not established.

- The exact `MCP error -32603: Network error contacting Normattiva: fetch failed` symptom occurred in one local and one hosted five-probe `list_articles` call. Both failed in about 0.5–0.6 seconds. This excludes the connector's 20-second abort and Vercel's 60-second invocation ceiling as the cause of those two observations.
- All 16 sequential upstream-backed reads succeeded: six direct Normattiva calls, five local-connector calls, and five hosted-connector calls. One later direct burst of five concurrent Node `fetch` calls also succeeded. Five-way concurrency was therefore associated with, but was not sufficient to reproduce, the error.
- Because the local stdio server and hosted Vercel server produced the same symptom, Vercel and Streamable HTTP are not necessary causes. The remaining boundary is the Node-fetch-to-Normattiva network path, but current error wrapping discards the low-level cause needed to distinguish DNS, TLS, socket reset, upstream rejection, and similar failures.
- A separate same-day experiment observed a genuine Normattiva HTTP `429` after hundreds of rapid article probes. It is evidence of an undocumented upstream traffic protection, not evidence for a particular requests-per-second limit. The official PDF and OpenAPI publish no 429, `Retry-After`, numeric rate limit, upstream timeout, or formal retry schedule.
- More seriously, a deterministic fixture proves that `429` with Normattiva code `1000` is classified as `InvalidRequest`, which `list_articles` and `read_act` treat as an article miss. A transient overload can therefore become a false empty range or silent early stop, not merely a visible failure.

The user's 7 failures in roughly 28 tool calls remain a **reported concern**. This study confirms the failure mode and failure amplification, but cannot estimate a stable failure rate from a small, non-isolated sample. Immediate retry success does not by itself distinguish rate limiting from a transient transport fault.

## Versions and deployment facts

The local experiments used commit [`90af053`](https://github.com/adellorto/normattiva-mcp/tree/90af05371bafdbb72ae870255e1ee2f9788b27cc), Node 24.15.0, `@normattiva/core` 0.1.4, `@modelcontextprotocol/sdk` 1.29.0, and `mcp-handler` 1.1.0. The hosted initialize response identified `normattiva-mcp` 0.1.0; its exact deployed commit could not be verified.

The repository sets a 20-second timeout on every Normattiva fetch and retains only `Error.message` when fetch rejects ([`api.ts`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/api.ts#L25-L40)). It has no retry logic. `list_articles` and `read_act` issue base probes in batches of five with `Promise.all`, and propagate any non-`InvalidRequest` failure from the batch ([`list_articles`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L260-L308), [`read_act`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L573-L580)). The HTTP handler and Vercel configuration both set a 60-second maximum duration and pin the deployment to `fra1` ([handler](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/http-server/api/mcp.ts#L10-L25), [`vercel.json`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/http-server/vercel.json#L1-L10)). Vercel defines maximum duration as the whole invocation, including response transmission; expiry returns HTTP 504 `FUNCTION_INVOCATION_TIMEOUT` ([Vercel limits](https://vercel.com/docs/functions/limitations)).

## Bounded live experiment

The test act was D.Lgs. 267/2000 (TUEL), `codice_redazionale=000G0304`, `data_gu=2000-09-28`, at vigenza date 2026-09-27. No automatic retries were used. Sequential calls were spaced by 750 ms. The only bursts were the connector's existing five-request batch and one matching direct five-request control. In total, 31 upstream requests were initiated; aggregate early rejection prevents knowing how many of their constituent requests failed or completed.

| Seam and shape | Result | Latency | Classification |
| --- | --- | --- | --- |
| Direct Normattiva, six sequential `dettaglio-atto` calls | 6/6 HTTP 200 | 0.579–1.888 s; median about 1.34 s | Upstream reachable; no `Retry-After` or rate-limit header on captured success |
| Local stdio connector, five sequential `read_article` calls | 5/5 `found:true` | 0.464–2.023 s; median 0.479 s | Connector single-call path succeeded |
| Hosted MCP, five sequential `read_article` calls | 5/5 `found:true`; HTTP 200 | 0.261–0.776 s; median 0.291 s | Hosted/Vercel single-call path succeeded |
| Local stdio connector, one `list_articles(max_articoli=5)` | Failed with exact reported `fetch failed` | 0.598 s | Not Vercel or HTTP transport; one rejection fails the whole batch |
| Hosted MCP, one `list_articles(max_articoli=5)` | HTTP 200 with MCP tool `isError:true` and exact reported text | 0.506 s | Vercel returned normally; failure was inside tool execution |
| Direct Normattiva, one concurrent burst for articles 1–5 | 5/5 HTTP 200 | 1.266–1.394 s each; 1.436 s total | Concurrency five is not deterministically failing |

The local and hosted aggregate failures occurred around 20:50 Europe/Rome. Multiple Wayfinder investigations were active against the same public service, so this was not an isolated load test; shared local egress and unrelated hosted calls could not be excluded. The experiment was stopped rather than increasing load to estimate a rate.

### Red-capable loop and its limit

The already-run local loop was: start the built stdio server, initialize MCP, then call `list_articles` once with the identifiers above, `max_articoli=5`, and `include_suffixes=false`. It asserted on `result.isError` and `/fetch failed/i`. It went red with:

```json
{"seam":"local-composed","calls_upstream":5,"concurrency":5,"latency_ms":598,"is_error":true,"fetch_failed":true}
```

The equivalent hosted call went red with:

```text
MCP error -32603: Network error contacting Normattiva: fetch failed
```

This loop is fast, agent-runnable, and catches the reported symptom, but is intentionally **not claimed deterministic**. Raising the reproduction rate would require repeated bursts against a public service with no published traffic allowance, contrary to the safe-testing constraint. A future campaign needs an isolated time window or non-production upstream, explicit request ceiling, and access to server/egress logs.

## The observed 429 and silent truncation

A parallel enumeration experiment observed this exact response through the hosted MCP at approximately 20:55 Europe/Rome:

```text
MCP error -32600: Normattiva API 429 [code=1000]: Errore generico della chiamata, riprovare più tardi
```

It followed a 200-probe hosted `list_articles` call completed in about 5.4 seconds, itself preceded by other 200-probe local and hosted runs. No raw response headers were retained, so the presence of `Retry-After` is unknown. This is a deliberately confounded high-load observation: it establishes that production can emit 429/code 1000, but not its threshold, window, or whether the immediately preceding call alone caused it.

The connector marks every 1xxx API code as `InvalidRequest`, irrespective of HTTP status ([`api.ts`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/api.ts#L58-L70)). Both aggregate tools catch every `InvalidRequest` as an article miss ([`list_articles`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L298-L305), [`read_act`](https://github.com/adellorto/normattiva-mcp/blob/90af05371bafdbb72ae870255e1ee2f9788b27cc/packages/core/src/tools.ts#L567-L570)).

A no-network fixture returned valid articles 1–5 and `HTTP 429 {code:"1000"}` for articles 6–10. `list_articles` returned:

```json
{
  "probed_up_to": 10,
  "stopped_early": true,
  "truncated": false,
  "articoli_trovati": 5,
  "last_article": 5
}
```

This is a **verified connector finding**: overload can be silently represented as the end of an act. It also means successful-looking aggregate results cannot currently be used to infer an upstream failure rate.

## Official retry and rate-limit evidence

The official portal links the API PDF and OpenAPI artifacts from [Come scaricare i dati](https://dati.normattiva.it/Come-scaricare-i-dati). The current [API specification PDF](https://dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf), accessed 2026-09-27 and carrying revisions through 2026-03-10, documents HTTP 500 for synchronous search, article detail, and updated-acts calls with the message “riprovare più tardi.” It supplies no delay, attempt count, backoff, timeout, idempotency, or requests-per-time-window contract. Its 503 overload response is specific to the asynchronous export workflow, not a stated contract for `dettaglio-atto`.

The official [OpenAPI JSON](https://dati.normattiva.it/assets/come_fare_per/openapi-bff-opendata.json) and [rendered OpenAPI](https://dati.normattiva.it/assets/come_fare_per/Normattiva%20OpenData.html), accessed the same day, enumerate 200, 202, 204, 303, 400, 404, 422, 500, 503, and 529 responses. They contain no 429, `Retry-After`, “rate limit,” or retry instructions. This is an absence finding, not proof of unlimited service; the live 429 demonstrates undocumented enforcement.

MCP itself requires implementations to apply maximum request timeouts but defines no numeric timeout or retry policy ([lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)). A Streamable HTTP disconnect is not cancellation, so a blind retry may overlap work that is still running ([transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)). MCP distinguishes protocol errors from tool-execution errors and recommends server-side rate limiting for tool calls ([tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)). HTTP permits automatic retry of POST only when its semantics are known to be idempotent; treating these Normattiva read/search POSTs as retry-safe is a project inference, not a published Normattiva guarantee ([RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)).

## Safe budget constraints for the remediation decision

These are conservative boundaries supported by the evidence, not a prescribed resilience implementation:

1. **Invocation deadline:** budget no more than about 50 seconds for all upstream work, leaving about 10 seconds of the configured 60-second Vercel ceiling for MCP handling and response transmission. This is an engineering margin, not an IPZS number.
2. **Per-attempt timeout:** the current 20-second ceiling is compatible with at most two total attempts for a single upstream read inside that shared deadline. Three worst-case attempts cannot fit. Aggregate work must consume the same shared deadline rather than grant every item an independent retry budget.
3. **Concurrency:** one in-flight Normattiva request is the only level shown stable through the connector in this bounded study. Five cannot be called safe: both five-way aggregate observations failed, although a direct five-way control passed. If more than one is required, concurrency two should be the next separately measured step, not an assumed safe default. Vercel's much larger platform concurrency is not an upstream allowance ([Vercel concurrency](https://vercel.com/docs/functions/concurrency-scaling)).
4. **Request count/rate:** no evidence-backed RPS or per-minute figure exists. Do not translate Vercel capacity or one successful burst into a Normattiva allowance. Aggregate work needs a small bounded unit and continuation/partial-progress semantics; the exact unit size remains a later design decision.
5. **Retry eligibility:** only pre-response network failures, connector timeouts, and retryable HTTP 5xx/429 responses are candidates. Do not retry 400/404/422 or documented validation/result-limit codes. Honor `Retry-After` if present. Any retry count and short jitter must remain inside the shared deadline and total-attempt cap.
6. **Progress preservation:** a transient failure must not be indistinguishable from “article absent” and must not discard or falsely complete prior successful probes. This constraint follows from the reproduced all-or-nothing failure and deterministic 429 fixture.
7. **Global load:** per-invocation limits alone are insufficient because Vercel can run many invocations concurrently. Any eventual budget must account for aggregate process/deployment traffic, but the official evidence does not justify a numeric global rate.

## Attribution still blocked by missing telemetry

The next diagnostic iteration needs structured, redacted fields at the upstream boundary: operation, attempt, elapsed time, timeout-vs-network classification, `cause.name`, `cause.code`, HTTP status, `Retry-After`, Normattiva `activityid`, batch size, and remaining invocation deadline. The current wrapper reduces all pre-response failures to `fetch failed`, and the hosted deployment's Vercel logs were not available. Without that evidence, assigning the sub-second failures specifically to Normattiva, DNS, TLS, or a socket reset would be speculation.

No resilience code was changed in this research.
