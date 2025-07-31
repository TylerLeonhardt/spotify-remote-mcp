import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { ITool, toolsRegistry } from '../toolsRegistry';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from 'zod';

const setVolumeArgsSchema = {
    volume_percent: z.number().min(0).max(100).describe('The volume to set. Must be a value from 0 to 100 inclusive.'),
    device_id: z.string().optional().describe('The id of the device this command is targeting. If not supplied, the user\'s currently active device is the target.')
};

type SetVolumeArgs = {
    volume_percent: number;
    device_id?: string;
};

export class SetVolumeTool implements ITool<typeof setVolumeArgsSchema> {
    name = 'set_volume';
    description = 'Set the volume for the user\'s current playback device. This API only works for users who have Spotify Premium.';
    argsSchema = setVolumeArgsSchema;

    async execute(args: SetVolumeArgs, { authInfo }: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> {
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
                    // If we can't get playback state, try to set volume anyway without device_id
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

            // Set volume
            await spotify.player.setPlaybackVolume(args.volume_percent, deviceId);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Volume set to ${args.volume_percent}% successfully${deviceInfo}.`,
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
                                text: 'Error: Insufficient permissions to control playback. The Spotify token needs the "user-modify-playback-state" scope to set volume.',
                            },
                        ],
                    };
                }

                if (error.message.includes('Premium')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: This feature requires Spotify Premium. Volume control is only available for Premium users.',
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

                if (error.message.includes('Volume not supported')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: Volume control is not supported on this device.',
                            },
                        ],
                    };
                }

                if (error.message.includes('Invalid volume')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Error: Invalid volume value. Volume must be between 0 and 100.',
                            },
                        ],
                    };
                }
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Error setting volume: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
            };
        }
    }
}

toolsRegistry.register(new SetVolumeTool());
