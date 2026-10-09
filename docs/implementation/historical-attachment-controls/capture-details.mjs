import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';

const SOURCE_LIMIT = 24 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_PACE_MS = 1_100;

export async function captureDetails({ root, directoryPrefix, plan, manifest = {} }) {
  const directory = new URL(`${directoryPrefix}-${new Date().toISOString().replaceAll(':', '-')}/`, root);
  mkdirSync(directory, { recursive: true });
  const captures = [];
  const save = () => writeFileSync(new URL('manifest.json', directory), JSON.stringify({ ...manifest, captures }, null, 2) + '\n');
  for (const entry of plan) {
    const record = { ...entry, captured_at: new Date().toISOString() };
    captures.push(record); save();
    const at = performance.now();
    try {
      const response = await fetch(entry.url, { method: 'POST', headers: {
        'Content-Type': 'application/json', Origin: 'https://dati.normattiva.it',
        'User-Agent': 'normattiva-mcp/0.2.0 research',
      }, body: JSON.stringify(entry.request), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      record.status = response.status;
      const chunks = []; record.decoded_bytes = 0;
      for await (const chunk of response.body) {
        record.decoded_bytes += chunk.length;
        assert.ok(record.decoded_bytes <= SOURCE_LIMIT, 'Decoded source limit exceeded');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      record.file = `${entry.name}.json.gz`;
      record.sha256 = createHash('sha256').update(body).digest('hex');
      writeFileSync(new URL(record.file, directory), gzipSync(body));
      assert.equal(response.status, 200);
      const envelope = JSON.parse(body.toString());
      assert.equal(envelope.success, true);
      assert.ok(envelope.data?.atto?.articoloHtml);
    } catch (error) {
      record.failure = error.cause?.code ?? error.message;
      process.exitCode = 1;
    } finally { record.elapsed_ms = performance.now() - at; save(); }
    if (record.failure) break;
    await setTimeout(REQUEST_PACE_MS);
  }
  console.log(JSON.stringify({ directory: directory.pathname, attempted: captures.length,
    completed: captures.filter(row => !row.failure).length }));
}
