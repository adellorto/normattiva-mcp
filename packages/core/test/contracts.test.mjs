import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupOutcomeSchema, indexPageSchema, articleInputSchema, articlePageSchema, discoveryContinuationInputSchema } from '../dist/contracts.js';
import { jsonContent } from '../dist/serialization.js';

const requested = { publication: { data_gu: '1988-09-12', codice_redazionale: '088G0458' }, snapshot_date: '2025-01-01', article_reference: '13-bis' };
const evidence = [{ source: 'official_detail', checked_at: '2026-10-05T12:00:00Z' }];

test('absence needs an explicit positive-evidence basis, and unresolved cannot carry legal content', () => {
  const unresolved = { outcome: 'unresolved', reason: 'lookup_inconclusive', requested, evidence };
  assert.equal(lookupOutcomeSchema.safeParse(unresolved).success, true);
  assert.equal(lookupOutcomeSchema.safeParse({ ...unresolved, content: { format: 'text', text: 'guess' } }).success, false);
  assert.equal(lookupOutcomeSchema.safeParse({ ...unresolved, outcome: 'absent' }).success, false);
  assert.equal(lookupOutcomeSchema.safeParse({ ...unresolved, outcome: 'absent', absence_basis: 'http_404' }).success, false);
});

test('locator and cursor inputs reject mixed targets before any traversal work', () => {
  assert.equal(articleInputSchema.safeParse({ article_locator: 'opaque', cursor: 'other' }).success, false);
  assert.equal(articleInputSchema.safeParse({ act_locator: 'act', article_reference: '2043', snapshot_date: '2025-02-29' }).success, false);
  assert.equal(discoveryContinuationInputSchema.safeParse({ request: 'a new search' }).success, false);
});

test('completed traversal cannot include a continuation and interruption requires useful progress', () => {
  const base = { snapshot: { act_locator: 'act', snapshot_date: '2025-01-01', representation_digest: 'sha256:fixture', evidence, newer_version_known: 'unknown' },
    coverage: { article_inventory_complete: true, legal_content_complete: false, unread_attachment_refs: ['attachment'] } };
  const result = indexPageSchema.parse({ ...base, traversal: { progress: 'complete', items: [] } });
  assert.equal(result.coverage.legal_content_complete, false);
  assert.equal(indexPageSchema.safeParse({ ...base, traversal: { progress: 'complete', items: [], cursor: 'resume' } }).success, false);
  assert.equal(indexPageSchema.safeParse({ ...base, traversal: { progress: 'interrupted', items: [], cursor: 'resume',
    failure: { position: 'first', error: { category: 'transport_failure', code: 'upstream_timeout', message: 'Timed out.', retryability: true } }, explanation: 'Incomplete.' } }).success, false);
});

test('serialized bounds account for UTF-8 and both MCP representations', () => {
  assert.throws(() => jsonContent({ text: '😀'.repeat(40_000) }), error => error.detail.code === 'response_limit_exceeded');
});

test('a direct article can resume within content without confusing found with complete', () => {
  const page = { outcome: 'found', reason: 'official_content_returned', requested, evidence,
    content: { format: 'text', text: 'A useful prefix.' }, progress: 'more', cursor: 'exact-offset', explanation: 'More text remains.' };
  assert.equal(articlePageSchema.safeParse(page).success, true);
  assert.equal(articlePageSchema.safeParse({ ...page, progress: 'complete' }).success, false);
  assert.equal(articlePageSchema.safeParse({ ...page, cursor: undefined }).success, false);
  assert.equal(articlePageSchema.safeParse({ ...page, outcome: 'unresolved' }).success, false);
});
