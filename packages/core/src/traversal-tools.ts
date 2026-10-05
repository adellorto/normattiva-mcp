import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ActTraversal } from "./traversal.js";
import { runTool } from "./execution.js";
import { jsonContent } from "./serialization.js";
import { errorSchema } from "./errors.js";
import { calendarDateSchema, RESPONSE_LIMITS, indexPageSchema, readingPageSchema, articleToolResultSchema } from "./contracts.js";
import type { ToolContext } from "./context.js";

// This registration seam is used for the staged replacement interface. The
// coordinated public migration/discovery stage will select it in both servers.
function pageResult<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial().extend({ error: errorSchema.optional() }).superRefine((value, ctx) => {
    if (!((value as { error?: unknown }).error ? z.object({ error: errorSchema }).strict() : schema).safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Use a traversal page or a typed error envelope." });
    }
  });
}
export function registerTraversalTools(server: McpServer, reader: ActTraversal, context: ToolContext = {}): void {
  const locator = z.string().min(1).max(4096).optional(), cursor = z.string().min(1).max(16384).optional();
  const max_chars = z.number().int().min(1).max(RESPONSE_LIMITS.textMax).optional();
  server.registerTool("list_articles", {
    description: "List verified article occurrences and attachment references at a frozen date. Pass the returned cursor literally to continue. Coverage remains incomplete while verification continues.",
    inputSchema: { act_locator: locator, snapshot_date: calendarDateSchema.optional(), cursor,
      page_size: z.number().int().min(1).max(RESPONSE_LIMITS.indexMax).optional() },
    outputSchema: pageResult(indexPageSchema),
  }, async (args, extra) => runTool("composed", extra.signal, context, args, async () => jsonContent(await reader.listArticles(args, extra.signal))));
  server.registerTool("read_article", {
    description: "Read one exact article or readable reference. Unresolved is not absence. Large articles return a literal cursor that resumes within content; article locators work after restart without rebuilding an index.",
    inputSchema: { act_locator: locator, article_locator: locator, article_reference: z.string().trim().min(1).max(200).optional(),
      snapshot_date: calendarDateSchema.optional(), cursor, max_chars },
    outputSchema: articleToolResultSchema,
  }, async (args, extra) => runTool("direct", extra.signal, context, args, async () => jsonContent(await reader.readArticle(args, extra.signal))));
  server.registerTool("read_act", {
    description: "Read bounded article and attachment text with table relationships preserved. Pass a listed attachment reference to select it, or a returned cursor literally to continue within text or cells. Traversal completion is distinct from legal-content coverage.",
    inputSchema: { act_locator: locator, attachment_ref: locator, snapshot_date: calendarDateSchema.optional(), cursor, max_chars },
    outputSchema: pageResult(readingPageSchema),
  }, async (args, extra) => runTool("composed", extra.signal, context, args, async () => jsonContent(await reader.readAct(args, extra.signal))));
}
