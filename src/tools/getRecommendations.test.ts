import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetRecommendationsTool } from './getRecommendations';
import { getSpotifyApi } from '../spotifyApi';

// Mock the Spotify API
vi.mock('../spotifyApi', () => ({
    getSpotifyApi: vi.fn()
}));

const mockGetSpotifyApi = vi.mocked(getSpotifyApi);

describe('GetRecommendationsTool', () => {
    let tool: GetRecommendationsTool;
    let mockSpotifyApi: any;

    beforeEach(() => {
        tool = new GetRecommendationsTool();
        mockSpotifyApi = {
            recommendations: {
                get: vi.fn()
            }
        };
        mockGetSpotifyApi.mockReturnValue(mockSpotifyApi);
    });

    describe('tool metadata', () => {
        it('should have correct name', () => {
            expect(tool.name).toBe('get_recommendations');
        });

        it('should have correct description', () => {
            expect(tool.description).toBe('Call Spotify\'s API to get track recommendations');
        });

        it('should have proper schema structure', () => {
            expect(tool.argsSchema).toHaveProperty('seed_genres');
            expect(tool.argsSchema).toHaveProperty('limit');
            expect(tool.argsSchema).toHaveProperty('min_acousticness');
            expect(tool.argsSchema).toHaveProperty('max_acousticness');
            expect(tool.argsSchema).toHaveProperty('min_tempo');
            expect(tool.argsSchema).toHaveProperty('max_tempo');
        });
    });

    describe('authentication checks', () => {
        it('should return error when not authenticated', async () => {
            const result = await tool.execute(
                { seed_genres: ['pop'] },
                { authInfo: null } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'You are not authenticated.'
            });
        });
    });

    describe('successful recommendations', () => {
        const mockAuthInfo = { token: 'fake-token' };
        const mockSpotifyResponse = {
            tracks: [
                {
                    name: 'Test Song',
                    artists: [{ name: 'Test Artist' }],
                    album: { name: 'Test Album' },
                    duration_ms: 180000, // 3 minutes
                    popularity: 75,
                    preview_url: 'https://preview.spotify.com/test',
                    external_urls: { spotify: 'https://open.spotify.com/track/test' },
                    uri: 'spotify:track:test'
                },
                {
                    name: 'Another Song',
                    artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
                    album: { name: 'Another Album' },
                    duration_ms: 240000, // 4 minutes
                    popularity: 85,
                    preview_url: null,
                    external_urls: { spotify: 'https://open.spotify.com/track/another' },
                    uri: 'spotify:track:another'
                }
            ]
        };

        beforeEach(() => {
            mockSpotifyApi.recommendations.get.mockResolvedValue(mockSpotifyResponse);
        });

        it('should return recommendations with basic parameters', async () => {
            const result = await tool.execute(
                { seed_genres: ['pop', 'rock'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.recommendations.get).toHaveBeenCalledWith({
                seed_genres: 'pop,rock',
                limit: 10
            });

            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Found 2 recommendations:');
            expect(result.content[0].text).toContain('**Test Song** by Test Artist');
            expect(result.content[0].text).toContain('**Another Song** by Artist One, Artist Two');
            expect(result.content[0].text).toContain('Duration: 3:00 | Popularity: 75/100');
            expect(result.content[0].text).toContain('Duration: 4:00 | Popularity: 85/100');
        });

        it('should respect custom limit parameter', async () => {
            await tool.execute(
                { seed_genres: ['jazz'], limit: 5 },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.recommendations.get).toHaveBeenCalledWith({
                seed_genres: 'jazz',
                limit: 5
            });
        });

        it('should use default limit when not provided', async () => {
            await tool.execute(
                { seed_genres: ['classical'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(mockSpotifyApi.recommendations.get).toHaveBeenCalledWith({
                seed_genres: 'classical',
                limit: 10
            });
        });
    });

    describe('audio feature parameter conversion', () => {
        const mockAuthInfo = { token: 'fake-token' };

        beforeEach(() => {
            mockSpotifyApi.recommendations.get.mockResolvedValue({ tracks: [] });
        });

        it('should convert percentage audio features to decimal', async () => {
            await tool.execute({
                seed_genres: ['electronic'],
                min_acousticness: 20,
                max_acousticness: 80,
                min_danceability: 60,
                max_danceability: 100,
                min_energy: 40,
                max_energy: 90,
                min_instrumentalness: 10,
                max_instrumentalness: 30,
                min_liveness: 5,
                max_liveness: 25,
                min_speechiness: 0,
                max_speechiness: 15,
                min_valence: 50,
                max_valence: 95,
                min_popularity: 30,
                max_popularity: 70
            }, { authInfo: mockAuthInfo } as any);

            expect(mockSpotifyApi.recommendations.get).toHaveBeenCalledWith({
                seed_genres: 'electronic',
                limit: 10,
                min_acousticness: 0.2,
                max_acousticness: 0.8,
                min_danceability: 0.6,
                max_danceability: 1.0,
                min_energy: 0.4,
                max_energy: 0.9,
                min_instrumentalness: 0.1,
                max_instrumentalness: 0.3,
                min_liveness: 0.05,
                max_liveness: 0.25,
                min_speechiness: 0,
                max_speechiness: 0.15,
                min_valence: 0.5,
                max_valence: 0.95,
                min_popularity: 0.3,
                max_popularity: 0.7
            });
        });

        it('should not convert tempo and loudness parameters', async () => {
            await tool.execute({
                seed_genres: ['rock'],
                min_tempo: 120,
                max_tempo: 140,
                min_loudness: -10,
                max_loudness: -5
            }, { authInfo: mockAuthInfo } as any);

            expect(mockSpotifyApi.recommendations.get).toHaveBeenCalledWith({
                seed_genres: 'rock',
                limit: 10,
                min_tempo: 120,
                max_tempo: 140,
                min_loudness: -10,
                max_loudness: -5
            });
        });

        it('should skip undefined parameters', async () => {
            await tool.execute({
                seed_genres: ['ambient'],
                min_energy: 30,
                max_energy: undefined, // This should be skipped
                min_valence: undefined // This should be skipped
            }, { authInfo: mockAuthInfo } as any);

            expect(mockSpotifyApi.recommendations.get).toHaveBeenCalledWith({
                seed_genres: 'ambient',
                limit: 10,
                min_energy: 0.3
                // max_energy and min_valence should not be present
            });
        });
    });

    describe('error handling', () => {
        const mockAuthInfo = { token: 'fake-token' };

        it('should handle Spotify API errors gracefully', async () => {
            const errorMessage = 'Spotify API rate limit exceeded';
            mockSpotifyApi.recommendations.get.mockRejectedValue(new Error(errorMessage));

            const result = await tool.execute(
                { seed_genres: ['pop'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: `Error getting recommendations: ${errorMessage}`
            });
        });

        it('should handle unknown errors', async () => {
            mockSpotifyApi.recommendations.get.mockRejectedValue('Unknown error object');

            const result = await tool.execute(
                { seed_genres: ['rock'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'Error getting recommendations: Unknown error'
            });
        });

        it('should handle empty response from Spotify API', async () => {
            mockSpotifyApi.recommendations.get.mockResolvedValue({ tracks: [] });

            const result = await tool.execute(
                { seed_genres: ['indie'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Found 0 recommendations:');
        });
    });

    describe('formatted output structure', () => {
        const mockAuthInfo = { token: 'fake-token' };

        it('should format track duration correctly', async () => {
            const mockResponse = {
                tracks: [
                    {
                        name: 'Short Song',
                        artists: [{ name: 'Artist' }],
                        album: { name: 'Album' },
                        duration_ms: 65000, // 1:05
                        popularity: 50,
                        preview_url: null,
                        external_urls: { spotify: 'https://spotify.com/track/1' },
                        uri: 'spotify:track:1'
                    },
                    {
                        name: 'Long Song',
                        artists: [{ name: 'Artist' }],
                        album: { name: 'Album' },
                        duration_ms: 258000, // 4:18
                        popularity: 60,
                        preview_url: null,
                        external_urls: { spotify: 'https://spotify.com/track/2' },
                        uri: 'spotify:track:2'
                    }
                ]
            };

            mockSpotifyApi.recommendations.get.mockResolvedValue(mockResponse);

            const result = await tool.execute(
                { seed_genres: ['pop'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].text).toContain('Duration: 1:05 | Popularity: 50/100');
            expect(result.content[0].text).toContain('Duration: 4:18 | Popularity: 60/100');
        });

        it('should handle multiple artists correctly', async () => {
            const mockResponse = {
                tracks: [
                    {
                        name: 'Collaboration',
                        artists: [
                            { name: 'Artist One' },
                            { name: 'Artist Two' },
                            { name: 'Artist Three' }
                        ],
                        album: { name: 'Various Artists' },
                        duration_ms: 180000,
                        popularity: 75,
                        preview_url: null,
                        external_urls: { spotify: 'https://spotify.com/track/collab' },
                        uri: 'spotify:track:collab'
                    }
                ]
            };

            mockSpotifyApi.recommendations.get.mockResolvedValue(mockResponse);

            const result = await tool.execute(
                { seed_genres: ['pop'] },
                { authInfo: mockAuthInfo } as any
            );

            expect(result.content[0].text).toContain('**Collaboration** by Artist One, Artist Two, Artist Three');
        });

        it('should include all required fields in output', async () => {
            const mockResponse = {
                tracks: [
                    {
                        name: 'Complete Track',
                        artists: [{ name: 'Complete Artist' }],
                        album: { name: 'Complete Album' },
                        duration_ms: 210000,
                        popularity: 88,
                        preview_url: 'https://preview.spotify.com/complete',
                        external_urls: { spotify: 'https://open.spotify.com/track/complete' },
                        uri: 'spotify:track:complete'
                    }
                ]
            };

            mockSpotifyApi.recommendations.get.mockResolvedValue(mockResponse);

            const result = await tool.execute(
                { seed_genres: ['pop'] },
                { authInfo: mockAuthInfo } as any
            );

            const output = result.content[0].text;
            expect(output).toContain('**Complete Track** by Complete Artist');
            expect(output).toContain('Album: Complete Album');
            expect(output).toContain('Duration: 3:30 | Popularity: 88/100');
            expect(output).toContain('Spotify: https://open.spotify.com/track/complete');
            expect(output).toContain('URI: spotify:track:complete');
        });
    });
});