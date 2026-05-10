#!/usr/bin/env node
// Quick MCP handshake + live API smoke test for normattiva-mcp.
// Spawns dist/index.js, runs initialize -> list tools/resources/prompts ->
// calls search_acts with a simple query -> reads the denominazioni resource.
//
// Run with: node tests/smoke.mjs
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, "..", "dist", "index.js");

const proc = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
});

const rl = createInterface({ input: proc.stdout });
const pending = new Map();
let nextId = 1;

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolveP, rejectP) => {
    pending.set(id, { resolve: resolveP, reject: rejectP });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rejectP(new Error(`timeout waiting for ${method}`));
      }
    }, 30000);
  });
}

function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

try {
  console.log("→ initialize");
  const init = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.1" },
  });
  console.log("  serverInfo:", init.serverInfo, "caps:", Object.keys(init.capabilities ?? {}));
  notify("notifications/initialized", {});

  console.log("→ tools/list");
  const tools = await send("tools/list", {});
  console.log("  tools:", tools.tools.map((t) => t.name));

  console.log("→ resources/list");
  const resources = await send("resources/list", {});
  console.log("  resources:", resources.resources.map((r) => r.uri));

  console.log("→ prompts/list");
  const prompts = await send("prompts/list", {});
  console.log("  prompts:", prompts.prompts.map((p) => p.name));

  console.log("→ tools/call search_acts (denominazione=LEGGE, anno=2023, per_page=2)");
  const search = await send("tools/call", {
    name: "search_acts",
    arguments: { denominazione: "LEGGE", anno: 2023, per_page: 2 },
  });
  const searchData = JSON.parse(search.content[0].text);
  console.log(`  totale_atti=${searchData.totale_atti}, returned=${searchData.atti.length}`);
  if (searchData.atti.length > 0) {
    console.log(`  first: ${searchData.atti[0].descrizione}`);
    console.log(`  codice_redazionale: ${searchData.atti[0].codice_redazionale}`);
  }

  console.log("→ resources/read normattiva://tipologiche/denominazioni");
  const den = await send("resources/read", {
    uri: "normattiva://tipologiche/denominazioni",
  });
  const denData = JSON.parse(den.contents[0].text);
  console.log(`  ${denData.length} denominazioni, e.g. ${denData[0].label}=${denData[0].value}`);

  // Known-good record from the spec/notebook: Legge 400/1988, art. 13-bis
  console.log("→ tools/call read_article (Legge 400/1988 art. 13-bis, format=text)");
  const article = await send("tools/call", {
    name: "read_article",
    arguments: {
      data_gu: "1988-09-12",
      codice_redazionale: "088G0458",
      articolo: 13,
      sotto_articolo: 2,
      id_gruppo: 6,
      data_vigenza: "2025-01-01",
      format: "text",
    },
  });
  const articleData = JSON.parse(article.content[0].text);
  console.log(`  titolo: ${articleData.titolo}`);
  console.log(`  text len: ${articleData.articolo.length} chars`);
  console.log(`  preview: ${articleData.articolo.slice(0, 120).replace(/\n/g, " ⏎ ")}...`);

  console.log("→ tools/call recent_updates (last 7 days)");
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const recent = await send("tools/call", {
    name: "recent_updates",
    arguments: { data_inizio: fmt(weekAgo), data_fine: fmt(today) },
  });
  const recentData = JSON.parse(recent.content[0].text);
  console.log(`  numero_atti: ${recentData.numero_atti}`);

  console.log("\n✓ all good");
  proc.kill();
  process.exit(0);
} catch (err) {
  console.error("✗ smoke test failed:", err);
  proc.kill();
  process.exit(1);
}
