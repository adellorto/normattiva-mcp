import { z } from "zod";

export const errorSchema = z.object({
  category: z.enum([
    "invalid_input", "invalid_locator", "invalid_cursor", "transport_failure",
    "rate_limited", "upstream_failure", "internal_failure",
  ]),
  code: z.string().min(1),
  message: z.string().min(1).max(300),
  retryability: z.union([z.boolean(), z.literal("unknown")]),
  retry_after_ms: z.number().nonnegative().optional(),
  provider: z.literal("normattiva").optional(),
  operation: z.string().optional(),
  http_status: z.number().int().optional(),
  upstream_code: z.string().max(80).optional(),
  transport_cause: z.enum(["timeout", "dns", "tls", "connection_reset", "connection_refused", "unknown"]).optional(),
});

export type ErrorDetail = z.infer<typeof errorSchema>;

/** The cause stays internal; only the bounded detail crosses the MCP boundary. */
export class OperationError extends Error {
  constructor(readonly detail: ErrorDetail, options?: ErrorOptions) {
    super(detail.message, options);
    this.name = "OperationError";
  }
}

export function internalError(code: string, message: string, retryability: ErrorDetail["retryability"] = "unknown"): OperationError {
  return new OperationError({ category: "internal_failure", code, message, retryability });
}
