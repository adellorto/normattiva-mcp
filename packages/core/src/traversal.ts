import { z } from "zod";
import { dettaglioAtto, officialText, ARTICLE_DETAIL_URL, type WebsiteSession } from "./api.js";
import { OperationError, internalError } from "./errors.js";
import { currentCall, upstreamRuntime, type UpstreamRuntime } from "./upstream.js";
import { RESPONSE_LIMITS, indexInputSchema, articleInputSchema, actInputSchema, indexPageSchema, readingPageSchema,
  articlePageSchema, type IndexPage, type ReadingPage, type ArticlePage } from "./contracts.js";
import { assertResponseSize } from "./serialization.js";
import { ReferenceCodec, digest, type Reference, type Binding, type ActIdentity } from "./references.js";
import { parsePortal, detailText, detailStructure, articleLabel, articleHeading, sourceFailure,
  type Publication, type ParsedAct, type SourceEntry, type Segment } from "./act-source.js";
import { prepareSource, parseSource } from "./source-parser.js";

interface Acquired extends Binding, ParsedAct { checkedAt: string; verified: Set<string>; notesOnly?: boolean; renderedControlUrl?: string; }
interface Options { signingKey: Uint8Array; upstream?: UpstreamRuntime; cacheBytes?: number; }
type Cursor = Extract<Reference, { kind: "cursor" }>;
type ArticleReference = Extract<Reference, { kind: "article" }>;
const invalidInput = () => new OperationError({ category: "invalid_input", code: "invalid_input", message: "Use one valid target or literal continuation cursor with bounded inputs.", retryability: false });
const fits = (page: unknown) => { try { assertResponseSize({ structuredContent: page, content: [{ type: "text", text: JSON.stringify(page) }] }); return true; } catch { return false; } };
const binding = (act: Binding): Binding => ({ publication: act.publication, date: act.date, source: act.source, digest: act.digest,
  ...(act.identity ? { identity: act.identity } : {}) });
const boundary = (text: string, end: number) => end > 0 && end < text.length
  && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff
  && text.charCodeAt(end) >= 0xdc00 && text.charCodeAt(end) <= 0xdfff ? end - 1 : end;
function characterEnd(text: string, start: number, allowance: number): number {
  let end = start, count = 0;
  while (end < text.length && count++ < allowance) end += text.codePointAt(end)! > 0xffff ? 2 : 1;
  return end;
}
function characters(text: string): number { let count = 0; for (const _ of text) count++; return count; }

/** Shared source/reading seam. Cache entries are conveniences; references contain all binding and position data. */
export class ActTraversal {
  private readonly codec: ReferenceCodec;
  private readonly runtime: UpstreamRuntime;
  private readonly cache = new Map<string, { act: Acquired; bytes: number }>();
  private cacheSize = 0;
  private readonly cacheLimit: number;
  constructor(options: Options) {
    this.codec = new ReferenceCodec(options.signingKey);
    this.runtime = options.upstream ?? upstreamRuntime;
    this.cacheLimit = options.cacheBytes ?? 32 * 1024 * 1024;
  }
  actLocator(publication: Publication): string { return this.codec.act(publication); }
  evict(): void { this.cache.clear(); this.cacheSize = 0; }
  private call<T>(kind: "direct" | "composed", signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    // MCP and composed callers own the existing allowance; never reset it.
    return currentCall() ? work() : this.runtime.call(kind, signal, work);
  }
  private input<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value); if (!parsed.success) throw invalidInput(); return parsed.data;
  }
  private cursor(value: string, operation: string): Cursor { return this.codec.decode(value, "cursor", operation) as Cursor; }
  private continuation(act: Binding, operation: Cursor["operation"], index: number, segment: number, offset: number, limit: number, target?: string): string {
    return this.codec.issue({ v: 1, kind: "cursor", ...binding(act), operation, index, segment, offset, limit, ...(target ? { target } : {}) });
  }
  private entry(act: Acquired, entry: SourceEntry): IndexPage["traversal"]["items"][number] {
    const target = { v: 1 as const, ...binding(act), selector: entry.selector, label: entry.label, contentDigest: entry.contentDigest };
    const common = { label: entry.label, ...(entry.heading ? { heading: entry.heading } : {}), hierarchy: entry.hierarchy };
    return entry.kind === "article" ? { ...common, kind: "article", article_locator: this.codec.issue({ ...target, kind: "article", address: entry.address!, legalDigest: entry.legalDigest, tableDigest: entry.tableDigest, unread: entry.unread }) }
      : { ...common, kind: "attachment", attachment_ref: this.codec.issue({ ...target, kind: "attachment" }), text_available: !entry.unread,
        historical_link_verified: false, ...(entry.officialUrl ? { official_url: entry.officialUrl } : {}),
        ...(entry.unread ? { explanation: entry.explanation ?? "This component contains unread graphics. Its full contents were not retrieved." } : {}) };
  }
  private envelope(act: Acquired, verifiedThrough = 0, displayedEntries: IndexPage["traversal"]["items"] = []) {
    const evidence: IndexPage["snapshot"]["evidence"] = [{ source: "official_akn" as const, checked_at: act.checkedAt, publication: act.publication,
      snapshot_date: act.date, official_url: act.source, representation_digest: act.digest,
      ...(act.notesOnly ? { explanation: "The official copies differ only within identified explanatory notes; this page retains the selected AKN copy." } : {}) }];
    if (act.renderedControlUrl) evidence.push({ source: "official_detail", checked_at: act.checkedAt, publication: act.publication,
      snapshot_date: act.date, official_url: act.renderedControlUrl });
    return { snapshot: { act_locator: this.codec.act(act.publication, act.identity), snapshot_date: act.date, representation_digest: act.digest,
      evidence, newer_version_known: "unknown" as const },
      coverage: { article_inventory_complete: act.inventoryComplete && verifiedThrough === act.entries.length,
        legal_content_complete: act.legalComplete && verifiedThrough === act.entries.length,
        unread_attachment_refs: displayedEntries.flatMap(e => e.kind === "attachment" && !e.text_available ? [e.attachment_ref] : []),
        ...(act.coverageExplanation ? { explanation: act.coverageExplanation }
          : verifiedThrough < act.entries.length ? { explanation: "Remaining entries need verification." } : {}) } };
  }
  private async acquire(publication: Publication, date: string, expected?: Binding, identity = expected?.identity): Promise<Acquired> {
    return prepareSource(currentCall()!.signal, () => this.acquirePrepared(publication, date, expected, identity));
  }
  private async acquirePrepared(publication: Publication, date: string, expected?: Binding, identity?: ActIdentity): Promise<Acquired> {
    const key = JSON.stringify([publication, date, identity]);
    const cached = this.cache.get(key);
    if (cached) {
      if (expected && (cached.act.digest !== expected.digest || cached.act.source !== expected.source)) throw sourceFailure("representation_changed", "The cached representation differs from the continuation binding.");
      this.cache.delete(key); this.cache.set(key, cached); return cached.act;
    }
    const url = `https://www.normattiva.it/eli/id/${publication.data_gu.replaceAll("-", "/")}/${encodeURIComponent(publication.codice_redazionale)}/CONSOLIDATED/${date.replaceAll("-", "")}`;
    const session: WebsiteSession = {};
    const page = await officialText(url, session);
    const portal = parsePortal(page.text, page.url, publication, date);
    if (expected && portal.source !== expected.source) throw sourceFailure("representation_changed", "The supplied structured source address changed; continuation cannot switch representations.");
    const source = await officialText(portal.source, session);
    if (source.url !== portal.source) throw sourceFailure("source_unverified", "The structured download changed address without publication/date verification.");
    // The frozen reading representation includes the supplied address crosswalk
    // and unresolved navigation components, not just the XML legal body.
    const fingerprint = digest(JSON.stringify({ akn: digest(source.text), navigation: portal.navigation }));
    if (expected && fingerprint !== expected.digest) throw sourceFailure("representation_changed", "The acquired representation changed; continuation cannot switch or restart.");
    const completed = this.cache.get(key);
    if (completed?.act.digest === fingerprint && completed.act.source === portal.source) return completed.act;
    const parsed = await parseSource(source.text, publication, date, portal, currentCall()!.signal);
    const anchor = parsed.entries.find(e => e.kind === "article");
    if (!anchor) throw sourceFailure("snapshot_unverified", "No independent dated article control is available to verify this source.");
    // Independent controls are checked per occurrence before useful output.
    // A cursor authenticates already verified prefixes of this exact digest.
    const act: Acquired = { ...parsed, publication, date, ...(identity ? { identity } : {}), source: portal.source, digest: fingerprint, checkedAt: new Date().toISOString(), verified: new Set() };
    if (identity && portal.rendered) {
      const control = portal.rendered, first = act.entries[0];
      if (first?.kind === "article" && !first.unread) {
        if (control.from > date || (control.to && control.to < date)) throw sourceFailure("snapshot_conflict", "The rendered article validity does not cover the selected date.");
        const structure = detailStructure(control.html);
        if (structure.hasGraphics || structure.tableDigest !== first.tableDigest || digest(detailText(control.html)) !== first.contentDigest)
          throw sourceFailure("source_content_conflict", "The independent rendered first occurrence disagrees with the AKN; the index is withheld.");
        act.verified.add(first.selector); act.renderedControlUrl = page.url;
      }
    }
    const bytes = Buffer.byteLength(JSON.stringify(act));
    if (bytes <= this.cacheLimit) {
      while (this.cacheSize + bytes > this.cacheLimit || this.cache.size >= 8) {
        const oldest = this.cache.keys().next().value!; this.cacheSize -= this.cache.get(oldest)!.bytes; this.cache.delete(oldest);
      }
      this.cache.set(key, { act, bytes }); this.cacheSize += bytes;
    }
    return act;
  }
  private async verifyEntry(act: Acquired, entry: SourceEntry): Promise<void> {
    if (entry.unread || act.verified.has(entry.selector)) return;
    if (!entry.address) throw sourceFailure("address_unverified", "No exact historical retrieval address is available.");
    const detail = await this.verifiedDetail(act.publication, act.date, entry.kind === "article" ? entry.label : undefined, entry.address, entry.contentDigest, entry.legalDigest, entry.tableDigest, act.identity);
    if (detail.notesOnly) act.notesOnly = true;
    act.verified.add(entry.selector);
  }
  private async verifiedDetail(publication: Publication, date: string, label: string | undefined, address: ArticleReference["address"], expectedDigest?: string, expectedLegalDigest?: string, expectedTableDigest?: string, identity?: ActIdentity) {
    const result = await dettaglioAtto({ ...address, dataGU: publication.data_gu, codiceRedazionale: publication.codice_redazionale,
      dataVigenza: date, tipoDettaglio: "singolavigenza" });
    const atto = result.data?.atto;
    if (!result.success || !atto?.articoloHtml) throw sourceFailure("target_unresolved", "The official detail did not establish the requested target.");
    const subtitle = atto.sottoTitolo ?? "";
    // Missing editorial metadata can use independent proof; conflicting
    // editorial metadata cannot. These are the official legacy/current code forms.
    const editorialConflict = [...subtitle.matchAll(/\((\d{3}[A-Z]\d{4}|\d{2}[A-Z]\d{5})\)/g)]
      .some(match => match[1] !== publication.codice_redazionale);
    const gu = [atto.annoGU, atto.meseGU, atto.giornoGU].map((v, i) => String(v).padStart(i === 0 ? 4 : 2, "0")).join("-");
    const issued = identity && [atto.annoProvvedimento, atto.meseProvvedimento, atto.giornoProvvedimento].map((v, i) => String(v).padStart(i === 0 ? 4 : 2, "0")).join("-");
    const identityVerified = identity ? atto.tipoProvvedimentoDescrizione === identity.type && issued === identity.issued
      && atto.numeroProvvedimento === identity.number && atto.numeroGU === identity.gazette
      && (identity.supplement ? atto.tipoSupplementoCode === identity.supplement.type && atto.numeroSupplemento === identity.supplement.number
        : !atto.tipoSupplementoCode && !atto.numeroSupplemento)
      : subtitle.includes(`(${publication.codice_redazionale})`);
    if (editorialConflict || !identityVerified || gu !== publication.data_gu) throw sourceFailure("source_identity_conflict", "The article detail did not verify the exact publication.");
    const from = atto.articoloDataInizioVigenza, to = atto.articoloDataFineVigenza;
    if (!from || from > date || (to && to < date)) throw sourceFailure("snapshot_conflict", "The article's official validity interval does not cover the requested date.");
    const text = detailText(atto.articoloHtml);
    const structure = detailStructure(atto.articoloHtml);
    if (structure.hasGraphics) throw sourceFailure("graphic_content_unread", "This article includes unread graphics. Full content cannot be certified without interpreting them.");
    if (expectedTableDigest && structure.tableDigest !== expectedTableDigest) throw sourceFailure("source_table_conflict", "The official copies disagree on table relationships or cell values; the result is withheld.");
    const heading = articleHeading(text);
    if (label && articleLabel(heading ?? "") !== label) throw sourceFailure("article_identity_conflict", "The returned article heading does not match the requested occurrence.");
    const notesOnly = !!expectedDigest && digest(text) !== expectedDigest && !!expectedLegalDigest && digest(detailText(atto.articoloHtml, true)) === expectedLegalDigest;
    if (expectedDigest && digest(text) !== expectedDigest && !notesOnly) throw sourceFailure("source_content_conflict", "The structured and direct sources disagree on legal content or unclassified notes; the result is withheld.");
    return { text, from, to, title: atto.titolo, notesOnly, tableDigest: structure.tableDigest, hasTables: structure.hasTables };
  }
  async listArticles(value: unknown, signal?: AbortSignal): Promise<IndexPage> {
    const args = this.input(indexInputSchema, value);
    const cursor = "cursor" in args ? this.cursor(args.cursor, "list_articles") : undefined;
    const actReference = cursor ?? this.codec.actReference("act_locator" in args ? args.act_locator : "");
    const { publication, identity } = actReference;
    const date = cursor?.date ?? ("snapshot_date" in args ? args.snapshot_date : undefined) ?? new Date().toISOString().slice(0, 10);
    const limit = args.page_size ?? cursor?.limit ?? RESPONSE_LIMITS.indexDefault;
    return this.call("composed", signal, async () => {
      const act = await this.acquire(publication, date, cursor, identity);
      let index = cursor?.index ?? 0;
      if (index > act.entries.length || (cursor && (cursor.segment || cursor.offset || cursor.target))) throw invalidInput();
      if (cursor) for (const entry of act.entries.slice(0, index)) if (!entry.unread) act.verified.add(entry.selector);
      const items: IndexPage["traversal"]["items"] = [];
      let failure: OperationError | undefined;
      const make = (): IndexPage => ({ ...this.envelope(act, index, items), traversal: !items.length && index < act.entries.length ? { progress: "pending", items: [],
        cursor: this.continuation(act, "list_articles", index, 0, 0, limit), explanation: "Source acquisition completed; occurrence verification continues in the next call." }
        : failure ? { progress: "interrupted", items,
        cursor: this.continuation(act, "list_articles", index, 0, 0, limit), failure: { error: failure.detail, position: String(index) }, explanation: "Prefix preserved; continue with the literal cursor." }
        : index === act.entries.length ? { progress: "complete", items }
        : { progress: "more", items, cursor: this.continuation(act, "list_articles", index, 0, 0, limit), explanation: "These entries are one index page. Continue with the literal cursor for the remaining entries." } });
      while (index < act.entries.length && items.length < limit) {
        if (currentCall()!.attempts >= currentCall()!.maxAttempts && !act.verified.has(act.entries[index]!.selector)) break;
        try { await this.verifyEntry(act, act.entries[index]!); }
        catch (error) { if (!items.length || !(error instanceof OperationError)) throw error; failure = error; break; }
        items.push(this.entry(act, act.entries[index]!)); index++;
        if (!fits(make())) { items.pop(); index--; break; }
      }
      if (index < act.entries.length && !items.length && currentCall()!.attempts < currentCall()!.maxAttempts) throw internalError("index_entry_limit_exceeded", "An exact index entry cannot fit the serialized response limit.", false);
      const result = indexPageSchema.parse(make()); assertResponseSize({ structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] }); return result;
    });
  }
  async readArticle(value: unknown, signal?: AbortSignal): Promise<ArticlePage> {
    const args = this.input(articleInputSchema, value);
    const cursor = "cursor" in args ? this.cursor(args.cursor, "read_article") : undefined;
    const token = cursor?.target ?? ("article_locator" in args ? args.article_locator : undefined);
    let exact = token ? this.codec.decode(token, "article") as ArticleReference : undefined;
    if (cursor && (!exact || JSON.stringify(binding(cursor)) !== JSON.stringify(binding(exact)))) throw invalidInput();
    const actReference = exact ?? this.codec.actReference("act_locator" in args ? args.act_locator : "");
    const { publication, identity } = actReference;
    const date = exact?.date ?? ("snapshot_date" in args ? args.snapshot_date : undefined) ?? new Date().toISOString().slice(0, 10);
    const label = exact?.label ?? articleLabel("article_reference" in args ? args.article_reference : "");
    if (!label) throw invalidInput();
    const limit = args.max_chars ?? cursor?.limit ?? RESPONSE_LIMITS.textDefault;
    return this.call("direct", signal, async () => {
      const evidence = [{ source: "official_detail" as const, checked_at: new Date().toISOString(), publication, snapshot_date: date, official_url: ARTICLE_DETAIL_URL }];
      const requested = { act_locator: this.codec.act(publication, identity), snapshot_date: date, article_reference: label,
        ...(token ? { article_locator: token } : {}) };
      if (!exact) {
        const acquired = [...this.cache.values()].map(c => c.act).find(a => a.date === date && JSON.stringify(a.publication) === JSON.stringify(publication)
          && JSON.stringify(a.identity) === JSON.stringify(identity));
        if (acquired) {
          if (acquired.unmatchedArticleLabels.includes(label)) return { outcome: "unresolved", reason: "source_membership_conflict", requested,
            evidence: [{ ...evidence[0]!, explanation: "An official navigation address is missing from the acquired representation; historical membership is unresolved." }] };
          const matches = acquired.entries.filter(e => e.kind === "article" && e.label === label);
          if (!matches.length && acquired.inventoryComplete && acquired.entries.every(e => acquired.verified.has(e.selector))) return { outcome: "absent", reason: "complete_inventory_excludes_article", requested,
            evidence: [{ source: "verified_index", checked_at: acquired.checkedAt, publication, snapshot_date: date, representation_digest: acquired.digest }], absence_basis: "verified_index" };
          if (matches.length > 1) return { outcome: "unresolved", reason: "exact_occurrence_required", requested,
            evidence: [{ ...evidence[0]!, explanation: "Multiple occurrences share this label. Select the exact article_locator from list_articles." }] };
          if (matches.length === 1) {
            const entry = this.entry(acquired, matches[0]!);
            if (entry.kind === "article") {
              exact = this.codec.decode(entry.article_locator, "article") as ArticleReference;
              Object.assign(requested, { article_locator: entry.article_locator });
            }
          }
        }
      }
      // Ordinary base articles have an established direct coordinate path. No annex or suffix guessing.
      if (!exact && !/^\d+$/.test(label)) return { outcome: "unresolved", reason: "exact_locator_required", requested,
        evidence: [{ ...evidence[0]!, explanation: "Use list_articles to select an exact article_locator for this suffixed or structured reference." }] };
      if (exact?.unread) return { outcome: "unresolved", reason: "graphic_content_unread", requested,
        evidence: [{ ...evidence[0]!, explanation: "The acquired article contains unread graphics; its full content is withheld." }] };
      let content: Awaited<ReturnType<ActTraversal["verifiedDetail"]>>;
      const address = exact?.address ?? { idArticolo: Number(label), sottoArticolo: 1, sottoArticolo1: 0, flagTipoArticolo: "0", idGruppo: 0, progressivo: 0, versione: 0 };
      try {
        content = await this.verifiedDetail(publication, date, label, address, exact?.contentDigest, cursor ? undefined : exact?.legalDigest, exact?.tableDigest, identity);
      } catch (error) {
        if (!(error instanceof OperationError)) throw error;
        if (error.detail.http_status !== 404 && !["target_unresolved", "source_identity_conflict", "snapshot_conflict", "article_identity_conflict", "source_content_conflict", "source_table_conflict", "graphic_content_unread"].includes(error.detail.code)) throw error;
        return { outcome: "unresolved", reason: error.detail.code, requested, evidence: [{ ...evidence[0]!, explanation: error.detail.message }] };
      }
      if (content.hasTables) return { outcome: "unresolved", reason: "structured_table_reading_required", requested,
        evidence: [{ ...evidence[0]!, explanation: "Use read_act for this publication and snapshot date to preserve table cells, headers and spans in bounded pages." }] };
      const text = content.text, offset = cursor?.offset ?? 0;
      if (content.notesOnly) evidence[0] = { ...evidence[0]!, ...{ explanation: "The official copies differ only within identified explanatory notes; this read uses the validated direct copy." } };
      if (offset >= text.length && offset !== 0) throw invalidInput();
      let end = characterEnd(text, offset, limit);
      const source = exact?.source ?? ARTICLE_DETAIL_URL;
      const reference = exact ? { ...exact, contentDigest: digest(text), legalDigest: undefined } : { v: 1 as const, kind: "article" as const, publication, date, source, ...(identity ? { identity } : {}), digest: digest(text), label, selector: "direct", contentDigest: digest(text),
        address, tableDigest: content.tableDigest };
      const make = (): ArticlePage => ({ outcome: "found", reason: "verified_official_article", requested, evidence,
        content: { format: "text", text: text.slice(offset, end), ...(content.title ? { title: content.title } : {}),
          ...(content.from ? { effective_from: content.from } : {}), ...(content.to ? { effective_to: content.to } : {}) },
        ...(end === text.length ? { progress: "complete" as const } : { progress: "more" as const,
          cursor: this.continuation(reference, "read_article", 0, 0, end, limit, content.notesOnly ? this.codec.issue(reference) : token ?? this.codec.issue(reference)), explanation: "This page contains part of the article. Continue with the literal cursor for the remaining text." }) });
      while (!fits(make()) && end > offset) end = boundary(text, offset + Math.floor((end - offset) / 2));
      if (end === offset && text.length > offset) throw internalError("response_limit_exceeded", "The article envelope leaves no space for content.", false);
      return articlePageSchema.parse(make());
    });
  }
  async readAct(value: unknown, signal?: AbortSignal): Promise<ReadingPage> {
    const args = this.input(actInputSchema, value);
    const cursor = "cursor" in args ? this.cursor(args.cursor, "read_act") : undefined;
    const attachmentToken = cursor?.target ?? ("attachment_ref" in args ? args.attachment_ref : undefined);
    const attachment = attachmentToken ? this.codec.decode(attachmentToken, "attachment") : undefined;
    const actReference = cursor ?? this.codec.actReference("act_locator" in args ? args.act_locator : "");
    const { publication, identity } = actReference;
    const date = cursor?.date ?? ("snapshot_date" in args ? args.snapshot_date : undefined) ?? attachment?.date ?? new Date().toISOString().slice(0, 10);
    if (attachment && (JSON.stringify(attachment.publication) !== JSON.stringify(publication) || attachment.date !== date
      || (cursor && JSON.stringify(binding(cursor)) !== JSON.stringify(binding(attachment))))) throw invalidInput();
    const limit = args.max_chars ?? cursor?.limit ?? RESPONSE_LIMITS.textDefault;
    return this.call("composed", signal, async () => {
      const act = await this.acquire(publication, date, cursor ?? attachment, identity);
      const entries = attachment ? act.entries.filter(e => e.selector === (attachment as Extract<Reference, { kind: "attachment" }>).selector) : act.entries;
      if (attachment && (entries.length !== 1 || entries[0]!.kind !== "attachment" || entries[0]!.contentDigest !== (attachment as Extract<Reference, { kind: "attachment" }>).contentDigest)) throw invalidInput();
      if (attachment && entries[0]!.unread) throw sourceFailure("attachment_unread", entries[0]!.explanation ?? "The attachment includes unread graphics; its full content is unresolved.");
      let index = cursor?.index ?? 0, segment = cursor?.segment ?? 0, offset = cursor?.offset ?? 0, chars = 0;
      const items: ReadingPage["traversal"]["items"] = [];
      let failure: OperationError | undefined;
      if (index > entries.length || (index === entries.length && (segment || offset))) throw invalidInput();
      const make = (): ReadingPage => ({ ...this.envelope(act, attachment ? 0 : index, items.map(i => i.entry)), traversal: !items.length && index < entries.length ? { progress: "pending", items: [],
        cursor: this.continuation(act, "read_act", index, segment, offset, limit, attachmentToken), explanation: "Source acquisition completed; content verification continues in the next call." }
        : failure ? { progress: "interrupted", items,
        cursor: this.continuation(act, "read_act", index, segment, offset, limit, attachmentToken), failure: { error: failure.detail, position: `${index}:${segment}:${offset}` }, explanation: "Prefix preserved; continue with the literal cursor." }
        : index === entries.length ? { progress: "complete", items }
        : { progress: "more", items, cursor: this.continuation(act, "read_act", index, segment, offset, limit, attachmentToken), explanation: "These entries are one reading page. Continue with the literal cursor for the remaining content." } });
      while (index < entries.length && chars < limit && items.length < RESPONSE_LIMITS.indexMax) {
        const entry = entries[index]!;
        if (currentCall()!.attempts >= currentCall()!.maxAttempts && !act.verified.has(entry.selector)) break;
        try { await this.verifyEntry(act, entry); }
        catch (error) { if (!items.length || !(error instanceof OperationError)) throw error; failure = error; break; }
        const units = entry.unread ? [] : entry.segments.flatMap<Segment>(s => s.kind === "text" || !s.cells.length ? [s] : s.cells.map(cell => ({ ...s, cells: [cell] })));
        if (segment > units.length || (segment === units.length && offset)) throw invalidInput();
        const output: Segment[] = [];
        const item = { entry: this.entry(act, entry), segments: output, content_complete: false };
        items.push(item);
        while (segment < units.length && chars < limit) {
          const unit = units[segment]!, text = unit.kind === "text" ? unit.text : unit.cells[0]?.text ?? "";
          if (offset > text.length) throw invalidInput();
          const start = offset;
          let end = characterEnd(text, offset, limit - chars);
          const chunk = () => unit.kind === "text" ? { ...unit, offset: start, text: text.slice(start, end) }
            : { ...unit, cells: unit.cells.length ? [{ ...unit.cells[0]!, offset: start, text: text.slice(start, end) }] : [] };
          output.push(chunk());
          while (!fits(make()) && end > start) { end = boundary(text, start + Math.floor((end - start) / 2)); output[output.length - 1] = chunk(); }
          if (!fits(make()) || (end === start && text.length > start)) { output.pop(); break; }
          chars += characters(text.slice(start, end)); offset = end;
          if (offset === text.length) { segment++; offset = 0; } else break;
        }
        if (segment === units.length) { item.content_complete = !entry.unread; index++; segment = 0; offset = 0; }
        else if (!output.length) { items.pop(); break; }
        else break;
        if (!fits(make())) { items.pop(); index--; segment = 0; offset = 0; break; }
      }
      if (!items.length && index < entries.length && currentCall()!.attempts < currentCall()!.maxAttempts) throw internalError("response_limit_exceeded", "The reading envelope leaves no space for content.", false);
      const result = readingPageSchema.parse(make()); assertResponseSize({ structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] }); return result;
    });
  }
}
