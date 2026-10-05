import { z } from "zod";
import { OperationError } from "./errors.js";
import { calendarDateSchema } from "./contracts.js";
import { matchingAliases } from "./act-aliases.js";

export const citationSchema = z.object({ type: z.string().min(1).max(100), year: z.string().regex(/^\d{4}$/), number: z.string().regex(/^\d{1,9}$/), issued: calendarDateSchema.optional() }).strict();
export type Citation = z.infer<typeof citationSchema>;
export const discoveryPlanSchema = z.object({
  request: z.string().min(1).max(4096), article: z.string().max(200).optional(),
  route: z.enum(["exact", "alias", "relevance", "advanced"]), citation: citationSchema.optional(),
  aliases: z.array(z.string().max(80)).max(20).optional(), uncertainTime: z.boolean().default(false),
  query: z.string().max(4096).optional(),
  filters: z.object({ denominazioneAtto: z.string().max(100).optional(), annoProvvedimento: z.string().regex(/^\d{4}$/).optional(),
    dataInizioEmanazione: calendarDateSchema.optional(), dataFineEmanazione: calendarDateSchema.optional(),
    dataInizioPubProvvedimento: calendarDateSchema.optional(), dataFinePubProvvedimento: calendarDateSchema.optional(),
    vigenza: calendarDateSchema.optional(), classeProvvedimento: z.enum(["1", "2", "3"]).optional() }).strict().optional(),
}).strict().superRefine((plan, ctx) => {
  const filters = Object.keys(plan.filters ?? {}).length;
  const exact = plan.route === "exact" && !!plan.citation && !plan.aliases && !plan.query && !filters;
  const alias = plan.route === "alias" && !!plan.aliases?.length && new Set(plan.aliases).size === plan.aliases.length
    && !plan.citation && !plan.query && !filters;
  const search = !plan.citation && !plan.aliases && (plan.route === "relevance" ? !!plan.query?.trim() && !filters : plan.route === "advanced" && filters > 0);
  if (!exact && !alias && !search) ctx.addIssue({ code: "custom", message: "Discovery plan fields must match one route." });
});
export type DiscoveryPlan = z.infer<typeof discoveryPlanSchema>;
export function invalidRequest(message: string, code = "unsupported_request"): OperationError {
  return new OperationError({ category: "invalid_input", code, message, retryability: false });
}
const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const datePattern = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{1,2}[°º]?\s+(?:${months.join("|")})\s+\d{4})`;
function date(value: string): string {
  let iso = value;
  if (!/^\d{4}-/.test(value)) {
    const match = /^(\d{1,2})[°º]?\s+(\w+)\s+(\d{4})$/i.exec(value)!;
    iso = `${match[3]}-${String(months.indexOf(match[2]!.toLowerCase()) + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  }
  if (!calendarDateSchema.safeParse(iso).success) throw invalidRequest("Use a real calendar date.", "invalid_calendar_date");
  return iso;
}
const sameCitation = (a: Citation, b: Citation) => a.type === b.type && a.year === b.year && a.number === b.number
  && !(a.issued && b.issued && a.issued !== b.issued);

function research(text: string): { query: string; filters: NonNullable<DiscoveryPlan["filters"]> } {
  const filters: NonNullable<DiscoveryPlan["filters"]> = {};
  let rest = text.toLowerCase().replaceAll(/[’‘]/g, "'");
  // Shared-month/year ranges are expanded before validation; invalid days and
  // reversed ranges are errors, never heuristically relaxed topical searches.
  rest = rest.replace(new RegExp(String.raw`(?:dal|tra il)\s+(\d{1,2})[°º]?\s+(?:al|e il)\s+(\d{1,2})[°º]?\s+(${months.join("|")})\s+(\d{4})`, "g"),
    (_, first, last, month, year) => `dal ${first} ${month} ${year} al ${last} ${month} ${year}`);
  const dates = [...rest.matchAll(new RegExp(datePattern, "g"))];
  const values = dates.map(match => date(match[0]));
  const published = /\bpubblicat[ioae]|gazzetta ufficiale/.test(rest), issued = /\bemanat[ioae]/.test(rest);
  const inForce = /\bin vigore\s+(?:il|al)/.test(rest);
  if (published && issued) throw invalidRequest("Specify one publication or issuance window per request.");
  if ((published || issued) && !inForce) {
    if (values.length !== 2) throw invalidRequest("Supply explicit start and end dates for publication or issuance research.");
    if (values[0]! > values[1]!) throw invalidRequest("The end date must not precede the start date.", "inverted_date_range");
    if (published) { filters.dataInizioPubProvvedimento = values[0]; filters.dataFinePubProvvedimento = values[1]; }
    else { filters.dataInizioEmanazione = values[0]; filters.dataFineEmanazione = values[1]; }
  } else if (inForce) {
    if (values.length !== 1) throw invalidRequest("Supply one explicit date of vigenza.");
    filters.vigenza = values[0];
  } else if (values.length) throw invalidRequest("Specify whether dates constrain publication, issuance or vigenza.");
  for (const match of dates) rest = rest.replace(match[0], " ");
  if (/\b(?:dal|al|tra il|in vigore il)\s+\d/.test(rest)) throw invalidRequest("Use explicit supported calendar dates.", "invalid_calendar_date");
  const typeFilters = [
    ["DECRETO LEGISLATIVO", /\bdecret[oi] legislativ[oi]\b/g],
    ["DECRETO-LEGGE", /\bdecret[oi][ -]legge\b/g],
    ["DECRETO DEL PRESIDENTE DELLA REPUBBLICA", /\bdecret[oi] del presidente della repubblica\b/g],
    ["REGIO DECRETO", /\b(?:regi decreti|regio decreto)\b/g],
    ["LEGGE", /\bleggi\b/g],
  ] as const;
  for (const [type, pattern] of typeFilters) if (pattern.test(rest)) {
    if (filters.denominazioneAtto) throw invalidRequest("Specify one act type per research request.");
    filters.denominazioneAtto = type; rest = rest.replace(pattern, " ");
  }
  const years = [...rest.matchAll(/\b(?:del(?:l'anno)?|nel|anno)\s+(\d{4})\b/g)];
  if (years.length > 1) throw invalidRequest("Specify one act year per request.");
  if (years.length) {
    const year = years[0]![1]!;
    if (Number(year) < 1861 || Number(year) > new Date().getUTCFullYear()) throw invalidRequest("Use a supported act year.");
    filters.annoProvvedimento = year; rest = rest.replace(years[0]![0], " ");
  }
  const classes = [...rest.matchAll(/\b(abrogat[ioae]|aggiornat[ioae]|senza aggiornamenti)\b/g)];
  if (new Set(classes.map(match => match[1]!.startsWith("abrogat") ? "3" : match[1]!.startsWith("aggiornat") ? "2" : "1")).size > 1) {
    throw invalidRequest("The requested version classes contradict each other.");
  }
  if (classes.length) filters.classeProvvedimento = classes[0]![1]!.startsWith("abrogat") ? "3" : classes[0]![1]!.startsWith("aggiornat") ? "2" : "1";
  rest = rest.replace(/\b(?:abrogat[ioae]|aggiornat[ioae]|senza aggiornamenti)\b/g, " ");
  rest = rest.replace(/\b(?:quali|norme|italiane|atti|sono stati|sono|stati|risultavano|risultano|pubblicat[ioae]|emanat[ioae]|in gazzetta ufficiale|gazzetta ufficiale|in vigore|dal|tra il|al|e il|il)\b/g, " ");
  rest = rest.replace(/^\s*(?:cerca|trova|mostrami)\s+/i, "").replace(/^\s*(?:i|le|la|gli)\s+/i, "");
  rest = rest.replace(/^\s*(?:riguardano|disciplinano|sulla|sulle|sul|sui|su)\s+/i, "");
  rest = rest.replace(/^\s*(?:i|le|la|gli)\s+/i, "");
  return { filters, query: rest.replace(/[?.]+$/g, "").replace(/\s+/g, " ").trim() };
}
const typeSpellings = [
  ["REGIO DECRETO-LEGGE", String.raw`regio decreto[ -]legge`],
  ["REGIO DECRETO", String.raw`r\.?\s*d\.?|regio decreto`],
  ["DECRETO LEGISLATIVO", String.raw`d\.?\s*lgs\.?|decreto legislativo`],
  ["DECRETO DEL PRESIDENTE DELLA REPUBBLICA", String.raw`d\.?\s*p\.?\s*r\.?|decreto del presidente della repubblica`],
  ["DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI", String.raw`d\.?\s*p\.?\s*c\.?\s*m\.?|decreto del presidente del consiglio dei ministri`],
  ["DECRETO-LEGGE", String.raw`d\.?\s*l\.?|decreto[ -]legge`],
  ["LEGGE COSTITUZIONALE", String.raw`legge costituzionale`],
  ["LEGGE", String.raw`legge|l\.`],
] as const;

function citations(text: string): Citation[] {
  const typePattern = typeSpellings.map(([, pattern]) => `(?:${pattern})`).join("|");
  const pattern = new RegExp(String.raw`\b(${typePattern})\s*(?:n(?:umero)?\.?\s*)?(?:(\d{1,9})\s*(?:\/|del(?:l['’]anno)?\s+)\s*(\d{4}|\d{2})\b|(${datePattern})\s*,?\s*n(?:umero)?\.?\s*(\d{1,9})\b)`, "gi");
  return [...text.matchAll(pattern)].map(match => {
    const type = typeSpellings.find(([, spelling]) => new RegExp(`^(?:${spelling})$`, "i").test(match[1]!))![0];
    let year = match[3];
    if (year?.length === 2) year = String(Number(year) >= 50 ? 1900 + Number(year) : 2000 + Number(year));
    if (match[4]) year = date(match[4]).slice(0, 4);
    if (Number(year) < 1861 || Number(year) > new Date().getUTCFullYear()) throw invalidRequest("Supply an unambiguous act year from 1861 through the current year.");
    return { type, number: String(Number(match[2] ?? match[5])), year: year!, ...(match[4] ? { issued: date(match[4]) } : {}) };
  });
}
export function planDiscovery(request: string): DiscoveryPlan {
  if (/\b(?:continua|continue|cursore|cursor|pagina successiva|next page)\b/i.test(request)) {
    throw invalidRequest("Use continue_acts with the literal cursor returned by discovery.", "continuation_required");
  }
  if (/\b(?:non|escludi|escludendo|tranne)\s+(?:abrogat[ioae]|aggiornat[ioae]|vigent[ie])\b/i.test(request)) {
    throw invalidRequest("Use a supported positive version class; negated status constraints require clarification.");
  }
  const suffix = "bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies|terdecies|quaterdecies|quindecies|sexdecies|septiesdecies|octiesdecies|noviesdecies|vicies|duodevicies";
  const articles = [...request.matchAll(new RegExp(String.raw`\b(?:articolo|art\.)\s*(\d+(?:\s*-?\s*(?:${suffix})\b)?(?:\s*,?\s*comma\s+\d+)?)`, "gi"))];
  if (articles.length > 1) throw invalidRequest("Discover one article-bearing act request at a time.");
  const articleMatch = articles[0];
  const text = articleMatch ? request.replace(articleMatch[0], " ") : request;
  const matches = citations(text);
  const aliases = matchingAliases(text);
  if (matches.length > 1) throw invalidRequest("Supply one complete act citation per discovery request.");
  if (matches.length && aliases.length && [...new Set(aliases.map(alias => alias.family))]
    .some(family => !aliases.some(alias => alias.family === family && sameCitation(alias.citation, matches[0]!)))) {
    throw invalidRequest("The common name and supplied citation contradict each other.", "contradictory_request");
  }
  const common = { request, uncertainTime: /\b(?:oggi|vigente|vigenti|attuale|current|in vigore|vecchio|storico|precedente)\b/i.test(text),
    ...(articleMatch ? { article: articleMatch[1]!.replace(/\s*-?\s*([a-z]+)(?![a-z])/i, (part, suffix) => suffix.toLowerCase() === "comma" ? part : `-${suffix.toLowerCase()}`).replace(/\s+/g, " ") } : {}) };
  if (matches.length) {
    if (/\b(?:pubblicat[ioae]|emanat[ioae]|in vigore\s+(?:il|al)|abrogat[ioae]|aggiornat[ioae]|senza aggiornamenti|nel\s+\d{4})\b/i.test(text)
      || /\b(?:e|oppure)\s+(?:d\.?\s*[lp]|decreto|legge|regio)/i.test(text)) {
      throw invalidRequest("Use separate exact identification and date/status research requests; combined constraints require clarification.");
    }
    return { ...common, route: "exact", citation: matches[0]! };
  }
  // Citation-like incomplete input is not a topic. Unknown modifiers require
  // clarification instead of silently dropping legal retrieval constraints.
  const knownType = typeSpellings.map(([, spelling]) => `(?:${spelling})`).join("|");
  if (new RegExp(String.raw`\b(?:${knownType})\s*(?:n(?:umero)?\.?\s*)?\d`, "i").test(text)
    || /\b\d{1,9}\s*\/\s*\d{2,4}\b/.test(text)) {
    throw invalidRequest("Supply the act type, number and year for an exact citation.");
  }
  if (/\b(?:recentemente|recenti|ultimi|ultime|settimana|mese scorso)\b/i.test(text)) throw invalidRequest("Replace relative research dates with explicit calendar dates.");
  const historicalAlias = aliases.length && /\bnel\s+\d{4}\b/i.test(text);
  const { query, filters } = research(historicalAlias ? text.replace(/\bnel\s+\d{4}\b/gi, " ") : text);
  const hasFilters = Object.keys(filters).length > 0;
  if (aliases.length && !hasFilters) return { ...common, uncertainTime: common.uncertainTime || !!historicalAlias, route: "alias", aliases: aliases.map(alias => alias.id) };
  if (!query && !hasFilters) throw invalidRequest("Supply an act name, citation or topic.");
  return { ...common, route: hasFilters ? "advanced" : "relevance", query, filters };
}
