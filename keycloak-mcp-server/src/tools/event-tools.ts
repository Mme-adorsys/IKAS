import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Schemas } from '../types/index.js';

export const eventTools: Tool[] = [
  {
    name: "list-admin-events",
    description: "List admin events with filtering and sorting options",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        eventType: { type: "string", description: "Filter by event type" },
        resourceType: { type: "string", description: "Filter by resource type" },
        resourcePath: { type: "string", description: "Filter by resource path" },
        clientId: { type: "string", description: "Filter by client ID" },
        userId: { type: "string", description: "Filter by user ID" },
        success: { type: "boolean", description: "Filter by success status" },
        sortBy: { type: "string", enum: ["time", "eventType", "resourceType", "clientId"], description: "Field to sort by" },
        sortOrder: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
      },
      required: ["realm"]
    }
  },
  {
    name: "list-user-events",
    description: "List user events with filtering and sorting options",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        type: { type: "string", description: "Filter by event type" },
        clientId: { type: "string", description: "Filter by client ID" },
        userId: { type: "string", description: "Filter by user ID" },
        ipAddress: { type: "string", description: "Filter by IP address" },
        sortBy: { type: "string", enum: ["time", "type", "clientId", "userId", "ipAddress"], description: "Field to sort by" },
        sortOrder: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
        first: { type: "number", description: "First result to return" },
        max: { type: "number", description: "Maximum number of results to return" }
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
        realm: { type: "string", description: "The realm name" },
        eventId: { type: "string", description: "ID of the event to retrieve" }
      },
      required: ["realm", "eventId"]
    }
  },
  {
    name: "get-event-types",
    description: "Get all available event types for filtering",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "get-resource-types",
    description: "Get all available resource types for filtering",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" }
      },
      required: ["realm"]
    }
  },
  {
    name: "export-events",
    description: "Export events to a file format (CSV, JSON)",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "The realm name" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        eventType: { type: "string", description: "Filter by event type" },
        resourceType: { type: "string", description: "Filter by resource type" },
        format: { type: "string", enum: ["csv", "json"], description: "Export format", default: "json" },
        includeDetails: { type: "boolean", description: "Whether to include detailed event information", default: false }
      },
      required: ["realm"]
    }
  }
];
