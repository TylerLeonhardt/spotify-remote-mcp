import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { ITool, toolsRegistry } from '../toolsRegistry';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from 'zod';

const pausePlaybackArgsSchema = {
    device_id: z.string().optional().describe('The id of the device this command is targeting. If not supplied, the user\'s currently active device is the target.')
};

type PausePlaybackArgs = {
    device_id?: string;
};

export class PausePlaybackTool implements ITool<typeof pausePlaybackArgsSchema> {
    name = 'pause_playback';
    description = 'Pause playback on the user\'s account. This API only works for users who have Spotify Premium.';
    argsSchema = pausePlaybackArgsSchema;

    async execute(args: PausePlaybackArgs, { authInfo }: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> {
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
            let deviceId = args.device_id;
            let deviceInfo = '';

            // If no device_id provided, get the currently active device
            if (!deviceId) {
                try {
                    const playbackState = await spotify.player.getPlaybackState();
                    if (playbackState?.device?.id) {
                        deviceId = playbackState.device.id;
                        deviceInfo = ` on ${playbackState.device.name} (${playbackState.device.type})`;
                    } else {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: 'No active playback found. Make sure Spotify is playing music on a device.',
                                },
                            ],
                        };
                    }
                } catch (error) {
                    // If we can't get playback state, try to pause anyway without device_id
                    deviceId = undefined;
                }
            } else {
                // If device_id was provided, try to get device name for better user feedback
                try {
                    const devices = await spotify.player.getAvailableDevices();
                    const targetDevice = devices.devices.find(device => device.id === deviceId);
                    if (targetDevice) {
                        deviceInfo = ` on ${targetDevice.name} (${targetDevice.type})`;
                    } else {
                        deviceInfo = ` on device ${deviceId}`;
                    }
                } catch (error) {
                    deviceInfo = ` on device ${deviceId}`;
                }
            }

            // Pause playback
            await spotify.player.pausePlayback(deviceId as any);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Playback paused successfully${deviceInfo}.`,
                    },
                ],
            };

        } catch (error) {
            // Handle specific error cases
            if (error instanceof Error) {
                if (error.message.includes('scope')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: Insufficient permissions to control playback. The Spotify token needs the "user-modify-playback-state" scope to pause playback.',
                            },
                        ],
                    };
                }

                if (error.message.includes('Premium')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: This feature requires Spotify Premium. Playback control is only available for Premium users.',
                            },
                        ],
                    };
                }

                if (error.message.includes('Device not found')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: The specified device was not found or is not available.',
                            },
                        ],
                    };
                }

                if (error.message.includes('No active device')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: No active device found. Please start playing music on a Spotify device first.',
                            },
                        ],
                    };
                }
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Error pausing playback: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
            };
        }
    }
}

toolsRegistry.register(new PausePlaybackTool());
