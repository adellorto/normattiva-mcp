import assert from 'node:assert/strict';
export async function checkContracts(client) {
  assert.equal(client.getServerVersion().name, 'normattiva-mcp');
  assert.deepEqual((await client.listTools()).tools.map(t => t.name),
    ['find_acts', 'continue_acts', 'list_articles', 'read_article', 'read_act', 'recent_updates']);
  assert.equal((await client.listResources()).resources.length, 4);
  assert.equal((await client.listPrompts()).prompts.length, 2);
  const resource = await client.readResource({ uri: 'normattiva://tipologiche/denominazioni' });
  assert.equal(JSON.parse(resource.contents[0].text)[0].value, 'DECRETO LEGISLATIVO');
  const discovery = await client.callTool({ name: 'find_acts', arguments: { request: 'decreto legislativo 267/2000 articolo 13' } });
  assert.equal(discovery.structuredContent.match, 'identified');
  assert.equal(discovery.structuredContent.article_reference, '13');
  const act_locator = discovery.structuredContent.traversal.items[0].act_locator;
  const found = await client.callTool({ name: 'read_article', arguments: { act_locator, article_reference: '13', snapshot_date: '2026-10-02', max_chars: 4 } });
  assert.equal(found.structuredContent.outcome, 'found');
  assert.deepEqual(JSON.parse(found.content[0].text), found.structuredContent);
  assert.equal(found.structuredContent.progress, 'more');
  const continued = await client.callTool({ name: 'read_article', arguments: { cursor: found.structuredContent.cursor, max_chars: 100 } });
  assert.equal(found.structuredContent.content.text + continued.structuredContent.content.text, 'Art. 13. Fixture text 13.');
  assert.equal(continued.structuredContent.progress, 'complete');
  const index = await client.callTool({ name: 'list_articles', arguments: { act_locator, snapshot_date: '2026-10-02', page_size: 1 } });
  assert.equal(index.structuredContent.traversal.items[0].label, '13');
  assert.equal(index.structuredContent.traversal.progress, 'more');
  const next = await client.callTool({ name: 'list_articles', arguments: { cursor: index.structuredContent.traversal.cursor } });
  assert.equal(next.structuredContent.traversal.items[0].label, '20');
  assert.equal(next.structuredContent.coverage.article_inventory_complete, true);
  const read = await client.callTool({ name: 'read_act', arguments: { act_locator, snapshot_date: '2026-10-02' } });
  assert.equal(read.structuredContent.traversal.progress, 'complete');
  assert.equal(read.structuredContent.traversal.items.length, 2);
  const updates = await client.callTool({ name: 'recent_updates', arguments: { data_inizio: '2026-10-01', data_fine: '2026-10-02' } });
  const updateRead = await client.callTool({ name: 'read_article', arguments: {
    act_locator: updates.structuredContent.atti[0].act_locator, article_reference: '13', snapshot_date: '2026-10-02',
  } });
  assert.equal(updateRead.structuredContent.outcome, 'unresolved');
  assert.equal(updateRead.structuredContent.reason, 'source_identity_conflict');
  const unresolved = await client.callTool({ name: 'read_article', arguments: { act_locator, article_reference: '999' } });
  assert.equal(unresolved.structuredContent.outcome, 'unresolved');
  const error = await client.callTool({ name: 'read_article', arguments: { article_locator: 'invented' } });
  assert.equal(error.isError, true);
  assert.equal(error.structuredContent.error.category, 'invalid_locator');
  assert.equal(JSON.stringify(error).includes('private dump'), false);
  // Human citations from the recorded model failures are never read references.
  for (const name of ['list_articles', 'read_article', 'read_act']) {
    const rejected = await client.callTool({ name, arguments: {
      act_locator: 'D.P.R. 28 dicembre 2000, n. 445', ...(name === 'read_article' ? { article_reference: '46' } : {}),
    } });
    assert.equal(rejected.isError, true);
    assert.equal(rejected.structuredContent.error.category, 'invalid_locator');
    assert.match(rejected.content[0].text, /invalid_locator/);
  }
  const request = 'Mi serve l’art. 13, comma 1, del decreto legislativo 267/2000 oggi vigente.';
  const complete = await client.callTool({ name: 'find_acts', arguments: { request } });
  assert.equal(complete.structuredContent.interpretation, request);
  assert.equal(complete.structuredContent.article_reference, '13, comma 1');
  assert.equal(complete.structuredContent.match, 'identified');
  assert.equal(complete.structuredContent.traversal.items[0].current, 'unknown');
  assert.deepEqual(JSON.parse(complete.content[0].text), complete.structuredContent);
  for (const request of ['Cerca l’art. 2043 del Codice civile, cioè della Legge 262/1942.',
    'Cerca gli atti emanati dal 31 dicembre 2024 al 1° gennaio 2024.']) {
    const rejected = await client.callTool({ name: 'find_acts', arguments: { request } });
    assert.equal(rejected.isError, true);
    assert.equal(rejected.structuredContent.error.category, 'invalid_input');
  }
}
