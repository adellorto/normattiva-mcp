#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "@normattiva/core";
import { createRequire } from "node:module";
import { resolveLocalSigningKey } from "./local-reference-trust.js";

const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

async function main(): Promise<void> {
  const signingKey = await resolveLocalSigningKey();
  const server = createServer({
    name: "normattiva-mcp",
    version: pkg.version,
  }, { signingKey });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[normattiva-mcp] fatal:", err);
  process.exit(1);
});
