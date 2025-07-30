import { McpServer, RegisteredTool, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ZodRawShape } from 'zod';

export interface ITool<T extends ZodRawShape | undefined = undefined> {
    name: string;
    description: string;
    argsSchema: T;
    execute: ToolCallback<T>
}

export class ToolsRegistry {
    private tools: ITool<ZodRawShape>[] = [];

    register<T extends ZodRawShape>(tool: ITool<T>): void {
        this.tools.push(tool);
    }

    registerToServer(server: McpServer): RegisteredTool[] {
        return this.tools.map(tool => server.tool(
            tool.name,
            tool.description,
            tool.argsSchema,
            tool.execute
        ))
    }
}

export const toolsRegistry = new ToolsRegistry();
