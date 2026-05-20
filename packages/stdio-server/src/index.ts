#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerTools,
  registerResources,
  registerPrompts,
  type ToolContext,
} from "@normattiva/core";

async function main(): Promise<void> {
  const server = new McpServer({
    name: "normattiva-mcp",
    version: "0.1.4",
  });

  const ctx: ToolContext = {};

  registerTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server, ctx);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[normattiva-mcp] fatal:", err);
  process.exit(1);
});
