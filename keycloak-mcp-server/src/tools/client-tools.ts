import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const clientTools: Tool[] = [
  {
    name: "create-client",
    description: "Create a new client in a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID (unique identifier)" },
        name: { type: "string", description: "Client name" },
        description: { type: "string", description: "Client description" },
        enabled: { type: "boolean", description: "Whether the client is enabled", default: true },
        publicClient: { type: "boolean", description: "Whether this is a public client", default: false },
        standardFlowEnabled: { type: "boolean", description: "Whether standard flow is enabled", default: false },
        implicitFlowEnabled: { type: "boolean", description: "Whether implicit flow is enabled", default: false },
        directAccessGrantsEnabled: { type: "boolean", description: "Whether direct access grants are enabled", default: false },
        serviceAccountsEnabled: { type: "boolean", description: "Whether service accounts are enabled", default: false },
        redirectUris: { type: "array", items: { type: "string" }, description: "List of redirect URIs" },
        webOrigins: { type: "array", items: { type: "string" }, description: "List of web origins" }
      },
      required: ["realm", "clientId", "name"]
    }
  },
  {
    name: "update-client",
    description: "Update an existing client's configuration",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID to update" },
        name: { type: "string", description: "New client name" },
        description: { type: "string", description: "New client description" },
        enabled: { type: "boolean", description: "Whether the client is enabled" },
        publicClient: { type: "boolean", description: "Whether this is a public client" },
        standardFlowEnabled: { type: "boolean", description: "Whether standard flow is enabled" },
        implicitFlowEnabled: { type: "boolean", description: "Whether implicit flow is enabled" },
        directAccessGrantsEnabled: { type: "boolean", description: "Whether direct access grants are enabled" },
        serviceAccountsEnabled: { type: "boolean", description: "Whether service accounts are enabled" },
        redirectUris: { type: "array", items: { type: "string" }, description: "New list of redirect URIs" },
        webOrigins: { type: "array", items: { type: "string" }, description: "New list of web origins" }
      },
      required: ["realm", "clientId"]
    }
  },
  {
    name: "delete-client",
    description: "Delete a client from a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID to delete" }
      },
      required: ["realm", "clientId"]
    }
  },
  {
    name: "list-clients",
    description: "List clients in a specific realm with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Filter by client ID" },
        name: { type: "string", description: "Filter by client name" },
        enabled: { type: "boolean", description: "Filter by enabled status" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-client",
    description: "Get detailed information about a specific client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID to retrieve" }
      },
      required: ["realm", "clientId"]
    }
  },
  {
    name: "get-client-secret",
    description: "Get the client secret for a specific client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID" }
      },
      required: ["realm", "clientId"]
    }
  },
  {
    name: "regenerate-client-secret",
    description: "Regenerate the client secret for a specific client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID" }
      },
      required: ["realm", "clientId"]
    }
  },
  {
    name: "get-client-roles",
    description: "Get all roles for a specific client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID" }
      },
      required: ["realm", "clientId"]
    }
  },
  {
    name: "get-client-users",
    description: "Get all users for a specific client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        clientId: { type: "string", description: "Client ID" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm", "clientId"]
    }
  }
];
