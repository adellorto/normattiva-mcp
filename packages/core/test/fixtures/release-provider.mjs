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
  if (['clarify-invalid', 'repair-invalid'].includes(process.env.RELEASE_PROVIDER_MODE)) {
    const message = process.env.RELEASE_PROVIDER_MODE === 'clarify-invalid'
      ? { role: 'assistant', content: 'Il 31 dicembre 2024 è successivo al 1 gennaio 2024. Quale intervallo intendevi?' }
      : { role: 'assistant', content: null, tool_calls: [{ id: 'fixture_call', type: 'function',
        function: { name: 'find_acts', arguments: JSON.stringify({ request: 'Cerca gli atti emanati dal 1 gennaio 2024 al 31 dicembre 2024.' }) } }] };
    return Response.json({ model: 'fixture-model', choices: [{ message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }], usage: { cost: 0 } });
  }
  if (process.env.RELEASE_PROVIDER_MODE === 'stall') {
    setInterval(() => {}, 1000);
    return await new Promise(() => {});
  }
  return Response.json({ error: { message: `Provider unavailable ${process.env.OPENROUTER_API_KEY}` } }, { status: 503 });
};
