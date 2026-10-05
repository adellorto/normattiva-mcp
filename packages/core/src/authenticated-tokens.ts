import { createHmac, timingSafeEqual } from "node:crypto";
import { internalError } from "./errors.js";

/** Internal integrity primitive; consumers validate their own versioned payloads. */
export class AuthenticatedTokens {
  private readonly key: Buffer;
  constructor(key: Uint8Array) {
    if (key.byteLength < 32) throw internalError("reference_trust_unconfigured", "Configure a signing key of at least 32 bytes.", false);
    this.key = Buffer.from(key);
  }
  issue(prefix: string, data: unknown, limit: number): string {
    const body = Buffer.from(JSON.stringify(data)).toString("base64url");
    const token = `${prefix}${body}.${createHmac("sha256", this.key).update(body).digest("base64url")}`;
    if (token.length > limit) throw internalError("reference_limit_exceeded", "The exact reference exceeds its format limit.", false);
    return token;
  }
  decode(prefix: string, token: string, limit: number): unknown {
    if (token.length > limit || !token.startsWith(prefix)) throw new Error("Invalid token");
    const suffix = token.slice(prefix.length);
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(suffix)) throw new Error("Invalid token");
    const [body, mac] = suffix.split(".") as [string, string];
    const expected = createHmac("sha256", this.key).update(body).digest();
    if (mac !== expected.toString("base64url") || !timingSafeEqual(expected, Buffer.from(mac, "base64url"))) throw new Error("Invalid token");
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  }
}
