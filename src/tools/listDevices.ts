import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { ITool, toolsRegistry2 } from '../toolsRegistry';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export class ListDevicesTool implements ITool<{}> {
    name = 'list_devices';
    description = 'List available Spotify Connect devices that can be used for playback';
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

        try {
            const devices = await spotify.player.getAvailableDevices();
            
            if (devices.devices.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'No Spotify devices found. Please open Spotify on a device and try again.',
                        },
                    ],
                };
            }

            const deviceList = devices.devices.map(device => {
                const status = device.is_active ? '(active)' : '(inactive)';
                return `- ${device.name} (${device.type}) ${status}`;
            }).join('\n');

            return {
                content: [
                    {
                        type: 'text',
                        text: `Available Spotify devices:\n${deviceList}`,
                    },
                ],
            };

        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error getting devices: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
            };
        }
    }
}

toolsRegistry2.register(new ListDevicesTool());