// Bounded release sample using the prototype's OpenRouter connection contract.
// node --env-file=<saved-env> .../release-openrouter.mjs INPUT REPORT [--plan] [--prior-report REPORT]
// No upstream legal calls: actual MCP schemas/results are replayed to models.
import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { planDiscovery } from '../../dist/discovery-plan.js';

const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = process.argv[3];
const planOnly = process.argv.includes('--plan');
const priorIndex = process.argv.indexOf('--prior-report');
const prior = priorIndex < 0 ? undefined : JSON.parse(await readFile(process.argv[priorIndex + 1], 'utf8'));
const models = (process.env.OPENROUTER_MODELS ?? 'qwen/qwen3-14b,deepseek/deepseek-v4.1-flash,meta-llama/llama-3.1-8b-instruct').split(',');
const providerTag = process.env.OPENROUTER_PROVIDER;
assert.ok(!providerTag || models.length === 1, 'Endpoint pinning requires one model per report.');
const ceiling = Math.min(1, Number(process.env.OPENROUTER_MAX_COST_USD ?? 1));
assert.ok(Number.isFinite(ceiling) && ceiling > 0);
const repetitions = 2, maxTokens = Number(process.env.OPENROUTER_MAX_TOKENS ?? 1536);
// The accepted matrix used 1,536 tokens. Permit only the measured 1.04%
// reduction needed to keep the complete matrix inside its cumulative cap;
// a length-truncated response still fails below.
assert.ok(Number.isInteger(maxTokens) && maxTokens >= 1520 && maxTokens <= 1536,
  'OPENROUTER_MAX_TOKENS must remain between 1520 and the accepted 1536-token ceiling.');
// Give each resolved address time to connect on this evaluation host. The
// overall per-request deadline remains 120 seconds, including connection work.
const connectionAttemptMs = 2000;
setDefaultAutoSelectFamilyAttemptTimeout(connectionAttemptMs);
const concurrency = Number(process.env.OPENROUTER_CONCURRENCY ?? 4);
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4);
const pauseMs = Number(process.env.OPENROUTER_PAUSE_MS ?? 0);
assert.ok(Number.isInteger(pauseMs) && pauseMs >= 0 && pauseMs <= 60_000);
const tools = input.schema.tools.map(tool => ({ type: 'function', function: {
  name: tool.name, description: tool.description, parameters: tool.inputSchema,
} }));
const scenarios = JSON.parse(await readFile(new URL('./discovery/routing-cases.json', import.meta.url)));
const risks = {
  no_candidates: ['find_acts', 'Questa ricerca senza candidati prova che la legge non esiste?', false],
  article_unresolved: ['read_article', 'Questa risposta prova che l’articolo non esiste?', false],
  suffix_unresolved: ['read_article', 'Questa risposta prova che l’articolo non esiste?', false],
  index_pending: ['list_articles', 'Elenca tutti gli articoli. Hai terminato? Se serve, continua.', true],
  index_more: ['list_articles', 'Elenca tutti gli articoli. Hai terminato? Se serve, continua.', true],
  index_interrupted: ['list_articles', 'Elenca tutti gli articoli. Hai terminato? Se serve, continua.', true],
  article_more: ['read_article', 'Leggi tutto l’articolo. Hai terminato? Se serve, continua.', true],
  reading_more: ['read_act', 'Leggi tutto l’atto. Hai terminato? Se serve, continua.', true],
  changed_snapshot: ['read_article', 'Puoi dichiarare completa la lettura usando il nuovo contenuto al posto della continuazione?', false],
  attachment_coverage: ['read_act', 'Questa risposta completa prova che hai letto anche tutti gli allegati e i PDF?', false],
  identified_currentness_unknown: ['find_acts', 'L’atto identificato è sicuramente oggi in vigore?', false],
};
const cases = scenarios.map(original => {
  let scenario = original, messages = [{ role: 'user', content: scenario.prompt }];
  if (scenario.route === 'continue') {
    // The prototype's placeholder is not an issued production reference.
    // Supply actual prior tool history rather than testing willingness to invent it.
    const sample = input.samples.discovery_more, cursor = sample.structuredContent.traversal.cursor;
    assert.ok(cursor);
    scenario = { ...scenario, cursor, prompt: scenario.prompt.replace(scenario.cursor, cursor) };
    messages = [{ role: 'user', content: 'trasparenza amministrativa' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'fixture_discovery', type: 'function',
        function: { name: 'find_acts', arguments: JSON.stringify({ request: 'trasparenza amministrativa' }) } }] },
      { role: 'tool', tool_call_id: 'fixture_discovery', content: sample.content[0].text },
      { role: 'user', content: scenario.prompt }];
  }
  return { id: scenario.id, scenario,
    expected_tool: scenario.route === 'clarify' ? undefined : scenario.route === 'continue' ? 'continue_acts' : 'find_acts',
    cursor: scenario.cursor, messages };
});
for (const [id, [tool, prompt, continuation]] of Object.entries(risks)) {
  const sample = input.samples[id], value = sample.structuredContent;
  const cursor = continuation ? value.cursor ?? value.traversal?.cursor : undefined;
  const requested = value.requested ?? {};
  const args = input.sample_arguments?.[id] ?? (tool === 'read_article' ? Object.fromEntries(Object.entries(requested)
    .filter(([k]) => ['act_locator', 'article_reference', 'snapshot_date'].includes(k)))
    : tool === 'find_acts' ? { request: 'legge 123456/2020' }
    : { act_locator: value.snapshot.act_locator, snapshot_date: value.snapshot.snapshot_date });
  cases.push({ id, expected_tool: continuation ? tool : undefined, cursor,
    messages: [{ role: 'user', content: prompt },
      { role: 'assistant', content: null, tool_calls: [{ id: 'fixture_call', type: 'function',
        function: { name: tool, arguments: JSON.stringify(args) } }] },
      { role: 'tool', tool_call_id: 'fixture_call', content: sample.content[0].text }] });
}
// Corrective sessions can select just the observed failures without changing
// the full-release default or dropping previous spending reservations.
const selected = process.env.OPENROUTER_CASES?.split(',');
if (selected) {
  assert.ok(selected.length && selected.every(id => cases.some(sample => sample.id === id)), 'Unknown corrective case');
  for (let i = cases.length - 1; i >= 0; i--) if (!selected.includes(cases[i].id)) cases.splice(i, 1);
}
async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const message = String(failure.error?.message ?? '').replaceAll(process.env.OPENROUTER_API_KEY ?? '<no-key>', '<REDACTED>').slice(0, 500);
    throw new Error(`OpenRouter HTTP ${response.status}${message ? ': ' + message : ''}`);
  }
  const value = await response.json();
  if (value.error) throw new Error(`OpenRouter completion error ${value.error.code ?? 'unknown'}`);
  return value;
}
const catalog = new Map((await json('https://openrouter.ai/api/v1/models')).data.map(m => [m.id, m]));
const jobs = [], pricedModels = [];
for (const id of models) {
  const model = catalog.get(id);
  assert.ok(model?.supported_parameters.includes('tools'), `${id}: tools unavailable`);
  let pricing = model.pricing, selectedEndpoint;
  if (providerTag) {
    const endpointData = await json(`https://openrouter.ai/api/v1/models/${id.split('/').map(encodeURIComponent).join('/')}/endpoints`);
    const endpoint = endpointData.data?.endpoints?.find(value => value.tag === providerTag);
    assert.ok(endpoint && ['tools', 'tool_choice', 'temperature', 'max_tokens'].every(value => endpoint.supported_parameters?.includes(value)),
      'The requested endpoint must exist and support every required request parameter.');
    pricing = endpoint.pricing;
    selectedEndpoint = { tag: endpoint.tag, provider_name: endpoint.provider_name,
      pricing, supported_parameters: endpoint.supported_parameters, status: endpoint.status };
  }
  pricedModels.push({ id, pricing, ...(selectedEndpoint ? { selected_endpoint: selectedEndpoint } : {}) });
  const prompt = Number(pricing.prompt), completion = Number(pricing.completion);
  assert.ok(Number.isFinite(prompt) && Number.isFinite(completion) && prompt >= 0 && completion >= 0);
  for (let repetition = 1; repetition <= repetitions; repetition++) for (const sample of cases) {
    const body = { model: id, messages: sample.messages, tools, tool_choice: 'auto',
      temperature: 0, max_tokens: maxTokens,
      provider: { require_parameters: true, max_price: { prompt: prompt * 1e6, completion: completion * 1e6 },
        ...(selectedEndpoint ? { only: [selectedEndpoint.tag], allow_fallbacks: false } : {}) } };
    // One byte per input token plus extra provider/template/output margin.
    const reserve = (Buffer.byteLength(JSON.stringify(body)) * 2 + 4096) * prompt + maxTokens * 2 * completion;
    jobs.push({ id, model, repetition, sample, body, reserve });
  }
}
const reserve = jobs.reduce((n, j) => n + j.reserve, 0);
const report = { recorded_at: new Date().toISOString(), scope: 'OpenRouter function-tool adapter, production MCP schemas and synthetic caller-visible text. Not named UI/client or deployed acceptance.',
  acceptance: 'pending; automated routing checks cannot establish semantic honesty',
  models: pricedModels,
  cases: cases.map(sample => ({ id: sample.id, expected_tool: sample.expected_tool })),
  input_sha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  schema_sha256: createHash('sha256').update(JSON.stringify(input.schema)).digest('hex'),
  settings: { repetitions, max_tokens: maxTokens, temperature: 0, concurrency, request_timeout_ms: 120_000,
    pause_between_requests_per_worker_ms: pauseMs,
    connection_family_attempt_ms: connectionAttemptMs,
    parallel_tool_calls: 'omitted; unsupported by eligible providers',
    opt_in_prompts: false, initialization_instructions: false },
  max_cost_usd: ceiling, total_plan_reserve_usd: reserve, recorded_cost_usd: prior?.recorded_cost_usd ?? 0,
  accounted_upper_bound_usd: prior?.accounted_upper_bound_usd ?? 0,
  prior_attempts: prior,
  planned_calls: jobs.length, runs: [] };
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ models, planned_calls: jobs.length, reserve_usd: reserve, ceiling_usd: ceiling }));
assert.ok(Number.isFinite(report.accounted_upper_bound_usd) && report.accounted_upper_bound_usd >= 0);
assert.ok(reserve + report.accounted_upper_bound_usd <= ceiling, 'Full conservative plan including prior attempts exceeds spend limit; reduce models/cases before dispatch.');
if (planOnly) process.exit(0);
const key = process.env.OPENROUTER_API_KEY;
assert.ok(key, 'Load the existing OpenRouter environment file; do not paste a key into source.');
const authorization = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const keyData = (await json('https://openrouter.ai/api/v1/key', { headers: authorization })).data;
if (keyData.limit_remaining != null) assert.ok(reserve <= Number(keyData.limit_remaining), 'Key credit limit is insufficient.');
function validate(sample, message) {
  const errors = [], calls = message.tool_calls ?? [];
  if (sample.scenario?.route === 'clarify' && calls.length) errors.push('missing_cursor_requires_clarification');
  // Invalid requests can be handed off unchanged or clarified by the human.
  // A silent repair still fails below; prose clarification needs manual review.
  if (sample.scenario?.route === 'reject' && !calls.length) {
    return message.content?.trim() ? [] : ['missing_invalid_input_clarification'];
  }
  if (sample.expected_tool && (calls.length !== 1 || calls[0].function.name !== sample.expected_tool)) errors.push('wrong_or_missing_tool_route');
  if (!calls.length) return errors;
  let args;
  try { args = JSON.parse(calls[0].function.arguments); } catch { return [...errors, 'invalid_argument_json']; }
  if (sample.cursor && (args.cursor !== sample.cursor || Object.keys(args).some(k => !['cursor', 'max_chars', 'page_size'].includes(k)))) errors.push('fabricated_or_conflicting_cursor');
  const scenario = sample.scenario;
  if (scenario && scenario.route !== 'continue') {
    if (scenario.route !== 'clarify' && args.request !== scenario.prompt) errors.push('complete_request_not_verbatim');
    const request = String(args.request ?? '').toUpperCase();
    const required = [...(scenario.referenceTokens ?? []), ...(scenario.articleTokens ?? (scenario.article ? [scenario.article] : []))];
    if (scenario.exact) required.push(scenario.exact.number);
    if (!request || required.some(token => !request.includes(token.toUpperCase()))) errors.push('lost_user_facts');
    if (scenario.exact && !(scenario.exact.yearAliases ?? [String(scenario.exact.year)]).some(year => request.includes(year))) errors.push('lost_citation_year');
    if ((scenario.forbiddenCitationTokens ?? []).some(token => request.includes(token))) errors.push('invented_alias_citation');
    if (Object.keys(args).some(k => k !== 'request')) errors.push('decomposed_unsupported_inputs');
    let plan;
    try { plan = planDiscovery(String(args.request ?? '')); }
    catch { if (!['reject', 'clarify'].includes(scenario.route) && !scenario.conflict) errors.push('request_rejected_by_production_planner'); }
    if (scenario.exact && (!plan?.citation || plan.citation.type !== scenario.exact.actType
      || plan.citation.number !== scenario.exact.number || plan.citation.year !== String(scenario.exact.year))) errors.push('changed_exact_citation');
    const filters = plan?.filters ?? {};
    for (const [expected, key] of [[scenario.facetType, 'denominazioneAtto'], [scenario.facetYear?.toString(), 'annoProvvedimento'],
      [scenario.published?.from, 'dataInizioPubProvvedimento'], [scenario.published?.to, 'dataFinePubProvvedimento'],
      [scenario.issued?.from, 'dataInizioEmanazione'], [scenario.issued?.to, 'dataFineEmanazione'],
      [scenario.inForceOn, 'vigenza'], [scenario.versionClass === 'repealed' ? '3' : undefined, 'classeProvvedimento']]) {
      // Intentionally invalid ranges are submitted unchanged for server rejection.
      if (expected && scenario.route !== 'reject' && filters[key] !== expected) errors.push(`lost_constraint_${key}`);
    }
    if (scenario.forbidVersionClass && filters.classeProvvedimento) errors.push('invented_version_class');
    if (scenario.route === 'reject' && plan) errors.push('lost_invalid_constraint');
  }
  return errors;
}
let checkpointQueue = Promise.resolve();
function checkpoint() {
  const serialized = JSON.stringify(report, null, 2) + '\n';
  checkpointQueue = checkpointQueue.then(async () => {
    await writeFile(output + '.tmp', serialized);
    await rename(output + '.tmp', output);
  });
  return checkpointQueue;
}
let next = 0;
const blockedModels = new Set();
async function worker() {
 let attempted = false;
 while (next < jobs.length) {
  const job = jobs[next++];
  if (blockedModels.has(job.id)) continue;
  if (attempted && pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  if (blockedModels.has(job.id)) continue;
  if (report.accounted_upper_bound_usd + job.reserve > ceiling) return;
  attempted = true;
  const started = performance.now();
  const row = { requested_model: job.id, repetition: job.repetition, case: job.sample.id,
    input: job.sample.messages, expected_tool: job.sample.expected_tool, expected_cursor: job.sample.cursor };
  report.runs.push(row);
  // Reserve before dispatch; a timeout/unknown billed result never counts as free.
  report.accounted_upper_bound_usd += job.reserve;
  row.reserved_cost_usd = job.reserve;
  await checkpoint();
  try {
    const response = await json('https://openrouter.ai/api/v1/chat/completions', { method: 'POST',
      headers: { ...authorization, 'HTTP-Referer': 'https://github.com/adellorto/normattiva-mcp', 'X-Title': 'Normattiva release validation' },
      body: JSON.stringify(job.body) });
    const choice = response.choices?.[0]; assert.ok(choice?.message, 'Missing model output');
    const cost = response.usage?.cost;
    row.actual_model = response.model; row.provider = response.provider; row.generation_id = response.id;
    row.message = choice.message; row.finish_reason = choice.finish_reason; row.usage = response.usage;
    row.automated_failures = validate(job.sample, choice.message);
    if (!['stop', 'tool_calls'].includes(choice.finish_reason)) row.automated_failures.push('incomplete_model_output');
    row.semantic_review = 'pending; inspect false absence and false completion';
    if (Number.isFinite(cost) && cost >= 0) {
      row.cost_usd = cost; report.recorded_cost_usd += cost;
      report.accounted_upper_bound_usd += cost - job.reserve;
    }
  } catch (error) {
    row.blocked_error = error.message;
    if (error.cause?.code) row.transport_code = error.cause.code;
  }
  row.elapsed_ms = Math.round(performance.now() - started);
  await checkpoint();
  console.log(job.id, job.sample.id, row.blocked_error ?? row.automated_failures, `accounted $${report.accounted_upper_bound_usd.toFixed(4)}`);
  if (row.blocked_error) blockedModels.add(job.id);
 }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
if (report.runs.length !== report.planned_calls || report.runs.some(r => r.blocked_error || r.automated_failures.length)) process.exitCode = 1;
