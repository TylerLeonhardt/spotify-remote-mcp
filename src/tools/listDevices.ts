import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { toolsRegistry } from '../toolsRegistry';

toolsRegistry.register((server) => server.tool(
    'list_devices',
    'List available Spotify Connect devices that can be used for playback',
    {
        // No parameters needed
    },
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
));