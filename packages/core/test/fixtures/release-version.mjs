import { readFile } from 'node:fs/promises';

export const releaseVersion = JSON.parse(await readFile(
  new URL('../../../stdio-server/package.json', import.meta.url), 'utf8',
)).version;
