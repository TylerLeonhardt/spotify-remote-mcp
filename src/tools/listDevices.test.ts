import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListDevicesTool } from './listDevices';
import { getSpotifyApi } from '../spotifyApi';
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

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

const mockGetSpotifyApi = vi.mocked(getSpotifyApi);

describe('ListDevicesTool', () => {
    let tool: ListDevicesTool;
    let mockAuthInfo: AuthInfo;
    let mockRequestExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
        tool = new ListDevicesTool();
        mockAuthInfo = {
            token: 'test-token',
            clientId: 'test-client-id',
            scopes: ['user-read-playback-state'],
            expiresAt: Date.now() / 1000 + 3600
        };
        mockRequestExtra = {
            authInfo: mockAuthInfo
        } as RequestHandlerExtra<ServerRequest, ServerNotification>;
        vi.clearAllMocks();
    });

    describe('tool properties', () => {
        it('should have correct name', () => {
            expect(tool.name).toBe('list_devices');
        });

        it('should have correct description', () => {
            expect(tool.description).toBe('List available Spotify Connect devices that can be used for playback');
        });

        it('should have empty args schema', () => {
            expect(tool.argsSchema).toEqual({});
        });
    });

    describe('execute method', () => {
        describe('authentication checks', () => {
            it('should return error when not authenticated', async () => {
                const result = await tool.execute({}, { authInfo: undefined } as any);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'You are not authenticated.',
                        },
                    ],
                });
            });

            it('should return error when authInfo is null', async () => {
                const result = await tool.execute({}, { authInfo: null } as any);
                
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'You are not authenticated.',
                        },
                    ],
                });
            });
        });

        describe('successful device listing', () => {
            it('should list devices with active and inactive status', async () => {
                const mockDevices = {
                    devices: [
                        {
                            id: 'device1',
                            name: 'Kitchen Speaker',
                            type: 'Speaker',
                            is_active: true,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 50
                        },
                        {
                            id: 'device2',
                            name: 'Office Computer',
                            type: 'Computer',
                            is_active: false,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 80
                        },
                        {
                            id: 'device3',
                            name: 'Phone',
                            type: 'Smartphone',
                            is_active: false,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 30
                        }
                    ]
                };

                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockResolvedValue(mockDevices)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(mockGetSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotify.player.getAvailableDevices).toHaveBeenCalled();
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Available Spotify devices:\n- Kitchen Speaker (Speaker) (active)\n- Office Computer (Computer) (inactive)\n- Phone (Smartphone) (inactive)',
                        },
                    ],
                });
            });

            it('should handle devices with only active devices', async () => {
                const mockDevices = {
                    devices: [
                        {
                            id: 'device1',
                            name: 'Active Speaker',
                            type: 'Speaker',
                            is_active: true,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 75
                        }
                    ]
                };

                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockResolvedValue(mockDevices)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Available Spotify devices:\n- Active Speaker (Speaker) (active)',
                        },
                    ],
                });
            });

            it('should handle devices with only inactive devices', async () => {
                const mockDevices = {
                    devices: [
                        {
                            id: 'device1',
                            name: 'Inactive Computer',
                            type: 'Computer',
                            is_active: false,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 0
                        },
                        {
                            id: 'device2',
                            name: 'Inactive Phone',
                            type: 'Smartphone',
                            is_active: false,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 50
                        }
                    ]
                };

                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockResolvedValue(mockDevices)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Available Spotify devices:\n- Inactive Computer (Computer) (inactive)\n- Inactive Phone (Smartphone) (inactive)',
                        },
                    ],
                });
            });
        });

        describe('empty device list handling', () => {
            it('should return appropriate message when no devices are found', async () => {
                const mockDevices = {
                    devices: []
                };

                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockResolvedValue(mockDevices)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(mockGetSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotify.player.getAvailableDevices).toHaveBeenCalled();
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'No Spotify devices found. Please open Spotify on a device and try again.',
                        },
                    ],
                });
            });
        });

        describe('error handling', () => {
            it('should handle API errors with Error objects', async () => {
                const mockError = new Error('Spotify API is unavailable');
                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockRejectedValue(mockError)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(mockGetSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
                expect(mockSpotify.player.getAvailableDevices).toHaveBeenCalled();
                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error getting devices: Spotify API is unavailable',
                        },
                    ],
                });
            });

            it('should handle non-Error exceptions', async () => {
                const mockError = 'String error message';
                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockRejectedValue(mockError)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error getting devices: Unknown error',
                        },
                    ],
                });
            });

            it('should handle network timeout errors', async () => {
                const mockError = new Error('Network timeout');
                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockRejectedValue(mockError)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Error getting devices: Network timeout',
                        },
                    ],
                });
            });
        });

        describe('formatted output structure', () => {
            it('should format output correctly with special characters in device names', async () => {
                const mockDevices = {
                    devices: [
                        {
                            id: 'device1',
                            name: 'John\'s iPhone',
                            type: 'Smartphone',
                            is_active: true,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 70
                        },
                        {
                            id: 'device2',
                            name: 'Living Room TV (Samsung)',
                            type: 'TV',
                            is_active: false,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 100
                        }
                    ]
                };

                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockResolvedValue(mockDevices)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                expect(result).toEqual({
                    content: [
                        {
                            type: 'text',
                            text: 'Available Spotify devices:\n- John\'s iPhone (Smartphone) (active)\n- Living Room TV (Samsung) (TV) (inactive)',
                        },
                    ],
                });
            });

            it('should maintain correct output structure for content array', async () => {
                const mockDevices = {
                    devices: [
                        {
                            id: 'device1',
                            name: 'Test Device',
                            type: 'Computer',
                            is_active: false,
                            is_private_session: false,
                            is_restricted: false,
                            volume_percent: 50
                        }
                    ]
                };

                const mockSpotify = {
                    player: {
                        getAvailableDevices: vi.fn().mockResolvedValue(mockDevices)
                    }
                };

                mockGetSpotifyApi.mockReturnValue(mockSpotify as any);

                const result = await tool.execute({}, mockRequestExtra);

                // Verify structure
                expect(result).toHaveProperty('content');
                expect(Array.isArray(result.content)).toBe(true);
                expect(result.content).toHaveLength(1);
                expect(result.content[0]).toHaveProperty('type', 'text');
                expect(result.content[0]).toHaveProperty('text');
                expect(typeof result.content[0].text).toBe('string');
            });
        });
    });
});