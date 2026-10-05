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

/** Staged registration; both default transports migrate together in stage 4. */
export function registerDiscoveryTools(server: McpServer, finder: ActDiscovery, context: ToolContext = {}): void {
  server.registerTool("find_acts", {
    description: "Find official Italian acts from the user's citation, common name or topic. Preserve dates, constraints and article references in request. Returns act locators and candidates, without article text. Empty discovery does not prove legal absence.",
    inputSchema: discoveryInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.findActs(args, extra.signal))));
  server.registerTool("continue_acts", {
    description: "Continue act discovery using only the literal cursor returned by find_acts or continue_acts. Search uses a live corpus; completion describes this traversal, not exhaustive legal relevance.",
    inputSchema: discoveryContinuationInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.continueActs(args, extra.signal))));
}
