import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const userTools: Tool[] = [
  {
    name: "create-user",
    description: "Create a new user in a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        username: { type: "string", description: "Username for the new user" },
        email: { type: "string", format: "email", description: "Email address for the user" },
        firstName: { type: "string", description: "First name of the user" },
        lastName: { type: "string", description: "Last name of the user" },
        enabled: { type: "boolean", description: "Whether the user is enabled", default: true },
        emailVerified: { type: "boolean", description: "Whether the email is verified", default: false }
      },
      required: ["realm", "username", "email", "firstName", "lastName"]
    }
  },
  {
    name: "update-user",
    description: "Update an existing user's information",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user to update" },
        username: { type: "string", description: "New username" },
        email: { type: "string", format: "email", description: "New email address" },
        firstName: { type: "string", description: "New first name" },
        lastName: { type: "string", description: "New last name" },
        enabled: { type: "boolean", description: "Whether the user is enabled" },
        emailVerified: { type: "boolean", description: "Whether the email is verified" }
      },
      required: ["realm", "userId"]
    }
  },
  {
    name: "delete-user",
    description: "Delete a user from a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user to delete" }
      },
      required: ["realm", "userId"]
    }
  },
  {
    name: "list-users",
    description: "List users in a specific realm with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        username: { type: "string", description: "Filter by username" },
        email: { type: "string", description: "Filter by email" },
        firstName: { type: "string", description: "Filter by first name" },
        lastName: { type: "string", description: "Filter by last name" },
        enabled: { type: "boolean", description: "Filter by enabled status" },
        emailVerified: { type: "boolean", description: "Filter by email verification status" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-user",
    description: "Get detailed information about a specific user",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user to retrieve" }
      },
      required: ["realm", "userId"]
    }
  },
  {
    name: "reset-user-password",
    description: "Reset a user's password",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user" },
        newPassword: { type: "string", description: "New password for the user" },
        temporary: { type: "boolean", description: "Whether the password is temporary", default: true }
      },
      required: ["realm", "userId", "newPassword"]
    }
  },
  {
    name: "send-verification-email",
    description: "Send a verification email to a user",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user" }
      },
      required: ["realm", "userId"]
    }
  },
  {
    name: "get-user-groups",
    description: "Get all groups that a user belongs to",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user" }
      },
      required: ["realm", "userId"]
    }
  },
  {
    name: "get-user-roles",
    description: "Get all roles assigned to a user",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user" }
      },
      required: ["realm", "userId"]
    }
  }
];
