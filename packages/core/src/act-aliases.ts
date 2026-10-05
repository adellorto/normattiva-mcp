import type { Citation } from "./discovery-plan.js";

export interface ActAlias { id: string; names: readonly string[]; name: string; citation: Citation; urn: string; provenance: string; verified_at: string; }
const codes = "https://www.normattiva.it/staticPage/codici";
function code(id: string, name: string, names: string[], type: string, issued: string, number: string, urnType = "decreto.legislativo"): ActAlias {
  return { id, name, names: [name, ...names], citation: { type, year: issued.slice(0, 4), number },
    urn: `urn:nir:stato:${urnType}:${issued};${number}`, provenance: codes, verified_at: "2026-10-05" };
}
// Reviewed seed, not an exhaustive synonym dictionary. Changes require source
// review; a captured date is evidence of review, never evidence of currentness.
export const ALIAS_VERSION = 1;
export const ACT_ALIASES: readonly ActAlias[] = [
  code("civil", "Codice civile", [], "REGIO DECRETO", "1942-03-16", "262", "regio.decreto"),
  code("cad", "Codice dell'amministrazione digitale", ["CAD"], "DECRETO LEGISLATIVO", "2005-03-07", "82"),
  code("privacy", "Codice in materia di protezione dei dati personali", ["Codice privacy"], "DECRETO LEGISLATIVO", "2003-06-30", "196"),
  code("road", "Codice della strada", [], "DECRETO LEGISLATIVO", "1992-04-30", "285"),
  code("consumer", "Codice del consumo", [], "DECRETO LEGISLATIVO", "2005-09-06", "206"),
  code("contracts-2023", "Nuovo Codice dei contratti pubblici", ["Codice dei contratti pubblici", "Codice dei contratti"], "DECRETO LEGISLATIVO", "2023-03-31", "36"),
  code("contracts-2016", "Codice dei contratti pubblici (2016)", ["Codice dei contratti pubblici", "Codice dei contratti"], "DECRETO LEGISLATIVO", "2016-04-18", "50"),
  code("contracts-2006", "Codice dei contratti pubblici (2006)", ["Codice dei contratti pubblici", "Codice dei contratti"], "DECRETO LEGISLATIVO", "2006-04-12", "163"),
  { ...code("tuel", "Testo unico delle leggi sull'ordinamento degli enti locali", ["TUEL", "Testo unico enti locali"], "DECRETO LEGISLATIVO", "2000-08-18", "267"),
    provenance: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2000-08-18;267" },
];
export function normalizeName(text: string): string { return text.toLowerCase().replaceAll(/[’‘]/g, "'").replaceAll(/[^a-zà-ù0-9]+/g, " ").trim(); }
export function matchingAliases(request: string): ActAlias[] {
  const text = ` ${normalizeName(request)} `;
  return ACT_ALIASES.filter(alias => alias.names.some(name => text.includes(` ${normalizeName(name)} `)));
}
