import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const roleTools: Tool[] = [
  {
    name: "create-role",
    description: "Create a new role in a specific realm or client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        name: { type: "string", description: "Role name" },
        description: { type: "string", description: "Role description" },
        composite: { type: "boolean", description: "Whether this is a composite role", default: false },
        clientRole: { type: "boolean", description: "Whether this is a client role", default: false },
        clientId: { type: "string", description: "Client ID for client roles" }
      },
      required: ["realm", "name"]
    }
  },
  {
    name: "update-role",
    description: "Update an existing role's information",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the role to update" },
        name: { type: "string", description: "New role name" },
        description: { type: "string", description: "New role description" },
        composite: { type: "boolean", description: "Whether this is a composite role" }
      },
      required: ["realm", "roleId"]
    }
  },
  {
    name: "delete-role",
    description: "Delete a role from a specific realm or client",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the role to delete" }
      },
      required: ["realm", "roleId"]
    }
  },
  {
    name: "list-roles",
    description: "List roles in a specific realm or client with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        name: { type: "string", description: "Filter by role name" },
        clientRole: { type: "boolean", description: "Filter by client role status" },
        clientId: { type: "string", description: "Filter by client ID for client roles" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-role",
    description: "Get detailed information about a specific role",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the role to retrieve" }
      },
      required: ["realm", "roleId"]
    }
  },
  {
    name: "get-role-users",
    description: "Get all users assigned to a specific role",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the role" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm", "roleId"]
    }
  },
  {
    name: "get-role-groups",
    description: "Get all groups assigned to a specific role",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the role" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm", "roleId"]
    }
  },
  {
    name: "assign-role-to-user",
    description: "Assign a role to a specific user",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user" },
        roleId: { type: "string", description: "ID of the role to assign" }
      },
      required: ["realm", "userId", "roleId"]
    }
  },
  {
    name: "remove-role-from-user",
    description: "Remove a role from a specific user",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user" },
        roleId: { type: "string", description: "ID of the role to remove" }
      },
      required: ["realm", "userId", "roleId"]
    }
  },
  {
    name: "assign-role-to-group",
    description: "Assign a role to a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group" },
        roleId: { type: "string", description: "ID of the role to assign" }
      },
      required: ["realm", "groupId", "roleId"]
    }
  },
  {
    name: "remove-role-from-group",
    description: "Remove a role from a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group" },
        roleId: { type: "string", description: "ID of the role to remove" }
      },
      required: ["realm", "groupId", "roleId"]
    }
  },
  {
    name: "get-role-composites",
    description: "Get composite roles for a specific role",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the role" }
      },
      required: ["realm", "roleId"]
    }
  },
  {
    name: "add-composite-role",
    description: "Add a composite role to another role",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the parent role" },
        compositeRoleId: { type: "string", description: "ID of the composite role to add" }
      },
      required: ["realm", "roleId", "compositeRoleId"]
    }
  },
  {
    name: "remove-composite-role",
    description: "Remove a composite role from another role",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        roleId: { type: "string", description: "ID of the parent role" },
        compositeRoleId: { type: "string", description: "ID of the composite role to remove" }
      },
      required: ["realm", "roleId", "compositeRoleId"]
    }
  }
];
