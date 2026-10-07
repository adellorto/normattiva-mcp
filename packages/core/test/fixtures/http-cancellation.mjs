// Actual default HTTP handler and upstream fixture; no deployed or live traffic.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { signingKey } from './traversal-upstream.mjs';
import './public-upstream.mjs';

process.env.NORMATTIVA_REFERENCE_KEY = signingKey.toString('hex');
const upstream = globalThis.fetch;
const events = [];
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('dettaglio-atto')) return upstream(url, init);
  const article = JSON.parse(init.body).idArticolo;
  events.push({ event: 'started', article });
  if (article !== 997 && article !== 998) return upstream(url, init);
  return new Promise((resolve, reject) => {
    const abort = () => { events.push({ event: 'aborted', article }); reject(init.signal.reason); };
    if (init.signal.aborted) abort();
    else init.signal.addEventListener('abort', abort, { once: true });
  });
};
const { POST } = await import('../../../http-server/api/mcp.ts');
const url = 'https://fixture.invalid/api/mcp';
const headers = {
  'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
  'Mcp-Protocol-Version': '2025-11-25',
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  const deadline = Date.now() + 750;
  while (!check() && Date.now() < deadline) await pause(5);
  assert.ok(check(), message);
}
const client = new Client({ name: 'http-cancellation-contract', version: '1' });
const transport = new StreamableHTTPClientTransport(new URL(url), {
  fetch: (input, init) => POST(new Request(input, init)),
});
try {
  await client.connect(transport);
  const found = (await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } })).structuredContent;
  assert.equal(found.match, 'identified');
  const act_locator = found.traversal.items[0].act_locator;
  const read = (article_reference, id = 100, signal, sessionId = transport.sessionId) => POST(new Request(url, {
    method: 'POST', headers: { ...headers, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) }, signal,
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: {
      name: 'read_article', arguments: { act_locator, article_reference, snapshot_date: '2026-10-02' },
    } }),
  }));
  const notify = (requestId, sessionId = transport.sessionId) => POST(new Request(url, {
    method: 'POST', headers: { ...headers, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId } }),
  }));
  const mode = process.argv[2];
  if (mode === 'pre-abort') {
    const controller = new AbortController();
    controller.abort();
    assert.equal((await read('997', 100, controller.signal)).status, 202);
    await client.ping();
    assert.equal(events.length, 0, 'no dispatch after an already aborted signal');
    assert.equal((await (await read('13')).json()).result.structuredContent.outcome, 'found');
    await client.close();
    console.log('HTTP cancellation contracts passed');
    process.exit(0);
  }
  if (mode === 'batch') {
    const response = await POST(new Request(url, { method: 'POST', headers,
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 100, method: 'ping' },
        { jsonrpc: '2.0', id: 101, method: 'ping' },
      ]),
    }));
    assert.equal(response.status, 400, 'one MCP message per HTTP POST');
    assert.equal(events.length, 0);
    await client.close();
    console.log('HTTP cancellation contracts passed');
    process.exit(0);
  }
  const controller = new AbortController();
  const pending = read('997', 100, controller.signal).catch(error => error);
  await until(() => events.some(e => e.event === 'started' && e.article === 997), 'active upstream reached');
  if (mode === 'request-abort') {
    controller.abort();
    await until(() => events.some(e => e.event === 'aborted' && e.article === 997), 'HTTP Request abort must reach upstream');
  } else if (mode === 'queued' || mode === 'queued-abort') {
    const queuedController = new AbortController();
    const queued = read('998', 101, queuedController.signal);
    // A ping on this namespace confirms that the preceding POST was dispatched.
    await client.ping();
    assert.equal(events.some(e => e.article === 998), false);
    if (mode === 'queued') assert.equal((await notify(101)).status, 202);
    else queuedController.abort();
    assert.equal((await queued).status, 202);
    assert.equal(events.some(e => e.article === 998), false, 'cancelled queued call must not reach upstream');
    assert.equal(events.some(e => e.event === 'aborted' && e.article === 997), false, 'cancelling queued call must not cancel active call');
    assert.equal((await notify(100)).status, 202);
    await until(() => events.some(e => e.event === 'aborted' && e.article === 997), 'protocol cancellation must reach active upstream');
  } else if (mode === 'isolation') {
    assert.match(transport.sessionId, /^h1_/);
    const stateless = await POST(new Request(url, { method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 100 } }),
    }));
    assert.equal(stateless.status, 202);
    const tampered = transport.sessionId.slice(0, -1) + (transport.sessionId.endsWith('A') ? 'B' : 'A');
    assert.equal((await notify(100, tampered)).status, 404);
    for (const invalid of [undefined, { id: 100 }, '100', 999]) assert.equal((await notify(invalid)).status, 202);
    assert.equal(events.some(e => e.event === 'aborted'), false, 'invalid or unscoped cancellation must not target another request');
    const otherClient = new Client({ name: 'other-http-client', version: '1' });
    const otherTransport = new StreamableHTTPClientTransport(new URL(url), {
      fetch: (input, init) => POST(new Request(input, init)),
    });
    await otherClient.connect(otherTransport);
    assert.notEqual(otherTransport.sessionId, transport.sessionId);
    const otherPending = read('998', 100, undefined, otherTransport.sessionId);
    await otherClient.ping();
    assert.equal((await notify(100, otherTransport.sessionId)).status, 202);
    assert.equal((await otherPending).status, 202);
    assert.equal(events.some(e => e.event === 'aborted'), false, 'same id in another client must not cancel active caller');
    assert.equal(events.some(e => e.article === 998), false);
    assert.equal((await read('13', 100)).status, 409, 'duplicate active id must not overwrite cancellation target');
    assert.equal((await notify(100)).status, 202);
    await pending;
    assert.equal((await notify(100)).status, 202, 'late notification is harmless after cleanup');
    const reused = await read('13', 100);
    assert.equal((await reused.json()).result.structuredContent.outcome, 'found', 'completed request registration was removed');
    await otherClient.close();
  } else if (mode === 'request-shaped-cancellation') {
    const response = await Promise.race([
      POST(new Request(url, { method: 'POST', headers: { ...headers, 'Mcp-Session-Id': transport.sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id: 103, method: 'notifications/cancelled', params: { requestId: 100 } }),
      })),
      pause(750).then(() => null),
    ]);
    assert.equal(events.some(e => e.event === 'aborted'), false, 'only a notification may cancel the original call');
    assert.ok(response, 'a request-shaped cancellation must receive its own RPC error');
    assert.equal((await response.json()).error.code, -32601);
    assert.equal((await notify(100)).status, 202);
    await pending;
  } else if (mode === 'other-instance') {
    // Distinct handler module state, shared process upstream and preserved trust.
    // This isolates routing memory without replacing either production handler.
    const { POST: otherPOST } = await import('../../../http-server/api/mcp.ts?other-instance');
    const scopedHeaders = { ...headers, 'Mcp-Session-Id': transport.sessionId };
    const ping = await otherPOST(new Request(url, { method: 'POST', headers: scopedHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 102, method: 'ping' }),
    }));
    assert.equal(ping.status, 200, 'namespace remains valid without session storage');
    const ignored = await otherPOST(new Request(url, { method: 'POST', headers: scopedHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 100 } }),
    }));
    assert.equal(ignored.status, 202);
    assert.equal(events.some(e => e.event === 'aborted'), false, 'cross-instance cancellation is not claimed');
    assert.equal((await notify(100)).status, 202);
    await until(() => events.some(e => e.event === 'aborted' && e.article === 997), 'originating instance cancellation reaches upstream');
  } else {
    assert.fail('unknown fixture mode');
  }
  const healthy = await client.callTool({ name: 'read_article', arguments: {
    act_locator, article_reference: '13', snapshot_date: '2026-10-02',
  } }, undefined, { timeout: 1000 });
  assert.equal(healthy.structuredContent.outcome, 'found');
  await pending;
  assert.equal(events.filter(e => e.event === 'started' && e.article === 997).length, 1, 'cancellation must not retry');
  console.log('HTTP cancellation contracts passed');
  await client.close();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
