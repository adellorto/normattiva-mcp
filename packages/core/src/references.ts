import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { calendarDateSchema, publicationSchema } from "./contracts.js";
import { OperationError, internalError } from "./errors.js";
import { ARTICLE_DETAIL_URL } from "./api.js";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const addressSchema = z.object({
  idArticolo: z.number().int().nonnegative(), sottoArticolo: z.number().int().positive(),
  sottoArticolo1: z.number().int().nonnegative(), flagTipoArticolo: z.string().regex(/^\d{1,6}$/),
  idGruppo: z.number().int().nonnegative(), progressivo: z.number().int().nonnegative(),
  versione: z.number().int().nonnegative(),
}).strict();
export type RetrievalAddress = z.infer<typeof addressSchema>;
const binding = { publication: publicationSchema, date: calendarDateSchema, source: z.string().max(2048), digest: z.string().regex(/^[a-f0-9]{64}$/) };
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
export type Binding = Pick<Reference, "publication" | "date" | "source" | "digest">;

export function referenceError(cursor: boolean): OperationError {
  return new OperationError({ category: cursor ? "invalid_cursor" : "invalid_locator",
    code: cursor ? "invalid_cursor" : "invalid_locator", retryability: false,
    message: "The reference is invalid, untrusted, incompatible, or for another operation." });
}

/** No session database or per-process random key. The configured key survives restart. */
export class ReferenceCodec {
  private readonly key: Buffer;
  constructor(key: Uint8Array) {
    if (key.byteLength < 32) throw internalError("reference_trust_unconfigured", "Configure a signing key of at least 32 bytes.", false);
    this.key = Buffer.from(key);
  }
  act(publication: z.infer<typeof publicationSchema>): string {
    return "a1_" + Buffer.from(JSON.stringify(publicationSchema.parse(publication))).toString("base64url");
  }
  publication(locator: string): z.infer<typeof publicationSchema> {
    try {
      if (!locator.startsWith("a1_") || locator.length > 4096) throw referenceError(false);
      const data = publicationSchema.strict().parse(JSON.parse(Buffer.from(locator.slice(3), "base64url").toString("utf8")));
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(data.codice_redazionale) || this.act(data) !== locator) throw referenceError(false);
      return data;
    } catch { throw referenceError(false); }
  }
  issue(data: Reference): string {
    const body = Buffer.from(JSON.stringify(referenceSchema.parse(data))).toString("base64url");
    const mac = createHmac("sha256", this.key).update(body).digest("base64url");
    const token = `n1_${body}.${mac}`;
    if (token.length > (data.kind === "cursor" ? 16384 : 4096)) throw internalError("reference_limit_exceeded", "The exact reference exceeds its format limit.", false);
    return token;
  }
  decode(token: string, kind: Reference["kind"], operation?: string): Reference {
    try {
      if (token.length > (kind === "cursor" ? 16384 : 4096) || !/^n1_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw referenceError(kind === "cursor");
      const [body, mac] = token.slice(3).split(".") as [string, string];
      const expected = createHmac("sha256", this.key).update(body).digest();
      if (mac !== expected.toString("base64url") || !timingSafeEqual(expected, Buffer.from(mac, "base64url"))) throw referenceError(kind === "cursor");
      const data = referenceSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
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
