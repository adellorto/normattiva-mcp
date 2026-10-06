import { createHash } from "node:crypto";
import { z } from "zod";
import { calendarDateSchema, publicationSchema } from "./contracts.js";
import { OperationError } from "./errors.js";
import { AuthenticatedTokens } from "./authenticated-tokens.js";
import { ARTICLE_DETAIL_URL } from "./api.js";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const addressSchema = z.object({
  idArticolo: z.number().int().nonnegative(), sottoArticolo: z.number().int().positive(),
  sottoArticolo1: z.number().int().nonnegative(), flagTipoArticolo: z.string().regex(/^\d{1,6}$/),
  idGruppo: z.number().int().nonnegative(), progressivo: z.number().int().nonnegative(),
  versione: z.number().int().nonnegative(),
}).strict();
export type RetrievalAddress = z.infer<typeof addressSchema>;
export const actIdentitySchema = z.object({
  type: z.string().trim().min(1).max(120), issued: calendarDateSchema, number: z.number().int().positive(),
  gazette: z.number().int().positive(), supplement: z.object({ type: z.string().min(1).max(12), number: z.number().int().nonnegative() }).strict().optional(),
}).strict();
export type ActIdentity = z.infer<typeof actIdentitySchema>;
const actReferenceSchema = z.object({ v: z.literal(2), publication: publicationSchema, identity: actIdentitySchema }).strict();
const binding = { publication: publicationSchema, date: calendarDateSchema, source: z.string().max(2048), digest: z.string().regex(/^[a-f0-9]{64}$/), identity: actIdentitySchema.optional() };
const position = { index: z.number().int().nonnegative(), segment: z.number().int().nonnegative(), offset: z.number().int().nonnegative() };
const targetFields = { selector: z.string().max(1024), label: z.string().max(300), contentDigest: z.string().regex(/^[a-f0-9]{64}$/) };
const referenceSchema = z.discriminatedUnion("kind", [
  z.object({ v: z.literal(1), kind: z.literal("article"), ...binding, ...targetFields, address: addressSchema,
    legalDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(), tableDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(), unread: z.boolean().optional() }).strict(),
  z.object({ v: z.literal(1), kind: z.literal("attachment"), ...binding, ...targetFields }).strict(),
  z.object({ v: z.literal(1), kind: z.literal("cursor"), ...binding, operation: z.enum(["list_articles", "read_act", "read_article"]),
    ...position, limit: z.number().int().positive(), target: z.string().max(4096).optional() }).strict(),
]);
export type Reference = z.infer<typeof referenceSchema>;
export type Binding = Pick<Reference, "publication" | "date" | "source" | "digest" | "identity">;

export function referenceError(cursor: boolean): OperationError {
  return new OperationError({ category: cursor ? "invalid_cursor" : "invalid_locator",
    code: cursor ? "invalid_cursor" : "invalid_locator", retryability: false,
    message: "The reference is invalid, untrusted, incompatible, or for another operation." });
}

/** No session database or per-process random key. The configured key survives restart. */
export class ReferenceCodec {
  private readonly tokens: AuthenticatedTokens;
  constructor(key: Uint8Array) {
    this.tokens = new AuthenticatedTokens(key);
  }
  act(publication: z.infer<typeof publicationSchema>, identity?: ActIdentity): string {
    if (identity) return this.tokens.issue("a2_", actReferenceSchema.parse({ v: 2, publication, identity }), 4096);
    return "a1_" + Buffer.from(JSON.stringify(publicationSchema.parse(publication))).toString("base64url");
  }
  publication(locator: string): z.infer<typeof publicationSchema> {
    return this.actReference(locator).publication;
  }
  actReference(locator: string): { publication: z.infer<typeof publicationSchema>; identity?: ActIdentity } {
    try {
      if (locator.startsWith("a2_")) return actReferenceSchema.parse(this.tokens.decode("a2_", locator, 4096));
      if (!locator.startsWith("a1_") || locator.length > 4096) throw referenceError(false);
      const data = publicationSchema.strict().parse(JSON.parse(Buffer.from(locator.slice(3), "base64url").toString("utf8")));
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(data.codice_redazionale) || this.act(data) !== locator) throw referenceError(false);
      return { publication: data };
    } catch { throw referenceError(false); }
  }
  issue(data: Reference): string {
    return this.tokens.issue("n1_", referenceSchema.parse(data), data.kind === "cursor" ? 16384 : 4096);
  }
  decode(token: string, kind: Reference["kind"], operation?: string): Reference {
    try {
      const data = referenceSchema.parse(this.tokens.decode("n1_", token, kind === "cursor" ? 16384 : 4096));
      if (data.kind !== kind || (data.kind === "cursor" && data.operation !== operation)) throw referenceError(kind === "cursor");
      const source = new URL(data.source);
      const direct = source.href === ARTICLE_DETAIL_URL
        && ((data.kind === "article" && data.selector === "direct") || (data.kind === "cursor" && data.operation === "read_article"));
      if (direct) return data;
      if (source.origin !== "https://www.normattiva.it" || source.pathname !== "/do/atto/caricaAKN" || source.username || source.password) throw referenceError(kind === "cursor");
      if (source.searchParams.get("dataGU") !== data.publication.data_gu.replaceAll("-", "")
        || source.searchParams.get("codiceRedaz") !== data.publication.codice_redazionale
        || source.searchParams.get("dataVigenza") !== data.date.replaceAll("-", "")) throw referenceError(kind === "cursor");
      return data;
    } catch { throw referenceError(kind === "cursor"); }
  }
}
