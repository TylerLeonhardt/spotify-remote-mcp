import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { toolsRegistry } from '../toolsRegistry';

// Helper function to determine URI type
function getUriType(uri: string): 'track' | 'album' | 'playlist' | 'unknown' {
    if (uri.includes(':track:')) return 'track';
    if (uri.includes(':album:')) return 'album';
    if (uri.includes(':playlist:')) return 'playlist';
    return 'unknown';
}

toolsRegistry.register((server) => server.tool(
    'play_songs',
    'Start playing songs on a Spotify device. If no device is specified, will use the currently active device or list available devices.',
    {
        uris: z.array(z.string()).describe("Array of Spotify URIs (tracks, albums, playlists) to play"),
    },
    async ({ uris }, { authInfo }): Promise<CallToolResult> => {
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

        if (!uris || uris.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No URIs provided to play.',
                    },
                ],
            }
        }

        const spotify = getSpotifyApi(authInfo);

        // Separate URIs by type
        const trackUris: string[] = [];
        const contextUris: string[] = [];
        
        for (const uri of uris) {
            const uriType = getUriType(uri);
            if (uriType === 'track') {
                trackUris.push(uri);
            } else if (uriType === 'album' || uriType === 'playlist') {
                contextUris.push(uri);
            }
        }

        try {
            let deviceId: string | undefined = undefined;

            // If no device ID specified, try to get current playback state
            try {
                const state = await spotify.player.getPlaybackState();
                if (state?.device?.id) {
                    deviceId = state.device.id;
                }
            } catch (error) {
                // Playback state might not be available, continue to device selection
            }

            // If still no device, get available devices
            if (!deviceId) {
                const devices = await spotify.player.getAvailableDevices();
                
                if (devices.devices.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No active Spotify devices found. Please open Spotify on a device and try again.',
                            },
                        ],
                    };
                }

                // For MCP, we'll use the first available device or prioritize active ones
                const activeDevice = devices.devices.find(device => device.is_active);
                const selectedDevice = activeDevice || devices.devices[0];
                
                if (selectedDevice?.id) {
                    deviceId = selectedDevice.id;
                } else {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Available devices found but no device IDs:\n${devices.devices.map(d => `- ${d.name} (${d.type})`).join('\n')}\n\nPlease ensure Spotify is active on a device.`,
                            },
                        ],
                    };
                }
            }

            // Start playback based on URI types
            let playedContent = '';
            
            if (contextUris.length > 0) {
                // Play context URI (album/playlist) - only one can be played at a time
                const contextUri = contextUris[0];
                await spotify.player.startResumePlayback(deviceId, contextUri);
                
                playedContent = `Started playing ${getUriType(contextUri)}: ${contextUri}`;
                
                // Warn if there are multiple context URIs or track URIs that will be ignored
                if (contextUris.length > 1) {
                    playedContent += `\nNote: Only the first ${getUriType(contextUri)} was played. Additional context URIs were ignored: ${contextUris.slice(1).join(', ')}`;
                }
                if (trackUris.length > 0) {
                    playedContent += `\nNote: Track URIs were ignored when playing ${getUriType(contextUri)}: ${trackUris.join(', ')}`;
                }
            } else if (trackUris.length > 0) {
                // Play individual tracks
                await spotify.player.startResumePlayback(deviceId, undefined, trackUris);
                playedContent = `Successfully started playing ${trackUris.length} track(s):\n${trackUris.map((uri, index) => `${index + 1}. ${uri}`).join('\n')}`;
            } else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'No valid Spotify URIs found. Please provide track, album, or playlist URIs.',
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `${playedContent}\nPlaying on device: ${deviceId}`,
                    },
                ],
            };

        } catch (error) {
            // If the error is about insufficient scope, provide helpful message
            if (error instanceof Error && error.message.includes('scope')) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Error: Insufficient permissions to control playback. The Spotify token needs the "user-modify-playback-state" scope to play songs.',
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Error starting playback: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
            };
        }
    }
));
