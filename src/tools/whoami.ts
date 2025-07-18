import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { toolsRegistry } from '../toolsRegistry';

toolsRegistry.register((server) => server.tool(
    'whoami',
    'A tool that returns the authenticated user\'s information',
    {},
    async (_args, { authInfo }): Promise<CallToolResult> => {
        if (!authInfo) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'You are not authenticated.',
                    },
                ],
            }
        }
        const spotify = getSpotifyApi(authInfo);
        const result = await spotify.currentUser.profile();
        
        return {
            content: [
                {
                    type: 'text',
                    text: `Here is the result of the Spotify Profile: ${JSON.stringify(result)}.`,
                },
            ],
        };
    }
));
