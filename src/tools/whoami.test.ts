import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhoAmITool } from './whoami';
import { getSpotifyApi } from '../spotifyApi';
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Mock the spotifyApi module
vi.mock('../spotifyApi', () => ({
    getSpotifyApi: vi.fn()
}));

describe('WhoAmITool', () => {
    let whoAmITool: WhoAmITool;
    let mockSpotifyApi: any;
    let mockAuthInfo: AuthInfo;
    let mockRequestExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
        whoAmITool = new WhoAmITool();
        
        // Setup mock Spotify API
        mockSpotifyApi = {
            currentUser: {
                profile: vi.fn()
            }
        };
        
        // Setup mock auth info
        mockAuthInfo = {
            token: 'mock-token',
            clientId: 'mock-client-id',
            scopes: ['user-read-private'],
            expiresAt: Date.now() / 1000 + 3600
        };
        
        // Setup mock request extra
        mockRequestExtra = {
            authInfo: mockAuthInfo
        } as RequestHandlerExtra<ServerRequest, ServerNotification>;
        
        vi.mocked(getSpotifyApi).mockReturnValue(mockSpotifyApi);
    });

    describe('tool properties', () => {
        it('should have correct name', () => {
            expect(whoAmITool.name).toBe('whoami');
        });

        it('should have correct description', () => {
            expect(whoAmITool.description).toBe('A tool that returns the authenticated user\'s information');
        });

        it('should have empty args schema', () => {
            expect(whoAmITool.argsSchema).toEqual({});
        });
    });

    describe('execute method', () => {
        describe('authentication checks', () => {
            it('should return not authenticated message when authInfo is undefined', async () => {
                const requestExtraWithoutAuth = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;
                
                const result = await whoAmITool.execute({}, requestExtraWithoutAuth);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'You are not authenticated.',
                        },
                    ],
                });
                expect(getSpotifyApi).not.toHaveBeenCalled();
            });

            it('should return not authenticated message when authInfo is null', async () => {
                const requestExtraWithNullAuth = {
                    authInfo: null
                } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;
                
                const result = await whoAmITool.execute({}, requestExtraWithNullAuth);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'You are not authenticated.',
                        },
                    ],
                });
                expect(getSpotifyApi).not.toHaveBeenCalled();
            });
        });

        describe('successful user profile retrieval', () => {
            it('should return formatted user profile when authenticated', async () => {
                const mockUserProfile = {
                    id: 'test-user-id',
                    display_name: 'Test User',
                    email: 'test@example.com',
                    followers: { total: 100 },
                    country: 'US'
                };
                
                mockSpotifyApi.currentUser.profile.mockResolvedValue(mockUserProfile);
                
                const result = await whoAmITool.execute({}, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.currentUser.profile).toHaveBeenCalledWith();
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: `Here is the result of the Spotify Profile: ${JSON.stringify(mockUserProfile)}.`,
                        },
                    ],
                });
            });

            it('should handle empty user profile data', async () => {
                const emptyProfile = {};
                mockSpotifyApi.currentUser.profile.mockResolvedValue(emptyProfile);
                
                const result = await whoAmITool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: `Here is the result of the Spotify Profile: ${JSON.stringify(emptyProfile)}.`,
                        },
                    ],
                });
            });

            it('should handle complex user profile data', async () => {
                const complexProfile = {
                    id: 'complex-user',
                    display_name: 'Complex User Name',
                    email: 'complex@test.com',
                    followers: { total: 1234 },
                    country: 'CA',
                    images: [
                        { url: 'https://example.com/image1.jpg', height: 300, width: 300 },
                        { url: 'https://example.com/image2.jpg', height: 64, width: 64 }
                    ],
                    external_urls: {
                        spotify: 'https://open.spotify.com/user/complex-user'
                    }
                };
                
                mockSpotifyApi.currentUser.profile.mockResolvedValue(complexProfile);
                
                const result = await whoAmITool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: `Here is the result of the Spotify Profile: ${JSON.stringify(complexProfile)}.`,
                        },
                    ],
                });
            });
        });

        describe('error handling', () => {
            it('should handle Spotify API network errors', async () => {
                const networkError = new Error('Network error');
                mockSpotifyApi.currentUser.profile.mockRejectedValue(networkError);
                
                await expect(whoAmITool.execute({}, mockRequestExtra)).rejects.toThrow('Network error');
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.currentUser.profile).toHaveBeenCalledWith();
            });

            it('should handle Spotify API authentication errors', async () => {
                const authError = new Error('Invalid access token');
                mockSpotifyApi.currentUser.profile.mockRejectedValue(authError);
                
                await expect(whoAmITool.execute({}, mockRequestExtra)).rejects.toThrow('Invalid access token');
            });

            it('should handle Spotify API rate limiting errors', async () => {
                const rateLimitError = new Error('Rate limit exceeded');
                mockSpotifyApi.currentUser.profile.mockRejectedValue(rateLimitError);
                
                await expect(whoAmITool.execute({}, mockRequestExtra)).rejects.toThrow('Rate limit exceeded');
            });

            it('should handle unexpected Spotify API responses', async () => {
                const unexpectedError = new Error('Unexpected API response');
                mockSpotifyApi.currentUser.profile.mockRejectedValue(unexpectedError);
                
                await expect(whoAmITool.execute({}, mockRequestExtra)).rejects.toThrow('Unexpected API response');
            });
        });

        describe('output structure', () => {
            it('should always return CallToolResult with correct structure', async () => {
                const mockProfile = { id: 'test' };
                mockSpotifyApi.currentUser.profile.mockResolvedValue(mockProfile);
                
                const result = await whoAmITool.execute({}, mockRequestExtra);
                
                // Verify the result has the correct CallToolResult structure
                expect(result).toHaveProperty('content');
                expect(Array.isArray(result.content)).toBe(true);
                expect(result.content).toHaveLength(1);
                expect(result.content[0]).toHaveProperty('type', 'text');
                expect(result.content[0]).toHaveProperty('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for authentication errors', async () => {
                const requestExtraWithoutAuth = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;
                
                const result = await whoAmITool.execute({}, requestExtraWithoutAuth);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });
        });

        describe('args parameter', () => {
            it('should ignore any arguments passed to execute method', async () => {
                const mockProfile = { id: 'test' };
                mockSpotifyApi.currentUser.profile.mockResolvedValue(mockProfile);
                
                // Pass some random arguments
                const randomArgs = { someKey: 'someValue', anotherKey: 123 };
                
                const result = await whoAmITool.execute(randomArgs, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.currentUser.profile).toHaveBeenCalledWith();
                expect(result.content[0].text).toContain(JSON.stringify(mockProfile));
            });
        });
    });
});