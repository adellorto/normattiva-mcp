import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
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

const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BASE_URL + path;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { ...COMMON_HEADERS, ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch (err) {
    throw new McpError(
      ErrorCode.InternalError,
      `Network error contacting Normattiva: ${(err as Error).message}`,
    );
  }

  if (!res.ok) {
    let detail = "";
    let apiCode: string | undefined;
    try {
      const body = (await res.json()) as {
        message?: string;
        description?: string;
        error?: string;
        code?: string;
      };
      apiCode = body.code;
      detail = body.message ?? body.description ?? body.error ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    // IPZS-specific 4xx codes (per spec §1.3.x): 1003 invalid export format,
    // 1005/1006 invalid input/vigenza, 1200 resource missing, 1204 token unknown,
    // 1501 window > 12 months, 1502 > 7000 atti, 1503 inverted date range.
    const isClientError =
      res.status === 400 ||
      res.status === 404 ||
      res.status === 422 ||
      (apiCode !== undefined && /^1[0-9]{3}$/.test(apiCode));
    const mcpCode = isClientError ? ErrorCode.InvalidRequest : ErrorCode.InternalError;
    const codeTag = apiCode ? ` [code=${apiCode}]` : "";
    throw new McpError(
      mcpCode,
      `Normattiva API ${res.status}${codeTag}: ${detail || res.statusText}`,
    );
  }

  return (await res.json()) as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function ricercaAvanzata(body: RicercaAvanzataBody): Promise<RicercaResponse> {
  return postJson("/bff-opendata/v1/api/v1/ricerca/avanzata", body);
}

export async function dettaglioAtto(body: DettaglioAttoBody): Promise<DettaglioAttoResponse> {
  try {
    return await postJson<DettaglioAttoResponse>("/bff-opendata/v1/api/v1/atto/dettaglio-atto", body);
  } catch (err) {
    // Soft-fail "not found" responses so callers can probe sotto_articolo / id_gruppo
    // without try/catch: real bad-input or server errors still surface as exceptions.
    if (
      err instanceof McpError &&
      err.code === ErrorCode.InvalidRequest &&
      /non\s+trovat[oa]/i.test(err.message)
    ) {
      return { success: false, message: err.message };
    }
    throw err;
  }
}

export function ricercaAggiornati(body: AggiornatiBody): Promise<RicercaResponse> {
  return postJson("/bff-opendata/v1/api/v1/ricerca/aggiornati", body);
}

function memoize<T>(fn: () => Promise<T>): () => Promise<T> {
  let cache: Promise<T> | undefined;
  return () => {
    if (!cache) {
      cache = fn().catch((err) => {
        cache = undefined;
        throw err;
      });
    }
    return cache;
  };
}

export const getDenominazioni = memoize(() =>
  request<DenominazioneItem[]>("/bff-opendata/v1/api/v1/tipologiche/denominazione-atto"),
);

export const getClassiProvvedimento = memoize(() =>
  request<ClasseItem[]>("/bff-opendata/v1/api/v1/tipologiche/classe-provvedimento"),
);

export const getCollezioniPredefinite = memoize(() =>
  request<CollezioneItem[]>("/bff-opendata/v1/api/v1/collections/collection-predefinite"),
);

export const getRicerchePredefinite = memoize(() =>
  request<RicerchePredefiniteResponse>("/bff-opendata/v1/api/v1/ricerca/predefinita"),
);
