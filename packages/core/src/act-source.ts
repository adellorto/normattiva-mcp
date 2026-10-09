import { SaxesParser } from "saxes";
import { SAXParser } from "parse5-sax-parser";
import { z } from "zod";
import { RESPONSE_LIMITS, calendarDateSchema, publicationSchema, contentSegmentSchema } from "./contracts.js";
import { OperationError } from "./errors.js";
import { addressSchema, digest, type RetrievalAddress } from "./references.js";

export type Publication = z.infer<typeof publicationSchema>;
export type Segment = z.infer<typeof contentSegmentSchema>;
export type Hierarchy = Array<{ kind: string; label: string; occurrence: string }>;
export interface SourceEntry {
  kind: "article" | "attachment"; label: string; heading?: string; selector: string; hierarchy: Hierarchy;
  segments: Segment[]; contentDigest: string; address?: RetrievalAddress;
  legalDigest: string;
  tableDigest: string;
  officialUrl?: string; unread: boolean;
  explanation?: string;
}
export interface ParsedAct { entries: SourceEntry[]; inventoryComplete: boolean; legalComplete: boolean;
  unmatchedArticleLabels: string[]; preambleDigest?: string; coverageExplanation?: string; }
interface XmlNode { name: string; uri: string; attrs: Record<string, string>; children: Array<XmlNode | string>; path: string; }
const AKN = "http://docs.oasis-open.org/legaldocml/ns/akn/3.0";
export const normalized = (text: string) => text.replace(/\s+/gu, " ").trim();

/** Proven website/XML typography equivalents; no note deletion or punctuation folding. */
export function legalText(text: string): string {
  return normalized(text.normalize("NFC").replace(/\battivita'/g, "attività").replace(/\bcitta'/g, "città").replace(/\b([AEIOUaeiou])'/g, (_, vowel: string) => ({ a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù" }[vowel]!)))
    .replace(/\bprocedera'/g, "procederà")
    .replace(/\bavra'/g, "avrà")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/^(?:Articolo|Art\.?)\s*(\d+(?:-[a-z0-9]+)?)\.?\s+/i, "Art. $1. ");
}
function scanDetailText(html: string, mode: "article" | "leading", omitExplanatoryNotes = false): { text: string; articleMarkers: number } {
  const parser = new SAXParser(), parts: string[] = [];
  const stack: Array<{ tag: string; hidden: boolean }> = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const breaks = new Set(["br", "p", "div", "h2", "tr", "td", "th"]);
  let count = 0, articleMarkers = 0;
  const collecting = () => mode === "article" || !articleMarkers;
  parser.on("startTag", token => {
    if (++count > 100_000 || stack.length >= 96) throw sourceFailure("parse_limit_exceeded", "The article HTML exceeds its element or depth limit.");
    const classes = token.attrs.find(a => a.name === "class")?.value.split(/\s+/) ?? [];
    if (classes.includes("article-num-akn")) { articleMarkers++; if (mode === "article") parts.length = 0; }
    const hidden = ["script", "style", "template"].includes(token.tagName) || (omitExplanatoryNotes && classes.includes("note-akn"));
    if (!voidTags.has(token.tagName) && !token.selfClosing) stack.push({ tag: token.tagName, hidden });
    if (collecting() && voidTags.has(token.tagName) && breaks.has(token.tagName) && !stack.some(n => n.hidden)) parts.push(" ");
  });
  parser.on("text", token => { if (collecting() && !stack.some(n => n.hidden)) parts.push(token.text); });
  parser.on("endTag", token => {
    const position = stack.map(n => n.tag).lastIndexOf(token.tagName);
    if (position >= 0) stack.length = position;
    if (collecting() && breaks.has(token.tagName) && !stack.some(n => n.hidden)) parts.push(" ");
  });
  parser.end(html);
  return { text: legalText(parts.join("")), articleMarkers };
}

export function detailText(html: string, omitExplanatoryNotes = false): string {
  return scanDetailText(html, "article", omitExplanatoryNotes).text;
}

/** Text explicitly rendered before the article heading in a compound body.
 * Undefined means the body has no structural article marker and cannot be
 * partitioned; an empty string means the marker is the first substantive part. */
export function renderedLeadingText(html: string): string | undefined {
  const { text, articleMarkers } = scanDetailText(html, "leading");
  if (!articleMarkers) return undefined;
  if (articleMarkers !== 1) throw sourceFailure("source_unverified", "The rendered body does not identify one exact first article occurrence.");
  return text;
}

export function sourceFailure(code: string, message: string): OperationError {
  return new OperationError({ category: "upstream_failure", code, message, retryability: false, provider: "normattiva" });
}
export function articleLabel(text: string): string | undefined {
  const label = normalized(text).replace(/^(?:articolo|art\.?)\s*/i, "").replace(/\.$/, "").replace(/\s+/g, "-").toLowerCase();
  return /^\d+(?:[-/][a-z0-9]+)*$/.test(label) ? label : undefined;
}
export function articleHeading(text: string, component = false): string | undefined {
  const suffix = "bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies|terdecies|quaterdecies|quindecies|sexdecies|septiesdecies|octiesdecies|noviesdecies|vicies|duodevicies";
  return new RegExp(`${component ? "(?:^|\\n)\\s*" : "\\b"}(?:Articolo|Art\\.?)\\s*(\\d+(?:/\\d+|[-\\s]+(?:${suffix}))?)(?=[\\s.()])`, component ? "m" : "i").exec(text)?.[1];
}
interface Navigation { label: string; component: string; address: RetrievalAddress; hierarchy: Hierarchy; officialUrl: string; }
export interface PortalEvidence { source: string; navigation: Navigation[]; rendered?: { html: string; from: string; to?: string }; }

/** The initial ELI view independently renders the first occurrence. Do not
 * strip a preamble from an unstructured API body to manufacture agreement. */
function renderedPortalArticle(html: string): PortalEvidence["rendered"] {
  const parser = new SAXParser({ sourceCodeLocationInfo: true });
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  let depth = 0, bodyDepth = 0, start = -1, end = -1, count = 0;
  const dates: Record<string, string> = {};
  let dateField: string | undefined;
  parser.on("startTag", tag => {
    if (++count > 100_000 || depth >= 96) throw sourceFailure("parse_limit_exceeded", "The rendered page exceeds its element or depth limit.");
    const attrs = Object.fromEntries(tag.attrs.map(a => [a.name, a.value]));
    if (!voidTags.has(tag.tagName) && !tag.selfClosing) depth++;
    if (attrs.class?.split(/\s+/).includes("bodyTesto")) {
      if (start !== -1) throw sourceFailure("source_unverified", "The dated page has multiple rendered article bodies.");
      start = tag.sourceCodeLocation!.startOffset; bodyDepth = depth;
    }
    if (tag.tagName === "span" && ["artInizio", "artFine"].includes(attrs.id ?? "")) { dateField = attrs.id; dates[dateField!] = ""; }
  });
  parser.on("text", token => { if (dateField) dates[dateField] += token.text; });
  parser.on("endTag", tag => {
    if (start >= 0 && end < 0 && depth === bodyDepth) end = tag.sourceCodeLocation!.endOffset;
    if (tag.tagName === "span") dateField = undefined;
    if (!voidTags.has(tag.tagName)) depth--;
  });
  parser.end(html);
  if (start < 0 || end < 0 || !dates.artInizio) return undefined;
  const date = (text: string): string => {
    const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(text.trim());
    const iso = m && `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    if (!iso || !calendarDateSchema.safeParse(iso).success) throw sourceFailure("snapshot_conflict", "The rendered article validity is unverifiable.");
    return iso;
  };
  return { html: html.slice(start, end), from: date(dates.artInizio), ...(dates.artFine ? { to: date(dates.artFine) } : {}) };
}

export function parsePortal(html: string, pageUrl: string, publication: Publication, date: string): PortalEvidence {
  const parser = new SAXParser();
  const links = new Set<string>(), navigation: Navigation[] = [];
  let identity = false, dated = false, component = "", count = 0;
  let navigationHierarchy: Hierarchy = [];
  let anchor: { attrs: Record<string, string>; text: string } | undefined;
  let header: { component: boolean; text: string; occurrence: string } | undefined;
  parser.on("startTag", tag => {
    if (++count > 100_000) throw sourceFailure("parse_limit_exceeded", "The official page exceeds the HTML element limit.");
    const attrs = Object.fromEntries(tag.attrs.map(a => [a.name, a.value]));
    if (attrs.property === "eli:id_local") {
      if (attrs.content !== publication.codice_redazionale) throw sourceFailure("source_identity_conflict", "The official page identifies another publication.");
      identity = true;
    }
    if (attrs.name === "dataVigenza") {
      if (attrs.value !== date.split("-").reverse().join("/")) throw sourceFailure("snapshot_conflict", "The official page does not select the requested date.");
      dated = true;
    }
    const classes = attrs.class?.split(/\s+/) ?? [];
    if (tag.tagName === "li" && (classes.includes("box_allegati") || classes.includes("box_allegati_small") || classes.includes("condiv"))) {
      header = { component: classes.includes("box_allegati") || classes.includes("box_allegati_small"), text: "", occurrence: `navigation:${navigation.length}` };
    }
    if (header && attrs.id?.startsWith("coll_")) header.occurrence = attrs.id;
    if (tag.tagName === "br" && header) header.text += " ";
    if (attrs.href?.includes("caricaAKN")) {
      const url = new URL(attrs.href, pageUrl);
      if (url.origin !== "https://www.normattiva.it" || url.pathname !== "/do/atto/caricaAKN"
        || url.searchParams.get("dataGU") !== publication.data_gu.replaceAll("-", "")
        || url.searchParams.get("codiceRedaz") !== publication.codice_redazionale
        || url.searchParams.get("dataVigenza") !== date.replaceAll("-", "")) throw sourceFailure("snapshot_conflict", "The supplied AKN link does not select the requested publication and date.");
      links.add(url.href);
    }
    if (tag.tagName === "a" && classes.includes("numero_articolo")) anchor = { attrs, text: "" };
  });
  parser.on("text", token => { if (anchor) anchor.text += token.text; if (header) header.text += token.text; });
  parser.on("endTag", tag => {
    if (tag.tagName === "li" && header) {
      const label = normalized(header.text);
      if (header.component) { component = label; navigationHierarchy = []; }
      else {
        const kind = /^LIBRO\b/.test(label) ? "book" : /^TITOLO\b/.test(label) ? "title" : /^CAPO\b/.test(label) ? "chapter" : /^SEZIONE\b/.test(label) ? "section" : undefined;
        if (kind) {
          const ranks = ["book", "title", "chapter", "section"];
          navigationHierarchy = navigationHierarchy.filter(h => ranks.indexOf(h.kind) < ranks.indexOf(kind));
          navigationHierarchy.push({ kind, label, occurrence: header.occurrence });
        }
      }
      header = undefined;
    }
    if (tag.tagName !== "a" || !anchor) return;
    const label = articleLabel(anchor.text) ?? normalized(anchor.text);
    const route = /showArticle\('([^']+)'/.exec(anchor.attrs.onclick ?? "")?.[1];
    anchor = undefined;
    if (!route) throw sourceFailure("address_unverified", "A navigation entry has no exact official address.");
    const url = new URL(route, pageUrl), p = url.searchParams;
    if (url.origin !== "https://www.normattiva.it" || url.pathname !== "/atto/caricaArticolo"
      || p.get("art.codiceRedazionale") !== publication.codice_redazionale
      || p.get("art.dataPubblicazioneGazzetta") !== publication.data_gu) throw sourceFailure("address_identity_conflict", "An official navigation address identifies another publication.");
    const number = (key: string) => { const value = p.get("art." + key); return value && /^\d+$/.test(value) ? Number(value) : NaN; };
    const address = addressSchema.safeParse({ idArticolo: number("idArticolo"), sottoArticolo: number("idSottoArticolo"),
      sottoArticolo1: number("idSottoArticolo1"), flagTipoArticolo: p.get("art.flagTipoArticolo"),
      idGruppo: number("idGruppo"), progressivo: number("progressivo"), versione: number("versione") });
    if (!address.success) throw sourceFailure("address_unverified", "An official retrieval address is incomplete.");
    navigation.push({ label, component: address.data.flagTipoArticolo === "0" ? "" : component, address: address.data, hierarchy: [...navigationHierarchy], officialUrl: url.href });
  });
  parser.end(html);
  if (!identity || !dated || links.size !== 1 || anchor) throw sourceFailure("source_unverified", "The dated official page does not supply one verifiable AKN link and complete navigation addresses.");
  return { source: [...links][0]!, navigation, rendered: renderedPortalArticle(html) };
}

function xmlTree(xml: string, closed?: (node: XmlNode, ancestors: XmlNode[]) => void): XmlNode {
  if (Buffer.byteLength(xml) > RESPONSE_LIMITS.sourceBytes) throw sourceFailure("source_limit_exceeded", "The XML exceeds the decoded source limit.");
  const parser = new SaxesParser({ xmlns: true });
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined, count = 0, skipping = 0;
  // Retain identification/version metadata and legal structure. RDF mirrors,
  // amendment analysis and presentation metadata are not a second legal body.
  const metadataOnly = new Set(["preservation", "lifecycle", "analysis", "references", "proprietary", "FRBRManifestation"]);
  parser.on("doctype", () => { throw sourceFailure("unsupported_xml", "DTD and entity declarations are unsupported."); });
  parser.on("opentag", tag => {
    if (++count > 180_000 || stack.length + skipping >= 96) throw sourceFailure("parse_limit_exceeded", "The XML exceeds the structural parser limit.");
    if (skipping || (tag.uri === AKN && metadataOnly.has(tag.local))) {
      if (["article", "doc", "body", "mainBody"].includes(tag.local)) throw sourceFailure("unsupported_structure", "Metadata unexpectedly contains legal structure.");
      skipping++; return;
    }
    const parent = stack.at(-1);
    const node: XmlNode = { name: tag.local, uri: tag.uri, attrs: {}, children: [], path: parent ? `${parent.path}/${parent.children.length}` : "0" };
    for (const attribute of Object.values(tag.attributes)) node.attrs[attribute.name] = attribute.value;
    if (parent) parent.children.push(node); else root = node;
    stack.push(node);
  });
  const text = (value: string) => { if (!skipping && stack.length) stack.at(-1)!.children.push(value); };
  parser.on("text", text); parser.on("cdata", text);
  parser.on("closetag", () => {
    if (skipping) { skipping--; return; }
    const node = stack.pop()!;
    closed?.(node, stack);
    if (node.name === "article" || node.name === "doc") node.children = [];
  });
  try { parser.write(xml).close(); }
  catch (error) { if (error instanceof OperationError) throw error; throw sourceFailure("malformed_source", "The official XML is not well formed."); }
  if (!root || root.name !== "akomaNtoso" || root.uri !== AKN) throw sourceFailure("unsupported_xml", "The official source is not supported AKN XML.");
  return root;
}
const nodes = (node: XmlNode) => node.children.filter((c): c is XmlNode => typeof c !== "string");
const child = (node: XmlNode, name: string) => nodes(node).find(c => c.name === name && c.uri === AKN);
function xmlText(node: XmlNode, omitNotes = false): string {
  if (omitNotes && node.name === "authorialNote") return "";
  return node.children.map(c => typeof c === "string" ? c : xmlText(c, omitNotes)).join("");
}
function* xmlWalk(node: XmlNode): Generator<XmlNode> { yield node; for (const c of nodes(node)) yield* xmlWalk(c); }

function segments(node: XmlNode, omitNotes = false): Segment[] {
  const result: Segment[] = [];
  const visit = (n: XmlNode) => {
    if (n.name === "meta" || (omitNotes && n.name === "authorialNote")) return;
    if (n.name === "table") {
      if ([...xmlWalk(n)].some(c => c !== n && c.name === "table")) throw sourceFailure("unsupported_table", "Nested tables require an explicit relationship adapter.");
      const caption = child(n, "caption");
      if (caption && normalized(xmlText(caption))) result.push({ kind: "text", block_id: `${n.path}:caption`, offset: 0, text: normalized(xmlText(caption)) });
      const rows = [...xmlWalk(n)].filter(c => c.name === "tr");
      const occupied = new Set<string>();
      const cells: Extract<Segment, { kind: "table" }>["cells"] = [];
      let columns = 1;
      rows.forEach((row, ri) => {
        let ci = 0;
        for (const cell of nodes(row).filter(c => ["th", "td"].includes(c.name))) {
          while (occupied.has(`${ri}:${ci}`)) ci++;
          const span = (name: string) => { const value = cell.attrs[name] ?? "1"; if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 10000) throw sourceFailure("unsupported_table", "A table has an invalid span."); return Number(value); };
          const row_span = span("rowspan"), column_span = span("colspan");
          if (ri + row_span > rows.length) throw sourceFailure("unsupported_table", "A table span exceeds its rows.");
          for (let r = ri; r < ri + row_span; r++) for (let c = ci; c < ci + column_span; c++) {
            if (occupied.has(`${r}:${c}`)) throw sourceFailure("unsupported_table", "Table cells overlap.");
            occupied.add(`${r}:${c}`);
            if (occupied.size > 100_000) throw sourceFailure("parse_limit_exceeded", "The table exceeds the cell limit.");
          }
          cells.push({ row: ri, column: ci, row_span, column_span, header: cell.name === "th", offset: 0, text: normalized(xmlText(cell, omitNotes)) });
          ci += column_span; columns = Math.max(columns, ci);
        }
      });
      result.push({ kind: "table", table_id: n.path, row_count: rows.length, column_count: columns, cells });
      return;
    }
    if (["p", "num", "heading"].includes(n.name) && ![...xmlWalk(n)].some(c => c !== n && c.name === "table")) {
      const text = normalized(xmlText(n, omitNotes));
      if (text) result.push({ kind: "text", block_id: n.path, offset: 0, text });
      return;
    }
    for (const [position, c] of n.children.entries()) {
      if (typeof c === "string") { if (normalized(c)) result.push({ kind: "text", block_id: `${n.path}/${position}`, offset: 0, text: normalized(c) }); }
      else visit(c);
    }
  };
  visit(node); return result;
}
export const segmentText = (items: Segment[]) => items.map(s => s.kind === "text" ? s.text : s.cells.map(c => c.text).join(" ")).join(" ");
export const tableDigest = (items: Segment[]) => digest(JSON.stringify(items.filter(s => s.kind === "table").map(s => ({
  rows: s.row_count, columns: s.column_count,
  cells: s.cells.map(({ row, column, row_span, column_span, header, text }) => ({ row, column, row_span, column_span, header, text: legalText(text) })),
}))));

/** Independent HTML table relationships, using the same bounded grid adapter. */
export function detailStructure(html: string): { tableDigest: string; hasTables: boolean; hasGraphics: boolean } {
  const parser = new SAXParser(), tables: XmlNode[] = [], stack: XmlNode[] = [];
  let hasGraphics = false;
  parser.on("startTag", token => {
    if (["img", "object", "embed", "iframe"].includes(token.tagName)) hasGraphics = true;
    if (!stack.length && token.tagName !== "table") return;
    if (stack.length >= 96) throw sourceFailure("parse_limit_exceeded", "The article table exceeds its depth limit.");
    const attrs = Object.fromEntries(token.attrs.map(a => [a.name, a.value]));
    attrs["html-tag"] = token.tagName;
    const node: XmlNode = { name: attrs.class?.split(/\s+/).includes("note-akn") ? "authorialNote" : token.tagName,
      uri: AKN, attrs, children: [], path: "detail" };
    if (stack.length) stack.at(-1)!.children.push(node); else tables.push(node);
    if (!["br", "img", "hr", "input", "col", "wbr"].includes(token.tagName) && !token.selfClosing) stack.push(node);
  });
  parser.on("text", token => { if (stack.length) stack.at(-1)!.children.push(token.text); });
  // Keep HTML tag names separately from AKN note classification for closing.
  parser.on("endTag", token => {
    const index = stack.map(n => n.attrs["html-tag"] ?? n.name).lastIndexOf(token.tagName);
    if (index >= 0) stack.length = index;
  });
  parser.end(html);
  return { tableDigest: tableDigest(tables.flatMap(n => segments(n, true))), hasTables: tables.length > 0, hasGraphics };
}
const structures = new Set(["body", "mainBody", "book", "part", "title", "chapter", "section", "subsection", "division", "article", "paragraph", "point", "subparagraph", "content", "intro", "wrapUp", "list", "item", "p", "num", "heading", "table", "tr", "td", "th", "thead", "tbody", "tfoot", "caption", "b", "i", "u", "sup", "sub", "span", "ref", "ins", "del", "br", "authorialNote", "noteRef", "img", "a", "embeddedStructure"]);

export function parseAct(xml: string, publication: Publication, date: string, portal: PortalEvidence): ParsedAct {
  const entries: SourceEntry[] = [], used = new Set<Navigation>();
  const addressKeys = new Set<string>();
  const navigationKey = (label: string, component: string) => `${label}\0${normalized(component).toLowerCase()}`;
  const navigationByKey = new Map<string, Navigation[]>();
  for (const item of portal.navigation) {
    const key = navigationKey(item.label, item.component);
    const matches = navigationByKey.get(key) ?? [];
    matches.push(item); navigationByKey.set(key, matches);
  }
  let inventoryComplete = true;
  const add = (node: XmlNode, kind: SourceEntry["kind"], label: string, hierarchy: Hierarchy, component: string) => {
    const items = segments(node);
    const graphics = [...xmlWalk(node)].filter(n => n.name === "img" || n.name === "embeddedStructure");
    const unread = graphics.length > 0;
    if (unread) inventoryComplete = false; // Graphics may conceal further article occurrences.
    const entry: SourceEntry = { kind, label, selector: node.path, hierarchy, segments: items,
      contentDigest: digest(legalText(segmentText(items))), legalDigest: digest(legalText(segmentText(segments(node, true)))), tableDigest: tableDigest(segments(node, true)), unread };
    const heading = child(node, "heading");
    if (heading) entry.heading = normalized(xmlText(heading));
    if (kind === "article") {
      const matches = navigationByKey.get(navigationKey(label, component)) ?? [];
      const match = matches.find(n => !used.has(n));
      if (!match || addressKeys.has(JSON.stringify(match.address))) throw sourceFailure("address_unverified", `No unambiguous official address for ${label.slice(0, 60)} in ${component.slice(0, 120) || "the main body"}.`);
      // Both sources retain document order. Repeated labels require a complete
      // one-to-one crosswalk of distinct official addresses, checked below.
      entry.address = match.address; used.add(match); addressKeys.add(JSON.stringify(match.address));
      if (component) entry.hierarchy = [...hierarchy, ...match.hierarchy];
    } else {
      const matches = portal.navigation.filter(n => n.label === label || n.component === label);
      if (matches.length === 1 && !used.has(matches[0]!)) {
        entry.address = matches[0]!.address; used.add(matches[0]!);
      }
      if (!entry.address) { entry.unread = true; entry.explanation = "The historical attachment address is unverified; content is withheld."; inventoryComplete = false; }
    }
    const src = graphics[0]?.attrs.src;
    if (src) { const url = new URL(src, portal.source); if (url.origin === "https://www.normattiva.it") entry.officialUrl = url.href; }
    entries.push(entry);
  };
  const check = (node: XmlNode) => {
    for (const n of xmlWalk(node)) if (!structures.has(n.name) || ![AKN, "http://www.w3.org/1999/xhtml"].includes(n.uri)) throw sourceFailure("unsupported_structure", "An unknown legal section prevents complete structural verification.");
  };
  const root = xmlTree(xml, (node, ancestors) => {
    if (node.name === "FRBRExpression") {
      const expression = child(node, "FRBRdate")?.attrs.date;
      if (!expression || !calendarDateSchema.safeParse(expression).success || expression > date) throw sourceFailure("snapshot_conflict", "A component expression cannot establish the requested snapshot.");
    }
    if (node.name === "article") {
      if (ancestors.some(n => n.name === "article" || n.name === "doc" || n.name === "meta") || !ancestors.some(n => n.name === "body")) throw sourceFailure("unsupported_structure", "Unexpected article ancestry prevents complete verification.");
      const bodyPosition = ancestors.findIndex(n => n.name === "body");
      if (ancestors.slice(bodyPosition).some(n => !structures.has(n.name))) throw sourceFailure("unsupported_structure", "An unknown legal section prevents complete structural verification.");
      check(node);
      const label = articleLabel(child(node, "num") ? xmlText(child(node, "num")!) : "");
      if (!label) throw sourceFailure("article_identity_conflict", "An article has an unsupported or missing label.");
      const hierarchy = ancestors.filter(n => ["book", "part", "title", "chapter", "section", "subsection", "division"].includes(n.name)).map(n => ({ kind: n.name,
        label: normalized([child(n, "num"), child(n, "heading")].filter(Boolean).map(h => xmlText(h!)).join(" ")), occurrence: n.path }));
      add(node, "article", label, hierarchy, "");
      return;
    }
    if (node.name !== "doc") return;
    const doc = node, main = child(doc, "mainBody"), name = doc.attrs.name;
    if (!main || !name) throw sourceFailure("unsupported_structure", "An attachment has no identified legal body.");
    check(main);
    const match = /^(.*)-art\.\s*(.+)$/i.exec(name);
    const hierarchy = [{ kind: "doc", label: match?.[1] ?? name, occurrence: doc.path }];
    if (match) {
      const label = articleLabel(match[2]!);
      const actual = articleHeading(xmlText(main), true);
      if (!label || articleLabel(actual ?? "") !== label) {
        add(main, "attachment", name, hierarchy, name);
        const withheld = entries.at(-1)!; withheld.unread = true; withheld.segments = [];
        withheld.explanation = "The component name and legal article heading disagree; this component is unresolved.";
        inventoryComplete = false;
      } else add(main, "article", label, hierarchy, match[1]!);
    } else {
      if ([...xmlWalk(main)].some(n => n.name === "article")) throw sourceFailure("unsupported_structure", "Nested component articles require a verified address crosswalk.");
      add(main, "attachment", name, hierarchy, name);
    }
  });
  const acts = nodes(root);
  if (acts.length !== 1 || acts[0]!.name !== "act" || acts[0]!.uri !== AKN || acts[0]!.attrs.name !== "monovigente") throw sourceFailure("unsupported_structure", "Only one monovigente act is supported.");
  const act = acts[0]!, meta = child(act, "meta");
  if (!meta) throw sourceFailure("source_identity_conflict", "The AKN publication metadata is missing.");
  const identification = child(meta, "identification"), work = identification && child(identification, "FRBRWork");
  const expected = `eli/id/${publication.data_gu.replaceAll("-", "/")}/${publication.codice_redazionale}/CONSOLIDATED/`;
  const aliases = work ? nodes(work).filter(n => n.name === "FRBRalias" && n.attrs.name === "eli") : [];
  if (child(meta, "publication")?.attrs.date !== publication.data_gu || aliases.length !== 1 || !aliases[0]!.attrs.value?.startsWith(expected)) throw sourceFailure("source_identity_conflict", "The AKN identifies another or unverifiable publication.");
  const edition = aliases[0]!.attrs.value!.slice(expected.length);
  if (!/^\d{8}$/.test(edition) || !calendarDateSchema.safeParse(`${edition.slice(0, 4)}-${edition.slice(4, 6)}-${edition.slice(6, 8)}`).success || edition > date.replaceAll("-", "")) throw sourceFailure("snapshot_conflict", "The AKN edition postdates or cannot establish the requested snapshot.");
  for (const n of xmlWalk(act)) {
    if (n.name === "FRBRExpression") {
      const expression = child(n, "FRBRdate")?.attrs.date;
      if (!expression || !calendarDateSchema.safeParse(expression).success || expression > date) throw sourceFailure("snapshot_conflict", "A component expression postdates or cannot establish the requested snapshot.");
    }
  }
  const body = child(act, "body");
  if (!body || nodes(act).filter(n => n.name === "body").length !== 1) throw sourceFailure("unsupported_structure", "One exact main legal body is required.");
  check(body);
  const containers = new Set(["body", "book", "part", "title", "chapter", "section", "subsection", "division"]);
  const checkOutsideArticles = (node: XmlNode) => {
    if (node.children.some(n => typeof n === "string" && normalized(n))) throw sourceFailure("unsupported_structure", "Unassigned legal text outside article occurrences prevents complete verification.");
    for (const n of nodes(node)) {
      if (n.name === "article") continue;
      if (n.name === "num" || n.name === "heading") {
        if ([...xmlWalk(n)].some(c => ["img", "embeddedStructure", "table"].includes(c.name))) throw sourceFailure("unsupported_structure", "Unread heading content requires an explicit section adapter.");
        continue;
      }
      if (!containers.has(n.name)) throw sourceFailure("unsupported_structure", "Legal text or graphics outside verified article occurrences require an explicit section adapter.");
      checkOutsideArticles(n);
    }
  };
  checkOutsideArticles(body);
  for (const n of nodes(act)) if (!["meta", "preface", "preamble", "body", "conclusions", "attachments"].includes(n.name)) throw sourceFailure("unsupported_structure", "An unknown act section prevents complete verification.");
  const outsideNames = new Set([...structures, "preface", "preamble", "conclusions", "docDate", "docNumber", "docTitle", "docType", "citations", "citation", "formula"]);
  const outside = nodes(act).filter(n => ["preface", "preamble", "conclusions"].includes(n.name));
  for (const section of outside) {
    for (const n of xmlWalk(section)) if (!outsideNames.has(n.name) || ![AKN, "http://www.w3.org/1999/xhtml"].includes(n.uri)
      || ["article", "embeddedStructure"].includes(n.name)) throw sourceFailure("unsupported_structure", "An unsupported outer legal section prevents complete verification.");
    if ([...xmlWalk(section)].some(n => n.name === "img")) add(section, "attachment", `${section.name} (unread graphics)`, [{ kind: section.name, label: section.name, occurrence: section.path }], "");
  }
  const attachments = child(act, "attachments");
  if (attachments) for (const attachment of nodes(attachments)) {
    if (attachment.name !== "attachment" || nodes(attachment).length !== 1 || nodes(attachment)[0]!.name !== "doc") throw sourceFailure("unsupported_structure", "An unknown component prevents complete verification.");
  }

  for (const same of navigationByKey.values()) {
    if (same.length > 1 && same.some(n => used.has(n)) && same.some(n => !used.has(n))) throw sourceFailure("address_unverified", "Repeated navigation labels cannot be mapped completely to source occurrences.");
  }
  // Navigation can include later articles on a historical page. It establishes
  // candidate addresses, never membership. Unreconciled candidates prevent
  // both complete inventory claims and negative answers from this snapshot.
  const unmatchedArticleLabels = [...new Set(portal.navigation.filter(n => !used.has(n) && articleLabel(n.label)).map(n => n.label))];
  if (unmatchedArticleLabels.length) inventoryComplete = false;
  for (const [position, candidate] of portal.navigation.entries()) {
    if (used.has(candidate) || articleLabel(candidate.label)) continue;
    inventoryComplete = false;
    entries.push({ kind: "attachment", label: candidate.label, selector: `navigation:${position}`, hierarchy: [
      ...(candidate.component ? [{ kind: "doc", label: candidate.component, occurrence: `navigation:${position}:component` }] : []),
      ...candidate.hierarchy,
    ], segments: [], contentDigest: digest(""), legalDigest: digest(""), tableDigest: tableDigest([]),
      address: candidate.address, officialUrl: candidate.officialUrl, unread: true,
      explanation: "Official navigation identifies a component missing from the acquired AKN; its historical membership and content remain unresolved." });
  }
  const parsedArticles = [...xmlWalk(body)].filter(n => n.name === "article").length;
  const visitedArticles = entries.filter(e => e.kind === "article" && !e.hierarchy.some(h => h.kind === "doc")).length;
  if (parsedArticles !== visitedArticles) throw sourceFailure("unsupported_structure", "Nested articles cannot be silently omitted from the inventory.");
  const outerLegalText = outside.some(n => normalized(xmlText(n)));
  const preamble = child(act, "preamble");
  const explanations: string[] = [];
  if (unmatchedArticleLabels.length) explanations.push("Unmatched official navigation addresses leave membership unresolved.");
  if (outerLegalText) explanations.push("Preface, preamble and conclusion sections lack a verified reading adapter.");
  if (entries.some(e => e.unread)) explanations.push("Unread components may conceal content or articles; references appear on their index pages.");
  return { entries, inventoryComplete, legalComplete: inventoryComplete && !outerLegalText && entries.every(e => !e.unread),
    unmatchedArticleLabels, ...(preamble ? { preambleDigest: digest(legalText(segmentText(segments(preamble)))) } : {}),
    ...(explanations.length ? { coverageExplanation: explanations.join(" ") } : {}) };
}
