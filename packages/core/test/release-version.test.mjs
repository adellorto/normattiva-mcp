import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { releaseVersion } from './fixtures/release-version.mjs';

const root = new URL('../../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('the release packages report one coordinated version', async () => {
  const manifests = await Promise.all([
    'packages/core/package.json',
    'packages/stdio-server/package.json',
    'packages/http-server/package.json',
  ].map(async path => JSON.parse(await read(path))));
  assert.deepEqual(manifests.map(manifest => manifest.version), [
    releaseVersion,
    releaseVersion,
    releaseVersion,
  ]);
});

test('the release landing pages advertise the coordinated package without manual local trust setup', async () => {
  for (const path of ['packages/http-server/index.html', 'packages/http-server/it/index.html']) {
    const page = await read(path);
    assert.match(page, new RegExp(`v${releaseVersion.replaceAll('.', '\\.')}[^0-9]`));
    assert.match(page, new RegExp(`normattiva-mcp@${releaseVersion.replaceAll('.', '\\.')}`));
    assert.doesNotMatch(page, /NORMATTIVA_REFERENCE_KEY/);
  }
});
