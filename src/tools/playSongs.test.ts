import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaySongsTool } from './playSongs';
import { getSpotifyApi } from '../spotifyApi';

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

describe('PlaySongsTool', () => {
    let tool: PlaySongsTool;
    let mockSpotifyApi: any;
    let mockAuthInfo: any;

    beforeEach(() => {
        tool = new PlaySongsTool();
        mockAuthInfo = { access_token: 'mock-token' };
        
        mockSpotifyApi = {
            player: {
                getAvailableDevices: vi.fn(),
                getPlaybackState: vi.fn(),
                startResumePlayback: vi.fn()
            }
        };
        
        (getSpotifyApi as any).mockReturnValue(mockSpotifyApi);
    });

    describe('basic properties', () => {
        it('should have correct name', () => {
            expect(tool.name).toBe('play_songs');
        });

        it('should have correct description', () => {
            expect(tool.description).toBe('Start playing tracks, albums, or playlists on a Spotify device. If no device is specified, will use the currently active device or list available devices.');
        });

        it('should have correct args schema', () => {
            expect(tool.argsSchema).toHaveProperty('uris');
            expect(tool.argsSchema).toHaveProperty('device_name');
        });
    });

    describe('authentication checks', () => {
        it('should return error when not authenticated', async () => {
            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: null } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'You are not authenticated.'
            });
        });
    });

    describe('input validation', () => {
        it('should return error when no URIs provided', async () => {
            const result = await tool.execute(
                { uris: [] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'No URIs provided to play.'
            });
        });

        it('should return error when URIs is undefined', async () => {
            const result = await tool.execute(
                { uris: undefined as any },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'No URIs provided to play.'
            });
        });
    });

    describe('device management', () => {
        it('should return error when no devices are available', async () => {
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({
                devices: []
            });

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'No active Spotify devices found. Please open Spotify on a device and try again.'
            });
        });

        it('should find device by name when device_name is specified', async () => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: false },
                { id: 'device2', name: 'Office', type: 'Smartphone', is_active: true }
            ];
            
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['spotify:track:123'], device_name: 'Kitchen' },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', undefined, ['spotify:track:123']
            );
            expect(result.content[0].text).toContain('Kitchen (Computer)');
        });

        it('should return error when specified device is not found', async () => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: false }
            ];
            
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });

            const result = await tool.execute(
                { uris: ['spotify:track:123'], device_name: 'NonExistent' },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].text).toContain('Device "NonExistent" not found');
            expect(result.content[0].text).toContain('Kitchen (Computer)');
        });

        it('should use active device when no device name specified', async () => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: false },
                { id: 'device2', name: 'Office', type: 'Smartphone', is_active: true }
            ];
            
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.getPlaybackState.mockRejectedValue(new Error('No state'));
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device2', undefined, ['spotify:track:123']
            );
            expect(result.content[0].text).toContain('Office (Smartphone)');
        });

        it('should use first device when no active device', async () => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: false },
                { id: 'device2', name: 'Office', type: 'Smartphone', is_active: false }
            ];
            
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.getPlaybackState.mockRejectedValue(new Error('No state'));
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', undefined, ['spotify:track:123']
            );
            expect(result.content[0].text).toContain('Kitchen (Computer)');
        });

        it('should use current playback device when available', async () => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: false },
                { id: 'device2', name: 'Office', type: 'Smartphone', is_active: false }
            ];
            
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.getPlaybackState.mockResolvedValue({
                device: { id: 'device2' }
            });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device2', undefined, ['spotify:track:123']
            );
        });

        it('should handle devices without IDs', async () => {
            const devices = [
                { id: null, name: 'Kitchen', type: 'Computer', is_active: false },
                { id: undefined, name: 'Office', type: 'Smartphone', is_active: false }
            ];
            
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.getPlaybackState.mockRejectedValue(new Error('No state'));

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].text).toContain('Available devices found but no device IDs');
            expect(result.content[0].text).toContain('Please ensure Spotify is active on a device');
        });
    });

    describe('URI type detection and playback', () => {
        beforeEach(() => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: true }
            ];
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});
        });

        it('should play track URIs', async () => {
            const trackUris = ['spotify:track:123', 'spotify:track:456'];
            
            const result = await tool.execute(
                { uris: trackUris },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', undefined, trackUris
            );
            expect(result.content[0].text).toContain('Successfully started playing 2 track(s)');
            expect(result.content[0].text).toContain('1. spotify:track:123');
            expect(result.content[0].text).toContain('2. spotify:track:456');
        });

        it('should play album URI (context)', async () => {
            const albumUri = 'spotify:album:123';
            
            const result = await tool.execute(
                { uris: [albumUri] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', albumUri
            );
            expect(result.content[0].text).toContain('Started playing album: spotify:album:123');
        });

        it('should play playlist URI (context)', async () => {
            const playlistUri = 'spotify:playlist:123';
            
            const result = await tool.execute(
                { uris: [playlistUri] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', playlistUri
            );
            expect(result.content[0].text).toContain('Started playing playlist: spotify:playlist:123');
        });

        it('should handle HTTP URL format URIs', async () => {
            const trackUri = 'https://open.spotify.com/track/123';
            
            const result = await tool.execute(
                { uris: [trackUri] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', undefined, [trackUri]
            );
            expect(result.content[0].text).toContain('Successfully started playing 1 track(s)');
        });

        it('should prioritize context URI and warn about multiple context URIs', async () => {
            const uris = ['spotify:album:123', 'spotify:playlist:456', 'spotify:track:789'];
            
            const result = await tool.execute(
                { uris },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', 'spotify:album:123'
            );
            expect(result.content[0].text).toContain('Started playing album: spotify:album:123');
            expect(result.content[0].text).toContain('Only the first album was played');
            expect(result.content[0].text).toContain('Additional context URIs were ignored: spotify:playlist:456');
            expect(result.content[0].text).toContain('Track URIs were ignored when playing album: spotify:track:789');
        });

        it('should return error for invalid URIs', async () => {
            const result = await tool.execute(
                { uris: ['invalid:uri:123', 'another:invalid:456'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'No valid Spotify URIs found. Please provide track, album, or playlist URIs.'
            });
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            const devices = [
                { id: 'device1', name: 'Kitchen', type: 'Computer', is_active: true }
            ];
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
        });

        it('should handle insufficient scope error', async () => {
            mockSpotifyApi.player.startResumePlayback.mockRejectedValue(
                new Error('scope error: insufficient permissions')
            );

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'Error: Insufficient permissions to control playback. The Spotify token needs the "user-modify-playback-state" scope to play songs.'
            });
        });

        it('should handle general errors', async () => {
            mockSpotifyApi.player.startResumePlayback.mockRejectedValue(
                new Error('Network error')
            );

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'Error starting playback: Network error'
            });
        });

        it('should handle unknown errors', async () => {
            mockSpotifyApi.player.startResumePlayback.mockRejectedValue('Unknown error');

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'Error starting playback: Unknown error'
            });
        });
    });

    describe('URI type detection helper', () => {
        // Since getUriType is not exported, we'll test it indirectly through the main functionality
        it('should correctly identify track URIs in spotify: format', async () => {
            const devices = [{ id: 'device1', name: 'Kitchen', type: 'Computer', is_active: true }];
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', undefined, ['spotify:track:123']
            );
        });

        it('should correctly identify album URIs in HTTP format', async () => {
            const devices = [{ id: 'device1', name: 'Kitchen', type: 'Computer', is_active: true }];
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['https://open.spotify.com/album/123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', 'https://open.spotify.com/album/123'
            );
        });

        it('should correctly identify playlist URIs in HTTP format', async () => {
            const devices = [{ id: 'device1', name: 'Kitchen', type: 'Computer', is_active: true }];
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});

            const result = await tool.execute(
                { uris: ['https://open.spotify.com/playlist/123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.player.startResumePlayback).toHaveBeenCalledWith(
                'device1', 'https://open.spotify.com/playlist/123'
            );
        });
    });

    describe('output formatting', () => {
        beforeEach(() => {
            const devices = [
                { id: 'device1', name: 'Kitchen Speaker', type: 'Computer', is_active: true }
            ];
            mockSpotifyApi.player.getAvailableDevices.mockResolvedValue({ devices });
            mockSpotifyApi.player.startResumePlayback.mockResolvedValue({});
        });

        it('should format device info correctly in success message', async () => {
            const result = await tool.execute(
                { uris: ['spotify:track:123'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].text).toContain('Playing on device: Kitchen Speaker (Computer)');
        });

        it('should show track count and enumeration for multiple tracks', async () => {
            const trackUris = ['spotify:track:123', 'spotify:track:456', 'spotify:track:789'];
            
            const result = await tool.execute(
                { uris: trackUris },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].text).toContain('Successfully started playing 3 track(s)');
            expect(result.content[0].text).toContain('1. spotify:track:123');
            expect(result.content[0].text).toContain('2. spotify:track:456');
            expect(result.content[0].text).toContain('3. spotify:track:789');
        });
    });
});