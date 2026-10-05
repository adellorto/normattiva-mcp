import { OperationError, type ErrorDetail } from "./errors.js";
import { executeUpstream } from "./upstream.js";
import { RESPONSE_LIMITS, calendarDateSchema, articleContentSchema } from "./contracts.js";
import type {
  RicercaAvanzataBody,
  RicercaResponse,
  DettaglioAttoBody,
  DettaglioAttoResponse,
  AggiornatiBody,
  DenominazioneItem,
  ClasseItem,
  CollezioneItem,
  RicerchePredefiniteResponse,
} from "./types.js";

// Hard-coded to the production OpenData environment. The PRE environment
// requires mTLS and is intentionally unsupported here.
export const BASE_URL = "https://api.normattiva.it/t/normattiva.api";

const COMMON_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
  Origin: "https://dati.normattiva.it",
  "User-Agent": "normattiva-mcp/0.1.4 (+https://www.npmjs.com/package/normattiva-mcp)",
};

const MAX_SOURCE_BYTES = RESPONSE_LIMITS.sourceBytes;
const MAX_ERROR_BYTES = 16 * 1024;

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) {
    const delay = Number(value) * 1_000;
    return Number.isSafeInteger(delay) ? delay : undefined;
  }
  // HTTP-date, not arbitrary strings accepted by Date.parse (e.g. "-1").
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function boundedBody(response: Response, limit: number, truncate = false): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        if (truncate) break;
        throw new OperationError({
          category: "upstream_failure", code: "source_limit_exceeded", retryability: false,
          message: "The decoded upstream body exceeded the source limit.", provider: "normattiva",
        });
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function transportError(error: unknown, operation: string): OperationError {
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  const mapping: Record<string, ErrorDetail["transport_cause"]> = {
    ENOTFOUND: "dns", EAI_AGAIN: "dns", ECONNRESET: "connection_reset",
    UND_ERR_SOCKET: "connection_reset", ECONNREFUSED: "connection_refused",
    CERT_HAS_EXPIRED: "tls", DEPTH_ZERO_SELF_SIGNED_CERT: "tls",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "tls", UND_ERR_CONNECT_TIMEOUT: "timeout",
    UND_ERR_HEADERS_TIMEOUT: "timeout", UND_ERR_BODY_TIMEOUT: "timeout", ETIMEDOUT: "timeout",
  };
  const transient = ["EAI_AGAIN", "ECONNRESET", "UND_ERR_SOCKET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(cause ?? "");
  const permanent = ["ENOTFOUND", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(cause ?? "");
  return new OperationError({
    category: "transport_failure", code: "upstream_transport_failure",
    message: "A transport failure prevented contacting Normattiva.",
    retryability: transient ? true : permanent ? false : "unknown",
    transport_cause: mapping[cause ?? ""] ?? "unknown", provider: "normattiva", operation,
  }, { cause: error });
}

async function request<T>(path: string, init?: RequestInit, validate?: (body: unknown) => boolean, normalize?: (body: T) => T): Promise<T> {
  return executeUpstream({
    operation: path,
    // These endpoints are searches, detail reads and metadata GETs. Export
    // submission must use a separate operation declared replay-unsafe.
    replaySafe: true,
    execute: async (signal) => {
      let response: Response;
      try {
        response = await fetch(BASE_URL + path, {
          ...init, signal,
          headers: { ...COMMON_HEADERS, ...(init?.headers as Record<string, string> | undefined) },
          redirect: "error",
        });
      } catch (error) {
        throw transportError(error, path);
      }
      if (!response.ok) {
        let body: { code?: unknown; message?: unknown } = {};
        // Read once. A bad/oversized error body must not hide a 429 or status.
        try { body = JSON.parse(await boundedBody(response, MAX_ERROR_BYTES, true)) ?? {}; } catch {}
        const code = typeof body.code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(body.code) ? body.code : undefined;
        const delay = retryAfter(response.headers.get("retry-after"));
        const knownTransient = (response.status === 500 && code === "500"
          && body.message === "Errore generico della chiamata, riprovare più tardi");
        throw new OperationError({
          category: response.status === 429 ? "rate_limited" : "upstream_failure",
          code: response.status === 429 ? "upstream_rate_limited" : "upstream_http_error",
          message: response.status === 429 ? "Normattiva is rate limited; retry in a later call."
            : `Normattiva returned HTTP ${response.status}. This does not establish legal absence.`,
          retryability: response.status === 429 || knownTransient ? true
            : response.status === 400 || response.status === 422 ? false : "unknown",
          ...(delay !== undefined ? { retry_after_ms: delay } : {}),
          provider: "normattiva", operation: path, http_status: response.status, upstream_code: code,
        });
      }
      let text: string;
      try { text = await boundedBody(response, MAX_SOURCE_BYTES); }
      catch (error) {
        if (error instanceof OperationError) throw error;
        throw transportError(error, path);
      }
      let body: unknown;
      try { body = JSON.parse(text); } catch (cause) {
        throw new OperationError({ category: "upstream_failure", code: "malformed_upstream_response",
          message: "Normattiva returned malformed success data.", retryability: false,
          provider: "normattiva", operation: path }, { cause });
      }
      if (validate && !validate(body)) throw new OperationError({
        category: "upstream_failure", code: "malformed_upstream_response",
        message: "Normattiva returned an unexpected success shape.", retryability: false,
        provider: "normattiva", operation: path,
      });
      return normalize ? normalize(body as T) : body as T;
    },
  });
}

function postJson<T>(path: string, body: unknown, validate: (body: unknown) => boolean, normalize?: (body: T) => T): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, validate, normalize);
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const searchResponse = (value: unknown): boolean => object(value)
  && typeof value.numeroAttiTrovati === "number" && Number.isInteger(value.numeroAttiTrovati) && value.numeroAttiTrovati >= 0
  && Array.isArray(value.listaAtti) && value.listaAtti.every(object);
const articleResponse = (value: unknown): boolean => object(value) && typeof value.success === "boolean"
  && (!value.success || (object(value.data) && object(value.data.atto) && typeof value.data.atto.articoloHtml === "string"));

function malformedArticleMetadata(): OperationError {
  return new OperationError({ category: "upstream_failure", code: "malformed_upstream_response",
    message: "Normattiva returned malformed article metadata.", retryability: false,
    provider: "normattiva", operation: "article_detail" });
}

function effectiveDate(value: unknown, openEnd = false): string | undefined {
  if (value === undefined || value === null || (openEnd && value === "99999999")) return undefined;
  const normalized = typeof value === "string" && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
  const parsed = calendarDateSchema.safeParse(normalized);
  if (!parsed.success) throw malformedArticleMetadata();
  return parsed.data;
}

function normalizeArticleResponse(body: DettaglioAttoResponse): DettaglioAttoResponse {
  if (!body.success || !body.data?.atto) return body;
  const atto = body.data.atto;
  const metadata = articleContentSchema.safeParse({
    format: "html", text: atto.articoloHtml, title: atto.titolo ?? undefined,
    effective_from: effectiveDate(atto.articoloDataInizioVigenza),
    effective_to: effectiveDate(atto.articoloDataFineVigenza, true),
  });
  if (!metadata.success) throw malformedArticleMetadata();
  return { ...body, data: { ...body.data, atto: { ...atto,
    titolo: metadata.data.title,
    articoloDataInizioVigenza: metadata.data.effective_from,
    articoloDataFineVigenza: metadata.data.effective_to,
  } } };
}

export function ricercaAvanzata(body: RicercaAvanzataBody): Promise<RicercaResponse> {
  return postJson("/bff-opendata/v1/api/v1/ricerca/avanzata", body, searchResponse);
}

export function dettaglioAtto(body: DettaglioAttoBody): Promise<DettaglioAttoResponse> {
  return postJson("/bff-opendata/v1/api/v1/atto/dettaglio-atto", body, articleResponse, normalizeArticleResponse);
}

export function ricercaAggiornati(body: AggiornatiBody): Promise<RicercaResponse> {
  return postJson("/bff-opendata/v1/api/v1/ricerca/aggiornati", body, searchResponse);
}

function memoize<T>(fn: () => Promise<T>): () => Promise<T> {
  let cache: T | undefined;
  // Only completed metadata is shared: a cancelled caller cannot poison a
  // second caller's in-flight request or spend that caller's budget.
  return async () => {
    if (cache === undefined) cache = await fn();
    return cache;
  };
}

const labeledItems = (body: unknown): boolean => Array.isArray(body)
  && body.every(item => object(item) && typeof item.label === "string" && typeof item.value === "string");

export const getDenominazioni = memoize(() =>
  request<DenominazioneItem[]>("/bff-opendata/v1/api/v1/tipologiche/denominazione-atto", undefined, labeledItems),
);

export const getClassiProvvedimento = memoize(() =>
  request<ClasseItem[]>("/bff-opendata/v1/api/v1/tipologiche/classe-provvedimento", undefined, labeledItems),
);

export const getCollezioniPredefinite = memoize(() =>
  request<CollezioneItem[]>("/bff-opendata/v1/api/v1/collections/collection-predefinite", undefined,
    body => Array.isArray(body) && body.every(item => object(item)
      && typeof item.nomeCollezione === "string" && typeof item.numeroAtti === "number")),
);

export const getRicerchePredefinite = memoize(() =>
  request<RicerchePredefiniteResponse>("/bff-opendata/v1/api/v1/ricerca/predefinita", undefined,
    body => object(body) && Array.isArray(body.ricerchePredefinite)),
);
