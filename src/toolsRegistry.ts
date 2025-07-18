import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

export class ToolsRegistry {
    private toolFactories: ((server: McpServer) => RegisteredTool)[] = [];

    register(factory: (server: McpServer) => RegisteredTool): void {
        this.toolFactories.push(factory);
    }

    getAllTools(server: McpServer): RegisteredTool[] {
        return this.toolFactories.map(factory => factory(server));
    }
}

export const toolsRegistry = new ToolsRegistry();
