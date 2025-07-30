import { CallToolResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { getSpotifyApi } from '../spotifyApi';
import { ITool, toolsRegistry2 } from '../toolsRegistry';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { z } from 'zod'; 

const searchArgsSchema = {
    q: z.string().describe(`Your search query.
You can narrow down your search using field filters. The available filters are album, artist, track, year, upc, tag:hipster, tag:new, isrc, and genre. Each field filter only applies to certain result types.
The artist and year filters can be used while searching albums, artists and tracks. You can filter on a single year or a range (e.g. 1955-1960).
The album filter can be used while searching albums and tracks.
The genre filter can be used while searching artists and tracks.
The isrc and track filters can be used while searching tracks.
The upc, tag:new and tag:hipster filters can only be used while searching albums. The tag:new filter will return albums released in the past two weeks and tag:hipster can be used to return only albums with the lowest 10% popularity.`),
    type: z.array(z.enum(['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook']).describe(`list of item types to search across. Search results include hits from all the specified item types.`)),
    limit: z.number().max(50).min(0).describe('The maximum number of results to return in each item type.').default(20),
    offset: z.number().describe('The index of the first result to return. Use this parameter along with limit to get the next set of results.').default(0),
};

type SearchArgs = {
    q: string;
    type: ('album' | 'artist' | 'playlist' | 'track' | 'show' | 'episode' | 'audiobook')[];
    limit: number;
    offset: number;
};

export class SearchTool implements ITool<typeof searchArgsSchema> {
    name = 'search';
    description = 'Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks that match a keyword string. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.';
    argsSchema = searchArgsSchema;
    
    async execute(args: SearchArgs, { authInfo }: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> {
        const { q, type, limit, offset } = args;
        
        if (!authInfo) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'You are not authenticated.',
                    },
                ],
            };
        }
        
        const spotify = getSpotifyApi(authInfo);
        const result = await spotify.search(q, type, 'US', limit as any, offset);

        return {
            content: [
                {
                    type: 'text',
                    text: `Here is the result of the Spotify Search: ${JSON.stringify(result)}.`,
                },
            ],
        };
    }
}

toolsRegistry2.register(new SearchTool());
