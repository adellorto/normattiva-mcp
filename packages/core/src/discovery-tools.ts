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
    description: "FIRST STEP for any act or article request: call ONLY find_acts, with the entire user message unchanged, then STOP and wait for the result. Do not send a speculative sequence of tools. The server plans citations, names, articles and dates. Preserve issuance/publication distinctions and contradictions. A next page needs a returned cursor; otherwise ask without tools. Returns act locators, never article text. Empty discovery does not prove absence.",
    inputSchema: discoveryInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.findActs(args, extra.signal))));
  server.registerTool("continue_acts", {
    description: "ONLY discovery pagination: copy the actual d1_ cursor returned by find_acts or continue_acts. Never call this for list_articles, read_article or read_act results; continue those with the SAME tool. Without a returned discovery cursor, ask for it without tools. Never invent references. Live search completion is traversal completion, not exhaustive legal relevance.",
    inputSchema: discoveryContinuationInputSchema, outputSchema: resultSchema,
  }, async (args, extra) => runTool("composed", extra.signal, context, args,
    async () => jsonContent(await finder.continueActs(args, extra.signal))));
}
