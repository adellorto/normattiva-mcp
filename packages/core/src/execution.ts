import { OperationError, internalError } from "./errors.js";
import { upstreamRuntime, type CallKind } from "./upstream.js";
import type { ToolContext } from "./context.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { calendarDateSchema } from "./contracts.js";

export function validateCalendarDates(args: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(args)) {
    if (!key.startsWith("data_") || typeof value !== "string") continue;
    if (!calendarDateSchema.safeParse(value).success) {
      throw new OperationError({ category: "invalid_input", code: "invalid_calendar_date",
        message: `The ${key} field must be a real ISO calendar date.`, retryability: false });
    }
  }
  if (typeof args.mese === "number" && typeof args.giorno === "number") {
    // Without a year, February 29 is possible; February 30 never is.
    const year = typeof args.anno === "number" ? args.anno : 2000;
    const date = `${String(year).padStart(4, "0")}-${String(args.mese).padStart(2, "0")}-${String(args.giorno).padStart(2, "0")}`;
    if (!calendarDateSchema.safeParse(date).success) throw new OperationError({
      category: "invalid_input", code: "invalid_calendar_date", retryability: false,
      message: "The year/month/day fields must describe a possible calendar date.",
    });
  }
  for (const [start, end] of [
    ["data_inizio", "data_fine"], ["data_emanazione_da", "data_emanazione_a"],
    ["data_pubblicazione_da", "data_pubblicazione_a"],
  ] as const) {
    if (typeof args[start] === "string" && typeof args[end] === "string" && args[start] > args[end]) {
      throw new OperationError({ category: "invalid_input", code: "inverted_date_range",
        message: "The end date must not precede the start date.", retryability: false });
    }
  }
  if (typeof args.data_inizio === "string" && typeof args.data_fine === "string") {
    const start = new Date(`${args.data_inizio}T00:00:00Z`);
    const end = new Date(`${args.data_fine}T00:00:00Z`);
    const anniversary = new Date(start);
    anniversary.setUTCFullYear(start.getUTCFullYear() + 1);
    if (end > anniversary) throw new OperationError({ category: "invalid_input", code: "update_window_too_large",
      message: "The updates window must be at most twelve months.", retryability: false });
  }
}

export async function runResource<T>(signal: AbortSignal, context: ToolContext, work: () => Promise<T>): Promise<T> {
  try {
    return await (context.upstream ?? upstreamRuntime).call("direct", signal, work);
  } catch (error) {
    if (error instanceof OperationError) {
      throw new McpError(ErrorCode.InternalError, error.detail.message, { error: error.detail });
    }
    throw new McpError(ErrorCode.InternalError, "An unexpected resource failure interrupted the operation.");
  }
}

export async function runTool<T>(
  kind: CallKind, signal: AbortSignal, context: ToolContext,
  args: Record<string, unknown>, work: () => Promise<T>,
) {
  try {
    validateCalendarDates(args);
    return await (context.upstream ?? upstreamRuntime).call(kind, signal, work);
  } catch (cause) {
    const error = cause instanceof OperationError ? cause
      : internalError("unexpected_internal_failure", "An unexpected internal failure interrupted the operation.");
    return {
      isError: true,
      structuredContent: { error: error.detail },
      content: [{ type: "text" as const, text: `${error.detail.code}: ${error.detail.message}` }],
    };
  }
}
