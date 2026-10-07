import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { internalError } from "./errors.js";
const decodedByteLimit = 16384;

/** Internal integrity primitive; consumers validate their own versioned payloads. */
export class AuthenticatedTokens {
  private readonly key: Buffer;
  constructor(key: Uint8Array) {
    if (key.byteLength < 32) throw internalError("reference_trust_unconfigured", "Configure a signing key of at least 32 bytes.", false);
    this.key = Buffer.from(key);
  }
  issue(prefix: string, data: unknown, limit: number, compressed = false): string {
    const json = Buffer.from(JSON.stringify(data));
    if (compressed && json.byteLength > decodedByteLimit) throw internalError("reference_limit_exceeded", "The exact reference exceeds its decoded format limit.", false);
    // Most references fit in 1 KiB. Grow output in small chunks instead of
    // retaining a default 16 KiB buffer for every cursor/locator size probe.
    const body = (compressed ? deflateRawSync(json, { chunkSize: 1024 }) : json).toString("base64url");
    const token = `${prefix}${body}.${createHmac("sha256", this.key).update(body).digest("base64url")}`;
    if (token.length > limit) throw internalError("reference_limit_exceeded", "The exact reference exceeds its format limit.", false);
    return token;
  }
  decode(prefix: string, token: string, limit: number, compressed = false): unknown {
    if (token.length > limit || !token.startsWith(prefix)) throw new Error("Invalid token");
    const suffix = token.slice(prefix.length);
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(suffix)) throw new Error("Invalid token");
    const [body, mac] = suffix.split(".") as [string, string];
    const expected = createHmac("sha256", this.key).update(body).digest();
    if (mac !== expected.toString("base64url") || !timingSafeEqual(expected, Buffer.from(mac, "base64url"))) throw new Error("Invalid token");
    const bytes = Buffer.from(body, "base64url");
    if (bytes.toString("base64url") !== body) throw new Error("Invalid token");
    // Authenticate before inflation and bound the decoded allocation too.
    return JSON.parse((compressed ? inflateRawSync(bytes, { maxOutputLength: decodedByteLimit }) : bytes).toString("utf8"));
  }
}
