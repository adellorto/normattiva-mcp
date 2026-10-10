import { RESPONSE_LIMITS } from "./contracts.js";
import { internalError } from "./errors.js";

/** The byte ceiling includes both MCP representations and all envelope fields. */
export function jsonContent(data: Record<string, unknown>) {
  const result = {
    structuredContent: data,
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
  assertResponseSize(result);
  return result;
}

export function assertResponseSize(result: unknown): void {
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > RESPONSE_LIMITS.serializedBytes) {
    throw internalError("response_limit_exceeded", "The response cannot fit the serialized byte limit.", false);
  }
}
