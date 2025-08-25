import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const metricsTools: Tool[] = [
  {
    name: "get-metrics",
    description: "Get Keycloak server metrics in Prometheus format",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get-server-info",
    description: "Get Keycloak server information and status",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get-realm-stats",
    description: "Get statistics for a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-user-sessions",
    description: "Get active user sessions for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Filter by client ID" },
        userId: { type: "string", description: "Filter by user ID" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-client-sessions",
    description: "Get active client sessions for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Filter by client ID" },
        userId: { type: "string", description: "Filter by user ID" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-offline-sessions",
    description: "Get offline sessions for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Filter by client ID" },
        userId: { type: "string", description: "Filter by user ID" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-realm-keys",
    description: "Get cryptographic keys for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-authentication-flows",
    description: "Get authentication flows for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-identity-providers",
    description: "Get identity providers configured for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-client-scopes",
    description: "Get client scopes for a realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  }
];
