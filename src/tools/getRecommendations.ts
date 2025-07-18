import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getSpotifyApi } from '../spotifyApi';
import { toolsRegistry } from '../toolsRegistry';

toolsRegistry.register((server) => server.tool(
    'get_recommendations',
    'Call Spotify\'s API to get track recommendations',
    {
        seed_genres: z.array(z.enum([
            "acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues",
            "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical",
            "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco",
            "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro",
            "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar",
            "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk",
            "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop",
            "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc",
            "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party",
            "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock",
            "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll",
            "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska",
            "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop",
            "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"
        ])).describe("The ONLY VALID seed genres to choose from"),
        min_acousticness: z.number().min(0).max(100).optional().describe("Minimum acousticness value (0-100)"),
        max_acousticness: z.number().min(0).max(100).optional().describe("Maximum acousticness value (0-100)"),
        min_danceability: z.number().min(0).max(100).optional().describe("Minimum danceability value (0-100)"),
        max_danceability: z.number().min(0).max(100).optional().describe("Maximum danceability value (0-100)"),
        min_energy: z.number().min(0).max(100).optional().describe("Minimum energy value (0-100)"),
        max_energy: z.number().min(0).max(100).optional().describe("Maximum energy value (0-100)"),
        min_instrumentalness: z.number().min(0).max(100).optional().describe("Minimum instrumentalness value (0-100)"),
        max_instrumentalness: z.number().min(0).max(100).optional().describe("Maximum instrumentalness value (0-100)"),
        min_liveness: z.number().min(0).max(100).optional().describe("Minimum liveness value (0-100)"),
        max_liveness: z.number().min(0).max(100).optional().describe("Maximum liveness value (0-100)"),
        min_loudness: z.number().min(-60).max(0).optional().describe("Minimum loudness value in dB (-60 to 0)"),
        max_loudness: z.number().min(-60).max(0).optional().describe("Maximum loudness value in dB (-60 to 0)"),
        min_popularity: z.number().min(0).max(100).optional().describe("Minimum popularity value (0-100)"),
        max_popularity: z.number().min(0).max(100).optional().describe("Maximum popularity value (0-100)"),
        min_speechiness: z.number().min(0).max(100).optional().describe("Minimum speechiness value (0-100)"),
        max_speechiness: z.number().min(0).max(100).optional().describe("Maximum speechiness value (0-100)"),
        min_tempo: z.number().min(0).max(250).optional().describe("Minimum tempo in BPM (0-250)"),
        max_tempo: z.number().min(0).max(250).optional().describe("Maximum tempo in BPM (0-250)"),
        min_valence: z.number().min(0).max(100).optional().describe("Minimum valence/positivity value (0-100)"),
        max_valence: z.number().min(0).max(100).optional().describe("Maximum valence/positivity value (0-100)"),
        limit: z.number().min(1).max(100).default(10).describe("The number of recommendations to return (1-100)")
    },
    async ({ seed_genres, limit, ...audioFeatures }, { authInfo }): Promise<CallToolResult> => {
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
        
        // Convert audio feature parameters to the format expected by Spotify API
        const recommendationParams: any = {
            seed_genres: seed_genres.join(','),
            limit: limit || 10
        };

        // Add audio feature parameters if provided
        Object.entries(audioFeatures).forEach(([key, value]) => {
            if (value !== undefined) {
                // Convert percentage values to decimal for audio features (except tempo, loudness)
                if (key.includes('acousticness') || key.includes('danceability') || 
                    key.includes('energy') || key.includes('instrumentalness') || 
                    key.includes('liveness') || key.includes('speechiness') || 
                    key.includes('valence') || key.includes('popularity')) {
                    recommendationParams[key] = (value as number) / 100;
                } else {
                    recommendationParams[key] = value;
                }
            }
        });

        try {
            const result = await spotify.recommendations.get(recommendationParams);

            // Format the tracks into a readable format
            const formattedTracks = result.tracks.map(track => ({
                name: track.name,
                artists: track.artists.map(artist => artist.name).join(', '),
                album: track.album.name,
                duration: `${Math.floor(track.duration_ms / 60000)}:${(Math.floor(track.duration_ms % 60000 / 1000)).toString().padStart(2, '0')}`,
                popularity: track.popularity,
                preview_url: track.preview_url,
                external_url: track.external_urls.spotify,
                uri: track.uri
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${result.tracks.length} recommendations:\n\n` +
                                formattedTracks.map((track, index) => 
                                `${index + 1}. **${track.name}** by ${track.artists}\n` +
                                `   Album: ${track.album}\n` +
                                `   Duration: ${track.duration} | Popularity: ${track.popularity}/100\n` +
                                `   Spotify: ${track.external_url}\n` +
                                `   URI: ${track.uri}\n`
                                ).join('\n')
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error getting recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
            };
        }
    }
));
