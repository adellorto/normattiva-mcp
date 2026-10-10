// Actual default MCP outputs for model acceptance, with synthetic source controls.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools, ActTraversal } from '../../dist/index.js';
import { signingKey, publication, installTraversalBoundary } from './traversal-upstream.mjs';

const { stdout } = await promisify(execFile)(process.execPath,
  [fileURLToPath(new URL('./measure-guidance.mjs', import.meta.url))], { maxBuffer: 1024 * 1024 });
const input = JSON.parse(stdout);
const act_locator = new ActTraversal({ signingKey }).actLocator(publication);
async function call(name, args) {
  const server = new McpServer({ name: 'release-model-input', version: '0' });
  registerTools(server, { signingKey });
  const client = new Client({ name: 'release-model-input', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try { return await client.callTool({ name, arguments: args }); }
  finally { await client.close(); await server.close(); }
}
installTraversalBoundary();
const boundary = globalThis.fetch;
const first = await call('read_article', { act_locator, article_reference: '13', snapshot_date: '2026-10-02', max_chars: 4 });
globalThis.fetch = async (url, init) => {
  const response = await boundary(url, init);
  if (!String(url).includes('dettaglio-atto')) return response;
  const value = await response.json();
  value.data.atto.articoloHtml = '<h2>Art. 13.</h2><p>Changed legal content.</p>';
  return Response.json(value);
};
input.samples.changed_snapshot = await call('read_article', { cursor: first.structuredContent.cursor });
input.sample_arguments = { changed_snapshot: { cursor: first.structuredContent.cursor } };
globalThis.fetch = async (url, init) => {
  const response = await boundary(url, init);
  if (!String(url).includes('caricaAKN')) return response;
  const graphic = '<attachments><attachment><doc name="Scan"><mainBody><p>Caption</p><img src="/official-scan.pdf"/></mainBody></doc></attachment></attachments>';
  return new Response((await response.text()).replace('</act>', graphic + '</act>'));
};
input.samples.attachment_coverage = await call('read_act', { act_locator, snapshot_date: '2026-10-02' });
input.sample_arguments.attachment_coverage = { act_locator, snapshot_date: '2026-10-02' };
input.sample_arguments.identified_currentness_unknown = { request: 'decreto legislativo 267/2000' };
console.log(JSON.stringify(input));
