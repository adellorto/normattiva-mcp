// Offline OpenRouter boundary for spending/checkpoint regressions. No network.
import { appendFileSync, writeFileSync } from 'node:fs';
let attempts = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('/models')) return Response.json({ data: process.env.RELEASE_PROVIDER_MODE === 'default-scope'
    ? ['qwen/qwen3-14b', 'deepseek/deepseek-v4.1-flash'].map(id => ({ id,
      pricing: { prompt: '0.00000012', completion: '0.00000024' }, supported_parameters: ['tools'] }))
    : [{ id: 'fixture-model', pricing: { prompt: '0.00000012', completion: '0.00000024' }, supported_parameters: ['tools'] }] });
  if (String(url).endsWith('/key')) return Response.json({ data: { limit_remaining: 1 } });
  if (String(url).endsWith('/fixture-model/endpoints')) return Response.json({ data: { endpoints: [{
    tag: 'fixture/fp8', provider_name: 'Fixture provider', status: 0,
    pricing: process.env.RELEASE_PROVIDER_MODE === 'pinned-expensive'
      ? { prompt: '0.00001', completion: '0.00002' } : { prompt: '0.0000002', completion: '0.0000003' },
    supported_parameters: ['tools', 'tool_choice', 'temperature', 'max_tokens'],
  }] } });
  if (!String(url).endsWith('/chat/completions')) throw new Error('Unexpected fixture destination');
  attempts++;
  writeFileSync(process.env.RELEASE_ATTEMPT_FILE, String(attempts));
  if (process.env.RELEASE_TIMING_FILE) appendFileSync(process.env.RELEASE_TIMING_FILE, Date.now() + '\n');
  const body = JSON.parse(init.body);
  if (process.env.RELEASE_PROVIDER_MODE === 'pinned-provider') {
    if (JSON.stringify(body.provider.only) !== '["fixture/fp8"]' || body.provider.allow_fallbacks !== false
      || Math.abs(body.provider.max_price.prompt - .2) > 1e-12 || Math.abs(body.provider.max_price.completion - .3) > 1e-12) {
      return Response.json({ error: { message: 'The selected endpoint and its actual prices must bound dispatch' } }, { status: 422 });
    }
    return Response.json({ model: 'fixture-model', provider: 'Fixture provider', choices: [{ finish_reason: 'tool_calls', message: {
      role: 'assistant', content: null, tool_calls: [{ id: 'fixture_pinned', type: 'function', function: {
        name: 'find_acts', arguments: JSON.stringify({ request: body.messages[0].content }),
      } }],
    } }], usage: { cost: .0002 } });
  }
  if ('parallel_tool_calls' in body) return Response.json({ error: { message: 'Unsupported provider parameter' } }, { status: 404 });
  if (process.env.RELEASE_PROVIDER_MODE === 'discovery-continuation') {
    const prior = body.messages.find(message => message.role === 'tool');
    const cursor = prior && JSON.parse(prior.content).traversal.cursor;
    if (!cursor || !body.messages.at(-1).content.includes(cursor)) return Response.json({ error: { message: 'Continuation must use an actual previously returned reference' } }, { status: 422 });
    return Response.json({ model: 'fixture-model', choices: [{ finish_reason: 'tool_calls', message: {
      role: 'assistant', content: null, tool_calls: [{ id: 'fixture_next', type: 'function', function: {
        name: 'continue_acts', arguments: JSON.stringify({ cursor }),
      } }],
    } }], usage: { cost: 0 } });
  }
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
