#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import our modular architecture components
import { KeycloakClientService } from './services/keycloak-client.js';
import { ToolRouter } from './tool-router.js';
import { 
  realmTools, 
  userTools, 
  clientTools, 
  groupTools, 
  roleTools, 
  eventTools, 
  metricsTools 
} from './tools/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '8001', 10);

// CORS configuration
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Keycloak client
const REALM_NAME = process.env.KEYCLOAK_REALM_NAME || 'master';
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_USERNAME = process.env.KEYCLOAK_USERNAME;
const KEYCLOAK_PASSWORD = process.env.KEYCLOAK_PASSWORD;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

const keycloakService = new KeycloakClientService(KEYCLOAK_URL, REALM_NAME);
const toolRouter = new ToolRouter(keycloakService);

// Authenticate with Keycloak
async function authenticateKeycloak() {
  try {
    if (KEYCLOAK_USERNAME && KEYCLOAK_PASSWORD) {
      await keycloakService.authenticate(KEYCLOAK_USERNAME, KEYCLOAK_PASSWORD);
      console.log('✅ Authenticated with Keycloak using username/password');
    } else if (KEYCLOAK_CLIENT_ID && KEYCLOAK_CLIENT_SECRET) {
      await keycloakService.authenticateWithClientCredentials(KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET);
      console.log('✅ Authenticated with Keycloak using client credentials');
    } else {
      console.warn('⚠️ No authentication credentials provided. Some operations may fail.');
    }
  } catch (error) {
    console.error('❌ Failed to authenticate with Keycloak:', error);
  }
}

// Initialize authentication
authenticateKeycloak();

// Combine all tools for easy counting
const allTools = [
  ...realmTools,
  ...userTools,
  ...clientTools,
  ...groupTools,
  ...roleTools,
  ...eventTools,
  ...metricsTools
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'keycloak-mcp-server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    totalTools: allTools.length,
    categories: {
      realm: realmTools.length,
      user: userTools.length,
      client: clientTools.length,
      group: groupTools.length,
      role: roleTools.length,
      event: eventTools.length,
      metrics: metricsTools.length
    },
    keycloakUrl: KEYCLOAK_URL,
    keycloakRealm: REALM_NAME
  });
});

// List all available tools
app.get('/tools', (req, res) => {
  res.json({
    tools: allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: getToolCategory(tool.name),
      inputSchema: tool.inputSchema
    })),
    totalCount: allTools.length,
    categories: {
      realm: realmTools.map(t => t.name),
      user: userTools.map(t => t.name),
      client: clientTools.map(t => t.name),
      group: groupTools.map(t => t.name),
      role: roleTools.map(t => t.name),
      event: eventTools.map(t => t.name),
      metrics: metricsTools.map(t => t.name)
    }
  });
});

// Helper function to determine tool category
function getToolCategory(toolName: string): string {
  if (realmTools.some(t => t.name === toolName)) return 'realm';
  if (userTools.some(t => t.name === toolName)) return 'user';
  if (clientTools.some(t => t.name === toolName)) return 'client';
  if (groupTools.some(t => t.name === toolName)) return 'group';
  if (roleTools.some(t => t.name === toolName)) return 'role';
  if (eventTools.some(t => t.name === toolName)) return 'event';
  if (metricsTools.some(t => t.name === toolName)) return 'metrics';
  return 'unknown';
}

// Generic tool execution endpoint
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const arguments_ = req.body;
  
  const startTime = Date.now();
  
  console.log(`🔧 Executing tool: ${toolName}`, {
    timestamp: new Date().toISOString(),
    toolName,
    category: getToolCategory(toolName),
    argumentKeys: Object.keys(arguments_),
    argumentCount: Object.keys(arguments_).length
  });

  try {
    // Check if tool exists
    const toolExists = allTools.some(tool => tool.name === toolName);
    if (!toolExists) {
      return res.status(404).json({
        success: false,
        error: `Tool '${toolName}' not found`,
        availableTools: allTools.map(t => t.name)
      });
    }

    // Execute the tool through the router
    const result = await toolRouter.handleToolCall(toolName, arguments_);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Tool '${toolName}' completed successfully`, {
      duration: `${duration}ms`,
      category: getToolCategory(toolName)
    });

    res.json({
      success: true,
      data: result,
      metadata: {
        toolName,
        category: getToolCategory(toolName),
        duration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ Tool '${toolName}' failed`, {
      error: errorMessage,
      duration: `${duration}ms`,
      category: getToolCategory(toolName)
    });

    res.status(500).json({
      success: false,
      error: errorMessage,
      metadata: {
        toolName,
        category: getToolCategory(toolName),
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Root endpoint with comprehensive information
app.get('/', (req, res) => {
  res.json({
    service: 'keycloak-mcp-server',
    version: '2.0.0',
    description: 'Comprehensive Keycloak MCP Server with all administrative tools',
    endpoints: {
      health: '/health',
      tools: '/tools',
      execute: '/tools/{toolName}'
    },
    totalTools: allTools.length,
    categories: {
      realm: {
        count: realmTools.length,
        description: 'Realm management operations'
      },
      user: {
        count: userTools.length,
        description: 'User lifecycle management'
      },
      client: {
        count: clientTools.length,
        description: 'OAuth/OIDC client management'
      },
      group: {
        count: groupTools.length,
        description: 'Group and membership management'
      },
      role: {
        count: roleTools.length,
        description: 'Role and permission management'
      },
      event: {
        count: eventTools.length,
        description: 'Audit and event monitoring'
      },
      metrics: {
        count: metricsTools.length,
        description: 'System metrics and monitoring'
      }
    },
    keycloakConnection: {
      url: KEYCLOAK_URL,
      realm: REALM_NAME,
      authMethod: KEYCLOAK_USERNAME ? 'username/password' : 
                  KEYCLOAK_CLIENT_ID ? 'client_credentials' : 'none'
    }
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message || 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: {
      health: 'GET /health',
      tools: 'GET /tools',
      execute: 'POST /tools/{toolName}',
      root: 'GET /'
    }
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 Keycloak MCP HTTP Server Started');
  console.log('=====================================');
  console.log(`📍 Server URL: http://0.0.0.0:${PORT}`);
  console.log(`🏛️  Keycloak URL: ${KEYCLOAK_URL}`);
  console.log(`🔑 Default Realm: ${REALM_NAME}`);
  console.log(`🛠️  Total Tools: ${allTools.length}`);
  console.log('');
  console.log('📋 Tool Categories:');
  console.log(`   • Realm Management: ${realmTools.length} tools`);
  console.log(`   • User Management: ${userTools.length} tools`);
  console.log(`   • Client Management: ${clientTools.length} tools`);
  console.log(`   • Group Management: ${groupTools.length} tools`);
  console.log(`   • Role Management: ${roleTools.length} tools`);
  console.log(`   • Event Monitoring: ${eventTools.length} tools`);
  console.log(`   • Metrics & Monitoring: ${metricsTools.length} tools`);
  console.log('');
  console.log('🔗 Endpoints:');
  console.log(`   • Health Check: http://localhost:${PORT}/health`);
  console.log(`   • List Tools: http://localhost:${PORT}/tools`);
  console.log(`   • Execute Tool: POST http://localhost:${PORT}/tools/{toolName}`);
  console.log('');
  console.log('✅ Server is ready to handle MCP tool requests');
  console.log('💡 Use HTTP POST requests to execute any of the 58 available tools');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});