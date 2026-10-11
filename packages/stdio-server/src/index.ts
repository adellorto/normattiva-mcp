#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "@normattiva/core";
import { resolveLocalSigningKey } from "./local-reference-trust.js";

async function main(): Promise<void> {
  const signingKey = await resolveLocalSigningKey();
  const server = createServer({
    name: "normattiva-mcp",
    version: "0.2.0",
  }, { signingKey });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[normattiva-mcp] fatal:", err);
  process.exit(1);
});
