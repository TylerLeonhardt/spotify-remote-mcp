import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetVolumeTool } from './setVolume';
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

describe('SetVolumeTool', () => {
    let setVolumeTool: SetVolumeTool;
    let mockSpotifyApi: any;
    let mockAuthInfo: AuthInfo;
    let mockRequestExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
        setVolumeTool = new SetVolumeTool();
        
        // Setup mock Spotify API
        mockSpotifyApi = {
            player: {
                setPlaybackVolume: vi.fn(),
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
            expect(setVolumeTool.name).toBe('set_volume');
        });

        it('should have correct description', () => {
            expect(setVolumeTool.description).toBe('Set the volume for the user\'s current playback device. This API only works for users who have Spotify Premium.');
        });

        it('should have correct args schema with required volume_percent and optional device_id', () => {
            expect(setVolumeTool.argsSchema).toHaveProperty('volume_percent');
            expect(setVolumeTool.argsSchema).toHaveProperty('device_id');
        });
    });

    describe('execute method', () => {
        describe('authentication checks', () => {
            it('should return not authenticated message when authInfo is undefined', async () => {
                const requestExtraWithoutAuth = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, requestExtraWithoutAuth);
                
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
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, requestExtraWithNullAuth);
                
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

        describe('successful volume operations', () => {
            it('should set volume successfully when authenticated and device_id provided', async () => {
                const deviceId = 'test-device-id';
                const volume = 75;
                const mockDevices = {
                    devices: [
                        { id: deviceId, name: 'Test Device', type: 'computer', is_active: true, supports_volume: true }
                    ]
                };
                
                mockSpotifyApi.player.getAvailableDevices.mockResolvedValue(mockDevices);
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume, device_id: deviceId }, mockRequestExtra);
                
                expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(volume, deviceId);
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Volume set to 75% successfully on Test Device (computer).',
                        },
                    ],
                });
            });

            it('should set volume on active device when no device_id provided', async () => {
                const volume = 60;
                const mockPlaybackState = {
                    device: {
                        id: 'active-device-id',
                        name: 'Active Device',
                        type: 'smartphone',
                        is_active: true,
                        supports_volume: true
                    },
                    is_playing: true
                };
                
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(volume, 'active-device-id');
                expect(result.content[0].text).toBe('Volume set to 60% successfully on Active Device (smartphone).');
            });

            it('should handle volume set when device not found in available devices list', async () => {
                const deviceId = 'unknown-device-id';
                const volume = 30;
                const mockDevices = {
                    devices: [
                        { id: 'different-device', name: 'Other Device', type: 'speaker' }
                    ]
                };
                
                mockSpotifyApi.player.getAvailableDevices.mockResolvedValue(mockDevices);
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume, device_id: deviceId }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(volume, deviceId);
                expect(result.content[0].text).toBe('Volume set to 30% successfully on device unknown-device-id.');
            });

            it('should handle volume set when getAvailableDevices fails', async () => {
                const deviceId = 'test-device-id';
                const volume = 85;
                
                mockSpotifyApi.player.getAvailableDevices.mockRejectedValue(new Error('Network error'));
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume, device_id: deviceId }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(volume, deviceId);
                expect(result.content[0].text).toBe('Volume set to 85% successfully on device test-device-id.');
            });

            it('should handle volume set when no active playback state', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(null);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(mockSpotifyApi.player.setPlaybackVolume).not.toHaveBeenCalled();
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'No active playback found. Make sure Spotify is playing music on a device.',
                        },
                    ],
                });
            });

            it('should handle volume set when playback state has no device', async () => {
                const mockPlaybackState = {
                    is_playing: true
                    // no device property
                };
                
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(mockPlaybackState);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result.content[0].text).toBe('No active playback found. Make sure Spotify is playing music on a device.');
            });

            it('should fallback to set volume without device_id when getPlaybackState fails', async () => {
                const volume = 40;
                mockSpotifyApi.player.getPlaybackState.mockRejectedValue(new Error('API Error'));
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.getPlaybackState).toHaveBeenCalled();
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(volume, undefined);
                expect(result.content[0].text).toBe('Volume set to 40% successfully.');
            });

            it('should handle minimum volume (0)', async () => {
                const volume = 0;
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(0, 'test');
                expect(result.content[0].text).toContain('Volume set to 0%');
            });

            it('should handle maximum volume (100)', async () => {
                const volume = 100;
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: volume }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(100, 'test');
                expect(result.content[0].text).toContain('Volume set to 100%');
            });
        });

        describe('error handling', () => {
            it('should handle insufficient scope errors', async () => {
                const scopeError = new Error('Insufficient scope');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(scopeError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: Insufficient permissions to control playback. The Spotify token needs the "user-modify-playback-state" scope to set volume.',
                        },
                    ],
                });
            });

            it('should handle Premium account requirement errors', async () => {
                const premiumError = new Error('Premium account required');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(premiumError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: This feature requires Spotify Premium. Volume control is only available for Premium users.',
                        },
                    ],
                });
            });

            it('should handle device not found errors', async () => {
                const deviceError = new Error('Device not found');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(deviceError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
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
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(deviceError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: No active device found. Please start playing music on a Spotify device first.',
                        },
                    ],
                });
            });

            it('should handle volume not supported errors', async () => {
                const volumeError = new Error('Volume not supported on this device');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(volumeError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: Volume control is not supported on this device.',
                        },
                    ],
                });
            });

            it('should handle invalid volume errors', async () => {
                const volumeError = new Error('Invalid volume value');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(volumeError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error: Invalid volume value. Volume must be between 0 and 100.',
                        },
                    ],
                });
            });

            it('should handle general API errors', async () => {
                const apiError = new Error('Network timeout');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(apiError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error setting volume: Network timeout',
                        },
                    ],
                });
            });

            it('should handle non-Error objects thrown by API', async () => {
                const unexpectedError = 'String error';
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(unexpectedError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error setting volume: Unknown error',
                        },
                    ],
                });
            });

            it('should handle undefined errors', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result.content[0].text).toBe('Error setting volume: Unknown error');
            });
        });

        describe('output structure', () => {
            it('should always return CallToolResult with correct structure for successful requests', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
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
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, requestExtraWithoutAuth);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for API errors', async () => {
                const apiError = new Error('API Error');
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ device: { id: 'test' } });
                mockSpotifyApi.player.setPlaybackVolume.mockRejectedValue(apiError);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });

            it('should return text content type for no active playback', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue(null);
                
                const result = await setVolumeTool.execute({ volume_percent: 50 }, mockRequestExtra);
                
                expect(result.content[0].type).toBe('text');
                expect(typeof result.content[0].text).toBe('string');
            });
        });

        describe('argument validation', () => {
            it('should handle volume_percent at boundary values', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                // Test minimum boundary
                const result1 = await setVolumeTool.execute({ volume_percent: 0 }, mockRequestExtra);
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(0, 'test');
                expect(result1.content[0].text).toContain('Volume set to 0%');
                
                // Test maximum boundary
                const result2 = await setVolumeTool.execute({ volume_percent: 100 }, mockRequestExtra);
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(100, 'test');
                expect(result2.content[0].text).toContain('Volume set to 100%');
            });

            it('should ignore extra arguments not in schema', async () => {
                const extraArgs = { 
                    volume_percent: 75,
                    device_id: 'test-device',
                    extraParam: 'should be ignored'
                };
                
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute(extraArgs as any, mockRequestExtra);
                
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(75, 'test-device');
                expect(result.content[0].text).toContain('Volume set to 75%');
            });

            it('should handle invalid device_id values', async () => {
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const result = await setVolumeTool.execute({ 
                    volume_percent: 50, 
                    device_id: 'invalid-device' 
                }, mockRequestExtra);
                
                expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(50, 'invalid-device');
                expect(result.content[0].text).toContain('Volume set to 50%');
            });

            it('should handle mid-range volume values', async () => {
                mockSpotifyApi.player.getPlaybackState.mockResolvedValue({ 
                    device: { id: 'test', name: 'Test', type: 'computer' } 
                });
                mockSpotifyApi.player.setPlaybackVolume.mockResolvedValue(undefined);
                
                const testValues = [25, 33, 50, 67, 88];
                
                for (const volume of testValues) {
                    const result = await setVolumeTool.execute({ volume_percent: volume }, mockRequestExtra);
                    expect(mockSpotifyApi.player.setPlaybackVolume).toHaveBeenCalledWith(volume, 'test');
                    expect(result.content[0].text).toContain(`Volume set to ${volume}%`);
                }
            });
        });
    });
});
