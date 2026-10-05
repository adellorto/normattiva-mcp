// A fresh process using the production HTTP handler, never a deployed endpoint.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import './release-upstream.mjs';

try {
  const { POST } = await import('../../../http-server/api/mcp.ts');
  const client = new Client({ name: 'release-portability', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('https://fixture.invalid/api/mcp'), {
    fetch: (url, init) => POST(new Request(url, init)),
  }));
  const result = await client.callTool(JSON.parse(process.argv[2]));
  await client.close();
  console.log(JSON.stringify(result));
  process.exit(0); // mcp-handler owns a persistent cleanup timer.
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
