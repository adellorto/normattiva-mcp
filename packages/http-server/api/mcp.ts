import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CancelledNotificationSchema, InitializeRequestSchema, isJSONRPCRequest, isJSONRPCNotification } from "@modelcontextprotocol/sdk/types.js";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  configuredSigningKey,
} from "@normattiva/core";
import pkg from "../package.json" with { type: "json" };

// The namespace is self-contained; only in-flight requests occupy process memory.
// A cancellation on another instance cannot reach this map. Never key by bare RPC id.
const activeRequests = new Map<string, () => void>();
function namespaceSignature(nonce: string, key: Uint8Array): Buffer {
  return createHmac("sha256", key).update(`normattiva-http-cancellation-v1:${nonce}`).digest();
}
function issueNamespace(key: Uint8Array): string {
  const nonce = randomBytes(32).toString("base64url");
  return `h1_${nonce}.${namespaceSignature(nonce, key).toString("base64url")}`;
}
function validNamespace(value: string, key: Uint8Array): boolean {
  const parts = /^h1_([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!parts) return false;
  const expected = namespaceSignature(parts[1]!, key).toString("base64url");
  return timingSafeEqual(Buffer.from(parts[2]!), Buffer.from(expected));
}
function requestKey(namespace: string, id: string | number): string {
  return `${namespace}:${JSON.stringify(id)}`;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }
  const signingKey = configuredSigningKey();
  const namespace = req.headers.get("Mcp-Session-Id");
  if (namespace !== null && !validNamespace(namespace, signingKey)) {
    return Response.json({ jsonrpc: "2.0", id: null, error: {
      code: -32000, message: "Unknown HTTP session; initialize again without Mcp-Session-Id.",
    } }, { status: 404, headers: CORS_HEADERS });
  }
  const server = createServer({ name: "normattiva-mcp", version: pkg.version }, { signingKey });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  let stopped!: (response: Response) => void;
  const cancelled = new Promise<Response>(resolve => { stopped = resolve; });
  const abort = () => {
    void server.close(); // SDK close aborts its request handlers, including queued work.
    stopped(new Response(null, { status: 202 }));
  };
  const dispatch = transport.onmessage!;
  const registered = new Set<string>();
  let issuedNamespace: string | undefined;
  transport.onmessage = (message, extra) => {
    if (req.signal.aborted) return;
    const cancellation = CancelledNotificationSchema.safeParse(message);
    if (isJSONRPCNotification(message) && cancellation.success) {
      const id = cancellation.data.params.requestId;
      if (namespace && id !== undefined) activeRequests.get(requestKey(namespace, id))?.();
      return;
    }
    if (isJSONRPCRequest(message)) {
      if (InitializeRequestSchema.safeParse(message).success) {
        issuedNamespace = issueNamespace(signingKey);
      } else if (namespace) {
        const key = requestKey(namespace, message.id);
        if (activeRequests.has(key)) {
          stopped(Response.json({ jsonrpc: "2.0", id: message.id, error: {
            code: -32600, message: "This request id is already active in the HTTP session.",
          } }, { status: 409 }));
          return;
        }
        registered.add(key);
        activeRequests.set(key, abort);
      }
    }
    dispatch(message, extra);
  };
  req.signal.addEventListener("abort", abort, { once: true });
  const handleMessage = async (): Promise<Response> => {
    let parsedBody: unknown;
    try { parsedBody = await req.json(); }
    catch {
      return Response.json({ jsonrpc: "2.0", id: null, error: {
        code: -32700, message: "Invalid JSON.",
      } }, { status: 400 });
    }
    if (Array.isArray(parsedBody)) {
      return Response.json({ jsonrpc: "2.0", id: null, error: {
        code: -32600, message: "Send one MCP message per HTTP POST.",
      } }, { status: 400 });
    }
    return transport.handleRequest(req, { parsedBody });
  };
  let res: Response;
  try {
    if (req.signal.aborted) { abort(); res = await cancelled; }
    else res = await Promise.race([handleMessage(), cancelled]);
  } finally {
    req.signal.removeEventListener("abort", abort);
    for (const key of registered) {
      if (activeRequests.get(key) === abort) activeRequests.delete(key);
    }
    await server.close();
  }
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  if (issuedNamespace && res.status === 200) headers.set("Mcp-Session-Id", issuedNamespace);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export { handler as GET, handler as POST, handler as DELETE, handler as OPTIONS };
