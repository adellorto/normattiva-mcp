import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ActDiscovery } from "./discovery.js";
import { runTool } from "./execution.js";
import { jsonContent } from "./serialization.js";
import { errorSchema } from "./errors.js";
import { discoveryInputSchema, discoveryContinuationInputSchema, discoveryPageSchema } from "./contracts.js";
import type { ToolContext } from "./context.js";

const resultSchema = z.object(discoveryPageSchema.shape).partial().extend({ error: errorSchema.optional() }).superRefine((value, ctx) => {
  const schema = value.error ? z.object({ error: errorSchema }).strict() : discoveryPageSchema;
  if (!schema.safeParse(value).success) ctx.addIssue({ code: "custom", message: "Use a discovery page or a typed error envelope." });
});

/** Shared discovery registration for both default transports. */
export function registerDiscoveryTools(server: McpServer, finder: ActDiscovery, context: ToolContext = {}): void {
  server.registerTool("find_acts", {
    description: "Discover official Italian acts: make one find_acts call with the complete user request verbatim, then wait for its result before reading or searching further. The server separates article intent and plans citation/name/topic/date constraints. Never replace issuance with publication or silently repair contradictions. For a next page without a returned cursor, ask for it without tools. Returns opaque act locators, never article text. Empty discovery does not prove absence.",
    inputSchema: discoveryInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.findActs(args, extra.signal))));
  server.registerTool("continue_acts", {
    description: "Continue discovery only with an actual returned d1_ cursor from find_acts or continue_acts, copied literally. If none is available, make no tool call: ask for the cursor in one short sentence. Never invent a cursor or use article/index/whole-act cursors. Search uses a live corpus; completion describes this traversal, not exhaustive legal relevance.",
    inputSchema: discoveryContinuationInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.continueActs(args, extra.signal))));
}
