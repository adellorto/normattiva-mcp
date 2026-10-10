// Matched legacy-format control: same MCP schema, source proof and result fields.
// node .../release-reference-control.mjs CURRENT_INPUT.json > LEGACY_INPUT.json
// Synthetic signing trust only; no legal calls or inference.
import { readFile } from 'node:fs/promises';
import { AuthenticatedTokens, TOKEN_WIRE_FORMATS } from '../../dist/authenticated-tokens.js';
import { ReferenceCodec } from '../../dist/references.js';
import { signingKey } from './traversal-upstream.mjs';

const tokens = new AuthenticatedTokens(signingKey), codec = new ReferenceCodec(signingKey);
const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
function legacy(token) {
  if (token.startsWith('d2_')) {
    const data = tokens.decode('d2_', token, 16384, TOKEN_WIRE_FORMATS.lowercaseCompact);
    return tokens.issue('d1_', data, 16384);
  }
  if (!token.startsWith('n2_') && !token.startsWith('n3_')) return token;
  const currentCursor = token.startsWith('n3_');
  const wire = tokens.decode(currentCursor ? 'n3_' : 'n2_', token, 16384,
    currentCursor ? TOKEN_WIRE_FORMATS.lowercaseCompact : TOKEN_WIRE_FORMATS.compact);
  const data = codec.decode(token, wire.kind, wire.operation);
  if (data.kind === 'cursor' && data.target) data.target = legacy(data.target);
  return tokens.issue('n1_', data, data.kind === 'cursor' ? 16384 : 4096);
}
function visit(value) {
  if (typeof value === 'string') return legacy(value);
  if (Array.isArray(value)) return value.map(visit);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
  return value;
}
for (const sample of Object.values(input.samples)) {
  const converted = visit(sample.structuredContent);
  if (JSON.stringify(converted) !== JSON.stringify(sample.structuredContent)) sample.content[0].text = JSON.stringify(converted);
  sample.structuredContent = converted;
}
if (input.sample_arguments) input.sample_arguments = visit(input.sample_arguments);
console.log(JSON.stringify(input));
