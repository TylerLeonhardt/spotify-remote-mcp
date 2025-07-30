import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { ITool, toolsRegistry2, ToolsRegistry2 } from '../toolsRegistry';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export class WhoAmITool implements ITool<{}> {
    name = 'whoami';
    description = 'A tool that returns the authenticated user\'s information';
    argsSchema = {};
    async execute(_args: {}, { authInfo }: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> {
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
}
toolsRegistry2.register(new WhoAmITool());
