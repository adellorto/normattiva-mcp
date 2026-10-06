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
    description: "Start discovery of official Italian acts from the user's citation, common name or topic. Preserve dates, constraints and article references in request. For a next-page request without a returned cursor, make no tool call: ask for that cursor instead of searching again. Returns act locators and candidates, without article text. Empty discovery does not prove legal absence.",
    inputSchema: discoveryInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.findActs(args, extra.signal))));
  server.registerTool("continue_acts", {
    description: "Continue discovery only with an actual returned d1_ cursor from find_acts or continue_acts, copied literally. If none is available, make no tool call: ask for the cursor in one short sentence. Never invent a cursor or use article/index/whole-act cursors. Search uses a live corpus; completion describes this traversal, not exhaustive legal relevance.",
    inputSchema: discoveryContinuationInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.continueActs(args, extra.signal))));
}
