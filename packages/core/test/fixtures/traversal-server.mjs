import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ActTraversal,registerTraversalTools } from '../../dist/index.js';
import { signingKey,installTraversalBoundary } from './traversal-upstream.mjs';
installTraversalBoundary();
const server=new McpServer({name:'traversal-fixture',version:'0'});
registerTraversalTools(server,new ActTraversal({signingKey}));
await server.connect(new StdioServerTransport());
