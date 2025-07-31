import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

/**
 * Custom error class for JSON parsing errors.
 * Used to signal https://github.com/spotify/spotify-web-api-ts-sdk/issues/127
 */
export class JsonParseError extends Error { }

export function getSpotifyApi(authInfo: AuthInfo): SpotifyApi {
    const spotify = new SpotifyApi(
        {
            async getAccessToken() {
                return {
                    access_token: authInfo.token,
                    expires_in: 70000,
                    token_type: 'bearer',
                    refresh_token: 'bad',
                    expires: authInfo.expiresAt
                };
            },
            setConfiguration(_configuration) {

            },
            async getOrCreateAccessToken() {
                return {
                    access_token: authInfo.token,
                    expires_in: 70000,
                    token_type: 'bearer',
                    refresh_token: 'bad',
                    expires: authInfo.expiresAt
                };
            },
            removeAccessToken() {

            },
        },
        {
            deserializer: {
                async deserialize<T>(response: Response) {
                    const text = await response.text();

                    if (text.length > 0) {
                        try {
                            const json = JSON.parse(text);
                            return json as T;
                        } catch (error) {
                            throw new JsonParseError(`Failed to parse JSON response: ${text}`);
                        }
                    }

                    return null as T;
                },
            },
        }
    );
    return spotify;
}
