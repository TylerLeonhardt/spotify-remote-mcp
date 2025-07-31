import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { ITool, toolsRegistry } from '../toolsRegistry';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from 'zod';

const getPlaybackStateArgsSchema = {
    market: z.string().optional().describe('An ISO 3166-1 alpha-2 country code. If a country code is specified, only content that is available in that market will be returned.'),
    additional_types: z.string().optional().describe('A comma-separated list of item types that your client supports besides the default track type. Valid types are: track and episode.')
};

type GetPlaybackStateArgs = {
    market?: string;
    additional_types?: string;
};

export class GetPlaybackStateTool implements ITool<typeof getPlaybackStateArgsSchema> {
    name = 'get_playback_state';
    description = 'Get information about the user\'s current playback state, including track or episode, progress, and active device';
    argsSchema = getPlaybackStateArgsSchema;

    async execute(args: GetPlaybackStateArgs, { authInfo }: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> {
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
        
        try {
            const result = await spotify.player.getPlaybackState(args.market as any, args.additional_types);

            if (!result) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'No playback is currently active or the user is not playing anything.',
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Current playback state: ${JSON.stringify(result, null, 2)}`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error retrieving playback state: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
            };
        }
    }
}

toolsRegistry.register(new GetPlaybackStateTool());
