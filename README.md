# Spotify Remote MCP

> **⚠️ UNOFFICIAL PROJECT** - This is an unofficial Spotify integration. It is not affiliated with, endorsed, or supported by Spotify Technology S.A.

A Model Context Protocol (MCP) server that provides Spotify integration capabilities through authenticated API access. This server allows AI assistants and other MCP clients to interact with Spotify's Web API to search for music, get recommendations, control playback, and access user profile information.

## Features

- **Search**: Search for albums, artists, playlists, tracks, shows, episodes, and audiobooks
- **Music Recommendations**: Get personalized track recommendations based on genres and audio features
- **Playback Control**: Start playing songs on active Spotify devices
- **User Profile**: Access authenticated user's Spotify profile information
- **OAuth2 Authentication**: Secure OAuth2 integration with Spotify's API
- **Session Management**: Persistent session handling with resumability support

## Tools Available

### 1. `search`
Search Spotify's catalog for music and content.

**Parameters:**
- `q` (string): Search query with optional field filters (album, artist, track, year, genre, etc.)
- `type` (array): Item types to search for (album, artist, playlist, track, show, episode, audiobook)
- `limit` (number): Maximum results per type (default: 20, max: 50)
- `offset` (number): Pagination offset (default: 0)

### 2. `get_recommendations`
Get AI-powered track recommendations from Spotify.

**Parameters:**
- `seed_genres` (array): Required array of genre seeds
- Audio feature filters (all optional):
  - `min_acousticness` / `max_acousticness` (0-100)
  - `min_danceability` / `max_danceability` (0-100)
  - `min_energy` / `max_energy` (0-100)
  - `min_instrumentalness` / `max_instrumentalness` (0-100)
  - `min_liveness` / `max_liveness` (0-100)
  - `min_loudness` / `max_loudness` (-60 to 0 dB)
  - `min_popularity` / `max_popularity` (0-100)
  - `min_speechiness` / `max_speechiness` (0-100)
  - `min_tempo` / `max_tempo` (0-250 BPM)
  - `min_valence` / `max_valence` (0-100)
- `limit` (number): Number of recommendations (1-100, default: 10)

### 3. `play_songs`
Start playing songs on an active Spotify device.

**Parameters:**
- `uris` (array): Spotify URIs for tracks, albums, or playlists to play

### 4. `whoami`
Get the authenticated user's Spotify profile information.

**Parameters:** None

## Prerequisites

- Node.js 18+
- A Spotify Developer Account
- Spotify Premium account (required for playback control)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd spotify-remote-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Set up Spotify Application:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new application
   - Note your Client ID and Client Secret
   - Add redirect URIs as needed for your OAuth flow

4. Compile TypeScript:
```bash
npm run compile
```

## Usage

### Starting the Server

```bash
npm start
```

The server will start on port 3000 by default and expose the following endpoints:

- `POST /mcp` - Main MCP protocol endpoint
- `GET /mcp` - Server-Sent Events for MCP streaming
- `DELETE /mcp` - Session termination endpoint
- OAuth metadata endpoints for authentication discovery

### Authentication

This MCP server uses OAuth2 Bearer token authentication. The server expects:

- **Required Scopes**: 
  - `user-read-private`
  - `user-read-email` 
  - `user-read-playback-state`
  - `user-modify-playback-state`

- **Authentication Flow**: The server validates tokens by calling Spotify's `/v1/me` endpoint

### Connecting from MCP Clients

Configure your MCP client to connect to:
- **URL**: `http://localhost:3000/mcp`
- **Authentication**: Bearer token with valid Spotify access token
- **Transport**: HTTP with SSE support for real-time updates

Example client configuration:
```json
{
  "spotify-remote": {
    "command": "node",
    "args": ["dist/index.js"],
    "env": {
      "PORT": "3000"
    }
  }
}
```

## Architecture

### Core Components

- **`index.ts`**: Main server setup with Express.js and OAuth2 authentication
- **`spotifyApi.ts`**: Spotify Web API SDK integration and authentication handling
- **`toolsRegistry.ts`**: Dynamic tool registration system
- **`tools.contribution.ts`**: Tool imports and initialization
- **`tools/`**: Individual tool implementations

### Key Features

- **Session Management**: Persistent sessions with automatic resumability
- **OAuth2 Integration**: Secure token validation with Spotify's API
- **Transport Layer**: HTTP with Server-Sent Events for real-time communication
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Type Safety**: Full TypeScript implementation with Zod schema validation

## Development

### Building

```bash
npm run compile
```

### Project Structure

```
src/
├── index.ts                 # Main server entry point
├── spotifyApi.ts           # Spotify API integration
├── toolsRegistry.ts        # Tool registration system
├── tools.contribution.ts   # Tool imports
└── tools/                  # Individual tools
    ├── search.ts           # Spotify search functionality
    ├── getRecommendations.ts # Music recommendations
    ├── playSongs.ts        # Playback control
    └── whoami.ts           # User profile access
```

### Adding New Tools

1. Create a new file in `src/tools/`
2. Implement the tool using the `toolsRegistry.register()` pattern
3. Import the tool in `src/tools.contribution.ts`

Example tool structure:
```typescript
import { toolsRegistry } from '../toolsRegistry';
import { z } from 'zod';

toolsRegistry.register((server) => server.tool(
    'tool_name',
    'Tool description',
    {
        // Zod schema for parameters
    },
    async (args, { authInfo }) => {
        // Tool implementation
        return {
            content: [
                {
                    type: 'text',
                    text: 'Response text'
                }
            ]
        };
    }
));
```

## Limitations

- Requires Spotify Premium for playback control features
- Rate limited by Spotify's API limits
- Geographic restrictions may apply to certain content
- Device must be active for playback control

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License

## Support

For issues and questions:
- Check Spotify's [Web API documentation](https://developer.spotify.com/documentation/web-api)
- Review MCP protocol specifications
- Open an issue in this repository

---

**Note**: This is an unofficial Spotify integration. It is not affiliated with or endorsed by Spotify Technology S.A.
