import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPlaybackStateTool } from './getPlaybackState';
import { getSpotifyApi } from '../spotifyApi';
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Mock the spotifyApi module
vi.mock('../spotifyApi', () => ({
    getSpotifyApi: vi.fn(),
    JsonParseError: class JsonParseError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'JsonParseError';
        }
    }
}));

describe('GetPlaybackStateTool', () => {
    let getPlaybackStateTool: GetPlaybackStateTool;
    let mockSpotifyApi: any;
    let mockAuthInfo: AuthInfo;
    let mockRequestExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
        getPlaybackStateTool = new GetPlaybackStateTool();
        
        // Setup mock Spotify API
        mockSpotifyApi = {
            player: {
                getPlaybackState: vi.fn()
            }
        };
        
        // Setup mock auth info
        mockAuthInfo = {
            token: 'mock-token',
            clientId: 'mock-client-id',
            scopes: ['user-read-playback-state'],
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
            expect(getPlaybackStateTool.name).toBe('get_playback_state');
        });

        it('should have correct description', () => {
            expect(getPlaybackStateTool.description).toBe('Get information about the user\'s current playback state, including track or episode, progress, and active device');
        });

        it('should have correct args schema with optional parameters', () => {
            expect(getPlaybackStateTool.argsSchema).toHaveProperty('market');
            expect(getPlaybackStateTool.argsSchema).toHaveProperty('additional_types');
        });
    });

    describe('execute method', () => {
        describe('authentication checks', () => {
            it('should return not authenticated message when authInfo is undefined', async () => {
                const requestExtraWithoutAuth = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;
                
                const result = await getPlaybackStateTool.execute({}, requestExtraWithoutAuth);
                
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
                
                const result = await getPlaybackStateTool.execute({}, requestExtraWithNullAuth);
                
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

        describe('successful playback state retrieval', () => {
            it('should return formatted playback state when authenticated and playing', async () => {
                const mockPlaybackState = {
                    device: {
                        id: 'device-id',
                        is_active: true,
                        is_private_session: false,
                        is_restricted: false,
                        name: 'My Computer',
                        type: 'computer',
                        volume_percent: 75,
                        supports_volume: true
                    },
                    repeat_state: 'off',
                    shuffle_state: false,
                    context: {
                        type: 'playlist',
                        href: 'https://api.spotify.com/v1/playlists/test',
                        external_urls: {
                            spotify: 'https://open.spotify.com/playlist/test'
                        },
                        uri: 'spotify:playlist:test'
                    },
                    timestamp: 1640995200000,
                    progress_ms: 125000,
                    is_playing: true,
                    item: {
                        id: 'track-id',
                        name: 'Test Song',
                        artists: [{ name: 'Test Artist' }],
                        album: { name: 'Test Album' },
                        duration_ms: 240000
                    },
                    currently_playing_type: 'track',
                    actions: {
                        interrupting_playback: false,
                        pausing: true,
                        resuming: true,
                        seeking: true,
                        skipping_next: true,
                        skipping_prev: true,
                        toggling_repeat_context: true,
                        toggling_shuffle: true,
                        toggling_repeat_track: true,
                        transferring_playback: true
                    }
                };
                
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith(undefined, undefined);
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: `Current playback state: ${JSON.stringify(mockPlaybackState, null, 2)}`,
                        },
                    ],
                });
            });

            it('should handle no active playback', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(null);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith(undefined, undefined);
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'No playback is currently active or the user is not playing anything.',
                        },
                    ],
                });
            });

            it('should pass market parameter when provided', async () => {
                const mockPlaybackState = { is_playing: false };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({ market: 'US' }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith('US', undefined);
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });

            it('should pass additional_types parameter when provided', async () => {
                const mockPlaybackState = { is_playing: false };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({ additional_types: 'track,episode' }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith(undefined, 'track,episode');
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });

            it('should pass both market and additional_types parameters when provided', async () => {
                const mockPlaybackState = { is_playing: true };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({ 
                    market: 'CA', 
                    additional_types: 'track,episode' 
                }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith('CA', 'track,episode');
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });

            it('should handle complex playback state with episode', async () => {
                const mockPlaybackState = {
                    device: {
                        id: 'device-id',
                        is_active: true,
                        name: 'Podcast Speaker',
                        type: 'speaker'
                    },
                    is_playing: true,
                    item: {
                        id: 'episode-id',
                        name: 'Test Episode',
                        show: { name: 'Test Podcast' },
                        duration_ms: 3600000
                    },
                    currently_playing_type: 'episode',
                    progress_ms: 1800000
                };
                
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
                expect(result.content[0].text).toContain('episode');
            });
        });

        describe('error handling', () => {
            it('should handle Spotify API network errors', async () => {
                const networkError = new Error('Network error');
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(networkError);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith(undefined, undefined);
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error retrieving playback state: Network error',
                        },
                    ],
                });
            });

            it('should handle Spotify API authentication errors', async () => {
                const authError = new Error('Invalid access token');
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(authError);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toBe('Error retrieving playback state: Invalid access token');
            });

            it('should handle Spotify API rate limiting errors', async () => {
                const rateLimitError = new Error('Rate limit exceeded');
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(rateLimitError);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toBe('Error retrieving playback state: Rate limit exceeded');
            });

            it('should handle non-Error objects thrown by API', async () => {
                const unexpectedError = 'String error';
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(unexpectedError);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toBe('Error retrieving playback state: Unknown error');
            });

            it('should handle undefined errors', async () => {
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(undefined);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toBe('Error retrieving playback state: Unknown error');
            });
        });

        describe('output structure', () => {
            it('should always return CallToolResult with correct structure for successful requests', async () => {
                const mockPlaybackState = { is_playing: false };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
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
                
                const result = await getPlaybackStateTool.execute({}, requestExtraWithoutAuth);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for API errors', async () => {
                const apiError = new Error('API Error');
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(apiError);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for no playback state', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(null);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });
        });

        describe('argument validation', () => {
            it('should handle empty arguments object', async () => {
                const mockPlaybackState = { is_playing: true };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({}, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith(undefined, undefined);
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });

            it('should ignore extra arguments not in schema', async () => {
                const mockPlaybackState = { is_playing: false };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const extraArgs = { 
                    market: 'US', 
                    additional_types: 'track',
                    extraParam: 'should be ignored'
                };
                
                const result = await getPlaybackStateTool.execute(extraArgs as Parameters<typeof getPlaybackStateTool.execute>[0], mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith('US', 'track');
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });

            it('should handle invalid market codes gracefully', async () => {
                const mockPlaybackState = { is_playing: false };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({ market: 'INVALID' }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith('INVALID', undefined);
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });

            it('should handle invalid additional_types values', async () => {
                const mockPlaybackState = { is_playing: false };
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await getPlaybackStateTool.execute({ additional_types: 'invalid,types' }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalledWith(undefined, 'invalid,types');
                expect(result.content[0].text).toContain(JSON.stringify(mockPlaybackState, null, 2));
            });
        });
    });
});
