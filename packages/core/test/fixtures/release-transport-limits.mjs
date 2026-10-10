// Real default registration/transport; stalled external upstream, no live traffic.
// Each invocation is isolated. Arguments: stdio|http cancellation|timeout.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { signingKey } from './traversal-upstream.mjs';
const [transportName, mode] = process.argv.slice(2);
assert.ok(['stdio', 'http'].includes(transportName) && ['cancellation', 'timeout'].includes(mode));
const scratch = await mkdtemp(join(tmpdir(), 'normattiva-transport-limits-'));
const eventsFile = join(scratch, 'events.jsonl');
const env = { ...process.env, NORMATTIVA_REFERENCE_KEY: signingKey.toString('hex'), RELEASE_STALL_EVENTS: eventsFile };
let transport;
if (transportName === 'stdio') transport = new StdioClientTransport({ command: process.execPath,
  args: ['--import', fileURLToPath(new URL('./release-stalled-upstream.mjs', import.meta.url)),
    fileURLToPath(new URL('../../../stdio-server/dist/index.js', import.meta.url))], env });
else {
  process.env.NORMATTIVA_REFERENCE_KEY = env.NORMATTIVA_REFERENCE_KEY;
  process.env.RELEASE_STALL_EVENTS = eventsFile;
  await import('./release-stalled-upstream.mjs');
  const { POST } = await import('../../../http-server/api/mcp.ts');
  transport = new StreamableHTTPClientTransport(new URL('https://fixture.invalid/api/mcp'), {
    fetch: (url, init) => POST(new Request(url, init)),
  });
}
const client = new Client({ name: 'release-transport-limits', version: '1' });
const events = async () => (await readFile(eventsFile, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(JSON.parse);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await client.connect(transport);
const found = await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000' } });
assert.equal(found.structuredContent.match, 'identified');
const act_locator = found.structuredContent.traversal.items[0].act_locator;
const controller = new AbortController(), started = performance.now();
const pending = client.callTool({ name: 'read_article', arguments: { act_locator,
  article_reference: '997', snapshot_date: '2026-10-02' } }, undefined, { signal: controller.signal, timeout: 65_000 })
  .then(result => ({ result }), error => ({ error: error.message }));
let gate, result, healthy, cancelledAt;
try {
  if (mode === 'cancellation') {
    const deadline = Date.now() + 5000;
    while (!(await events()).length && Date.now() < deadline) await pause(10);
    assert.ok((await events()).length, 'Stalled upstream not reached');
    cancelledAt = Date.now();
    controller.abort();
    await pause(500);
    const trace = await events();
    gate = trace.length === 2 && trace[1].event === 'aborted' ? 'passed' : 'failed';
    // A second ordinary call must get the released shared lane promptly.
    const normal = client.callTool({ name: 'read_article', arguments: { act_locator,
      article_reference: '13', snapshot_date: '2026-10-02' } }, undefined, { timeout: 1500 })
      .then(value => value.structuredContent, error => ({ error: error.message }));
    healthy = await normal;
    if (healthy.outcome !== 'found') gate = 'failed';
    result = await Promise.race([pending, pause(1000).then(() => ({ pending: true }))]);
  } else {
    result = await pending;
    const trace = await events();
    gate = result.result?.isError === true && result.result.structuredContent?.error?.code === 'upstream_timeout'
      && trace.filter(e => e.event === 'started').length === 2 && trace.filter(e => e.event === 'aborted').length === 2
      && performance.now() - started < 55_000 ? 'passed' : 'failed';
  }
  console.log(JSON.stringify({ recorded_at: new Date().toISOString(), node: process.version,
    transport: transportName, mode, gate, elapsed_ms: performance.now() - started,
    cancelled_at: cancelledAt,
    cancellation_abort_ms: cancelledAt === undefined ? undefined : (await events()).find(e => e.event === 'aborted')?.at - cancelledAt,
    events: await events(), result, healthy,
    scope: 'Default built stdio / production HTTP handler; synthetic stalled upstream, production 20s attempt and 50s shared policy. Not deployed HTTP.' }, null, 2));
} finally { await client.close(); }
process.exit(gate === 'passed' ? 0 : 1); // Also stop failed stalled probes.
