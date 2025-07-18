import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

export function getSpotifyApi(authInfo: AuthInfo): SpotifyApi {
    const spotify = new SpotifyApi({
        async getAccessToken() {
            return {
                access_token: authInfo.token,
                expires_in: 70000,
                token_type: 'bearer',
                refresh_token: 'bad',
                expires: authInfo.expiresAt
            }
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
            }
        },
        removeAccessToken() {

        },
    });
    return spotify;
}