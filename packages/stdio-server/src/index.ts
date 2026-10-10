#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "@normattiva/core";

async function main(): Promise<void> {
  const server = createServer({
    name: "normattiva-mcp",
    version: "0.2.0",
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[normattiva-mcp] fatal:", err);
  process.exit(1);
});
