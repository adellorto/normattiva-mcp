import { internalError } from "./errors.js";

/** No per-process fallback: restart-safe references require preserved trust. */
export function configuredSigningKey(): Buffer {
  const value = process.env.NORMATTIVA_REFERENCE_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw internalError("reference_trust_unconfigured",
      "Set NORMATTIVA_REFERENCE_KEY to a preserved cryptographically generated 32-byte key (64 hexadecimal characters).", false);
  }
  return Buffer.from(value, "hex");
}
