import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolsRegistry, ITool } from './toolsRegistry';
import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from 'zod';

describe('ToolsRegistry', () => {
    let registry: ToolsRegistry;
    let mockServer: McpServer;
    let mockTool: RegisteredTool;

    beforeEach(() => {
        registry = new ToolsRegistry();
        mockTool = {} as RegisteredTool;
        mockServer = {
            tool: vi.fn(() => mockTool)
        } as unknown as McpServer;
    });

    describe('tool registration', () => {
        it('should register a tool successfully', () => {
            const testTool: ITool<{}> = {
                name: 'test-tool',
                description: 'A test tool',
                argsSchema: {},
                execute: vi.fn()
            };

            expect(() => registry.register(testTool)).not.toThrow();
        });

        it('should register multiple tools', () => {
            const tool1: ITool<{}> = {
                name: 'tool1',
                description: 'First tool',
                argsSchema: {},
                execute: vi.fn()
            };

            const tool2: ITool<{}> = {
                name: 'tool2',
                description: 'Second tool',
                argsSchema: {},
                execute: vi.fn()
            };

            registry.register(tool1);
            registry.register(tool2);

            const registeredTools = registry.registerToServer(mockServer);
            expect(registeredTools).toHaveLength(2);
        });

        it('should handle tools with complex schemas', () => {
            const complexSchema = {
                param1: z.string(),
                param2: z.number()
            };
            
            const complexTool: ITool<typeof complexSchema> = {
                name: 'complex-tool',
                description: 'A tool with complex schema',
                argsSchema: complexSchema,
                execute: vi.fn()
            };

            expect(() => registry.register(complexTool)).not.toThrow();
        });
    });

    describe('registerToServer functionality', () => {
        it('should register tools to server with correct parameters', () => {
            const testTool: ITool<{}> = {
                name: 'server-test-tool',
                description: 'Test tool for server registration',
                argsSchema: {},
                execute: vi.fn()
            };

            registry.register(testTool);
            const registeredTools = registry.registerToServer(mockServer);

            expect(mockServer.tool).toHaveBeenCalledWith(
                'server-test-tool',
                'Test tool for server registration',
                {},
                testTool.execute
            );
            expect(registeredTools).toEqual([mockTool]);
        });

        it('should register multiple tools to server', () => {
            const tool1: ITool<{}> = {
                name: 'multi-tool-1',
                description: 'First multi tool',
                argsSchema: {},
                execute: vi.fn()
            };

            const tool2: ITool<{}> = {
                name: 'multi-tool-2',
                description: 'Second multi tool',
                argsSchema: {},
                execute: vi.fn()
            };

            registry.register(tool1);
            registry.register(tool2);
            
            const registeredTools = registry.registerToServer(mockServer);

            expect(mockServer.tool).toHaveBeenCalledTimes(2);
            expect(mockServer.tool).toHaveBeenNthCalledWith(1,
                'multi-tool-1',
                'First multi tool',
                {},
                tool1.execute
            );
            expect(mockServer.tool).toHaveBeenNthCalledWith(2,
                'multi-tool-2',
                'Second multi tool',
                {},
                tool2.execute
            );
            expect(registeredTools).toHaveLength(2);
        });

        it('should return empty array when no tools registered', () => {
            const registeredTools = registry.registerToServer(mockServer);
            
            expect(registeredTools).toEqual([]);
            expect(mockServer.tool).not.toHaveBeenCalled();
        });

        it('should preserve tool execution function', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'Test result' }]
            } as CallToolResult);

            const testTool: ITool<{}> = {
                name: 'execute-test-tool',
                description: 'Tool to test execute function preservation',
                argsSchema: {},
                execute: mockExecute
            };

            registry.register(testTool);
            registry.registerToServer(mockServer);

            // Verify the execute function was passed to server.tool
            expect(mockServer.tool).toHaveBeenCalledWith(
                'execute-test-tool',
                'Tool to test execute function preservation',
                {},
                mockExecute
            );
        });

        it('should handle tools with different argument schemas', () => {
            const stringSchema = { text: z.string() };
            const stringTool: ITool<typeof stringSchema> = {
                name: 'string-tool',
                description: 'Tool with string param',
                argsSchema: stringSchema,
                execute: vi.fn()
            };

            const numberSchema = { count: z.number() };
            const numberTool: ITool<typeof numberSchema> = {
                name: 'number-tool',
                description: 'Tool with number param',
                argsSchema: numberSchema,
                execute: vi.fn()
            };

            registry.register(stringTool);
            registry.register(numberTool);
            
            const registeredTools = registry.registerToServer(mockServer);

            expect(mockServer.tool).toHaveBeenCalledWith(
                'string-tool',
                'Tool with string param',
                { text: stringSchema.text },
                stringTool.execute
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'number-tool',
                'Tool with number param',
                { count: numberSchema.count },
                numberTool.execute
            );
            expect(registeredTools).toHaveLength(2);
        });
    });

    describe('ITool interface compliance', () => {
        it('should accept tools that implement ITool interface correctly', () => {
            const validTool: ITool<{}> = {
                name: 'valid-tool',
                description: 'A valid tool implementation',
                argsSchema: {},
                execute: async (args: {}, extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
                    return {
                        content: [{ type: 'text', text: 'Valid response' }]
                    };
                }
            };

            expect(() => registry.register(validTool)).not.toThrow();
        });

        it('should properly handle tool with async execute function', async () => {
            const asyncExecute = vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'Async result' }]
            });

            const asyncTool: ITool<{}> = {
                name: 'async-tool',
                description: 'Tool with async execute',
                argsSchema: {},
                execute: asyncExecute
            };

            registry.register(asyncTool);
            registry.registerToServer(mockServer);

            expect(mockServer.tool).toHaveBeenCalledWith(
                'async-tool',
                'Tool with async execute',
                {},
                asyncExecute
            );
        });
    });
});
