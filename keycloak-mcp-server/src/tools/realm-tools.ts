import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const realmTools: Tool[] = [
  {
    name: "list-realms",
    description: "List all accessible realms in Keycloak",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get-realm",
    description: "Get detailed information about a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "create-realm",
    description: "Create a new realm in Keycloak",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        displayName: { type: "string", description: "Display name for the realm" },
        enabled: { type: "boolean", description: "Whether the realm is enabled", default: true },
        displayNameHtml: { type: "string", description: "HTML display name for the realm" },
        userManagedAccessAllowed: { type: "boolean", description: "Whether user managed access is allowed", default: false },
        loginTheme: { type: "string", description: "Login theme for the realm" },
        accountTheme: { type: "string", description: "Account theme for the realm" },
        adminTheme: { type: "string", description: "Admin theme for the realm" },
        emailTheme: { type: "string", description: "Email theme for the realm" }
      },
      required: ["realm"]
    }
  },
  {
    name: "update-realm",
    description: "Update an existing realm's configuration",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        displayName: { type: "string", description: "New display name for the realm" },
        enabled: { type: "boolean", description: "Whether the realm is enabled" },
        displayNameHtml: { type: "string", description: "New HTML display name for the realm" },
        userManagedAccessAllowed: { type: "boolean", description: "Whether user managed access is allowed" },
        loginTheme: { type: "string", description: "New login theme for the realm" },
        accountTheme: { type: "string", description: "New account theme for the realm" },
        adminTheme: { type: "string", description: "New admin theme for the realm" },
        emailTheme: { type: "string", description: "New email theme for the realm" }
      },
      required: ["realm"]
    }
  },
  {
    name: "delete-realm",
    description: "Delete a realm from Keycloak (WARNING: This action cannot be undone)",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name to delete" }
      },
      required: ["realm"]
    }
  }
];
