# Spotify Remote MCP

> **⚠️ UNOFFICIAL PROJECT** - This is an unofficial Spotify integration. It is not affiliated with, endorsed, or supported by Spotify Technology S.A.

An MCP server that lets AI assistants control Spotify - search music, play songs, and manage playback.

## Features

- **🔍 Search**: Search for albums, artists, playlists, tracks, shows, episodes, and audiobooks
- **🎵 Playback Control**: Start/pause playback, skip tracks, and control volume
- **📱 Device Management**: List available Spotify Connect devices and target specific devices by name  
- **👤 User Profile**: Access authenticated user's Spotify profile information
- **🔐 OAuth2 Authentication**: Secure OAuth2 integration with Spotify's OpenID Connect configuration

## Tools Available

| Tool | Description |
|------|-------------|
| `search` | Search Spotify catalog for tracks, albums, artists, playlists, etc. |
| `play_songs` | Start playing music on Spotify devices |
| `pause_playback` | Pause current playback |
| `skip_to_next` | Skip to next track |
| `skip_to_previous` | Skip to previous track |
| `set_volume` | Adjust playback volume (0-100%) |
| `get_playback_state` | Get current track and playback info |
| `list_devices` | List available Spotify Connect devices |
| `whoami` | Get user profile information |

## Prerequisites

- Node.js 20+ (updated requirement)
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
   - Add the following redirect URIs:
     - `http://localhost:33418`
     - `https://vscode.dev/redirect`

4. Build the project:
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

This MCP server uses OAuth2 Bearer token authentication with dynamic metadata fetching from Spotify's OpenID Connect configuration.

- **Required Scopes**: 
  - `user-read-private`
  - `user-read-email` 
  - `user-read-playback-state`
  - `user-modify-playback-state`

- **Authentication Flow**: The server validates tokens by calling Spotify's `/v1/me` endpoint
- **Metadata Source**: Dynamically fetched from `https://accounts.spotify.com/.well-known/openid-configuration`

### Connecting from MCP Clients

Configure your MCP client to connect to:
- **URL**: `http://localhost:3000/mcp`
- **Authentication**: Bearer token with valid Spotify access token
- **Transport**: HTTP with SSE support for real-time updates

Example VS Code configuration:
```json
{
  "mcpServers": {
    "spotify-remote": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```

## Architecture

### Core Components

- **`index.ts`**: Main server with Express.js, OAuth2 auth, and session management
- **`spotifyApi.ts`**: Spotify Web API SDK integration and authentication handling
- **`toolsRegistry.ts`**: Dynamic tool registration system with TypeScript support
- **`tools.contribution.ts`**: Tool imports and initialization
- **`tools/`**: Individual tool implementations with comprehensive error handling

### Key Features

- **Dynamic OAuth Metadata**: Fetches configuration from Spotify's OpenID Connect endpoint
- **Session Management**: Persistent sessions with automatic resumability via InMemoryEventStore
- **Transport Layer**: HTTP with Server-Sent Events for real-time bidirectional communication
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript implementation with Zod schema validation
- **Testing**: Vitest test suite for all tools

## Development

### Building & Watching

```bash
# Build once
npm run compile

# Watch for changes (TypeScript + ESBuild)
npm run watch

# Run tests
npm test
```

### Project Structure

```
src/
├── index.ts                    # Main server entry point
├── spotifyApi.ts              # Spotify API integration  
├── toolsRegistry.ts           # Tool registration system
├── tools.contribution.ts      # Tool imports
└── tools/                     # Individual tool implementations
    ├── search.ts              # Spotify search with filtering
    ├── getPlaybackState.ts    # Current playback information
    ├── playSongs.ts           # Start playback with device targeting
    ├── pausePlayback.ts       # Pause control
    ├── skipToNext.ts          # Next track
    ├── skipToPrevious.ts      # Previous track
    ├── setVolume.ts           # Volume control
    ├── listDevices.ts         # Device discovery
    ├── whoami.ts              # User profile
    └── *.test.ts              # Comprehensive test coverage
```

### Adding New Tools

1. Create a new file in `src/tools/` implementing the `ITool` interface
2. Add corresponding test file
3. Import the tool in `src/tools.contribution.ts`
4. Build and test

Example tool structure:
```typescript
import { ITool, toolsRegistry } from '../toolsRegistry';
import { z } from 'zod';

export class MyTool implements ITool<typeof myArgsSchema> {
    name = 'my_tool';
    description = 'Tool description';
    argsSchema = {
        param: z.string().describe('Parameter description')
    };
    
    async execute(args: MyArgs, { authInfo }: RequestHandlerExtra) {
        // Tool implementation
        return {
            content: [{
                type: 'text',
                text: 'Response text'
            }]
        };
    }
}

toolsRegistry.register(new MyTool());
```

## Error Handling

The server provides comprehensive error handling for common scenarios:

- **Authentication**: Clear messages for invalid/expired tokens
- **Premium Requirements**: Specific errors for Premium-only features
- **Device Issues**: Helpful messages for device targeting problems
- **API Limits**: Graceful handling of rate limits and quota issues
- **Network Issues**: Fallback behavior for connectivity problems

## Deployment

### Environment Variables

- `PORT`: Server port (default: 3000)
- `WEBSITE_HOSTNAME`: For production deployment (enables HTTPS URLs)

### Azure Deployment

The project includes Azure deployment configuration:

```bash
# Deploy to Azure
az webapp deploy --resource-group myResourceGroup --name myapp --src-path dist/
```

## Limitations

- Requires Spotify Premium for playback control features
- Rate limited by Spotify's API limits  
- Geographic restrictions may apply to certain content
- Device must be active for playback control
- Some features may not be available in all markets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run compile` to ensure everything builds
5. Submit a pull request

## Testing

```bash
# Run all tests
npm test
```

## License

MIT License

## Support

For issues and questions:
- Check Spotify's [Web API documentation](https://developer.spotify.com/documentation/web-api)
- Review MCP protocol specifications
- Open an issue in this repository

---

**Note**: This is an unofficial Spotify integration. It is not affiliated with or endorsed by Spotify Technology S.A.
