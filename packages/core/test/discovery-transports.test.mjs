import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ActDiscovery,registerDiscoveryTools } from '../dist/index.js';
import { UpstreamRuntime } from '../dist/upstream.js';
import { signingKey,installDiscoveryBoundary } from './fixtures/discovery-upstream.mjs';

async function contracts(client) {
  const tools=await client.listTools();
  assert.deepEqual(tools.tools.map(tool=>tool.name),['find_acts','continue_acts']);
  const first=await client.callTool({name:'find_acts',arguments:{request:'trasparenza amministrativa'}});
  assert.equal(first.structuredContent.match,'candidates');
  assert.equal(first.structuredContent.traversal.progress,'more');
  assert.equal(first.structuredContent.traversal.items.length,5);
  assert.deepEqual(JSON.parse(first.content[0].text),first.structuredContent);
  const next=await client.callTool({name:'continue_acts',arguments:{cursor:first.structuredContent.traversal.cursor}});
  assert.equal(next.structuredContent.traversal.progress,'complete');
  assert.equal(next.structuredContent.traversal.items[0].title,'Synthetic act 2:0');
  const error=await client.callTool({name:'continue_acts',arguments:{cursor:'invented'}});
  assert.equal(error.isError,true);
  assert.equal(error.structuredContent.error.category,'invalid_cursor');
}
test('stdio carries shallow discovery and live-corpus continuation',async()=>{
  const client=new Client({name:'discovery-stdio',version:'0'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/discovery-server.mjs',import.meta.url))]}));
  try{await contracts(client)}finally{await client.close()}
});
test('fresh Streamable HTTP servers continue discovery without cached search sessions',async()=>{
  const original=globalThis.fetch;installDiscoveryBoundary();const upstream=new UpstreamRuntime();
  const client=new Client({name:'discovery-http',version:'0'});
  const transport=new StreamableHTTPClientTransport(new URL('https://fixture.invalid/mcp'),{fetch:async(url,init)=>{
    const server=new McpServer({name:'discovery-http',version:'0'});
    registerDiscoveryTools(server,new ActDiscovery({signingKey,upstream}),{upstream});
    const connection=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    await server.connect(connection);
    try{return await connection.handleRequest(new Request(url,init))}finally{await server.close()}
  }});
  try{await client.connect(transport);await contracts(client)}finally{globalThis.fetch=original;await client.close()}
});
