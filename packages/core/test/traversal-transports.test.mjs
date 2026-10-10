import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ActTraversal,registerTraversalTools } from '../dist/index.js';
import { UpstreamRuntime } from '../dist/upstream.js';
import { publication,signingKey,installTraversalBoundary } from './fixtures/traversal-upstream.mjs';
const act_locator=new ActTraversal({signingKey}).actLocator(publication);
async function contracts(client) {
  await client.listTools();
  const first=await client.callTool({name:'list_articles',arguments:{act_locator,snapshot_date:'2026-10-02',page_size:1}});
  assert.equal(first.structuredContent.traversal.progress,'more');
  assert.equal(first.structuredContent.coverage.article_inventory_complete,false);
  const second=await client.callTool({name:'list_articles',arguments:{cursor:first.structuredContent.traversal.cursor}});
  assert.equal(second.structuredContent.traversal.items[0].label,'20');
  assert.equal(second.structuredContent.coverage.article_inventory_complete,true);
  const exact=first.structuredContent.traversal.items[0].article_locator;
  let result=await client.callTool({name:'read_article',arguments:{article_locator:exact,max_chars:4}}),text='';
  for(let calls=0;;calls++){
    assert.ok(calls<20);
    assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
    text+=result.structuredContent.content.text;
    if(result.structuredContent.progress==='complete')break;
    result=await client.callTool({name:'read_article',arguments:{cursor:result.structuredContent.cursor}});
  }
  assert.equal(text,'Art. 13. Fixture text 13.');
  const error=await client.callTool({name:'read_article',arguments:{article_locator:'invented'}});
  assert.equal(error.isError,true);assert.equal(error.structuredContent.error.category,'invalid_locator');
}
test('stdio carries snapshot index and within-article continuation contracts',async()=>{
  const client=new Client({name:'traversal-stdio',version:'0'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/traversal-server.mjs',import.meta.url))]}));
  try{await contracts(client)}finally{await client.close()}
});
test('fresh Streamable HTTP servers resume the same references without cache or sessions',async()=>{
  const original=globalThis.fetch;installTraversalBoundary();const upstream=new UpstreamRuntime();
  const client=new Client({name:'traversal-http',version:'0'});
  const transport=new StreamableHTTPClientTransport(new URL('https://fixture.invalid/mcp'),{fetch:async(url,init)=>{
    const server=new McpServer({name:'traversal-http',version:'0'});
    registerTraversalTools(server,new ActTraversal({signingKey,upstream,cacheBytes:0}),{upstream});
    const connection=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    await server.connect(connection);
    try{return await connection.handleRequest(new Request(url,init))}finally{await server.close()}
  }});
  try{await client.connect(transport);await contracts(client)}finally{globalThis.fetch=original;await client.close()}
});
