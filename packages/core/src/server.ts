import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import type { ToolContext } from "./context.js";

/** Construct and register against one SDK instance, including in traced bundles. */
export function createServer(info: { name: string; version: string }, context: ToolContext = {}): McpServer {
  const server = new McpServer(info);
  registerTools(server, context);
  registerResources(server, context);
  registerPrompts(server, context);
  return server;
}
