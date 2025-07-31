import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { toolsRegistry } from './toolsRegistry';
import './tools.contribution.js';

const SCOPES = ['user-read-private', 'user-read-email', 'user-read-playback-state', 'user-modify-playback-state'];

// Create an MCP server with implementation details
const getServer = () => {
    const server = new McpServer(
        {
            name: 'spotify-unofficial',
            version: '0.1.0',
        },
        {
            capabilities: { logging: {} }
        }
    );

    toolsRegistry.registerToServer(server);

    return server;
};

const MCP_PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Create auth middleware for MCP endpoints
const mcpServerUrl = process.env.WEBSITE_HOSTNAME ? new URL(`https://${process.env.WEBSITE_HOSTNAME}`) : new URL(`http://localhost:${MCP_PORT}`);

// Fetch OAuth metadata from Spotify's well-known endpoint
const fetchOAuthMetadata = async (): Promise<OAuthMetadata> => {
    try {
        const response = await fetch('https://accounts.spotify.com/.well-known/openid-configuration');
        if (!response.ok) {
            throw new Error(`Failed to fetch OAuth metadata: ${response.status} ${response.statusText}`);
        }
        const metadata = await response.json();
        return metadata as OAuthMetadata;
    } catch (error) {
        console.error('Error fetching OAuth metadata:', error);
        // Fallback to cached metadata if the endpoint is unavailable
        return {
            issuer: "https://accounts.spotify.com",
            authorization_endpoint: "https://accounts.spotify.com/oauth2/v2/auth",
            token_endpoint: "https://accounts.spotify.com/api/token",
            revocation_endpoint: "https://accounts.spotify.com/oauth2/revoke/v1",
            response_types_supported: ["code", "none"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"]
        };
    }
};

// Initialize OAuth metadata - will be populated during server startup
let oauthMetadata: OAuthMetadata;

const tokenVerifier = {
    verifyAccessToken: async (token: string) => {

        const response = await fetch('https://api.spotify.com/v1/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });


        if (!response.ok) {
            throw new Error(`Invalid or expired token: ${await response.text()}`);
        }

        return {
            token,
            // NOTE: This isn't used but if it is, then we need a way to obtain it.
            clientId: 'UNUSED',
            scopes: SCOPES,
            expiresAt: Date.now() / 1000 + 3600, // Set to 1 hour from now for demo purposes
        };
    }
};
// Initialize server with OAuth metadata
const initializeServer = async () => {
    // Fetch OAuth metadata first
    oauthMetadata = await fetchOAuthMetadata();
    
    // Add metadata routes to the main MCP server
    app.use(mcpAuthMetadataRouter({
        oauthMetadata,
        resourceServerUrl: mcpServerUrl,
        scopesSupported: SCOPES,
        resourceName: 'Spotify (Unofficial)',
    }));
};

const authMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: SCOPES,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP POST endpoint
const mcpPostHandler = async (req: Request, res: Response) => {
    console.log('Received MCP request:', req.body);
    if (req.auth) {
        console.log('Authenticated user:', req.auth);
    }
    try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            const eventStore = new InMemoryEventStore();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                eventStore, // Enable resumability
                onsessioninitialized: (sessionId) => {
                    // Store the transport by session ID when session is initialized
                    // This avoids race conditions where requests might come in before the session is stored
                    console.log(`Session initialized with ID: ${sessionId}`);
                    transports[sessionId] = transport;
                }
            });

            // Set up onclose handler to clean up transport when closed
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    console.log(`Transport closed for session ${sid}, removing from transports map`);
                    delete transports[sid];
                }
            };

            // Connect the transport to the MCP server BEFORE handling the request
            // so responses can flow back through the same transport
            const server = getServer();
            await server.connect(transport);

            await transport.handleRequest(req, res, req.body);
            return; // Already handled
        } else {
            // Invalid request - no session ID or not initialization request
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Bad Request: No valid session ID provided',
                },
                id: null,
            });
            return;
        }

        // Handle the request with existing transport - no need to reconnect
        // The existing transport is already connected to the server
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            });
        }
    }
};
app.post('/mcp', authMiddleware, mcpPostHandler);

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
const mcpGetHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    if (req.auth) {
        console.log('Authenticated SSE connection from user:', req.auth);
    }

    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
        console.log(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};
app.get('/mcp', authMiddleware, mcpGetHandler);

// Handle DELETE requests for session termination (according to MCP spec)
const mcpDeleteHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    console.log(`Received session termination request for session ${sessionId}`);

    try {
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    } catch (error) {
        console.error('Error handling session termination:', error);
        if (!res.headersSent) {
            res.status(500).send('Error processing session termination');
        }
    }
};
app.delete('/mcp', authMiddleware, mcpDeleteHandler);

app.get('/hi', (req: Request, res: Response) => {
    res.send('Hello, world!');
});

// Initialize server and start listening
const startServer = async () => {
    try {
        await initializeServer();
        app.listen(MCP_PORT, () => {
            console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
};

startServer().then(() => {
    console.log('Server started successfully');
}).catch(error => {
    console.error('Error starting server:', error);
});

// Handle server shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');

    // Close all active transports to properly clean up resources
    for (const sessionId in transports) {
        try {
            console.log(`Closing transport for session ${sessionId}`);
            await transports[sessionId].close();
            delete transports[sessionId];
        } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
        }
    }
    console.log('Server shutdown complete');
    process.exit(0);
});
