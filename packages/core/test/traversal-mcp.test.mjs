import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ActTraversal, registerTraversalTools } from '../dist/index.js';
import { UpstreamRuntime } from '../dist/upstream.js';

const key = Buffer.alloc(32,7), pub = {data_gu:'2000-09-28',codice_redazionale:'000G0304'};
const detail = {success:true,data:{atto:{sottoTitolo:'(000G0304)',annoGU:2000,meseGU:9,giornoGU:28,
  articoloHtml:'<h2>Art. 13.</h2><p>A long article text.</p>',articoloDataInizioVigenza:'20200101',articoloDataFineVigenza:'99999999'}}};
test('MCP replacement reading schemas serialize continuation and typed input errors consistently', async () => {
  const upstream = new UpstreamRuntime(), reader = new ActTraversal({signingKey:key,upstream});
  const server = new McpServer({name:'traversal-contract',version:'0'});
  registerTraversalTools(server,reader,{upstream});
  const client = new Client({name:'traversal-contract',version:'0'});
  const [ct,st] = InMemoryTransport.createLinkedPair();
  const original = globalThis.fetch; let attempts=0;
  globalThis.fetch=async()=>{attempts++;return Response.json(detail)};
  await server.connect(st); await client.connect(ct); await client.listTools();
  try {
    let result = await client.callTool({name:'read_article',arguments:{act_locator:reader.actLocator(pub),article_reference:'13',snapshot_date:'2026-10-02',max_chars:5}});
    assert.equal(result.structuredContent.outcome,'found');
    assert.equal(result.structuredContent.progress,'more');
    assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
    let text=result.structuredContent.content.text;
    while(result.structuredContent.progress==='more') {
      result=await client.callTool({name:'read_article',arguments:{cursor:result.structuredContent.cursor}});
      text+=result.structuredContent.content.text;
    }
    assert.equal(text,'Art. 13. A long article text.');
    const before=attempts;
    const error=await client.callTool({name:'list_articles',arguments:{act_locator:reader.actLocator(pub),cursor:'invented'}});
    assert.equal(error.isError,true);
    assert.equal(error.structuredContent.error.category,'invalid_input');
    assert.equal(attempts,before);
  } finally {globalThis.fetch=original;await client.close();await server.close();}
});
