#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { z } from 'zod';
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  CreateMessageRequest,
  CreateMessageResultSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  LoggingLevel,
  ReadResourceRequestSchema,
  Resource,
  SetLevelRequestSchema,
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
const kcAdminClient = new KcAdminClient({
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: REALM_NAME
});

// Tool schemas
const CreateUserSchema = z.object({
  realm: z.string(),
  username: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string()
});

const DeleteUserSchema = z.object({
  realm: z.string(),
  userId: z.string()
});

const ListUsersSchema = z.object({
  realm: z.string()
});

// Event types
interface AdminEvent {
  id: string;
  time: number;
  operationType: string;
  resourceType: string;
  resourcePath?: string;
  clientId?: string;
  userId?: string;
  success: boolean;
  representation?: string;
  error?: string;
}

interface UserEvent {
  id: string;
  time: number;
  type: string;
  clientId?: string;
  userId?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

// Event schemas
const EventFilterSchema = z.object({
  realm: z.string(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  eventType: z.string().optional(),
  resourceType: z.string().optional(),
  resourcePath: z.string().optional(),
  clientId: z.string().optional(),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
  success: z.boolean().optional(),
  sortBy: z.enum(['time', 'eventType', 'resourceType', 'clientId']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  first: z.number().optional(),
  max: z.number().optional()
});

const UserEventFilterSchema = z.object({
  realm: z.string(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  clientId: z.string().optional(),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
  type: z.string().optional(),
  sortBy: z.enum(['time', 'type', 'clientId', 'userId', 'ipAddress']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  first: z.number().optional(),
  max: z.number().optional()
});

const GetEventDetailsSchema = z.object({
  realm: z.string(),
  eventId: z.string()
});

const GetResourceReferenceSchema = z.object({
  resourceId: z
    .number()
    .min(1)
    .max(100)
    .describe("ID of the resource to reference (1-100)"),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create-user",
        description: "Create a new user in a specific realm",
        inputSchema: {
          type: "object",
          properties: {
            realm: { type: "string" },
            username: { type: "string" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" }
          },
          required: ["realm", "username", "email", "firstName", "lastName"]
        }
      },
      {
        name: "delete-user",
        description: "Delete a user from a specific realm",
        inputSchema: {
          type: "object",
          properties: {
            realm: { type: "string" },
            userId: { type: "string" }
          },
          required: ["realm", "userId"]
        }
      },
      {
        name: "list-realms",
        description: "List all available realms",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "list-users",
        description: "List users in a specific realm",
        inputSchema: {
          type: "object",
          properties: {
            realm: { type: "string" }
          },
          required: ["realm"]
        }
      },
      {
        name: "list-admin-events",
        description: "List admin events with filtering and sorting options",
        inputSchema: {
          type: "object",
          properties: {
            realm: { type: "string" },
            fromDate: { type: "string", description: "ISO date string" },
            toDate: { type: "string", description: "ISO date string" },
            eventType: { type: "string" },
            resourceType: { type: "string" },
            resourcePath: { type: "string" },
            clientId: { type: "string" },
            userId: { type: "string" },
            ipAddress: { type: "string" },
            success: { type: "boolean" },
            sortBy: { type: "string", enum: ["time", "eventType", "resourceType", "clientId"] },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
            first: { type: "number" },
            max: { type: "number" }
          },
          required: ["realm"]
        }
      },
      {
        name: "get-event-details",
        description: "Get detailed information about a specific event",
        inputSchema: {
          type: "object",
          properties: {
            realm: { type: "string" },
            eventId: { type: "string" }
          },
          required: ["realm", "eventId"]
        }
      },
      {
        name: "list-user-events",
        description: "List user events with filtering and sorting options",
        inputSchema: {
          type: "object",
          properties: {
            realm: { type: "string" },
            fromDate: { type: "string", description: "ISO date string" },
            toDate: { type: "string", description: "ISO date string" },
            clientId: { type: "string" },
            userId: { type: "string" },
            ipAddress: { type: "string" },
            type: { type: "string" },
            sortBy: { type: "string", enum: ["time", "type", "clientId", "userId", "ipAddress"] },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
            first: { type: "number" },
            max: { type: "number" }
          },
          required: ["realm"]
        }
      },
      {
        name: "get-metrics",
        description: "Get Keycloak server metrics in Prometheus format",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  };
});


let subscriptions: Set<string> = new Set();
let subsUpdateInterval: NodeJS.Timeout | undefined;
let stdErrUpdateInterval: NodeJS.Timeout | undefined;

// Set up update interval for subscribed resources
subsUpdateInterval = setInterval(() => {
  for (const uri of subscriptions) {
    server.notification({
      method: "notifications/resources/updated",
      params: { uri },
    });
  }
}, 10000);

// Configuration for resources folder
console.error(process.env.RESOURCES_FOLDER)
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
      const fileContent = fs.readFileSync(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      const uri = `file://${file}`;

      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        resources.push({
          uri,
          name: file,
          mimeType,
          text: fileContent.toString('utf-8')
        });
      } else {
        resources.push({
          uri,
          name: file,
          mimeType,
          blob: fileContent.toString('base64')
        });
      }
    }
  });

  return resources;
};

// Initialize resources from folder
try {
  ALL_RESOURCES = loadResourcesFromFolder(RESOURCES_FOLDER);
  console.error(`Loaded ${ALL_RESOURCES.length} resources from ${RESOURCES_FOLDER}`);
} catch (error) {
  console.error(`Error loading resources: ${error}`);
}

// Set up a watcher to reload resources when folder changes
fs.watch(RESOURCES_FOLDER, (eventType, filename) => {
  console.error(`Resource folder changed (${eventType}): ${filename}`);
  try {
    ALL_RESOURCES = loadResourcesFromFolder(RESOURCES_FOLDER);
    console.error(`Reloaded ${ALL_RESOURCES.length} resources`);

    // Notify subscribers about the change
    for (const uri of subscriptions) {
      server.notification({
        method: "notifications/resources/updated",
        params: { uri },
      });
    }
  } catch (error) {
    console.error(`Error reloading resources: ${error}`);
  }
});

const PAGE_SIZE = 10;
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  // Authenticate before each request - use service account if configured, otherwise fallback to admin user
  if (process.env.KEYCLOAK_CLIENT_ID && process.env.KEYCLOAK_CLIENT_SECRET) {
    // Service account authentication (recommended for production)
    await kcAdminClient.auth({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      grantType: 'client_credentials',
    });
  } else {
    // Admin user authentication (fallback for development/testing)
    await kcAdminClient.auth({
      username: process.env.KEYCLOAK_ADMIN || 'admin',
      password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
      grantType: 'password',
      clientId: 'admin-cli',
    });
    console.error(`(NOT RECOMMENDED FOR NON-DEV ENVIRONMENTS!!) Authenticated with admin user: ${process.env.KEYCLOAK_ADMIN}`);
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create-user": {
        const { realm, username, email, firstName, lastName } = CreateUserSchema.parse(args);

        kcAdminClient.setConfig({
          realmName: realm
        });

        const user = await kcAdminClient.users.create({
          realm,
          username,
          email,
          firstName,
          lastName,
          enabled: true
        });

        return {
          content: [{
            type: "text",
            text: `User created successfully. User ID: ${user.id}`
          }]
        };
      }

      case "delete-user": {
        const { realm, userId } = DeleteUserSchema.parse(args);

        kcAdminClient.setConfig({
          realmName: realm
        });

        await kcAdminClient.users.del({
          id: userId,
          realm
        });

        return {
          content: [{
            type: "text",
            text: `User ${userId} deleted successfully from realm ${realm}`
          }]
        };
      }

      case "list-realms": {
        const realms = await kcAdminClient.realms.find();

        return {
          content: [{
            type: "text",
            text: `Available realms:\n${realms.map(r => `- ${r.realm}`).join('\n')}`
          }]
        };
      }

      case "list-users": {
        const { realm } = ListUsersSchema.parse(args);

        kcAdminClient.setConfig({
          realmName: realm
        });

        const users = await kcAdminClient.users.find();

        return {
          content: [{
            type: "text",
            text: `Users in realm ${realm}:\n${users.map(u => `- ${u.username} (${u.id})`).join('\n')}`
          }]
        };
      }

      case "list-admin-events": {
        const {
          realm,
          fromDate,
          toDate,
          eventType,
          resourceType,
          resourcePath,
          clientId,
          userId,
          ipAddress,
          success,
          sortBy,
          sortOrder,
          first,
          max
        } = EventFilterSchema.parse(args);

        kcAdminClient.setConfig({
          realmName: realm
        });

        // Build query parameters
        const queryParams: Record<string, string> = {};
        if (fromDate) queryParams.dateFrom = fromDate;
        if (toDate) queryParams.dateTo = toDate;
        if (eventType) queryParams.type = eventType;
        if (resourceType) queryParams.resourceType = resourceType;
        if (resourcePath) queryParams.resourcePath = resourcePath;
        if (clientId) queryParams.clientId = clientId;
        if (userId) queryParams.userId = userId;
        if (ipAddress) queryParams.ipAddress = ipAddress;
        if (success !== undefined) queryParams.success = success.toString();
        if (first) queryParams.first = first.toString();
        if (max) queryParams.max = max.toString();

        // Use the REST API directly since the client doesn't expose these methods
        const response = await fetch(`${process.env.KEYCLOAK_URL}/admin/realms/${realm}/admin-events?${new URLSearchParams(queryParams)}`, {
          headers: {
            'Authorization': `Bearer ${kcAdminClient.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch admin events: ${response.statusText}`);
        }

        const events = await response.json() as AdminEvent[];

        // Sort events if requested
        if (sortBy) {
          events.sort((a: AdminEvent, b: AdminEvent) => {
            const aValue = a[sortBy as keyof AdminEvent];
            const bValue = b[sortBy as keyof AdminEvent];
            const modifier = sortOrder === 'desc' ? -1 : 1;

            if (aValue === undefined && bValue === undefined) return 0;
            if (aValue === undefined) return modifier;
            if (bValue === undefined) return -modifier;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return modifier * aValue.localeCompare(bValue);
            }
            return modifier * (aValue > bValue ? 1 : -1);
          });
        }

        return {
          content: [{
            type: "text",
            text: `Admin Events in realm ${realm}:\n${events.map((e: AdminEvent) =>
              `- Time: ${new Date(e.time).toISOString()}\n` +
              `  Type: ${e.operationType}\n` +
              `  Resource: ${e.resourceType}${e.resourcePath ? ` (${e.resourcePath})` : ''}\n` +
              `  Client: ${e.clientId || 'N/A'}\n` +
              `  User: ${e.userId || 'N/A'}\n` +
              `  Success: ${e.success}\n` +
              `  ID: ${e.id}\n`
            ).join('\n')}`
          }]
        };
      }

      case "get-event-details": {
        const { realm, eventId } = GetEventDetailsSchema.parse(args);

        kcAdminClient.setConfig({
          realmName: realm
        });

        // Use the REST API directly
        const response = await fetch(`${process.env.KEYCLOAK_URL}/admin/realms/${realm}/admin-events/${eventId}`, {
          headers: {
            'Authorization': `Bearer ${kcAdminClient.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch event details: ${response.statusText}`);
        }

        const event = await response.json() as AdminEvent;

        return {
          content: [{
            type: "text",
            text: `Event Details:\n` +
              `Time: ${new Date(event.time).toISOString()}\n` +
              `Type: ${event.operationType}\n` +
              `Resource: ${event.resourceType}${event.resourcePath ? ` (${event.resourcePath})` : ''}\n` +
              `Client: ${event.clientId || 'N/A'}\n` +
              `User: ${event.userId || 'N/A'}\n` +
              `Success: ${event.success}\n` +
              `Representation: ${JSON.stringify(event.representation, null, 2)}\n` +
              `Error: ${event.error || 'None'}`
          }]
        };
      }

      case "list-user-events": {
        const {
          realm,
          fromDate,
          toDate,
          clientId,
          userId,
          ipAddress,
          type,
          sortBy,
          sortOrder,
          first,
          max
        } = UserEventFilterSchema.parse(args);

        kcAdminClient.setConfig({
          realmName: realm
        });

        // Build query parameters
        const queryParams: Record<string, string> = {};
        if (fromDate) queryParams.dateFrom = fromDate;
        if (toDate) queryParams.dateTo = toDate;
        if (clientId) queryParams.client = clientId;
        if (userId) queryParams.user = userId;
        if (ipAddress) queryParams.ipAddress = ipAddress;
        if (type) queryParams.type = type;
        if (first) queryParams.first = first.toString();
        if (max) queryParams.max = max.toString();

        // Use the REST API directly
        const response = await fetch(`${process.env.KEYCLOAK_URL}/admin/realms/${realm}/events?${new URLSearchParams(queryParams)}`, {
          headers: {
            'Authorization': `Bearer ${kcAdminClient.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user events: ${response.statusText}`);
        }

        const events = await response.json() as UserEvent[];

        // Sort events if requested
        if (sortBy) {
          events.sort((a: UserEvent, b: UserEvent) => {
            const aValue = a[sortBy as keyof UserEvent];
            const bValue = b[sortBy as keyof UserEvent];
            const modifier = sortOrder === 'desc' ? -1 : 1;

            if (aValue === undefined && bValue === undefined) return 0;
            if (aValue === undefined) return modifier;
            if (bValue === undefined) return -modifier;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return modifier * aValue.localeCompare(bValue);
            }
            return modifier * (aValue > bValue ? 1 : -1);
          });
        }

        return {
          content: [{
            type: "text",
            text: `User Events in realm ${realm}:\n${events.map((e: UserEvent) =>
              `- Time: ${new Date(e.time).toISOString()}\n` +
              `  Type: ${e.type}\n` +
              `  Client: ${e.clientId || 'N/A'}\n` +
              `  User: ${e.userId || 'N/A'}\n` +
              `  IP Address: ${e.ipAddress || 'N/A'}\n` +
              `  Details: ${JSON.stringify(e.details || {}, null, 2)}\n`
            ).join('\n')}`
          }]
        };
      }

      case "get-metrics": {
        // Fetch metrics from Keycloak's /metrics endpoint
        const response = await fetch(`${process.env.KEYCLOAK_URL}/metrics`);
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }
        const metricsText = await response.text();
        return {
          content: [{
            type: "text",
            text: metricsText
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Invalid arguments: ${error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        }]
      };
    }
    throw error;
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const cursor = request.params?.cursor;
  let startIndex = 0;

  if (cursor) {
    const decodedCursor = parseInt(atob(cursor), 10);
    if (!isNaN(decodedCursor)) {
      startIndex = decodedCursor;
    }
  }

  const endIndex = Math.min(startIndex + PAGE_SIZE, ALL_RESOURCES.length);
  const resources = ALL_RESOURCES.slice(startIndex, endIndex);

  let nextCursor: string | undefined;
  if (endIndex < ALL_RESOURCES.length) {
    nextCursor = btoa(endIndex.toString());
  }

  return {
    resources,
    nextCursor,
  };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "file://{filename}",
        name: "File Resource",
        description: "A file from the resources folder",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri.startsWith("file://")) {
    const filename = uri.substring(7); // Remove 'file://' prefix
    const resourceIndex = ALL_RESOURCES.findIndex(r => r.uri === uri);

    if (resourceIndex >= 0) {
      return {
        contents: [ALL_RESOURCES[resourceIndex]],
      };
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
});

const requestSampling = async (
  context: string,
  uri: string,
  maxTokens: number = 100
) => {
  const request: CreateMessageRequest = {
    method: "sampling/createMessage",
    params: {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Resource ${uri} context: ${context}`,
          },
        },
      ],
      systemPrompt: "You are a helpful test server.",
      maxTokens,
      temperature: 0.7,
      includeContext: "thisServer",
    },
  };

  return await server.request(request, CreateMessageResultSchema);
};

server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  const { uri } = request.params;
  subscriptions.add(uri);

  // Request sampling from client when someone subscribes
  await requestSampling("A new subscription was started", uri);
  return {};
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  subscriptions.delete(request.params.uri);
  return {};
});

let logLevel: LoggingLevel = "debug";

let logsUpdateInterval: NodeJS.Timeout | undefined;

const messages = [
  { level: "debug", data: "Debug-level message" },
  { level: "info", data: "Info-level message" },
  { level: "notice", data: "Notice-level message" },
  { level: "warning", data: "Warning-level message" },
  { level: "error", data: "Error-level message" },
  { level: "critical", data: "Critical-level message" },
  { level: "alert", data: "Alert level-message" },
  { level: "emergency", data: "Emergency-level message" },
];


const cleanup = async () => {
  if (subsUpdateInterval) clearInterval(subsUpdateInterval);
  if (logsUpdateInterval) clearInterval(logsUpdateInterval);
  if (stdErrUpdateInterval) clearInterval(stdErrUpdateInterval);
};


// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Keycloak MCP Server running on stdio");
