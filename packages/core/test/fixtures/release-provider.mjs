// Offline OpenRouter boundary for spending/checkpoint regressions. No network.
import { writeFileSync } from 'node:fs';
let attempts = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'fixture-model',
    pricing: { prompt: '0.00000012', completion: '0.00000024' }, supported_parameters: ['tools'] }] });
  if (String(url).endsWith('/key')) return Response.json({ data: { limit_remaining: 1 } });
  if (!String(url).endsWith('/chat/completions')) throw new Error('Unexpected fixture destination');
  attempts++;
  writeFileSync(process.env.RELEASE_ATTEMPT_FILE, String(attempts));
  const body = JSON.parse(init.body);
  if ('parallel_tool_calls' in body) return Response.json({ error: { message: 'Unsupported provider parameter' } }, { status: 404 });
  if (process.env.RELEASE_PROVIDER_MODE === 'stall') {
    setInterval(() => {}, 1000);
    return await new Promise(() => {});
  }
  return Response.json({ error: { message: `Provider unavailable ${process.env.OPENROUTER_API_KEY}` } }, { status: 503 });
};
