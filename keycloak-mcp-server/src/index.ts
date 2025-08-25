#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  CreateMessageRequest,
  CreateMessageResultSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Resource,
  SubscribeRequestSchema,
  Tool,
  ToolSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

import dotenv from 'dotenv';
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

const server = new Server(
  {
    name: "keycloak-admin",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
      resources: {
        subscribe: true,
        listChanged: true
      }
    },
  }
);

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
      console.error('Authenticated with Keycloak using username/password');
    } else if (KEYCLOAK_CLIENT_ID && KEYCLOAK_CLIENT_SECRET) {
      await keycloakService.authenticateWithClientCredentials(KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET);
      console.error('Authenticated with Keycloak using client credentials');
    } else {
      console.error('No authentication credentials provided. Some operations may fail.');
    }
  } catch (error) {
    console.error('Failed to authenticate with Keycloak:', error);
  }
}

// Initialize authentication
authenticateKeycloak();

// Combine all tools
const allTools: Tool[] = [
  ...realmTools,
  ...userTools,
  ...clientTools,
  ...groupTools,
  ...roleTools,
  ...eventTools,
  ...metricsTools
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await toolRouter.handleToolCall(request.params.name, request.params.arguments);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    };
  }
});

// All tool operations are handled through the CallToolRequestSchema handler above
// which routes to the toolRouter. This follows the proper MCP architecture pattern.

// Configuration for resources folder
const RESOURCES_FOLDER = process.env.RESOURCES_FOLDER || './resources';
let ALL_RESOURCES: Resource[] = [];

// Function to load resources from file system
const loadResourcesFromFolder = (folderPath: string): Resource[] => {
  const resources: Resource[] = [];

  console.error(`Reading from resources folder: ${folderPath}`);

  if (!fs.existsSync(folderPath)) {
    console.error(`Resources folder does not exist: ${folderPath}`);
    fs.mkdirSync(folderPath, { recursive: true });
    return resources;
  }

  const files = fs.readdirSync(folderPath);

  files.forEach((file, index) => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      const mimeType = mime.lookup(file) || 'application/octet-stream';
      const content = fs.readFileSync(filePath, 'utf8');
      
      resources.push({
        uri: `file://${filePath}`,
        name: file,
        description: `Resource file: ${file}`,
        mimeType,
        content: Buffer.from(content).toString('base64')
      });
    }
  });

  return resources;
};

// Load resources on startup
ALL_RESOURCES = loadResourcesFromFolder(RESOURCES_FOLDER);

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: ALL_RESOURCES
  };
});

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = ALL_RESOURCES.find(r => r.uri === request.params.uri);
  if (!resource) {
    throw new Error(`Resource not found: ${request.params.uri}`);
  }
  return resource;
});

// Subscribe to resources
server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  // Implementation for resource subscription
  return {};
});

// Unsubscribe from resources
server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  // Implementation for resource unsubscription
  return {};
});

// List resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: []
  };
});

// Note: Some MCP features are not implemented as they're not essential for Keycloak operations:
// - CreateMessageRequest (type, not schema)
// - Prompts (not supported in this server)
// - Logging (not supported in this server)

// Complete request handler (basic implementation)
server.setRequestHandler(CompleteRequestSchema, async (request) => {
  return {
    content: [
      {
        type: "text",
        text: "Completion functionality not implemented in this Keycloak MCP server"
      }
    ]
  };
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('🚀 Keycloak MCP Server started successfully');
console.error(`📍 Connected to Keycloak at: ${KEYCLOAK_URL}`);
console.error(`🏛️  Default realm: ${REALM_NAME}`);
console.error(`🛠️  Total available tools: ${allTools.length}`);
console.error('📋 Available tool categories:');
console.error(`   • Realm Management: ${realmTools.length} tools`);
console.error(`   • User Management: ${userTools.length} tools`);
console.error(`   • Client Management: ${clientTools.length} tools`);
console.error(`   • Group Management: ${groupTools.length} tools`);
console.error(`   • Role Management: ${roleTools.length} tools`);
console.error(`   • Event Monitoring: ${eventTools.length} tools`);
console.error(`   • Metrics & Monitoring: ${metricsTools.length} tools`);
console.error('');
console.error('✅ Server is ready to handle MCP tool requests');
console.error('💡 Use MCP Inspector or any MCP client to interact with the server');
