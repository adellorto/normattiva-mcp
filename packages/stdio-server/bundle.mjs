import { build } from 'esbuild';
import { chmod, rename } from 'node:fs/promises';

const options = { bundle: true, platform: 'node', format: 'esm',
  external: ['zod', '@modelcontextprotocol/sdk', '@modelcontextprotocol/sdk/*'] };
await build({ ...options, entryPoints: ['dist/index.js'], outfile: 'dist/index.bundled.mjs' });
// The runtime resolves this sibling through import.meta.url. It must be a
// standalone bundle too: npm consumers do not install the private core package.
await build({ ...options, entryPoints: ['../core/dist/act-parser-worker.js'], outfile: 'dist/act-parser-worker.js' });
await rename('dist/index.bundled.mjs', 'dist/index.js');
await chmod('dist/index.js', 0o755);
