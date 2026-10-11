import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { signingKey } from './traversal-upstream.mjs';
import { checkContracts } from './public-contracts.mjs';
import { releaseVersion } from './release-version.mjs';
import './public-upstream.mjs';
process.env.NORMATTIVA_REFERENCE_KEY = signingKey.toString('hex');
try {
  const { POST, OPTIONS } = await import('../../../http-server/api/mcp.ts');
  const preflight = await OPTIONS(new Request('https://fixture.invalid/api/mcp', { method: 'OPTIONS' }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
  const client = new Client({ name: 'http-contract', version: '0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://fixture.invalid/api/mcp'), {
    fetch: async (url, init) => {
      const response = await POST(new Request(url, init));
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      return response;
    },
  });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().version, releaseVersion);
    await checkContracts(client);
  }
  finally { await client.close(); }
  console.log('HTTP public contracts passed');
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
