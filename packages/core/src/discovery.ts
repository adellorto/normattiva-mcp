import { z } from "zod";
import { ricercaAvanzata, ricercaSemplice, BASE_URL } from "./api.js";
import { ReferenceCodec, digest, referenceError } from "./references.js";
import { AuthenticatedTokens } from "./authenticated-tokens.js";
import { RESPONSE_LIMITS, publicationSchema, discoveryInputSchema, discoveryContinuationInputSchema, discoveryPageSchema, type DiscoveryPage } from "./contracts.js";
import { discoveryPlanSchema, planDiscovery, invalidRequest, type DiscoveryPlan, type Citation } from "./discovery-plan.js";
import { currentCall, upstreamRuntime, type UpstreamRuntime } from "./upstream.js";
import { assertResponseSize } from "./serialization.js";
import { OperationError, internalError } from "./errors.js";
import type { AttoListItem, RicercaResponse } from "./types.js";
import { ACT_ALIASES, ALIAS_VERSION, type ActAlias } from "./act-aliases.js";

const advancedPath = "/bff-opendata/v1/api/v1/ricerca/avanzata", simplePath = advancedPath.replace("avanzata", "semplice");
const malformed = () => new OperationError({ category: "upstream_failure", code: "malformed_upstream_response",
  message: "Normattiva returned inconsistent discovery data.", retryability: false, provider: "normattiva" });
type Candidate = DiscoveryPage["traversal"]["items"][number];
type Target = { citation?: Citation; alias?: ActAlias };
interface Options { signingKey: Uint8Array; upstream?: UpstreamRuntime; pageSize?: number; }
const cursorSchema = z.object({
  v: z.literal(1), operation: z.literal("continue_acts"), alias_version: z.literal(ALIAS_VERSION), plan: discoveryPlanSchema,
  target: z.number().int().nonnegative(), page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  offset: z.number().int().nonnegative().max(RESPONSE_LIMITS.discoveryMax),
  limit: z.number().int().positive().max(RESPONSE_LIMITS.discoveryMax),
  page_digest: z.string().regex(/^[a-f0-9]{64}$/).optional(), degraded: z.boolean(),
}).strict();
type SearchCursor = z.infer<typeof cursorSchema>;
const fits = (page: unknown, reserve = 0) => {
  const result = { structuredContent: page, content: [{ type: "text", text: JSON.stringify(page) }] };
  try { assertResponseSize(result); return Buffer.byteLength(JSON.stringify(result), "utf8") <= RESPONSE_LIMITS.serializedBytes - reserve; } catch { return false; }
};

/** Discovery owns interpretation, validation and live-corpus continuation; it never reads legal content. */
export class ActDiscovery {
  private readonly codec: ReferenceCodec;
  private readonly tokens: AuthenticatedTokens;
  private readonly runtime: UpstreamRuntime;
  private readonly limit: number;
  constructor(options: Options) {
    this.codec = new ReferenceCodec(options.signingKey); this.tokens = new AuthenticatedTokens(options.signingKey);
    this.runtime = options.upstream ?? upstreamRuntime;
    this.limit = z.number().int().min(1).max(RESPONSE_LIMITS.discoveryMax).parse(options.pageSize ?? RESPONSE_LIMITS.discoveryDefault);
  }
  async findActs(input: unknown, signal?: AbortSignal): Promise<DiscoveryPage> {
    const parsed = discoveryInputSchema.safeParse(input);
    if (!parsed.success) throw invalidRequest("Supply only a nonempty bounded request.", "invalid_input");
    const plan = planDiscovery(parsed.data.request);
    try {
      this.continuation({ v: 1, operation: "continue_acts", alias_version: ALIAS_VERSION, plan, target: 20,
        page: Number.MAX_SAFE_INTEGER, offset: 19, limit: this.limit, page_digest: "0".repeat(64), degraded: false });
    } catch { throw invalidRequest("Shorten the request so its exact interpretation fits a bounded continuation reference.", "request_reference_limit"); }
    return this.call(signal, () => this.search({ v: 1, operation: "continue_acts", alias_version: ALIAS_VERSION, plan,
      target: 0, page: 1, offset: 0, limit: this.limit, degraded: false }));
  }
  async continueActs(input: unknown, signal?: AbortSignal): Promise<DiscoveryPage> {
    const parsed = discoveryContinuationInputSchema.safeParse(input);
    if (!parsed.success) throw invalidRequest("Supply only the literal discovery cursor.", "invalid_input");
    let state: SearchCursor;
    try {
      state = cursorSchema.parse(this.tokens.decode("d1_", parsed.data.cursor, 16384));
      // The serialized plan is authoritative; never reparse its request as a
      // new search. Validate state relationships before scheduling traffic.
      if ((state.plan.route === "exact" && !state.plan.citation)
        || (state.plan.route === "alias" && (!state.plan.aliases?.length || state.plan.aliases.some(id => !ACT_ALIASES.some(alias => alias.id === id))))
        || (["relevance", "advanced"].includes(state.plan.route) && state.target !== 0)
        || (state.offset > 0 && !state.page_digest) || state.offset >= state.limit
        || (state.degraded && state.plan.route !== "relevance")) throw referenceError(true);
      if (state.target >= this.targets(state.plan).length) throw referenceError(true);
    } catch { throw referenceError(true); }
    return this.call(signal, () => this.search(state));
  }
  private call<T>(signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    return currentCall() ? work() : this.runtime.call("composed", signal, work);
  }
  private targets(plan: DiscoveryPlan): Target[] {
    if (plan.route === "exact") return [{ citation: plan.citation! }];
    if (plan.route === "alias") return plan.aliases!.map(id => {
      const alias = ACT_ALIASES.find(alias => alias.id === id)!;
      return { citation: alias.citation, alias };
    });
    return [{}];
  }
  private candidate(item: AttoListItem, target: Target, path: string): Candidate {
    const { citation, alias } = target;
    if (citation && (typeof item.denominazioneAtto !== "string" || item.denominazioneAtto.toUpperCase() !== citation.type || String(item.annoProvvedimento) !== citation.year
      || !/^\d+$/.test(String(item.numeroProvvedimento)) || String(Number(item.numeroProvvedimento)) !== citation.number
      || (citation.issued && (typeof item.dataEmanazione !== "string" || item.dataEmanazione.slice(0, 10) !== citation.issued)))) throw malformed();
    const parsed = publicationSchema.strict().safeParse({ data_gu: item.dataGU, codice_redazionale: item.codiceRedazionale });
    if (!parsed.success || !/^[A-Za-z0-9_-]{1,80}$/.test(parsed.data.codice_redazionale)
      || typeof item.titoloAtto !== "string" || !item.titoloAtto.trim()) throw malformed();
    const publication = parsed.data;
    const candidate: Candidate = { act_locator: this.codec.act(publication), publication, title: item.titoloAtto, current: "unknown",
      evidence: [{ source: "official_search", checked_at: new Date().toISOString(), publication, official_url: BASE_URL + path }] };
    return alias ? { ...candidate, official_urn: alias.urn, alias: { name: alias.name, provenance: alias.provenance, verified_at: alias.verified_at },
      evidence: [...candidate.evidence, { source: "reviewed_alias", checked_at: `${alias.verified_at}T00:00:00Z`, official_url: alias.provenance }] } : candidate;
  }
  private ordering(state: SearchCursor): DiscoveryPage["ordering"] {
    return state.plan.route === "exact" ? "exact_citation" : state.plan.route === "alias" ? "reviewed_alias"
      : state.plan.route === "relevance" ? state.degraded ? "degraded_chronological" : "observed_relevance" : "chronological";
  }
  private envelope(state: SearchCursor, traversal: DiscoveryPage["traversal"], identified = false): DiscoveryPage {
    return { match: identified ? "identified" : traversal.items.length ? "candidates" : "no_candidates",
      interpretation: state.plan.request, ...(state.plan.article ? { article_reference: state.plan.article } : {}),
      ordering: this.ordering(state), corpus: "live", traversal,
      ...(state.degraded ? { explanation: "Observed relevance search is unavailable; this search uses chronological ordering." }
        : state.plan.uncertainTime ? { explanation: "The acts are live-verified, but their requested current or historical status remains unknown; select a candidate with that limitation." }
        : !traversal.items.length ? { explanation: "This bounded discovery returned no candidates. It does not prove legal absence." } : {}) };
  }
  private continuation(state: SearchCursor): string { return this.tokens.issue("d1_", cursorSchema.parse(state), 16384); }
  private more(state: SearchCursor, items: Candidate[]): DiscoveryPage {
    return this.envelope(state, { progress: "more", items, cursor: this.continuation(state),
      explanation: "Continue with the literal cursor. Search uses a live corpus; pages may change between calls." });
  }
  private async fetchPage(state: SearchCursor, target: Target): Promise<{ response: RicercaResponse; path: string }> {
    const { plan } = state, paginazione = { paginaCorrente: state.page, numeroElementiPerPagina: state.limit };
    if (plan.route === "relevance" && !state.degraded) return {
      response: await ricercaSemplice({ testoRicerca: plan.query!, orderType: "rilevante", paginazione }), path: simplePath };
    return { response: await ricercaAvanzata({ ...plan.filters, testoRicerca: plan.query || undefined,
      ...(target.citation ? { denominazioneAtto: target.citation.type, annoProvvedimento: target.citation.year, numeroProvvedimento: target.citation.number } : {}),
      ...(target.citation?.issued ? { giornoProvvedimento: String(Number(target.citation.issued.slice(8))), meseProvvedimento: String(Number(target.citation.issued.slice(5, 7))) } : {}),
      orderType: "recente", paginazione }), path: advancedPath };
  }
  private validatePage(response: RicercaResponse, state: SearchCursor): AttoListItem[] {
    const { numeroAttiTrovati: total, numeroPagine: pages, paginaCorrente: page, listaAtti: items } = response;
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(pages) || !Number.isSafeInteger(page)
      || total! < 0 || pages! < 0 || page !== state.page || !items || items.length > state.limit
      || total! < items.length || (total === 0 && (pages! > 1 || items.length !== 0))
      || (total! > 0 && (pages !== Math.ceil(total! / state.limit)
        || items.length !== Math.min(state.limit, Math.max(0, total! - (state.page - 1) * state.limit))))
      || (total! > 0 && (pages! < 1 || (!items.length && state.page <= pages!) || (state.page === 1 && pages === 1 && total !== items.length)))
      || new Set(items.map(item => `${item.dataGU}|${item.codiceRedazionale}`)).size !== items.length) throw malformed();
    if (state.offset > items.length || (state.page_digest && state.page_digest !== digest(JSON.stringify(items)))) {
      throw new OperationError({ category: "upstream_failure", code: "live_search_page_changed", message: "The live search page changed during within-page continuation. Start a new discovery request.", retryability: false });
    }
    return items;
  }
  private async search(initial: SearchCursor): Promise<DiscoveryPage> {
    let state = { ...initial };
    const items: Candidate[] = [], targets = this.targets(state.plan);
    let soleExactMatch = false;
    while (state.target < targets.length) {
      const scope = currentCall()!;
      if (items.length && scope.attempts >= scope.maxAttempts) return this.finish(this.more(state, items));
      try {
        const target = targets[state.target]!;
        const { response, path } = await this.fetchPage(state, target);
        const sourceItems = this.validatePage(response, state);
        soleExactMatch = targets.length === 1 && state.page === 1 && response.numeroAttiTrovati === 1
          && ["exact", "alias"].includes(state.plan.route) && !(state.plan.route === "alias" && state.plan.uncertainTime);
        for (let index = state.offset; index < sourceItems.length; index++) {
          const candidate = this.candidate(sourceItems[index]!, target, path);
          const unfinished = { ...state, offset: index, page_digest: digest(JSON.stringify(sourceItems)) };
          const after = index + 1 < sourceItems.length ? { ...unfinished, offset: index + 1 }
            : state.page < response.numeroPagine! ? { ...state, page: state.page + 1, offset: 0, page_digest: undefined }
            : { ...state, target: state.target + 1, page: 1, offset: 0, page_digest: undefined };
          const proposed = after.target < targets.length ? this.more(after, [...items, candidate])
            : this.envelope(state, { progress: "complete", items: [...items, candidate] }, soleExactMatch);
          // Reserve room for a typed interruption and its first unfinished
          // position, even when the next upstream operation fails unexpectedly.
          if (!fits(proposed, 2048)) {
            if (!items.length) throw internalError("response_limit_exceeded", "One discovery candidate cannot fit the serialized response limit.", false);
            return this.finish(this.more(unfinished, items));
          }
          items.push(candidate); state = after;
          if (items.length >= state.limit || state.target >= targets.length) return this.finish(proposed);
        }
        if (!sourceItems.length) state = { ...state, target: state.target + 1, page: 1, offset: 0, page_digest: undefined };
      } catch (error) {
        if (error instanceof OperationError && error.detail.category === "upstream_failure"
          && error.detail.code === "upstream_http_error" && error.detail.operation === simplePath
          && [404, 405, 501].includes(error.detail.http_status ?? 0)
          && state.plan.route === "relevance" && !state.degraded && state.page === 1 && state.offset === 0 && !items.length) {
          state = { ...state, degraded: true }; continue;
        }
        if (!(error instanceof OperationError) || !items.length) throw error;
        return this.finish(this.envelope(state, { progress: "interrupted", items, cursor: this.continuation(state),
          failure: { error: error.detail, position: `target:${state.target}/page:${state.page}/offset:${state.offset}` },
          explanation: "Discovery was interrupted after useful candidates. Resume the first unfinished position with the literal cursor." }));
      }
    }
    return this.finish(this.envelope(state, { progress: "complete", items }, soleExactMatch));
  }
  private finish(page: DiscoveryPage): DiscoveryPage {
    const result = discoveryPageSchema.parse(page);
    if (!fits(result)) throw internalError("response_limit_exceeded", "The discovery envelope cannot fit the serialized response limit.", false);
    return result;
  }
}
