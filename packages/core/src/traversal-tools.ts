import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ActTraversal } from "./traversal.js";
import { runTool } from "./execution.js";
import { jsonContent } from "./serialization.js";
import { errorSchema } from "./errors.js";
import { RESPONSE_LIMITS, indexPageSchema, readingPageSchema, articleToolResultSchema } from "./contracts.js";
import type { ToolContext } from "./context.js";

// All focused reading tools share the same snapshot and continuation module.
function pageResult<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial().extend({ error: errorSchema.optional() }).superRefine((value, ctx) => {
    if (!((value as { error?: unknown }).error ? z.object({ error: errorSchema }).strict() : schema).safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Use a traversal page or a typed error envelope." });
    }
  });
}
export function registerTraversalTools(server: McpServer, reader: ActTraversal, context: ToolContext = {}): void {
  const locator = z.string().min(1).max(4096).optional().describe(
    "INITIAL calls ONLY. FORBIDDEN when cursor is present, even if previously supplied. Copy a tool-returned opaque reference; never a citation or a value built from memory.");
  const cursor = z.string().min(1).max(16384).optional().describe(
    "Copy the complete cursor from this tool's earlier result character for character, including its signature. Supply only cursor and optional page_size or max_chars. NEVER add snapshot_date or original targets, even when known. No returned cursor means no continuation call.");
  const max_chars = z.number().int().min(1).max(RESPONSE_LIMITS.textMax).optional();
  // Semantic date validation belongs to the reader so impossible dates use the
  // same typed caller-error envelope as other well-shaped invalid inputs.
  const snapshot_date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("INITIAL calls ONLY. FORBIDDEN when cursor is present, even if the date is known. The cursor retains the frozen date.");
  server.registerTool("list_articles", {
    description: "List verified article occurrences and attachment references using an act_locator from find_acts. Initial snapshot_date defaults to today and freezes. Continuation: call list_articles with only the literal cursor and optional page_size; omit act_locator and snapshot_date. Never send this cursor to continue_acts. For an already requested full index, follow returned cursors without asking again. Inspect coverage and progress for completeness.",
    inputSchema: z.object({ act_locator: locator, snapshot_date, cursor,
      page_size: z.number().int().min(1).max(RESPONSE_LIMITS.indexMax).optional() }).strict(),
    outputSchema: pageResult(indexPageSchema),
  }, async (args, extra) => runTool("composed", extra.signal, context, args, async () => jsonContent(await reader.listArticles(args, extra.signal))));
  server.registerTool("read_article", {
    description: "Requires a locator already returned by a tool: article_locator from list_articles, or act_locator from find_acts plus article_reference (e.g. '13'); no index needed. Never invent locators or read before discovery returns. snapshot_date defaults to today; exact locators freeze it. For a full article, continue read_article with the literal cursor without asking permission; supply only cursor and optional max_chars. Unresolved means existence is unknown, NOT absent.",
    inputSchema: z.object({ act_locator: locator, article_locator: locator, article_reference: z.string().trim().min(1).max(200).optional()
      .describe("Initial act-locator call only; omit when cursor is present."),
      snapshot_date, cursor, max_chars }).strict(),
    outputSchema: articleToolResultSchema,
  }, async (args, extra) => runTool("direct", extra.signal, context, args, async () => jsonContent(await reader.readArticle(args, extra.signal))));
  server.registerTool("read_act", {
    description: "Read bounded text and table cells using an act_locator; optionally select a listed attachment_ref. snapshot_date defaults to today and freezes. Continuation: call read_act with only the literal cursor and optional max_chars; omit act_locator, attachment_ref and snapshot_date. If the whole act was requested, follow returned cursors without asking again. Entries are this page; traversal completion is distinct from legal-content coverage.",
    inputSchema: z.object({ act_locator: locator, attachment_ref: locator, snapshot_date, cursor, max_chars }).strict(),
    outputSchema: pageResult(readingPageSchema),
  }, async (args, extra) => runTool("composed", extra.signal, context, args, async () => jsonContent(await reader.readAct(args, extra.signal))));
}
