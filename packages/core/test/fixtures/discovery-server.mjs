import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ActDiscovery,registerDiscoveryTools } from '../../dist/index.js';
import { signingKey,installDiscoveryBoundary } from './discovery-upstream.mjs';
installDiscoveryBoundary();
const server=new McpServer({name:'discovery-fixture',version:'0'});
registerDiscoveryTools(server,new ActDiscovery({signingKey}));
await server.connect(new StdioServerTransport());
