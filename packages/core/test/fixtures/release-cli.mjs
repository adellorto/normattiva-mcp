// One explicit, bounded terminal-client fixture session; never contacts Normattiva.
// Usage: node .../release-cli.mjs claude|codex OUTPUT.json stdio|http --plan|--execute
// Uses existing subscription login. Do not run as part of pnpm test.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signingKey } from './traversal-upstream.mjs';

const [client, output, transportName, ...options] = process.argv.slice(2);
assert.equal(options.length, 1, 'Specify exactly one of --plan or --execute.');
assert.ok(['--plan', '--execute'].includes(options[0]), 'Specify exactly one of --plan or --execute.');
const planOnly = options[0] === '--plan';
assert.ok(['claude', 'codex'].includes(client) && output && ['stdio', 'http'].includes(transportName),
  'Specify client, output file and stdio|http transport; execution runs inference.');
const exec = promisify(execFile);
const version = planOnly ? undefined : (await exec(client, ['--version'])).stdout;
const scratch = await mkdtemp(join(tmpdir(), 'normattiva-release-client-'));
const prompt = 'Trova il decreto legislativo 267/2000 e leggine articolo 13, max_chars 4 prima, max_chars 100 seconda. Poi chiedi 999 stesso atto snapshot 2026-10-02, senza elencare tutti articoli. Riporta testo completo 13 e dimmi se 999 prova nonesistenza. Non altri servizi o file.';
const stdioServer = { command: process.execPath, args: ['--import',
  fileURLToPath(new URL('./release-upstream.mjs', import.meta.url)),
  fileURLToPath(new URL('../../../stdio-server/dist/index.js', import.meta.url))],
  env: { NORMATTIVA_REFERENCE_KEY: signingKey.toString('hex') } };

async function localHttpFixture() {
  process.env.NORMATTIVA_REFERENCE_KEY = signingKey.toString('hex');
  await import('./release-upstream.mjs');
  const handlers = await import('../../../http-server/api/mcp.ts');
  const server = createHttpServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const controller = new AbortController();
      incoming.once('aborted', () => controller.abort());
      const method = incoming.method ?? 'POST';
      const handler = handlers[method] ?? handlers.POST;
      const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
        method, headers: incoming.headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks),
        signal: controller.signal,
      });
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(500, { 'content-type': 'text/plain' });
      outgoing.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { server, url: `http://127.0.0.1:${address.port}/api/mcp` };
}

let httpFixture;
const httpUrl = transportName === 'http'
  ? (planOnly ? process.env.RELEASE_CLIENT_HTTP_URL : (httpFixture = await localHttpFixture()).url)
  : undefined;
assert.ok(transportName !== 'http' || httpUrl, 'HTTP plan requires RELEASE_CLIENT_HTTP_URL.');
const server = transportName === 'http' ? { type: 'http', url: httpUrl } : stdioServer;
const config = join(scratch, 'mcp.json');
await writeFile(config, JSON.stringify({ mcpServers: { normattiva: server } }));
const args = client === 'claude' ? ['--print', '--model', 'sonnet', '--effort', 'low',
  '--max-budget-usd', '0.50', '--no-session-persistence', '--output-format', 'stream-json',
  '--verbose', '--restricted', '--tools', '', '--strict-mcp-config', '--mcp-config', config,
  '--allowedTools', 'mcp__normattiva__*', '--permission-mode', 'dontAsk',
  '--disable-slash-commands', '--setting-sources', '', prompt]
  : ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--json',
    '--skip-git-repo-check', '--sandbox', 'read-only', '-C', scratch, '--model', 'gpt-5.6-terra',
    '-c', 'model_reasoning_effort="low"', '-c', 'features.apps=false',
    ...(transportName === 'http'
      ? ['-c', `mcp_servers.normattiva.url=${JSON.stringify(httpUrl)}`]
      : ['-c', `mcp_servers.normattiva.command=${JSON.stringify(stdioServer.command)}`,
        '-c', `mcp_servers.normattiva.args=${JSON.stringify(stdioServer.args)}`,
        '-c', `mcp_servers.normattiva.env.NORMATTIVA_REFERENCE_KEY=${JSON.stringify(stdioServer.env.NORMATTIVA_REFERENCE_KEY)}`]),
    '-c', 'mcp_servers.normattiva.default_tools_approval_mode="approve"', prompt];
if (planOnly) {
  console.log(JSON.stringify({ execution: 'disabled', client, transport: transportName,
    mcp_config: { mcpServers: { normattiva: server } } }));
  process.exit(0);
}
const execution = exec(client, args, { cwd: scratch, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
// Codex 0.160.1 also reads a piped stdin when a positional prompt exists.
// execFile leaves that pipe open unless the parent explicitly ends it.
execution.child.stdin.end();
let stdout = '', executionError;
function redact(value) {
  let text = String(value ?? '');
  for (const [name, secret] of Object.entries(process.env)) {
    if (/(KEY|TOKEN|SECRET|PASSWORD)/i.test(name) && secret.length >= 8) text = text.replaceAll(secret, '<REDACTED>');
  }
  return text;
}
try { ({ stdout } = await execution); }
catch (error) {
  stdout = error.stdout ?? '';
  executionError = { code: error.code, signal: error.signal, killed: error.killed,
    message: 'Client execution failed; retained completed events and reported usage.',
    diagnostics: redact(error.stderr).slice(-3000) };
  process.exitCode = 1;
}
const events = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
// Exclude initialization/account metadata, session IDs and unrelated config.
const calls = [], messages = []; let usage, reportedCost, actualModels;
if (client === 'codex') {
  for (const event of events) {
    if (event.type === 'item.completed' && event.item.type === 'mcp_tool_call') {
      const item = event.item;
      calls.push({ tool: item.tool, arguments: item.arguments, status: item.status,
        result: item.result?.structured_content, error: item.error });
    }
    if (event.type === 'item.completed' && event.item.type === 'agent_message') messages.push(event.item.text);
    if (event.type === 'turn.completed') usage = event.usage;
  }
} else {
  const pending = new Map();
  for (const event of events) {
    for (const item of event.message?.content ?? []) {
      if (item.type === 'tool_use') {
        const call = { tool: item.name, arguments: item.input }; calls.push(call); pending.set(item.id, call);
      }
      if (item.type === 'tool_result' && pending.has(item.tool_use_id)) {
        const call = pending.get(item.tool_use_id);
        try { call.result = JSON.parse(item.content); } catch { call.result = item.content; }
        call.is_error = item.is_error ?? false;
      }
    }
    if (event.type === 'result') {
      messages.push(event.result); usage = event.usage; reportedCost = event.total_cost_usd;
      actualModels = Object.keys(event.modelUsage ?? {});
    }
  }
}
const returnedCursors = new Map();
const continuationChecks = [];
for (const call of calls) {
  const tool = call.tool.replace('mcp__normattiva__', '');
  if (call.arguments?.cursor) continuationChecks.push({ literal: returnedCursors.get(tool)?.has(call.arguments.cursor) ?? false, status: call.status,
    error: call.result?.error });
  const cursor = call.result?.cursor ?? call.result?.traversal?.cursor;
  if (cursor) {
    const continuationTool = tool === 'find_acts' ? 'continue_acts' : tool;
    if (!returnedCursors.has(continuationTool)) returnedCursors.set(continuationTool, new Set());
    returnedCursors.get(continuationTool).add(cursor);
  }
}
await writeFile(output, JSON.stringify({ recorded_at: new Date().toISOString(), client, version: version.trim(),
  transport: transportName,
  requested_model: client === 'claude' ? 'sonnet' : 'gpt-5.6-terra', actual_models: actualModels,
  scope: `One synthetic ${transportName} terminal-client sample; semantic review required. No live source or general model acceptance.`,
  settings: args, prompt, calls, continuation_checks: continuationChecks, messages, usage,
  reported_list_cost_usd: reportedCost, execution_error: executionError,
  client_errors: events.filter(event => ['error', 'turn.failed'].includes(event.type)).map(event => redact(event.message ?? event.error?.message)),
  billing: 'Existing subscription login; no separate API charge demonstrated.' }, null, 2) + '\n');
if (httpFixture) await new Promise(resolve => httpFixture.server.close(resolve));
console.log(`Recorded ${client} fixture session: ${output}`);
