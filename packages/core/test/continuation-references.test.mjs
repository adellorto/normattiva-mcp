import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync, deflateRawSync, inflateRawSync } from 'node:zlib';
import { createHmac } from 'node:crypto';
import { ActTraversal } from '../dist/traversal.js';
import { installTraversalBoundary, signingKey, publication } from './fixtures/traversal-upstream.mjs';

test('bounded article references retain exact text and frozen dates across fresh readers', async () => {
  const original = globalThis.fetch;
  installTraversalBoundary();
  try {
    const reader = new ActTraversal({ signingKey });
    const first = await reader.readArticle({ act_locator: reader.actLocator(publication),
      article_reference: '13', snapshot_date: '2026-10-02', max_chars: 4 });
    assert.ok(first.cursor.length <= 650, `Article cursor has ${first.cursor.length} characters`);
    const second = await new ActTraversal({ signingKey }).readArticle({ cursor: first.cursor, max_chars: 100 });
    assert.equal(first.content.text + second.content.text, 'Art. 13. Fixture text 13.');
    assert.equal(second.requested.snapshot_date, '2026-10-02');
    assert.equal(second.progress, 'complete');
  } finally { globalThis.fetch = original; }
});

test('previous n1 reading references resume without replacing their frozen representation', async () => {
  const original = globalThis.fetch;
  installTraversalBoundary();
  const saved = JSON.parse(gunzipSync(readFileSync(new URL('../../../docs/implementation/release-model-input.json.gz', import.meta.url))));
  try {
    const result = await new ActTraversal({ signingKey }).readArticle({ cursor: saved.samples.article_more.structuredContent.cursor, max_chars: 100 });
    assert.equal(saved.samples.article_more.structuredContent.content.text + result.content.text, 'Art. 13. Fixture text 13.');
    assert.equal(result.requested.snapshot_date, saved.samples.article_more.structuredContent.requested.snapshot_date);
    const index = await new ActTraversal({ signingKey, cacheBytes: 0 }).listArticles({ cursor: saved.samples.index_more.structuredContent.traversal.cursor });
    assert.equal(index.traversal.items[0].label, '20');
    const reading = await new ActTraversal({ signingKey, cacheBytes: 0 }).readAct({ cursor: saved.samples.reading_more.structuredContent.traversal.cursor, max_chars: 100 });
    assert.equal(reading.traversal.items[0].segments[0].text.startsWith(' 13.'), true);
  } finally { globalThis.fetch = original; }
});

test('compact references reject alterations, incompatible versions, inflation bombs and different trust before acquisition', async () => {
  const original = globalThis.fetch;
  installTraversalBoundary();
  try {
    const reader = new ActTraversal({ signingKey });
    const first = await reader.readArticle({ act_locator: reader.actLocator(publication), article_reference: '13', snapshot_date: '2026-10-02', max_chars: 4 });
    const token = first.cursor;
    const body = token.slice(3).split('.')[0];
    const signed = data => {
      const body = deflateRawSync(Buffer.from(JSON.stringify(data))).toString('base64url');
      return `n2_${body}.${createHmac('sha256', signingKey).update(body).digest('base64url')}`;
    };
    const inflated = JSON.parse(inflateRawSync(Buffer.from(body, 'base64url')).toString());
    let attempts = 0;
    globalThis.fetch = async () => { attempts++; throw new Error('Reference must reject before acquisition'); };
    for (const cursor of [token.slice(0, 30) + (token[30] === 'A' ? 'B' : 'A') + token.slice(31),
      token.slice(0, -1), token + 'x', token.replace('n2_', 'n9_'), signed({ ...inflated, v: 9 }),
      signed({ ...inflated, source: 'https://attacker.invalid/' }), signed({ ...inflated, source: 'X'.repeat(100000) })]) {
      await assert.rejects(reader.readArticle({ cursor }), error => error.detail?.category === 'invalid_cursor');
    }
    await assert.rejects(new ActTraversal({ signingKey: Buffer.alloc(32, 9) }).readArticle({ cursor: token }), error => error.detail?.category === 'invalid_cursor');
    await assert.rejects(reader.listArticles({ cursor: token }), error => error.detail?.category === 'invalid_cursor');
    await assert.rejects(reader.readArticle({ cursor: token, snapshot_date: '2026-10-03' }), error => error.detail?.category === 'invalid_input');
    assert.equal(attempts, 0);
  } finally { globalThis.fetch = original; }
});
