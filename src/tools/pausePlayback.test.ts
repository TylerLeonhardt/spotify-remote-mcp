import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PausePlaybackTool } from './pausePlayback';
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

describe('PausePlaybackTool', () => {
    let pausePlaybackTool: PausePlaybackTool;
    let mockSpotifyApi: any;
    let mockAuthInfo: AuthInfo;
    let mockRequestExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
        pausePlaybackTool = new PausePlaybackTool();
        
        // Setup mock Spotify API
        mockSpotifyApi = {
            player: {
                pausePlayback: vi.fn(),
                getPlaybackState: vi.fn(),
                getAvailableDevices: vi.fn()
            }
        };
        
        // Setup mock auth info
        mockAuthInfo = {
            token: 'mock-token',
            clientId: 'mock-client-id',
            scopes: ['user-modify-playback-state'],
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
            expect(pausePlaybackTool.name).toBe('pause_playback');
        });

        it('should have correct description', () => {
            expect(pausePlaybackTool.description).toBe('Pause playback on the user\'s account. This API only works for users who have Spotify Premium.');
        });

        it('should have correct args schema with optional device_id', () => {
            expect(pausePlaybackTool.argsSchema).toHaveProperty('device_id');
        });
    });

    describe('execute method', () => {
        describe('authentication checks', () => {
            it('should return not authenticated message when authInfo is undefined', async () => {
                const requestExtraWithoutAuth = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;
                
                const result = await pausePlaybackTool.execute({}, requestExtraWithoutAuth);
                
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
                
                const result = await pausePlaybackTool.execute({}, requestExtraWithNullAuth);
                
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

        describe('successful pause operations', () => {
            it('should pause playback successfully when authenticated and device_id provided', async () => {
                const deviceId = 'test-device-id';
                const mockDevices = {
                    devices: [
                        { id: deviceId, name: 'Test Device', type: 'computer', is_active: true }
                    ]
                };
                
                mockSpotifyApi.player.getAvailableDevices.mockResolvedValue(mockDevices);
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({ device_id: deviceId }, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.player.pausePlayback).toHaveBeenCalledWith(deviceId);
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Playback paused successfully on Test Device (computer).',
                        },
                    ],
                });
            });

            it('should pause playback on active device when no device_id provided', async () => {
                const mockPlaybackState = {
                    device: {
                        id: 'active-device-id',
                        name: 'Active Device',
                        type: 'smartphone',
                        is_active: true
                    },
                    is_playing: true
                };
                
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(mockSpotifyApi.player.pausePlayback).toHaveBeenCalledWith('active-device-id');
                expect(result.content[0].text).toBe('Playback paused successfully on Active Device (smartphone).');
            });

            it('should handle pause when device not found in available devices list', async () => {
                const deviceId = 'unknown-device-id';
                const mockDevices = {
                    devices: [
                        { id: 'different-device', name: 'Other Device', type: 'speaker' }
                    ]
                };
                
                mockSpotifyApi.player.getAvailableDevices.mockResolvedValue(mockDevices);
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({ device_id: deviceId }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.pausePlayback).toHaveBeenCalledWith(deviceId);
                expect(result.content[0].text).toBe('Playback paused successfully on device unknown-device-id.');
            });

            it('should handle pause when getAvailableDevices fails', async () => {
                const deviceId = 'test-device-id';
                
                mockSpotifyApi.player.getAvailableDevices.mockRejectedValue(new Error('Network error'));
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({ device_id: deviceId }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.pausePlayback).toHaveBeenCalledWith(deviceId);
                expect(result.content[0].text).toBe('Playback paused successfully on device test-device-id.');
            });

            it('should handle pause when no active playback state', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(null);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(mockSpotifyApi.player.pausePlayback).not.toHaveBeenCalled();
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'No active playback found. Make sure Spotify is playing music on a device.',
                        },
                    ],
                });
            });

            it('should handle pause when playback state has no device', async () => {
                const mockPlaybackState = {
                    is_playing: true
                    // no device property
                };
                
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toBe('No active playback found. Make sure Spotify is playing music on a device.');
            });

            it('should return error when getPlaybackState fails and no device_id provided', async () => {
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(new Error('API Error'));
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(mockSpotifyApi.player.pausePlayback).not.toHaveBeenCalled();
                expect(result.content[0].text).toBe('I don\'t see any active device. Please start playing music on a Spotify device first.');
            });
        });

        describe('error handling', () => {
            it('should handle insufficient scope errors', async () => {
                const scopeError = new Error('Insufficient scope');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(scopeError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: Insufficient permissions to control playback. The Spotify token needs the "user-modify-playback-state" scope to pause playback.',
                        },
                    ],
                });
            });

            it('should handle Premium account requirement errors', async () => {
                const premiumError = new Error('Premium account required');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(premiumError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: This feature requires Spotify Premium. Playback control is only available for Premium users.',
                        },
                    ],
                });
            });

            it('should handle device not found errors', async () => {
                const deviceError = new Error('Device not found');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(deviceError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: The specified device was not found or is not available.',
                        },
                    ],
                });
            });

            it('should handle no active device errors', async () => {
                const deviceError = new Error('No active device found');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(deviceError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: No active device found. Please start playing music on a Spotify device first.',
                        },
                    ],
                });
            });

            it('should handle general API errors', async () => {
                const apiError = new Error('Network timeout');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(apiError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error pausing playback: Network timeout',
                        },
                    ],
                });
            });

            it('should handle non-Error objects thrown by API', async () => {
                const unexpectedError = 'String error';
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(unexpectedError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error pausing playback: Unknown error',
                        },
                    ],
                });
            });

            it('should handle undefined errors', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(undefined);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].text).toBe('Error pausing playback: Unknown error');
            });
        });

        describe('output structure', () => {
            it('should always return CallToolResult with correct structure for successful requests', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
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
                
                const result = await pausePlaybackTool.execute({}, requestExtraWithoutAuth);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for API errors', async () => {
                const apiError = new Error('API Error');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.pausePlayback.mockRejectedValue(apiError);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for no active playback', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(null);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });
        });

        describe('argument validation', () => {
            it('should handle empty arguments object', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({}, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(result.content[0].text).toContain('Playback paused successfully');
            });

            it('should ignore extra arguments not in schema', async () => {
                const extraArgs = { 
                    device_id: 'test-device',
                    extraParam: 'should be ignored'
                };
                
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute(extraArgs as Parameters<typeof pausePlaybackTool.execute>[0], mockRequestExtra);
                
                expect(mockSpotifyApi.player.pausePlayback).toHaveBeenCalledWith('test-device');
                expect(result.content[0].text).toContain('Playback paused successfully');
            });

            it('should handle invalid device_id values', async () => {
                mockSpotifyApi.player.pausePlayback.mockResolvedValue(undefined);
                
                const result = await pausePlaybackTool.execute({ device_id: 'invalid-device' }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.pausePlayback).toHaveBeenCalledWith('invalid-device');
                expect(result.content[0].text).toContain('Playback paused successfully');
            });
        });
    });
});
