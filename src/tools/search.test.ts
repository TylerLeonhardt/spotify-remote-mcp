import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { SearchTool } from './search';
import { getSpotifyApi } from '../spotifyApi';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Mock the spotifyApi module
vi.mock('../spotifyApi', () => ({
    getSpotifyApi: vi.fn()
}));

describe('SearchTool', () => {
    let searchTool: SearchTool;
    let mockSpotifyApi: any;
    let mockAuthInfo: AuthInfo;
    let mockRequestExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
        searchTool = new SearchTool();
        
        mockSpotifyApi = {
            search: vi.fn()
        };
        
        mockAuthInfo = {
            token: 'test-token',
            clientId: 'test-client-id',
            scopes: ['user-read-private'],
            expiresAt: Date.now() / 1000 + 3600
        };
        
        mockRequestExtra = {
            authInfo: mockAuthInfo
        } as RequestHandlerExtra<ServerRequest, ServerNotification>;

        (getSpotifyApi as Mock).mockReturnValue(mockSpotifyApi);
    });

    describe('Tool Properties', () => {
        test('should have correct name', () => {
            expect(searchTool.name).toBe('search');
        });

        test('should have correct description', () => {
            expect(searchTool.description).toBe('Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks that match a keyword string. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.');
        });

        test('should have correct argsSchema structure', () => {
            expect(searchTool.argsSchema).toHaveProperty('q');
            expect(searchTool.argsSchema).toHaveProperty('type');
            expect(searchTool.argsSchema).toHaveProperty('limit');
            expect(searchTool.argsSchema).toHaveProperty('offset');
        });
    });

    describe('Authentication', () => {
        test('should return authentication error when authInfo is missing', async () => {
            const mockRequestWithoutAuth = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;
            
            const result = await searchTool.execute({
                q: 'test query',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestWithoutAuth);

            expect(result).toEqual({
                content: [{
                    type: 'text',
                    text: 'You are not authenticated.'
                }]
            });
        });

        test('should return authentication error when authInfo is null', async () => {
            const mockRequestWithNullAuth = {
                authInfo: null
            } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;
            
            const result = await searchTool.execute({
                q: 'test query',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestWithNullAuth);

            expect(result).toEqual({
                content: [{
                    type: 'text',
                    text: 'You are not authenticated.'
                }]
            });
        });
    });

    describe('Search Functionality', () => {
        test('should perform successful search with all parameters', async () => {
            const mockSearchResult = {
                tracks: { items: [{ name: 'Test Track', artists: [{ name: 'Test Artist' }] }] },
                albums: { items: [{ name: 'Test Album' }] }
            };
            
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            const result = await searchTool.execute({
                q: 'test query',
                type: ['track', 'album'],
                limit: 10,
                offset: 5
            }, mockRequestExtra);

            expect(getSpotifyApi).toHaveBeenCalledWith(mockAuthInfo);
            expect(mockSpotifyApi.search).toHaveBeenCalledWith('test query', ['track', 'album'], 'US', 10, 5);
            expect(result).toEqual({
                content: [{
                    type: 'text',
                    text: `Here is the result of the Spotify Search: ${JSON.stringify(mockSearchResult)}.`
                }]
            });
        });

        test('should perform search with single type', async () => {
            const mockSearchResult = {
                tracks: { items: [{ name: 'Test Track' }] }
            };
            
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            const result = await searchTool.execute({
                q: 'rock music',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestExtra);

            expect(mockSpotifyApi.search).toHaveBeenCalledWith('rock music', ['track'], 'US', 20, 0);
            expect(result.content[0].text).toContain('Here is the result of the Spotify Search:');
        });

        test('should perform search with multiple types', async () => {
            const mockSearchResult = {
                tracks: { items: [] },
                albums: { items: [] },
                artists: { items: [] },
                playlists: { items: [] }
            };
            
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            await searchTool.execute({
                q: 'beatles',
                type: ['track', 'album', 'artist', 'playlist'],
                limit: 50,
                offset: 10
            }, mockRequestExtra);

            expect(mockSpotifyApi.search).toHaveBeenCalledWith('beatles', ['track', 'album', 'artist', 'playlist'], 'US', 50, 10);
        });

        test('should handle search with all supported types', async () => {
            const mockSearchResult = { tracks: { items: [] } };
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            await searchTool.execute({
                q: 'test',
                type: ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'],
                limit: 20,
                offset: 0
            }, mockRequestExtra);

            expect(mockSpotifyApi.search).toHaveBeenCalledWith(
                'test', 
                ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'], 
                'US', 
                20, 
                0
            );
        });

        test('should handle search with field filters in query', async () => {
            const mockSearchResult = { tracks: { items: [] } };
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            await searchTool.execute({
                q: 'artist:radiohead album:ok computer',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestExtra);

            expect(mockSpotifyApi.search).toHaveBeenCalledWith(
                'artist:radiohead album:ok computer', 
                ['track'], 
                'US', 
                20, 
                0
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle Spotify API errors', async () => {
            const apiError = new Error('Spotify API Error');
            mockSpotifyApi.search.mockRejectedValue(apiError);

            await expect(searchTool.execute({
                q: 'test query',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestExtra)).rejects.toThrow('Spotify API Error');
        });

        test('should handle network errors', async () => {
            const networkError = new Error('Network timeout');
            mockSpotifyApi.search.mockRejectedValue(networkError);

            await expect(searchTool.execute({
                q: 'test query',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestExtra)).rejects.toThrow('Network timeout');
        });
    });

    describe('Parameter Validation', () => {
        test('should work with minimum valid parameters', async () => {
            const mockSearchResult = { tracks: { items: [] } };
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            const result = await searchTool.execute({
                q: 'a',
                type: ['track'],
                limit: 1,
                offset: 0
            }, mockRequestExtra);

            expect(result.content[0].type).toBe('text');
            expect(mockSpotifyApi.search).toHaveBeenCalledWith('a', ['track'], 'US', 1, 0);
        });

        test('should work with maximum valid parameters', async () => {
            const mockSearchResult = { tracks: { items: [] } };
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            await searchTool.execute({
                q: 'very long search query with lots of text and filters artist:test year:2020-2023',
                type: ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'],
                limit: 50,
                offset: 1000
            }, mockRequestExtra);

            expect(mockSpotifyApi.search).toHaveBeenCalledWith(
                'very long search query with lots of text and filters artist:test year:2020-2023',
                ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'],
                'US',
                50,
                1000
            );
        });
    });

    describe('Response Format', () => {
        test('should return correctly formatted response', async () => {
            const mockSearchResult = {
                tracks: {
                    items: [{
                        name: 'Test Track',
                        artists: [{ name: 'Test Artist' }],
                        album: { name: 'Test Album' }
                    }]
                }
            };
            
            mockSpotifyApi.search.mockResolvedValue(mockSearchResult);

            const result = await searchTool.execute({
                q: 'test',
                type: ['track'],
                limit: 20,
                offset: 0
            }, mockRequestExtra);

            expect(result).toHaveProperty('content');
            expect(Array.isArray(result.content)).toBe(true);
            expect(result.content).toHaveLength(1);
            expect(result.content[0]).toHaveProperty('type', 'text');
            expect(result.content[0]).toHaveProperty('text');
            expect(result.content[0].text).toContain('Here is the result of the Spotify Search:');
            expect(result.content[0].text).toContain(JSON.stringify(mockSearchResult));
        });

        test('should handle empty search results', async () => {
            const emptySearchResult = {
                tracks: { items: [] },
                albums: { items: [] },
                artists: { items: [] }
            };
            
            mockSpotifyApi.search.mockResolvedValue(emptySearchResult);

            const result = await searchTool.execute({
                q: 'nonexistent query',
                type: ['track', 'album', 'artist'],
                limit: 20,
                offset: 0
            }, mockRequestExtra);

            expect(result.content[0].text).toContain(JSON.stringify(emptySearchResult));
        });
    });
});