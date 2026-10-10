import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { internalError } from "./errors.js";
const decodedByteLimit = 16384;
const base32Alphabet = "abcdefghijklmnopqrstuvwxyz234567";
type WireEncoding = "base64url" | "base32";
type WireFormat = Readonly<{ compressed: boolean; encoding: WireEncoding }>;
export const TOKEN_WIRE_FORMATS = Object.freeze({
  json: Object.freeze({ compressed: false, encoding: "base64url" as const }),
  compact: Object.freeze({ compressed: true, encoding: "base64url" as const }),
  lowercaseCompact: Object.freeze({ compressed: true, encoding: "base32" as const }),
});

function base32Encode(bytes: Uint8Array): string {
  let output = "", value = 0, bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) {
      bits -= 5; output += base32Alphabet[(value >>> bits) & 31];
    }
    value = bits ? value & ((1 << bits) - 1) : 0;
  }
  if (bits) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string): Buffer {
  if (!/^[a-z2-7]+$/.test(value)) throw new Error("Invalid token");
  const output: number[] = [];
  let accumulator = 0, bits = 0;
  for (const character of value) {
    accumulator = (accumulator << 5) | base32Alphabet.indexOf(character); bits += 5;
    if (bits >= 8) {
      bits -= 8; output.push((accumulator >>> bits) & 255);
      accumulator = bits ? accumulator & ((1 << bits) - 1) : 0;
    }
  }
  const bytes = Buffer.from(output);
  if (accumulator || base32Encode(bytes) !== value) throw new Error("Invalid token");
  return bytes;
}

const encode = (value: Uint8Array, encoding: WireEncoding) => encoding === "base32"
  ? base32Encode(value) : Buffer.from(value).toString("base64url");
const decode = (value: string, encoding: WireEncoding) => encoding === "base32"
  ? base32Decode(value) : Buffer.from(value, "base64url");

/** Internal integrity primitive; consumers validate their own versioned payloads. */
export class AuthenticatedTokens {
  private readonly key: Buffer;
  constructor(key: Uint8Array) {
    if (key.byteLength < 32) throw internalError("reference_trust_unconfigured", "Configure a signing key of at least 32 bytes.", false);
    this.key = Buffer.from(key);
  }
  issue(prefix: string, data: unknown, limit: number, format: WireFormat = TOKEN_WIRE_FORMATS.json): string {
    const json = Buffer.from(JSON.stringify(data));
    if (format.compressed && json.byteLength > decodedByteLimit) throw internalError("reference_limit_exceeded", "The exact reference exceeds its decoded format limit.", false);
    // Most references fit in 1 KiB. Grow output in small chunks instead of
    // retaining a default 16 KiB buffer for every cursor/locator size probe.
    const bytes = format.compressed ? deflateRawSync(json, { chunkSize: 1024 }) : json;
    const body = encode(bytes, format.encoding);
    const token = `${prefix}${body}.${encode(createHmac("sha256", this.key).update(body).digest(), format.encoding)}`;
    if (token.length > limit) throw internalError("reference_limit_exceeded", "The exact reference exceeds its format limit.", false);
    return token;
  }
  decode(prefix: string, token: string, limit: number, format: WireFormat = TOKEN_WIRE_FORMATS.json): unknown {
    if (token.length > limit || !token.startsWith(prefix)) throw new Error("Invalid token");
    const suffix = token.slice(prefix.length);
    const pattern = format.encoding === "base32" ? /^[a-z2-7]+\.[a-z2-7]{52}$/ : /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
    if (!pattern.test(suffix)) throw new Error("Invalid token");
    const [body, mac] = suffix.split(".") as [string, string];
    const expected = createHmac("sha256", this.key).update(body).digest();
    const supplied = decode(mac, format.encoding);
    if (mac !== encode(expected, format.encoding) || supplied.byteLength !== expected.byteLength || !timingSafeEqual(expected, supplied)) throw new Error("Invalid token");
    const bytes = decode(body, format.encoding);
    if (encode(bytes, format.encoding) !== body) throw new Error("Invalid token");
    // Authenticate before inflation and bound the decoded allocation too.
    const json = format.compressed ? inflateRawSync(bytes, { maxOutputLength: decodedByteLimit }) : bytes;
    return JSON.parse(json.toString("utf8"));
  }
}
