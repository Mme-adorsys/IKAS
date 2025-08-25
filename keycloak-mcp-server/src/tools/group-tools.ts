import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const groupTools: Tool[] = [
  {
    name: "create-group",
    description: "Create a new group in a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        name: { type: "string", description: "Group name" },
        parentId: { type: "string", description: "Parent group ID (for nested groups)" },
        attributes: { type: "object", description: "Group attributes as key-value pairs" }
      },
      required: ["realm", "name"]
    }
  },
  {
    name: "update-group",
    description: "Update an existing group's information",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group to update" },
        name: { type: "string", description: "New group name" },
        parentId: { type: "string", description: "New parent group ID" },
        attributes: { type: "object", description: "New group attributes as key-value pairs" }
      },
      required: ["realm", "groupId"]
    }
  },
  {
    name: "delete-group",
    description: "Delete a group from a specific realm",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group to delete" }
      },
      required: ["realm", "groupId"]
    }
  },
  {
    name: "list-groups",
    description: "List groups in a specific realm with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        name: { type: "string", description: "Filter by group name" },
        parentId: { type: "string", description: "Filter by parent group ID" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-group",
    description: "Get detailed information about a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group to retrieve" }
      },
      required: ["realm", "groupId"]
    }
  },
  {
    name: "get-group-members",
    description: "Get all members of a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm", "groupId"]
    }
  },
  {
    name: "add-user-to-group",
    description: "Add a user to a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user to add" },
        groupId: { type: "string", description: "ID of the group" }
      },
      required: ["realm", "userId", "groupId"]
    }
  },
  {
    name: "remove-user-from-group",
    description: "Remove a user from a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        userId: { type: "string", description: "ID of the user to remove" },
        groupId: { type: "string", description: "ID of the group" }
      },
      required: ["realm", "userId", "groupId"]
    }
  },
  {
    name: "get-group-roles",
    description: "Get all roles assigned to a specific group",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group" }
      },
      required: ["realm", "groupId"]
    }
  },
  {
    name: "get-group-hierarchy",
    description: "Get the hierarchical structure of groups",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        groupId: { type: "string", description: "ID of the group (optional, if not provided returns all groups)" }
      },
      required: ["realm"]
    }
  }
];
