#!/usr/bin/env node
/**
 * THROWAWAY PROTOTYPE — do not move into production.
 *
 * Compares first-tool-call routing across the current search_acts interface,
 * exact/discovery splits, and shallow server-routed candidates. It never
 * executes the proposed legal tool calls.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const ENV_PATH = resolve(ROOT, ".env.openrouter.local");
const RUNS_DIR = resolve(HERE, "runs");
const OPENROUTER = "https://openrouter.ai/api/v1";
const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

function parseEnv(text) {
  const result = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

async function loadLocalEnv() {
  if (!existsSync(ENV_PATH)) return;
  const values = parseEnv(await readFile(ENV_PATH, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

await loadLocalEnv();

const config = {
  apiKey: process.env.OPENROUTER_API_KEY || "",
  models: process.env.OPENROUTER_MODELS
    ? process.env.OPENROUTER_MODELS.split(",").map((value) => value.trim()).filter(Boolean)
    : [
        process.env.OPENROUTER_QWEN_MODEL || "qwen/qwen3-14b",
        process.env.OPENROUTER_DEEPSEEK_MODEL || "deepseek/deepseek-v4.1-flash",
        process.env.OPENROUTER_LLAMA_MODEL || "meta-llama/llama-3.1-8b-instruct",
      ],
  maxCostUsd: Number(process.env.OPENROUTER_MAX_COST_USD || "9"),
  repetitions: Number(process.env.OPENROUTER_REPETITIONS || "3"),
  maxOutputTokens: Number(process.env.OPENROUTER_MAX_OUTPUT_TOKENS || "2048"),
  concurrency: Number(process.env.OPENROUTER_CONCURRENCY || "1"),
  timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS || "60000"),
  interfaceIds: (process.env.OPENROUTER_INTERFACES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  scenarioIds: (process.env.OPENROUTER_SCENARIOS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  suite: process.env.OPENROUTER_SUITE || "core",
  providerOnly: (process.env.OPENROUTER_PROVIDERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  qwenNoThink: process.env.OPENROUTER_QWEN_NO_THINK === "1",
};

if (!Number.isFinite(config.maxCostUsd) || config.maxCostUsd <= 0) {
  throw new Error("OPENROUTER_MAX_COST_USD must be a positive number");
}
if (!Number.isInteger(config.repetitions) || config.repetitions < 1 || config.repetitions > 10) {
  throw new Error("OPENROUTER_REPETITIONS must be an integer from 1 to 10");
}
if (
  !Number.isInteger(config.maxOutputTokens) ||
  config.maxOutputTokens < 32 ||
  config.maxOutputTokens > 4096
) {
  throw new Error("OPENROUTER_MAX_OUTPUT_TOKENS must be an integer from 32 to 4096");
}
if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 8) {
  throw new Error("OPENROUTER_CONCURRENCY must be an integer from 1 to 8");
}
if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 10_000 || config.timeoutMs > 300_000) {
  throw new Error("OPENROUTER_TIMEOUT_MS must be an integer from 10000 to 300000");
}
if (!["core", "edge", "all"].includes(config.suite)) {
  throw new Error("OPENROUTER_SUITE must be core, edge, or all");
}

const date = {
  type: "string",
  pattern: DATE_PATTERN,
  description: "ISO date YYYY-MM-DD.",
};

const currentTool = {
  type: "function",
  function: {
    name: "search_acts",
    description:
      "Search Italian legislation on Normattiva by free text, title, act type, year/number, date range, or vigenza class. Returns metadata for each matching atto including codice_redazionale and data_gu, which are required to fetch article text via read_article. The denominazione parameter expects an Italian act-type label like 'LEGGE' or 'DECRETO LEGISLATIVO' — see resource normattiva://tipologiche/denominazioni for the full list. To find acts newly published in Gazzetta Ufficiale within a window, set data_pubblicazione_da and data_pubblicazione_a (this is the right tool for 'what was published recently?', not recent_updates).",
    parameters: {
      type: "object",
      properties: {
        testo: { type: "string", description: "Keywords searched in the act body." },
        titolo: { type: "string", description: "Keywords searched in the act title." },
        denominazione: {
          type: "string",
          description: "Official Italian act-type label, such as LEGGE or DECRETO LEGISLATIVO.",
        },
        anno: { type: "integer", description: "Year of the provvedimento." },
        numero: { type: "string", description: "Number of the provvedimento." },
        mese: { type: "integer", minimum: 1, maximum: 12 },
        giorno: { type: "integer", minimum: 1, maximum: 31 },
        data_emanazione_da: date,
        data_emanazione_a: date,
        data_pubblicazione_da: {
          ...date,
          description:
            "Start of the publication window in Gazzetta Ufficiale (YYYY-MM-DD). Use this (with data_pubblicazione_a) to answer 'which acts were published recently'.",
        },
        data_pubblicazione_a: {
          ...date,
          description: "End of the publication window in Gazzetta Ufficiale (YYYY-MM-DD).",
        },
        classe: {
          type: "string",
          enum: ["1", "2", "3"],
          description:
            "Vigenza class: 1=senza aggiornamenti (single-version atto), 2=aggiornato, 3=abrogato.",
        },
        codice_tipo: {
          type: "string",
          description: "Faceted filter: act-type code (e.g. 'PLE' for LEGGE).",
        },
        data_vigenza: {
          ...date,
          description:
            "Restrict results to atti in force on this date (YYYY-MM-DD). Maps to the spec's 'vigenza' field.",
        },
        page: { type: "integer", minimum: 1, default: 1 },
        per_page: { type: "integer", minimum: 1, maximum: 50, default: 5 },
        order: { type: "string", enum: ["recente", "vecchio"], default: "recente" },
      },
    },
  },
};

const discoveryFilters = {
  type: "object",
  additionalProperties: false,
  properties: {
    act_type: {
      type: "string",
      description: "Official act-type label; validated against the Normattiva typology.",
    },
    year: { type: "integer" },
    issued: {
      type: "object",
      additionalProperties: false,
      properties: { from: date, to: date },
    },
    published: {
      type: "object",
      additionalProperties: false,
      properties: { from: date, to: date },
    },
    in_force_on: date,
    version_class: {
      type: "string",
      enum: ["unamended", "amended", "repealed"],
    },
  },
};

const splitTools = [
  {
    type: "function",
    function: {
      name: "lookup_act",
      description:
        "Verify one act from exact coordinates. Use only when the user or an earlier tool result supplied the exact act type, act number, and year. Never turn a common name or acronym into remembered coordinates. Zero candidates does not prove absence.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          act_type: {
            type: "string",
            description: "Official act type, never a common name or citation.",
          },
          year: { type: "integer" },
          number: { type: "string", description: "Act number, never article number." },
        },
        required: ["act_type", "year", "number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_acts",
      description:
        "Discover candidate acts from a common name, acronym, article reference, or topic; or research acts by filters. article_reference preserves retrieval intent and is never mapped to an act number. Relevance is available only for plain queries plus type/year facets; advanced-only filters use chronological search.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          article_reference: {
            type: "string",
            description: "Human-readable article citation; does not assert existence.",
          },
          scope: { type: "string", enum: ["any", "title", "text"], default: "any" },
          filters: discoveryFilters,
          order: {
            type: "string",
            enum: ["auto", "best_match", "newest", "oldest"],
            default: "auto",
          },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          cursor: {
            type: "string",
            description: "Opaque continuation; when present it must be the only search input.",
          },
        },
      },
    },
  },
];

const exactBranch = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { const: "exact" },
    act_type: {
      type: "string",
      description: "Official act type, never a common name or citation.",
    },
    year: { type: "integer" },
    number: { type: "string", description: "Act number, never article number." },
  },
  required: ["mode", "act_type", "year", "number"],
};

const discoverBranch = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { const: "discover" },
    query: { type: "string", minLength: 1 },
    article_reference: {
      type: "string",
      description: "Human-readable article citation; does not assert existence.",
    },
    act_type: { type: "string" },
    year: { type: "integer" },
    order: {
      type: "string",
      enum: ["auto", "best_match", "newest", "oldest"],
      default: "auto",
    },
    limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
  },
  required: ["mode", "query"],
};

const researchBranch = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { const: "research" },
    query: { type: "string" },
    scope: { type: "string", enum: ["any", "title", "text"], default: "any" },
    filters: discoveryFilters,
    order: { type: "string", enum: ["newest", "oldest"], default: "newest" },
    limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
  },
  required: ["mode", "filters"],
};

const continueBranch = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { const: "continue" },
    cursor: { type: "string" },
  },
  required: ["mode", "cursor"],
};

const singleTools = [
  {
    type: "function",
    function: {
      name: "search_acts",
      description:
        "Find Italian acts through one discriminated interface. exact verifies user-supplied coordinates; discover handles common names, acronyms, article references, and topics; research handles advanced filters; continue resumes an opaque cursor. Fields from different modes cannot be combined.",
      parameters: {
        oneOf: [exactBranch, discoverBranch, researchBranch, continueBranch],
      },
    },
  },
];

const shallowSearchProperties = {
  query: {
    type: "string",
    description: "Common name, acronym, topic, or other discovery text.",
  },
  article_reference: {
    type: "string",
    description: "Article citation kept separate from the act identity.",
  },
  asserted_citation: {
    type: "string",
    description:
      "An unverified act citation stated alongside a common name. Preserve it so the server can detect conflicts; never silently trust it.",
  },
  act_type: {
    type: "string",
    description: "Optional act-type facet. Common abbreviations are accepted and normalized server-side.",
  },
  year: { type: "integer", description: "Optional year facet." },
  issued_from: date,
  issued_to: date,
  published_from: date,
  published_to: date,
  in_force_on: date,
  version_class: {
    type: "string",
    enum: ["unamended", "amended", "repealed"],
  },
  order: {
    type: "string",
    enum: ["auto", "best_match", "newest", "oldest"],
    default: "auto",
  },
  limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
  cursor: {
    type: "string",
    description: "Opaque continuation. When present it must be the only input.",
  },
};

const splitV2Tools = [
  {
    type: "function",
    function: {
      name: "lookup_act",
      description:
        "Verify an act when the user explicitly supplied a complete citation such as 'D.Lgs. 36/2023' or 'Legge 241/1990', including when an article is requested. Pass the citation verbatim; aliases are normalized server-side. Never use a common name or acronym as an exact citation.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          citation: {
            type: "string",
            description: "Complete user-supplied act citation, not a common name and not an article number.",
          },
          article_reference: {
            type: "string",
            description: "Optional requested article, kept separate from the act citation.",
          },
        },
        required: ["citation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_acts",
      description:
        "Discover candidate acts from a common name, acronym, article reference, or topic, or research by filters. Keep article numbers separate. If a claimed citation conflicts with a common name, preserve both query and asserted_citation so the server can reject the conflict. Relevance and advanced routing are chosen server-side.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: shallowSearchProperties,
      },
    },
  },
];

const routerV2Tools = [
  {
    type: "function",
    function: {
      name: "find_acts",
      description:
        "Find Italian acts through a shallow server-routed interface. Put the user's exact citation, common name, acronym, or topic in reference without decomposing it; keep any article separate. Preserve contradictory wording in reference. The server deterministically chooses strict exact lookup, relevance discovery, advanced filtering, rejection, or cursor continuation.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reference: {
            type: "string",
            description:
              "Verbatim-enough act citation, common name, acronym, topic, or conflicting claim for deterministic server routing.",
          },
          article_reference: shallowSearchProperties.article_reference,
          act_type: shallowSearchProperties.act_type,
          year: shallowSearchProperties.year,
          issued_from: date,
          issued_to: date,
          published_from: date,
          published_to: date,
          in_force_on: date,
          version_class: shallowSearchProperties.version_class,
          order: shallowSearchProperties.order,
          limit: shallowSearchProperties.limit,
          cursor: shallowSearchProperties.cursor,
        },
      },
    },
  },
];

const routerV3Tools = [
  {
    type: "function",
    function: {
      name: "find_acts",
      description:
        "Always call for a new Italian legal-research request, including ambiguous or conflicting citations, invalid date ranges, nonexistent acts, and requests for a next page that do not include a literal cursor. In request, write a compact standalone factual restatement: preserve every act name or citation, article, date, constraint, intent, and contradiction, but omit conversational framing and unnecessary punctuation. Do not classify the route, resolve common names, or silently repair conflicts. The server deterministically parses and validates the request, selects exact/relevance/advanced routing, controls fallback, and returns rejection or clarification states.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          request: {
            type: "string",
            description:
              "Compact factual restatement with every citation, article, date, common name, constraint, and conflicting detail preserved.",
          },
        },
        required: ["request"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "continue_acts",
      description:
        "Continue a previous act search only when the user supplied a literal opaque cursor. Never invent or reconstruct a cursor. If no literal cursor is present, use find_acts so the server can return needs_cursor.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: {
            type: "string",
            description: "Literal opaque continuation token copied byte-for-byte.",
          },
        },
        required: ["cursor"],
      },
    },
  },
];

const interfaces = [
  { id: "current", label: "Current wide search_acts", tools: [currentTool] },
  { id: "split", label: "Strict lookup_act + search_acts", tools: splitTools },
  { id: "single", label: "One discriminated search_acts", tools: singleTools },
  { id: "split_v2", label: "Citation-first lookup_act + shallow search_acts", tools: splitV2Tools },
  { id: "router_v2", label: "Shallow find_acts + deterministic server router", tools: routerV2Tools },
  { id: "router_v3", label: "Raw-request find_acts + deterministic server planner", tools: routerV3Tools },
];

const scenarios = [
  {
    id: "civil-code-2043",
    prompt: "Cosa dice l'articolo 2043 del codice civile?",
    route: "discover",
    article: "2043",
  },
  {
    id: "nonexistent-article-320",
    prompt: "Cosa dice l'articolo 320 del D.Lgs 36/2023?",
    route: "exact",
    exact: { actType: "DECRETO LEGISLATIVO", year: 2023, number: "36" },
    article: "320",
  },
  {
    id: "contracts-article-119",
    prompt: "Passami l'art. 119 del D.Lgs 36/2023",
    route: "exact",
    exact: { actType: "DECRETO LEGISLATIVO", year: 2023, number: "36" },
    article: "119",
  },
  {
    id: "cad-article-52",
    prompt: "Mi serve l'articolo 52 del CAD, non so il numero della legge",
    route: "discover",
    article: "52",
  },
  {
    id: "contracts-current-article-108",
    prompt: "E se cerco l'articolo 108 del codice dei contratti?",
    route: "discover",
    article: "108",
  },
  {
    id: "exact-law-241",
    prompt: "Trova la legge 241 del 1990.",
    route: "exact",
    exact: { actType: "LEGGE", year: 1990, number: "241" },
  },
  {
    id: "topic-transparency",
    prompt: "Quali norme riguardano la trasparenza amministrativa?",
    route: "discover",
  },
  {
    id: "publication-window",
    prompt:
      "Quali atti sono stati pubblicati in Gazzetta Ufficiale tra il 1° e il 7 settembre 2026?",
    route: "research",
  },
  {
    id: "faceted-contracts",
    prompt: "Cerca decreti legislativi del 2023 sui contratti pubblici.",
    route: "discover",
  },
  {
    id: "conflicting-civil-code",
    prompt: "Cerca l'articolo 2043 del Codice civile come LEGGE n. 2043 del 1942.",
    route: "discover",
    article: "2043",
    conflict: true,
  },
  {
    id: "edge-law-short-year",
    edge: true,
    prompt: "Mi serve l’art. 3, comma 1, della L. 241/90.",
    route: "exact",
    exact: { actType: "LEGGE", year: 1990, yearAliases: ["1990", "90"], number: "241" },
    articleTokens: ["3", "COMMA 1"],
  },
  {
    id: "edge-dpr-full-date",
    edge: true,
    prompt: "Mostrami l’articolo 46 del D.P.R. 28 dicembre 2000, n. 445.",
    route: "exact",
    exact: {
      actType: "DECRETO DEL PRESIDENTE DELLA REPUBBLICA",
      year: 2000,
      number: "445",
    },
    articleTokens: ["46"],
  },
  {
    id: "edge-regio-decreto",
    edge: true,
    prompt: "R.D. 16 marzo 1942, n. 262: cosa prevede l’art. 2043?",
    route: "exact",
    exact: { actType: "REGIO DECRETO", year: 1942, number: "262" },
    articleTokens: ["2043"],
  },
  {
    id: "edge-decreto-legge",
    edge: true,
    prompt: "Cerca l’articolo 7-bis del decreto-legge n. 76/2020.",
    route: "exact",
    exact: { actType: "DECRETO-LEGGE", year: 2020, number: "76" },
    articleTokens: ["7-BIS"],
  },
  {
    id: "edge-cad-unknown",
    edge: true,
    prompt: "Mi serve l’articolo 52 del CAD, ma non conosco il numero del decreto.",
    route: "discover",
    referenceTokens: ["CAD"],
    articleTokens: ["52"],
    forbiddenCitationTokens: ["82", "2005"],
  },
  {
    id: "edge-tuel-common-name",
    edge: true,
    prompt: "Cosa dice l’art. 42 del TUEL?",
    route: "discover",
    referenceTokens: ["TUEL"],
    articleTokens: ["42"],
    forbiddenCitationTokens: ["267", "2000"],
  },
  {
    id: "edge-current-contracts",
    edge: true,
    prompt: "Cerco l’articolo 108 del codice dei contratti oggi vigente.",
    route: "discover",
    referenceTokens: ["CODICE", "CONTRATTI", "VIGENTE"],
    articleTokens: ["108"],
    forbiddenCitationTokens: ["36", "2023"],
    forbidVersionClass: true,
  },
  {
    id: "edge-faceted-contracts",
    edge: true,
    prompt: "Cerca decreti legislativi del 2023 sui contratti pubblici.",
    route: "discover",
    referenceTokens: ["CONTRATTI", "PUBBLICI"],
    facetType: "DECRETO LEGISLATIVO",
    facetYear: 2023,
  },
  {
    id: "edge-ai-topic",
    edge: true,
    prompt:
      "Quali norme italiane disciplinano l’uso dell’intelligenza artificiale nelle pubbliche amministrazioni?",
    route: "discover",
    referenceTokens: ["INTELLIGENZA ARTIFICIALE", "PUBBLICHE AMMINISTRAZIONI"],
  },
  {
    id: "edge-publication-window",
    edge: true,
    prompt:
      "Quali atti sono stati pubblicati in Gazzetta Ufficiale dal 1° al 7 settembre 2026?",
    route: "research",
    published: { from: "2026-09-01", to: "2026-09-07" },
  },
  {
    id: "edge-issuance-window",
    edge: true,
    prompt: "Quali decreti legislativi sono stati emanati tra il 1° e il 31 marzo 2023?",
    route: "research",
    issued: { from: "2023-03-01", to: "2023-03-31" },
    facetType: "DECRETO LEGISLATIVO",
  },
  {
    id: "edge-in-force-on",
    edge: true,
    prompt: "Quali norme sulla protezione dei dati risultavano in vigore il 25 maggio 2018?",
    route: "research",
    referenceTokens: ["PROTEZIONE", "DATI"],
    inForceOn: "2018-05-25",
  },
  {
    id: "edge-repealed-codes",
    edge: true,
    prompt: "Trova i codici dei contratti pubblici abrogati.",
    route: "research",
    referenceTokens: ["CODICI", "CONTRATTI", "PUBBLICI"],
    versionClass: "repealed",
  },
  {
    id: "edge-conflicting-code",
    edge: true,
    prompt: "Cerca l’art. 2043 del Codice civile, cioè della Legge 262/1942.",
    route: "reject",
    referenceTokens: ["CODICE CIVILE", "LEGGE", "262", "1942"],
    articleTokens: ["2043"],
  },
  {
    id: "edge-reversed-range",
    edge: true,
    prompt: "Cerca gli atti emanati dal 31 dicembre 2024 al 1° gennaio 2024.",
    route: "reject",
    issued: { from: "2024-12-31", to: "2024-01-01" },
  },
  {
    id: "edge-nonexistent-law",
    edge: true,
    prompt: "Cerca la Legge 99999/1990.",
    route: "exact",
    exact: { actType: "LEGGE", year: 1990, number: "99999" },
  },
  {
    id: "edge-cursor",
    edge: true,
    prompt: "Continua con il cursore eyJxIjoiVFVFTCIsInAiOjJ9.",
    route: "continue",
    cursor: "eyJxIjoiVFVFTCIsInAiOjJ9",
  },
  {
    id: "edge-missing-cursor",
    edge: true,
    prompt: "Vai alla pagina successiva dei risultati sul TUEL.",
    route: "clarify",
  },
];

const activeInterfaces = config.interfaceIds.length
  ? interfaces.filter((item) => config.interfaceIds.includes(item.id))
  : interfaces;
const activeScenarios = config.scenarioIds.length
  ? scenarios.filter((item) => config.scenarioIds.includes(item.id))
  : config.suite === "edge"
    ? scenarios.filter((item) => item.edge)
    : config.suite === "all"
      ? scenarios
      : scenarios.filter((item) => !item.edge);

if (activeInterfaces.length !== (config.interfaceIds.length || interfaces.length)) {
  throw new Error("OPENROUTER_INTERFACES contains an unknown interface id");
}
if (config.scenarioIds.length && activeScenarios.length !== config.scenarioIds.length) {
  throw new Error("OPENROUTER_SCENARIOS contains an unknown scenario id");
}

const systemPrompt =
  "You route Italian legal research through the provided tools. Choose only the first tool call needed; do not answer the legal question or invent tool results. An article number is never an act number. Use exact act coordinates only when the user explicitly supplied a coherent exact citation. Otherwise use textual discovery. If no valid first call exists, ask one concise clarification.";

const officialActTypes = new Set([
  "COSTITUZIONE",
  "DECRETO",
  "DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI",
  "DECRETO DEL PRESIDENTE DELLA REPUBBLICA",
  "DECRETO-LEGGE",
  "DECRETO LEGISLATIVO",
  "DECRETO MINISTERIALE",
  "DELIBERAZIONE",
  "LEGGE",
  "LEGGE COSTITUZIONALE",
  "ORDINANZA",
  "REGIO DECRETO",
  "REGIO DECRETO-LEGGE",
  "REGIO DECRETO LEGISLATIVO",
  "REGOLAMENTO",
]);

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function hasArticleReference(args, article) {
  if (!article) return true;
  return String(args.article_reference || "").includes(article);
}

function citationMatchesExact(value, exact) {
  const citation = normalize(value);
  const compact = citation.replace(/[^A-Z0-9]/g, "");
  const typeAliases = {
    "DECRETO LEGISLATIVO": ["DLGS", "DECRETOLEGISLATIVO"],
    "DECRETO DEL PRESIDENTE DELLA REPUBBLICA": [
      "DPR",
      "DECRETODELPRESIDENTEDELLAREPUBBLICA",
    ],
    "REGIO DECRETO": ["RD", "REGIODECRETO"],
    "DECRETO-LEGGE": ["DL", "DECRETOLEGGE"],
    LEGGE: ["LEGGE"],
  };
  let hasType = (typeAliases[exact.actType] || [exact.actType.replace(/[^A-Z0-9]/g, "")]).some(
    (alias) => compact.includes(alias),
  );
  if (exact.actType === "LEGGE" && !hasType) {
    hasType = /(^|[^A-Z])L\.?([^A-Z]|$)/.test(citation);
  }
  const numberPattern = new RegExp("(^|[^0-9])" + exact.number + "([^0-9]|$)");
  const yearMatches = (exact.yearAliases || [String(exact.year)]).some((year) =>
    new RegExp("(^|[^0-9])" + year + "([^0-9]|$)").test(citation),
  );
  return hasType && numberPattern.test(citation) && yearMatches;
}

function validateCurrent(args, scenario) {
  const errors = [];
  const warnings = [];
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { errors: ["arguments are not an object"], warnings };
  }
  if (scenario.route === "exact") {
    if (normalize(args.denominazione) !== scenario.exact.actType) {
      errors.push("exact act type was not preserved");
    }
    if (Number(args.anno) !== scenario.exact.year) errors.push("exact act year was not preserved");
    if (String(args.numero || "") !== scenario.exact.number) {
      errors.push("exact act number was not preserved");
    }
  } else if (scenario.route === "research") {
    if (!args.data_pubblicazione_da || !args.data_pubblicazione_a) {
      errors.push("publication window was not expressed as publication filters");
    }
  } else {
    if (!args.testo && !args.titolo) errors.push("discovery has no text or title query");
    if (scenario.article && String(args.numero || "") === scenario.article) {
      errors.push("article number was emitted as the act number");
    }
    if (args.denominazione && !officialActTypes.has(normalize(args.denominazione))) {
      errors.push("common name or citation was emitted as the act type");
    }
    if (scenario.conflict && (normalize(args.denominazione) === "LEGGE" || args.numero === "2043")) {
      errors.push("conflicting user-supplied coordinates were trusted");
    }
  }
  if (scenario.id === "faceted-contracts") {
    if (Number(args.anno) !== 2023) warnings.push("year facet was not preserved");
    if (normalize(args.denominazione) !== "DECRETO LEGISLATIVO") {
      warnings.push("act-type facet was not preserved");
    }
  }
  return { errors, warnings };
}

function validateSplit(call, args, scenario) {
  const errors = [];
  const warnings = [];
  const expectedTool = scenario.route === "exact" ? "lookup_act" : "search_acts";
  if (call !== expectedTool) errors.push("expected " + expectedTool + " but got " + call);
  if (scenario.route === "exact" && call === "lookup_act") {
    if (normalize(args.act_type) !== scenario.exact.actType) {
      errors.push("exact act type was not preserved");
    }
    if (Number(args.year) !== scenario.exact.year) errors.push("exact act year was not preserved");
    if (String(args.number || "") !== scenario.exact.number) {
      errors.push("exact act number was not preserved");
    }
  }
  if (scenario.route !== "exact" && call === "search_acts") {
    if (scenario.route === "research") {
      if (!args.filters?.published?.from || !args.filters?.published?.to) {
        errors.push("publication window was not expressed in filters.published");
      }
    } else if (!args.query) {
      errors.push("discovery query is missing");
    }
    if (!hasArticleReference(args, scenario.article)) {
      warnings.push("article reference was not preserved separately");
    }
    if (scenario.conflict && args.filters?.act_type === "LEGGE") {
      errors.push("conflicting user-supplied act type was trusted");
    }
  }
  return { errors, warnings };
}

function validateSingle(call, args, scenario) {
  const errors = [];
  const warnings = [];
  if (call !== "search_acts") errors.push("expected search_acts but got " + call);
  const expectedMode =
    scenario.route === "exact"
      ? "exact"
      : scenario.route === "research"
        ? "research"
        : "discover";
  if (args.mode !== expectedMode) {
    errors.push("expected mode " + expectedMode + " but got " + String(args.mode));
  }
  if (expectedMode === "exact") {
    if (normalize(args.act_type) !== scenario.exact.actType) {
      errors.push("exact act type was not preserved");
    }
    if (Number(args.year) !== scenario.exact.year) errors.push("exact act year was not preserved");
    if (String(args.number || "") !== scenario.exact.number) {
      errors.push("exact act number was not preserved");
    }
  }
  if (expectedMode === "discover") {
    if (!args.query) errors.push("discovery query is missing");
    if (!hasArticleReference(args, scenario.article)) {
      warnings.push("article reference was not preserved separately");
    }
    if (scenario.conflict && args.act_type === "LEGGE") {
      errors.push("conflicting user-supplied act type was trusted");
    }
  }
  if (expectedMode === "research" && (!args.filters?.published?.from || !args.filters?.published?.to)) {
    errors.push("publication window was not expressed in filters.published");
  }
  return { errors, warnings };
}

function containsAll(value, tokens = []) {
  const normalized = normalize(value);
  return tokens.every((token) => normalized.includes(normalize(token)));
}

function articleTokensPreserved(args, scenario) {
  return containsAll(args.article_reference, scenario.articleTokens || []);
}

function facetTypeMatches(value, expected) {
  if (!expected) return true;
  const type = normalize(value).replace(/[^A-Z]/g, "");
  const expectedType = normalize(expected).replace(/[^A-Z]/g, "");
  if (expectedType === "DECRETOLEGISLATIVO") {
    return type === "DLGS" || type === "DECRETOLEGISLATIVO";
  }
  return type === expectedType;
}

function validateEdgeFields(args, scenario, referenceKey) {
  const errors = [];
  const warnings = [];
  const reference = args[referenceKey] || "";

  if (scenario.referenceTokens && !containsAll(reference, scenario.referenceTokens)) {
    errors.push("reference text lost required user wording");
  }
  if (scenario.articleTokens && !articleTokensPreserved(args, scenario)) {
    errors.push("article reference was not preserved separately");
  }
  if (
    scenario.forbiddenCitationTokens &&
    containsAll(JSON.stringify(args), scenario.forbiddenCitationTokens)
  ) {
    errors.push("model invented exact coordinates for a common name");
  }
  if (scenario.forbidVersionClass && args.version_class) {
    errors.push("current-law request was mapped to a version class");
  }
  if (scenario.facetType && !facetTypeMatches(args.act_type, scenario.facetType)) {
    errors.push("act-type facet was not preserved");
  }
  if (scenario.facetYear && Number(args.year) !== scenario.facetYear) {
    errors.push("year facet was not preserved");
  }
  if (scenario.published) {
    if (args.published_from !== scenario.published.from || args.published_to !== scenario.published.to) {
      errors.push("publication range was not preserved");
    }
    if (args.issued_from || args.issued_to) errors.push("publication range was mapped to issuance");
  }
  if (scenario.issued) {
    if (args.issued_from !== scenario.issued.from || args.issued_to !== scenario.issued.to) {
      errors.push("issuance range was not preserved");
    }
    if (args.published_from || args.published_to) errors.push("issuance range was mapped to publication");
  }
  if (scenario.inForceOn && args.in_force_on !== scenario.inForceOn) {
    errors.push("in-force date was not preserved");
  }
  if (scenario.versionClass && args.version_class !== scenario.versionClass) {
    errors.push("version class was not preserved");
  }
  return { errors, warnings };
}

function validateEdgeSplitV2(call, args, scenario) {
  const errors = [];
  const warnings = [];
  const expectedTool = scenario.route === "exact" ? "lookup_act" : "search_acts";
  if (call !== expectedTool) errors.push("expected " + expectedTool + " but got " + call);

  if (scenario.route === "exact" && call === "lookup_act") {
    if (!citationMatchesExact(args.citation, scenario.exact)) {
      errors.push("complete exact citation was not preserved");
    }
    if (scenario.articleTokens && !articleTokensPreserved(args, scenario)) {
      errors.push("article reference was not preserved separately");
    }
  }

  if (call === "search_acts") {
    const fields = validateEdgeFields(args, scenario, "query");
    errors.push(...fields.errors);
    warnings.push(...fields.warnings);
    if (scenario.route === "reject" && scenario.id === "edge-conflicting-code") {
      if (!containsAll(args.query, ["CODICE CIVILE"])) {
        errors.push("common-name side of conflict was not preserved");
      }
      if (!containsAll(args.asserted_citation, ["LEGGE", "262", "1942"])) {
        errors.push("asserted citation was not preserved for conflict detection");
      }
    }
    if (scenario.route === "continue") {
      if (args.cursor !== scenario.cursor) errors.push("cursor was not preserved byte-for-byte");
      if (Object.keys(args).some((key) => key !== "cursor")) {
        errors.push("cursor continuation included other search inputs");
      }
    }
  }
  if (scenario.route === "clarify") errors.push("missing cursor should not produce a tool call");
  return { errors, warnings };
}

function validateEdgeRouterV2(call, args, scenario) {
  const errors = [];
  const warnings = [];
  if (call !== "find_acts") errors.push("expected find_acts but got " + call);
  if (scenario.route === "exact") {
    if (!citationMatchesExact(args.reference, scenario.exact)) {
      errors.push("complete exact citation was not preserved for server routing");
    }
  }
  const fields = validateEdgeFields(args, scenario, "reference");
  errors.push(...fields.errors);
  warnings.push(...fields.warnings);
  if (scenario.route === "reject" && scenario.id === "edge-conflicting-code") {
    if (!containsAll(args.reference, scenario.referenceTokens)) {
      errors.push("conflicting wording was not preserved for server rejection");
    }
  }
  if (scenario.route === "continue") {
    if (args.cursor !== scenario.cursor) errors.push("cursor was not preserved byte-for-byte");
    if (Object.keys(args).some((key) => key !== "cursor")) {
      errors.push("cursor continuation included other search inputs");
    }
  }
  if (scenario.route === "clarify") errors.push("missing cursor should not produce a tool call");
  return { errors, warnings };
}

function validateSplitV2(call, args, scenario) {
  if (scenario.edge) return validateEdgeSplitV2(call, args, scenario);
  const errors = [];
  const warnings = [];
  const expectedTool = scenario.route === "exact" ? "lookup_act" : "search_acts";
  if (call !== expectedTool) errors.push("expected " + expectedTool + " but got " + call);

  if (scenario.route === "exact" && call === "lookup_act") {
    if (!citationMatchesExact(args.citation, scenario.exact)) {
      errors.push("complete exact citation was not preserved");
    }
    if (!hasArticleReference(args, scenario.article)) {
      warnings.push("article reference was not preserved separately");
    }
  }

  if (scenario.route !== "exact" && call === "search_acts") {
    if (scenario.route === "research") {
      if (!args.published_from || !args.published_to) {
        errors.push("publication window was not expressed as shallow filters");
      }
    } else if (!args.query) {
      errors.push("discovery query is missing");
    }
    if (!hasArticleReference(args, scenario.article)) {
      warnings.push("article reference was not preserved separately");
    }
    if (scenario.conflict) {
      if (!normalize(args.query).includes("CODICE CIVILE")) {
        errors.push("common-name side of conflict was not preserved");
      }
      if (!args.asserted_citation || !normalize(args.asserted_citation).includes("LEGGE")) {
        errors.push("asserted citation was not preserved for conflict detection");
      }
    }
  }

  if (scenario.id === "faceted-contracts" && call === "search_acts") {
    if (Number(args.year) !== 2023) warnings.push("year facet was not preserved");
    const type = normalize(args.act_type).replace(/[^A-Z]/g, "");
    if (type !== "DLGS" && type !== "DECRETOLEGISLATIVO") {
      warnings.push("act-type facet was not preserved");
    }
  }
  return { errors, warnings };
}

function validateRouterV2(call, args, scenario) {
  if (scenario.edge) return validateEdgeRouterV2(call, args, scenario);
  const errors = [];
  const warnings = [];
  if (call !== "find_acts") errors.push("expected find_acts but got " + call);

  if (scenario.route === "exact") {
    if (!citationMatchesExact(args.reference, scenario.exact)) {
      errors.push("complete exact citation was not preserved for server routing");
    }
  } else if (scenario.route === "research") {
    if (!args.published_from || !args.published_to) {
      errors.push("publication window was not expressed as shallow filters");
    }
  } else if (!args.reference) {
    errors.push("discovery reference is missing");
  }

  if (!hasArticleReference(args, scenario.article)) {
    warnings.push("article reference was not preserved separately");
  }
  if (scenario.conflict) {
    const reference = normalize(args.reference);
    for (const required of ["CODICE CIVILE", "LEGGE", "2043", "1942"]) {
      if (!reference.includes(required)) {
        errors.push("conflicting wording was not preserved for server rejection");
        break;
      }
    }
  }
  if (scenario.id === "faceted-contracts") {
    if (Number(args.year) !== 2023) warnings.push("year facet was not preserved");
    const type = normalize(args.act_type).replace(/[^A-Z]/g, "");
    if (type !== "DLGS" && type !== "DECRETOLEGISLATIVO") {
      warnings.push("act-type facet was not preserved");
    }
  }
  return { errors, warnings };
}

function validateRouterV3(call, args, scenario) {
  const errors = [];
  const warnings = [];
  const expectedTool = scenario.route === "continue" ? "continue_acts" : "find_acts";
  if (call !== expectedTool) errors.push("expected " + expectedTool + " but got " + call);
  if (scenario.route === "continue") {
    if (args.cursor !== scenario.cursor) errors.push("cursor was not preserved byte-for-byte");
    if (Object.keys(args).some((key) => key !== "cursor")) {
      errors.push("cursor continuation included a request or other input");
    }
    return { errors, warnings };
  }
  const request = String(args.request || "").trim();
  if (!request) errors.push("complete user request is missing");
  if (scenario.exact && !citationMatchesExact(request, scenario.exact)) {
    errors.push("exact citation was not preserved in the request");
  }
  const articleTokens = scenario.articleTokens || (scenario.article ? [scenario.article] : []);
  if (!containsAll(request, articleTokens)) {
    errors.push("article reference was not preserved in the request");
  }
  if (scenario.referenceTokens && !containsAll(request, scenario.referenceTokens)) {
    errors.push("reference text lost required user wording");
  }
  const promptNumbers = normalize(scenario.prompt).match(/\b\d+(?:-[A-Z]+)?\b/g) || [];
  if (!containsAll(request, promptNumbers)) {
    errors.push("one or more numeric details were lost from the request");
  }
  const normalizedRequest = normalize(request);
  if ((scenario.published || scenario.id === "publication-window") && !normalizedRequest.includes("PUBBLICAT")) {
    errors.push("publication intent was not preserved");
  }
  if (scenario.issued && !normalizedRequest.includes("EMANAT")) {
    errors.push("issuance intent was not preserved");
  }
  if (scenario.inForceOn && !normalizedRequest.includes("VIGORE")) {
    errors.push("in-force intent was not preserved");
  }
  if (scenario.versionClass && !normalizedRequest.includes("ABROGAT")) {
    errors.push("repealed-status intent was not preserved");
  }
  if (scenario.conflict && !containsAll(request, ["CODICE CIVILE", "LEGGE", "2043", "1942"])) {
    errors.push("conflicting wording was not preserved for server rejection");
  }
  if (scenario.id === "faceted-contracts" && !containsAll(request, ["DECRETI LEGISLATIVI", "2023", "CONTRATTI PUBBLICI"])) {
    errors.push("discovery facets were not preserved in the request");
  }
  if (Object.keys(args).some((key) => key !== "request")) {
    errors.push("new request included unsupported decomposed fields");
  }
  return { errors, warnings };
}

function validateCall(interfaceId, toolName, args, scenario) {
  if (interfaceId === "current") {
    if (toolName !== "search_acts") {
      return { errors: ["expected search_acts but got " + toolName], warnings: [] };
    }
    return validateCurrent(args, scenario);
  }
  if (interfaceId === "split") return validateSplit(toolName, args, scenario);
  if (interfaceId === "single") return validateSingle(toolName, args, scenario);
  if (interfaceId === "split_v2") return validateSplitV2(toolName, args, scenario);
  if (interfaceId === "router_v2") return validateRouterV2(toolName, args, scenario);
  return validateRouterV3(toolName, args, scenario);
}

function schemaBytes(tools) {
  return Buffer.byteLength(JSON.stringify(tools));
}

function requestBody(model, interfaceUnderTest, scenario) {
  const prompt =
    config.qwenNoThink && model.startsWith("qwen/")
      ? scenario.prompt + " /no_think"
      : scenario.prompt;
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    tools: interfaceUnderTest.tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    temperature: 0,
    max_tokens: config.maxOutputTokens,
    usage: { include: true },
    ...(config.providerOnly.length
      ? { provider: { only: config.providerOnly, allow_fallbacks: false } }
      : {}),
  };
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 1000) };
  }
  if (!response.ok) {
    const message = body?.error?.message || body?.message || response.statusText;
    const error = new Error("OpenRouter " + response.status + ": " + message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function requireCompletionResponse(body) {
  if (body?.error) {
    const error = new Error("OpenRouter completion error: " + (body.error.message || "unknown error"));
    error.status = body.error.code || null;
    throw error;
  }
  if (!Array.isArray(body?.choices) || body.choices.length === 0) {
    throw new Error("OpenRouter returned no completion choices");
  }
  return body;
}

async function loadCatalog() {
  const body = await fetchJson(OPENROUTER + "/models");
  return new Map((body.data || []).map((model) => [model.id, model]));
}

function requireModels(catalog) {
  return config.models.map((id) => {
    const model = catalog.get(id);
    if (!model) throw new Error("Model is absent from the live OpenRouter catalog: " + id);
    const supported = new Set(model.supported_parameters || []);
    if (!supported.has("tools") || !supported.has("tool_choice")) {
      throw new Error("Model does not currently advertise tools + tool_choice: " + id);
    }
    const promptPrice = Number(model.pricing?.prompt);
    const completionPrice = Number(model.pricing?.completion);
    if (!Number.isFinite(promptPrice) || !Number.isFinite(completionPrice)) {
      throw new Error("Model has unusable pricing metadata: " + id);
    }
    return { id, model, promptPrice, completionPrice };
  });
}

function conservativeReserve(body, pricedModel) {
  const serializedBytes = Buffer.byteLength(JSON.stringify(body));
  const promptTokenCeiling = serializedBytes;
  const completionTokenCeiling = config.maxOutputTokens * 2;
  return (
    promptTokenCeiling * pricedModel.promptPrice +
    completionTokenCeiling * pricedModel.completionPrice
  );
}

function responseCost(response, pricedModel) {
  const direct = Number(response.usage?.cost ?? response.usage?.total_cost);
  if (Number.isFinite(direct) && direct >= 0) {
    return { usd: direct, source: "openrouter_usage" };
  }
  const promptTokens = Number(response.usage?.prompt_tokens || 0);
  const completionTokens = Number(response.usage?.completion_tokens || 0);
  return {
    usd:
      promptTokens * pricedModel.promptPrice +
      completionTokens * pricedModel.completionPrice,
    source: "catalog_price_estimate",
  };
}

function parseFirstToolCall(response) {
  const choice = response.choices?.[0];
  const message = choice?.message || {};
  const toolCall = message.tool_calls?.[0];
  if (!toolCall) {
    return {
      kind: "no_tool_call",
      finishReason: choice?.finish_reason || null,
      text: String(message.content || "").slice(0, 800),
    };
  }
  const rawArgs = toolCall.function?.arguments;
  let args = rawArgs;
  if (typeof rawArgs === "string") {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return {
        kind: "invalid_json",
        tool: toolCall.function?.name || null,
        rawArguments: rawArgs.slice(0, 1000),
      };
    }
  }
  return {
    kind: "tool_call",
    tool: toolCall.function?.name || null,
    arguments: args,
    toolCallCount: message.tool_calls.length,
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isoFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function validateKey() {
  if (!config.apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is empty. Run: pnpm prototype:search-routing:setup",
    );
  }
  const result = await fetchJson(OPENROUTER + "/key", {
    headers: { Authorization: "Bearer " + config.apiKey },
  });
  return result.data || {};
}

function printPlan(pricedModels) {
  const calls =
    config.models.length * activeInterfaces.length * activeScenarios.length * config.repetitions;
  let reserve = 0;
  for (const pricedModel of pricedModels) {
    for (const interfaceUnderTest of activeInterfaces) {
      for (const scenario of activeScenarios) {
        const body = requestBody(pricedModel.id, interfaceUnderTest, scenario);
        reserve += conservativeReserve(body, pricedModel) * config.repetitions;
      }
    }
  }
  console.log("OpenRouter routing-evaluation plan");
  console.log("  models:       " + config.models.join(", "));
  console.log("  interfaces:   " + activeInterfaces.map((item) => item.id).join(", "));
  console.log("  suite:        " + config.suite);
  console.log("  prompts:      " + activeScenarios.length);
  console.log("  repetitions:  " + config.repetitions);
  console.log("  Qwen mode:    " + (config.qwenNoThink ? "non-thinking control" : "provider default"));
  console.log("  output cap:   " + config.maxOutputTokens + " tokens");
  console.log("  concurrency:  " + config.concurrency);
  console.log("  timeout:      " + config.timeoutMs + " ms");
  console.log(
    "  providers:    " + (config.providerOnly.length ? config.providerOnly.join(", ") : "OpenRouter auto"),
  );
  console.log("  requests:     " + calls);
  console.log("  hard cap:     $" + config.maxCostUsd.toFixed(2) + " USD");
  console.log("  reserve bound:$" + reserve.toFixed(4) + " USD");
  for (const interfaceUnderTest of activeInterfaces) {
    console.log(
      "  schema bytes [" +
        interfaceUnderTest.id +
        "]: " +
        schemaBytes(interfaceUnderTest.tools),
    );
  }
  if (reserve > config.maxCostUsd) {
    throw new Error("Conservative reserve exceeds OPENROUTER_MAX_COST_USD");
  }
  return { calls, reserve };
}

function markdownSummary(results, metadata) {
  const groups = new Map();
  for (const row of results) {
    const key = row.model + "\u0000" + row.interface;
    if (!groups.has(key)) {
      groups.set(key, {
        model: row.model,
        interface: row.interface,
        pass: 0,
        invalid: 0,
        noTool: 0,
        apiError: 0,
        cost: 0,
      });
    }
    const group = groups.get(key);
    group.cost += row.cost_usd || 0;
    if (row.result_kind === "api_error") group.apiError += 1;
    else if (row.result_kind === "expected_no_tool") {
      if (row.validation?.errors?.length) group.invalid += 1;
      else group.pass += 1;
    } else if (row.result_kind !== "tool_call") group.noTool += 1;
    else if (row.validation?.errors?.length) group.invalid += 1;
    else group.pass += 1;
  }
  const lines = [
    "# OpenRouter routing evaluation",
    "",
    "THROWAWAY PROTOTYPE results. Tool calls were captured but never executed.",
    "",
    "- Started: " + metadata.started_at,
    "- Completed: " + metadata.completed_at,
    "- Budget cap: $" + metadata.max_cost_usd.toFixed(2) + " USD",
    "- Recorded cost: $" + metadata.recorded_cost_usd.toFixed(6) + " USD",
    "- Repetitions per case: " + metadata.repetitions,
    "",
    "| Model | Interface | Pass | Invalid route/args | No tool | API error | Cost USD |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const group of groups.values()) {
    lines.push(
      "| " +
        group.model +
        " | " +
        group.interface +
        " | " +
        group.pass +
        " | " +
        group.invalid +
        " | " +
        group.noTool +
        " | " +
        group.apiError +
        " | " +
        group.cost.toFixed(6) +
        " |",
    );
  }
  lines.push(
    "",
    "The JSONL sibling is the primary trace: it preserves every emitted tool name and argument object.",
    "",
  );
  return lines.join("\n");
}

async function runEvaluation(pricedModels) {
  await validateKey();
  const plan = printPlan(pricedModels);
  const stamp = isoFileStamp();
  await mkdir(RUNS_DIR, { recursive: true });
  const jsonlPath = resolve(RUNS_DIR, stamp + ".jsonl");
  const markdownPath = resolve(RUNS_DIR, stamp + ".md");
  const rows = [];
  let spentUsd = 0;
  const startedAt = new Date().toISOString();

  console.log("");
  console.log("Running with bounded concurrency; the full-run reserve was checked before dispatch.");

  const tasks = [];
  for (const pricedModel of pricedModels) {
    for (const interfaceUnderTest of activeInterfaces) {
      for (const scenario of activeScenarios) {
        for (let repetition = 1; repetition <= config.repetitions; repetition += 1) {
          tasks.push({ pricedModel, interfaceUnderTest, scenario, repetition });
        }
      }
    }
  }

  let nextTask = 0;
  async function worker() {
    while (nextTask < tasks.length) {
      const taskIndex = nextTask;
      nextTask += 1;
      const { pricedModel, interfaceUnderTest, scenario, repetition } = tasks[taskIndex];
      const body = requestBody(pricedModel.id, interfaceUnderTest, scenario);
      const base = {
        sequence: taskIndex,
        recorded_at: new Date().toISOString(),
        model: pricedModel.id,
        interface: interfaceUnderTest.id,
        scenario: scenario.id,
        repetition,
        prompt: scenario.prompt,
        qwen_no_think: config.qwenNoThink && pricedModel.id.startsWith("qwen/"),
        max_output_tokens: config.maxOutputTokens,
        requested_providers: config.providerOnly,
        schema_sha256: sha256(JSON.stringify(interfaceUnderTest.tools)),
        schema_bytes: schemaBytes(interfaceUnderTest.tools),
      };

      try {
        const response = requireCompletionResponse(await fetchJson(OPENROUTER + "/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + config.apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/adellorto/normattiva-mcp",
            "X-Title": "normattiva-mcp search-routing prototype",
          },
          body: JSON.stringify(body),
        }));
        const cost = responseCost(response, pricedModel);
        spentUsd += cost.usd;
        const parsed = parseFirstToolCall(response);
        let resultKind = parsed.kind;
        let validation = { errors: [], warnings: [] };
        if (parsed.kind === "tool_call") {
          validation = validateCall(
            interfaceUnderTest.id,
            parsed.tool,
            parsed.arguments,
            scenario,
          );
        } else if (
          parsed.kind === "no_tool_call" &&
          scenario.route === "clarify" &&
          interfaceUnderTest.id !== "router_v3"
        ) {
          resultKind = "expected_no_tool";
          if (!parsed.text?.trim()) {
            validation.errors.push("clarification case returned no visible clarification");
          }
        }
        const row = {
          ...base,
          response_model: response.model || null,
          provider: response.provider || null,
          generation_id: response.id || null,
          result_kind: resultKind,
          tool: parsed.tool || null,
          arguments: parsed.arguments || null,
          finish_reason: parsed.finishReason || response.choices?.[0]?.finish_reason || null,
          response_text: parsed.text || null,
          raw_arguments: parsed.rawArguments || null,
          validation,
          usage: response.usage || null,
          cost_usd: cost.usd,
          cost_source: cost.source,
          cumulative_cost_usd: spentUsd,
        };
        rows.push(row);
        const verdict =
          resultKind === "expected_no_tool"
            ? validation.errors.length
              ? "invalid"
              : "pass"
            : parsed.kind !== "tool_call"
              ? parsed.kind
            : validation.errors.length
              ? "invalid"
              : "pass";
        console.log(
          [
            pricedModel.id,
            interfaceUnderTest.id,
            scenario.id,
            "r" + repetition,
            verdict,
            "$" + cost.usd.toFixed(6),
          ].join(" · "),
        );
      } catch (error) {
        rows.push({
          ...base,
          result_kind: "api_error",
          error_status: error.status || null,
          error_message: error.message,
          cost_usd: 0,
          cumulative_cost_usd: spentUsd,
        });
        console.log(
          [
            pricedModel.id,
            interfaceUnderTest.id,
            scenario.id,
            "r" + repetition,
            "api_error",
          ].join(" · "),
        );
      }
    }
  }

  await Promise.all(Array.from({ length: config.concurrency }, () => worker()));
  rows.sort((left, right) => left.sequence - right.sequence);
  await writeFile(
    jsonlPath,
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8",
  );

  const metadata = {
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    max_cost_usd: config.maxCostUsd,
    recorded_cost_usd: spentUsd,
    repetitions: config.repetitions,
    max_output_tokens: config.maxOutputTokens,
    concurrency: config.concurrency,
    timeout_ms: config.timeoutMs,
    suite: config.suite,
    requested_providers: config.providerOnly,
    conservative_plan_reserve_usd: plan.reserve,
    qwen_no_think: config.qwenNoThink,
  };
  await writeFile(markdownPath, markdownSummary(rows, metadata), "utf8");
  console.log("");
  console.log("Primary trace: " + jsonlPath);
  console.log("Summary:       " + markdownPath);
  console.log("Recorded cost: $" + spentUsd.toFixed(6) + " USD");
}

const mode = process.argv[2] || "--plan";
const catalog = await loadCatalog();
const pricedModels = requireModels(catalog);

if (mode === "--check") {
  const key = await validateKey();
  console.log("OpenRouter key: valid");
  console.log(
    "Key limit remaining: " +
      (key.limit_remaining == null ? "not reported" : "$" + Number(key.limit_remaining).toFixed(2)),
  );
  for (const item of pricedModels) {
    console.log("Model: " + item.id + " · tools + tool_choice · available");
  }
} else if (mode === "--plan") {
  printPlan(pricedModels);
} else if (mode === "--run") {
  await runEvaluation(pricedModels);
} else {
  throw new Error("Use one of: --check, --plan, --run");
}
