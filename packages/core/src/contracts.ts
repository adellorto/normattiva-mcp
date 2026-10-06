import { z } from "zod";
import { errorSchema } from "./errors.js";

export const RESPONSE_LIMITS = Object.freeze({
  discoveryDefault: 5, discoveryMax: 20, indexDefault: 30, indexMax: 50,
  textDefault: 16_000, textMax: 64_000, serializedBytes: 128 * 1024,
  sourceBytes: 24 * 1024 * 1024, inflatedArchiveBytes: 96 * 1024 * 1024,
});

export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !value.startsWith("0000-") && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a real ISO calendar date");
const locator = z.string().min(1).max(4096);
const cursor = z.string().min(1).max(16_384);
const knowledge = z.union([z.boolean(), z.literal("unknown")]);

export const publicationSchema = z.object({
  data_gu: calendarDateSchema, codice_redazionale: z.string().min(1).max(80),
});
export const evidenceSchema = z.object({
  source: z.enum(["official_detail", "official_akn", "official_export", "official_search", "reviewed_alias", "verified_index"]),
  checked_at: z.iso.datetime(),
  snapshot_date: calendarDateSchema.optional(),
  publication: publicationSchema.optional(),
  official_url: z.url().optional(),
  representation_digest: z.string().optional(),
  explanation: z.string().max(300).optional(),
});
export const snapshotSchema = z.object({
  act_locator: locator,
  snapshot_date: calendarDateSchema,
  representation_digest: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
  newer_version_known: knowledge,
  freshness_checked_at: z.iso.datetime().optional(),
  latest_known_change: calendarDateSchema.optional(),
});
export const coverageSchema = z.object({
  article_inventory_complete: z.boolean(),
  legal_content_complete: z.boolean(),
  unread_attachment_refs: z.array(locator),
  explanation: z.string().max(300).optional(),
});
export const requestedSchema = z.object({
  act_locator: locator.optional(),
  publication: publicationSchema.optional(),
  snapshot_date: calendarDateSchema,
  article_reference: z.string().min(1).optional(),
  article_locator: locator.optional(),
  attachment_ref: locator.optional(),
});

export const articleContentSchema = z.object({
  format: z.enum(["text", "html"]), text: z.string(),
  title: z.string().optional(),
  effective_from: calendarDateSchema.optional(), effective_to: calendarDateSchema.optional(),
});
const lookupFields = {
  reason: z.string().min(1), requested: requestedSchema, evidence: z.array(evidenceSchema).min(1),
};
export const lookupOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ ...lookupFields, outcome: z.literal("found"), content: articleContentSchema }).strict(),
  z.object({ ...lookupFields, outcome: z.literal("absent"),
    absence_basis: z.enum(["verified_index", "unambiguous_official_result"]) }).strict(),
  z.object({ ...lookupFields, outcome: z.literal("unresolved") }).strict(),
]);

// Direct article pages keep the legal conclusion separate from execution
// progress. Per-target outcomes in composed work use lookupOutcomeSchema.
const foundArticleFields = { ...lookupFields, outcome: z.literal("found"), content: articleContentSchema };
const usefulArticleContent = articleContentSchema.extend({ text: z.string().min(1) });
const articleProgressSchema = z.discriminatedUnion("progress", [
  z.object({ ...foundArticleFields, progress: z.literal("complete") }).strict(),
  z.object({ ...foundArticleFields, content: usefulArticleContent, progress: z.literal("more"),
    cursor, explanation: z.string().max(300) }).strict(),
  z.object({ ...foundArticleFields, content: usefulArticleContent, progress: z.literal("interrupted"),
    cursor, failure: z.object({ error: errorSchema, position: z.string().min(1) }),
    explanation: z.string().max(300) }).strict(),
]);
const articlePageBaseSchema = z.object({
  ...lookupFields, outcome: z.enum(["found", "absent", "unresolved"]),
  content: articleContentSchema.optional(),
  absence_basis: z.enum(["verified_index", "unambiguous_official_result"]).optional(),
  progress: z.enum(["more", "complete", "interrupted"]).optional(),
  cursor: cursor.optional(),
  failure: z.object({ error: errorSchema, position: z.string().min(1) }).optional(),
  explanation: z.string().max(300).optional(),
}).strict();
export const articlePageSchema = articlePageBaseSchema.superRefine((value, ctx) => {
  const schema = value.outcome === "found" ? articleProgressSchema : lookupOutcomeSchema;
  const result = schema.safeParse(value);
  if (!result.success) ctx.addIssue({ code: "custom", message: "Article outcome and continuation fields conflict." });
});

// SDK clients can validate even isError responses against outputSchema. Keep
// one object-root JSON schema while enforcing the exclusive branches here.
export const articleToolResultSchema = articlePageBaseSchema.partial().extend({
  error: errorSchema.optional(),
}).superRefine((value, ctx) => {
  const schema = value.error ? z.object({ error: errorSchema }).strict() : articlePageSchema;
  if (!schema.safeParse(value).success) ctx.addIssue({ code: "custom", message: "Use an article page or a typed error envelope." });
});

const hierarchy = z.array(z.object({ kind: z.string(), label: z.string(), occurrence: z.string() }));
const entryFields = { label: z.string(), heading: z.string().optional(), hierarchy, official_urn: z.string().optional() };
export const indexEntrySchema = z.discriminatedUnion("kind", [
  z.object({ ...entryFields, kind: z.literal("article"), article_locator: locator }),
  z.object({ ...entryFields, kind: z.literal("attachment"), attachment_ref: locator,
    text_available: z.boolean(), official_url: z.url().optional(),
    historical_link_verified: z.boolean(), explanation: z.string().max(300).optional() }),
]);

/** Cell coordinates and spans stay meaningful across table chunks and pages. */
export const contentSegmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), block_id: z.string(), offset: z.number().int().nonnegative(), text: z.string() }),
  z.object({ kind: z.literal("table"), table_id: z.string(),
    row_count: z.number().int().nonnegative(), column_count: z.number().int().positive(),
    cells: z.array(z.object({ row: z.number().int().nonnegative(), column: z.number().int().nonnegative(),
      row_span: z.number().int().positive(), column_span: z.number().int().positive(),
      header: z.boolean(), offset: z.number().int().nonnegative(), text: z.string() })) }),
]);
export const readingEntrySchema = z.object({
  entry: indexEntrySchema,
  segments: z.array(contentSegmentSchema),
  content_complete: z.boolean(),
});

function pageSchema<T extends z.ZodType>(item: T) {
  return z.discriminatedUnion("progress", [
    z.object({ progress: z.literal("pending"), items: z.array(item).max(0), cursor,
      explanation: z.string().max(300) }).strict(),
    z.object({ progress: z.literal("more"), items: z.array(item).min(1), cursor,
      explanation: z.string().max(300) }).strict(),
    z.object({ progress: z.literal("complete"), items: z.array(item) }).strict(),
    z.object({ progress: z.literal("interrupted"), items: z.array(item).min(1), cursor,
      failure: z.object({ error: errorSchema, position: z.string().min(1) }),
      explanation: z.string().max(300) }).strict(),
  ]);
}

export const indexPageSchema = z.object({ snapshot: snapshotSchema, coverage: coverageSchema,
  traversal: pageSchema(indexEntrySchema) });
export const readingPageSchema = z.object({ snapshot: snapshotSchema, coverage: coverageSchema,
  traversal: pageSchema(readingEntrySchema) });
const actCandidateSchema = z.object({
  act_locator: locator, publication: publicationSchema, title: z.string(),
  official_urn: z.string().optional(), evidence: z.array(evidenceSchema).min(1),
  alias: z.object({ name: z.string(), provenance: z.string(), verified_at: calendarDateSchema }).optional(),
  current: knowledge,
  supersedes: z.array(locator).optional(), superseded_by: z.array(locator).optional(),
});
export const discoveryPageSchema = z.object({
  match: z.enum(["identified", "candidates", "no_candidates"]),
  interpretation: z.string(), article_reference: z.string().optional(),
  ordering: z.enum(["reviewed_alias", "exact_citation", "observed_relevance", "chronological", "degraded_chronological"]),
  corpus: z.literal("live"),
  explanation: z.string().max(300).optional(),
  traversal: pageSchema(actCandidateSchema),
}).superRefine((value, ctx) => {
  if (value.traversal.progress === "pending") ctx.addIssue({ code: "custom", message: "Discovery has no preparation state." });
  if (value.match === "identified" && (value.traversal.items.length !== 1 || value.traversal.progress !== "complete")) {
    ctx.addIssue({ code: "custom", message: "Identification requires one exact selected act." });
  }
  if (value.match === "no_candidates" && (value.traversal.items.length !== 0 || value.traversal.progress !== "complete")) {
    ctx.addIssue({ code: "custom", message: "An empty discovery conclusion requires a completed bounded search." });
  }
});

export const discoveryInputSchema = z.object({ request: z.string().trim().min(1).max(4096) }).strict();
export const discoveryContinuationInputSchema = z.object({ cursor: cursor.describe(
  "Copy an actual d1_ cursor returned by discovery, without changes. No placeholders or guesses. If none was returned, ask before calling this tool.") }).strict();
export const indexInputSchema = z.union([
  z.object({ act_locator: locator, snapshot_date: calendarDateSchema.optional(),
    page_size: z.number().int().min(1).max(RESPONSE_LIMITS.indexMax).default(RESPONSE_LIMITS.indexDefault) }).strict(),
  z.object({ cursor, page_size: z.number().int().min(1).max(RESPONSE_LIMITS.indexMax).optional() }).strict(),
]);
const readBudget = z.number().int().min(1).max(RESPONSE_LIMITS.textMax);
export const articleInputSchema = z.union([
  z.object({ article_locator: locator, max_chars: readBudget.default(RESPONSE_LIMITS.textDefault) }).strict(),
  z.object({ act_locator: locator, article_reference: z.string().trim().min(1).max(200),
    snapshot_date: calendarDateSchema.optional(), max_chars: readBudget.default(RESPONSE_LIMITS.textDefault) }).strict(),
  z.object({ cursor, max_chars: readBudget.optional() }).strict(),
]);
export const actInputSchema = z.union([
  z.object({ act_locator: locator, snapshot_date: calendarDateSchema.optional(), attachment_ref: locator.optional(),
    max_chars: readBudget.default(RESPONSE_LIMITS.textDefault) }).strict(),
  z.object({ cursor, max_chars: readBudget.optional() }).strict(),
]);

export type LookupOutcome = z.infer<typeof lookupOutcomeSchema>;
export type ArticlePage = z.infer<typeof articlePageSchema>;
export type IndexPage = z.infer<typeof indexPageSchema>;
export type ReadingPage = z.infer<typeof readingPageSchema>;
export type DiscoveryPage = z.infer<typeof discoveryPageSchema>;
