// Bounded release sample using the prototype's OpenRouter connection contract.
// node --env-file=<saved-env> .../release-openrouter.mjs INPUT REPORT [--plan]
// No upstream legal calls: actual MCP schemas/results are replayed to models.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { planDiscovery } from '../../dist/discovery-plan.js';

const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = process.argv[3];
const planOnly = process.argv.includes('--plan');
const models = (process.env.OPENROUTER_MODELS ?? 'qwen/qwen3-14b,deepseek/deepseek-v4.1-flash,meta-llama/llama-3.1-8b-instruct').split(',');
const ceiling = Math.min(1, Number(process.env.OPENROUTER_MAX_COST_USD ?? 1));
assert.ok(Number.isFinite(ceiling) && ceiling > 0);
const repetitions = 2, maxTokens = 1536;
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
const cases = scenarios.map(scenario => ({ id: scenario.id, scenario,
  expected_tool: scenario.route === 'clarify' ? undefined : scenario.route === 'continue' ? 'continue_acts' : 'find_acts',
  cursor: scenario.cursor, messages: [{ role: 'user', content: scenario.prompt }] }));
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
async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
  const value = await response.json();
  if (value.error) throw new Error(`OpenRouter completion error ${value.error.code ?? 'unknown'}`);
  return value;
}
const catalog = new Map((await json('https://openrouter.ai/api/v1/models')).data.map(m => [m.id, m]));
const jobs = [];
for (const id of models) {
  const model = catalog.get(id);
  assert.ok(model?.supported_parameters.includes('tools'), `${id}: tools unavailable`);
  const prompt = Number(model.pricing.prompt), completion = Number(model.pricing.completion);
  assert.ok(Number.isFinite(prompt) && Number.isFinite(completion) && prompt >= 0 && completion >= 0);
  for (let repetition = 1; repetition <= repetitions; repetition++) for (const sample of cases) {
    const body = { model: id, messages: sample.messages, tools, tool_choice: 'auto',
      temperature: 0, max_tokens: maxTokens, parallel_tool_calls: false,
      provider: { require_parameters: true, max_price: { prompt: prompt * 1e6, completion: completion * 1e6 } } };
    // One byte per input token plus extra provider/template/output margin.
    const reserve = (Buffer.byteLength(JSON.stringify(body)) * 2 + 4096) * prompt + maxTokens * 2 * completion;
    jobs.push({ id, model, repetition, sample, body, reserve });
  }
}
const reserve = jobs.reduce((n, j) => n + j.reserve, 0);
const report = { recorded_at: new Date().toISOString(), scope: 'OpenRouter function-tool adapter, production MCP schemas and synthetic caller-visible text. Not named UI/client or deployed acceptance.',
  acceptance: 'pending; automated routing checks cannot establish semantic honesty',
  models: models.map(id => ({ id, pricing: catalog.get(id).pricing })),
  cases: cases.map(sample => ({ id: sample.id, expected_tool: sample.expected_tool })),
  input_sha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  schema_sha256: createHash('sha256').update(JSON.stringify(input.schema)).digest('hex'),
  settings: { repetitions, max_tokens: maxTokens, temperature: 0, parallel_tool_calls: false,
    opt_in_prompts: false, initialization_instructions: false },
  max_cost_usd: ceiling, total_plan_reserve_usd: reserve, recorded_cost_usd: 0,
  accounted_upper_bound_usd: 0, planned_calls: jobs.length, runs: [] };
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ models, planned_calls: jobs.length, reserve_usd: reserve, ceiling_usd: ceiling }));
assert.ok(reserve <= ceiling, 'Full conservative plan exceeds spend limit; reduce models/cases before dispatch.');
if (planOnly) process.exit(0);
const key = process.env.OPENROUTER_API_KEY;
assert.ok(key, 'Load the existing OpenRouter environment file; do not paste a key into source.');
const authorization = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const keyData = (await json('https://openrouter.ai/api/v1/key', { headers: authorization })).data;
if (keyData.limit_remaining != null) assert.ok(reserve <= Number(keyData.limit_remaining), 'Key credit limit is insufficient.');
function validate(sample, message) {
  const errors = [], calls = message.tool_calls ?? [];
  if (sample.scenario?.route === 'clarify' && calls.length) errors.push('missing_cursor_requires_clarification');
  if (sample.expected_tool && (calls.length !== 1 || calls[0].function.name !== sample.expected_tool)) errors.push('wrong_or_missing_tool_route');
  if (!calls.length) return errors;
  let args;
  try { args = JSON.parse(calls[0].function.arguments); } catch { return [...errors, 'invalid_argument_json']; }
  if (sample.cursor && (args.cursor !== sample.cursor || Object.keys(args).some(k => !['cursor', 'max_chars', 'page_size'].includes(k)))) errors.push('fabricated_or_conflicting_cursor');
  const scenario = sample.scenario;
  if (scenario && scenario.route !== 'continue') {
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
for (const job of jobs) {
  if (report.accounted_upper_bound_usd + job.reserve > ceiling) break;
  const started = performance.now();
  const row = { requested_model: job.id, repetition: job.repetition, case: job.sample.id,
    input: job.sample.messages, expected_tool: job.sample.expected_tool, expected_cursor: job.sample.cursor };
  report.runs.push(row);
  // Reserve before dispatch; a timeout/unknown billed result never counts as free.
  report.accounted_upper_bound_usd += job.reserve;
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
    if (typeof cost === 'number' && cost >= 0) {
      row.cost_usd = cost; report.recorded_cost_usd += cost;
      report.accounted_upper_bound_usd += cost - job.reserve;
    }
  } catch (error) { row.blocked_error = error.message; }
  row.elapsed_ms = Math.round(performance.now() - started);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(job.id, job.sample.id, row.blocked_error ?? row.automated_failures, `accounted $${report.accounted_upper_bound_usd.toFixed(4)}`);
  if (row.blocked_error) break;
}
if (report.runs.length !== report.planned_calls || report.runs.some(r => r.blocked_error || r.automated_failures.length)) process.exitCode = 1;
