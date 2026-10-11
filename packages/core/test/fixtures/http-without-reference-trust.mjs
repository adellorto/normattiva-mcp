import assert from 'node:assert/strict';

delete process.env.NORMATTIVA_REFERENCE_KEY;
const { POST } = await import('../../../http-server/api/mcp.ts');

await assert.rejects(POST(new Request('https://fixture.invalid/api/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fixture', version: '1' },
  } }),
})), error => error.detail?.code === 'reference_trust_unconfigured');

console.log('HTTP explicit trust requirement passed');
