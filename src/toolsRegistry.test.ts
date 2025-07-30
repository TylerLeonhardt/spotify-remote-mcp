import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolsRegistry, ToolsRegistry2, ITool } from './toolsRegistry';
import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

describe('ToolsRegistry (legacy)', () => {
    let registry: ToolsRegistry;
    let mockServer: McpServer;

    beforeEach(() => {
        registry = new ToolsRegistry();
        mockServer = {} as McpServer;
    });

    it('should register tool factories', () => {
        const mockFactory = vi.fn(() => ({} as RegisteredTool));
        
        registry.register(mockFactory);
        
        // Should not call factory during registration
        expect(mockFactory).not.toHaveBeenCalled();
    });

    it('should get all tools by calling factories with server', () => {
        const mockTool1 = { name: 'tool1' } as unknown as RegisteredTool;
        const mockTool2 = { name: 'tool2' } as unknown as RegisteredTool;
        const factory1 = vi.fn(() => mockTool1);
        const factory2 = vi.fn(() => mockTool2);
        
        registry.register(factory1);
        registry.register(factory2);
        
        const tools = registry.getAllTools(mockServer);
        
        expect(factory1).toHaveBeenCalledWith(mockServer);
        expect(factory2).toHaveBeenCalledWith(mockServer);
        expect(tools).toEqual([mockTool1, mockTool2]);
    });

    it('should return empty array when no tools registered', () => {
        const tools = registry.getAllTools(mockServer);
        expect(tools).toEqual([]);
    });
});

describe('ToolsRegistry2', () => {
    let registry: ToolsRegistry2;
    let mockServer: McpServer;
    let mockTool: RegisteredTool;

    beforeEach(() => {
        registry = new ToolsRegistry2();
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
            const complexTool: ITool<any> = {
                name: 'complex-tool',
                description: 'A tool with complex schema',
                argsSchema: {
                    param1: { type: 'string' },
                    param2: { type: 'number' }
                } as any,
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
            const stringTool: ITool<any> = {
                name: 'string-tool',
                description: 'Tool with string param',
                argsSchema: { text: { type: 'string' } } as any,
                execute: vi.fn()
            };

            const numberTool: ITool<any> = {
                name: 'number-tool',
                description: 'Tool with number param',
                argsSchema: { count: { type: 'number' } } as any,
                execute: vi.fn()
            };

            registry.register(stringTool);
            registry.register(numberTool);
            
            const registeredTools = registry.registerToServer(mockServer);

            expect(mockServer.tool).toHaveBeenCalledWith(
                'string-tool',
                'Tool with string param',
                { text: { type: 'string' } },
                stringTool.execute
            );
            expect(mockServer.tool).toHaveBeenCalledWith(
                'number-tool',
                'Tool with number param',
                { count: { type: 'number' } },
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
