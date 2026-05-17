import { createMcpHandler } from "mcp-handler";
import {
  registerTools,
  registerResources,
  registerPrompts,
  type ToolContext,
} from "@normattiva/core";
import pkg from "../package.json" with { type: "json" };

const mcpHandler = createMcpHandler(
  (server) => {
    const ctx: ToolContext = {};
    registerTools(server, ctx);
    registerResources(server, ctx);
    registerPrompts(server, ctx);
  },
  {
    serverInfo: { name: "normattiva-mcp", version: pkg.version },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    // SSE is removed from the 2025-03-26 MCP spec; expose only Streamable HTTP.
    disableSse: true,
  },
);

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
  const res = await mcpHandler(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export { handler as GET, handler as POST, handler as DELETE, handler as OPTIONS };
