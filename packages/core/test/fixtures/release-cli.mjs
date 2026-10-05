// One explicit, bounded terminal-client fixture session; never contacts Normattiva.
// Usage: node .../release-cli.mjs claude|codex OUTPUT.json
// Uses existing subscription login. Do not run as part of pnpm test.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signingKey } from './traversal-upstream.mjs';

const [client, output] = process.argv.slice(2);
assert.ok(['claude', 'codex'].includes(client) && output, 'Specify client and output file; this command runs inference.');
const scratch = await mkdtemp(join(tmpdir(), 'normattiva-release-client-'));
const prompt = 'Trova il decreto legislativo 267/2000 e leggine articolo 13, max_chars 4 prima, max_chars 100 seconda. Poi chiedi 999 stesso atto snapshot 2026-10-02, senza elencare tutti articoli. Riporta testo completo 13 e dimmi se 999 prova nonesistenza. Non altri servizi o file.';
const server = { command: process.execPath, args: ['--import',
  fileURLToPath(new URL('./release-upstream.mjs', import.meta.url)),
  fileURLToPath(new URL('../../../stdio-server/dist/index.js', import.meta.url))],
  env: { NORMATTIVA_REFERENCE_KEY: signingKey.toString('hex') } };
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
    '-c', `mcp_servers.normattiva.command=${JSON.stringify(server.command)}`,
    '-c', `mcp_servers.normattiva.args=${JSON.stringify(server.args)}`,
    '-c', `mcp_servers.normattiva.env.NORMATTIVA_REFERENCE_KEY=${JSON.stringify(server.env.NORMATTIVA_REFERENCE_KEY)}`,
    '-c', 'mcp_servers.normattiva.default_tools_approval_mode="approve"', prompt];
const exec = promisify(execFile);
const { stdout: version } = await exec(client, ['--version']);
const { stdout } = await exec(client, args, { cwd: scratch, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
const events = stdout.trim().split('\n').map(line => JSON.parse(line));
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
  requested_model: client === 'claude' ? 'sonnet' : 'gpt-5.6-terra', actual_models: actualModels,
  scope: 'One synthetic stdio terminal-client sample; semantic review required. No live source or general model acceptance.',
  settings: args, prompt, calls, continuation_checks: continuationChecks, messages, usage,
  reported_list_cost_usd: reportedCost, billing: 'Existing subscription login; no separate API charge demonstrated.' }, null, 2) + '\n');
console.log(`Recorded ${client} fixture session: ${output}`);
