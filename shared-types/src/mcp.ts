/**
 * MCP (Model Context Protocol) Types and Interfaces
 * Defines the structure for communication with Keycloak and Neo4j MCP servers
 */

export type MCPServerName = 'keycloak' | 'neo4j';

export interface MCPServer {
  name: MCPServerName;
  url: string;
  transport: 'stdio' | 'http' | 'websocket';
  description: string;
  version: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPToolCall {
  server: MCPServerName;
  tool: string;
  arguments: Record<string, any>;
  context?: {
    realm?: string;
    userId?: string;
    sessionId: string;
    timestamp?: string;
  };
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    source: MCPServerName;
    cached?: boolean;
    timestamp: string;
  };
}

// Keycloak MCP specific types
export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified?: boolean;
  createdTimestamp?: number;
  attributes?: Record<string, string[]>;
}

export interface KeycloakRealm {
  id: string;
  realm: string;
  displayName?: string;
  enabled: boolean;
  loginTheme?: string;
  accountTheme?: string;
  adminTheme?: string;
  emailTheme?: string;
}

export interface KeycloakAdminEvent {
  id: string;
  time: number;
  realmId: string;
  authDetails?: {
    realmId: string;
    clientId: string;
    userId: string;
    ipAddress: string;
  };
  resourceType: string;
  operationType: string;
  resourcePath: string;
  representation?: string;
  error?: string;
}

// Neo4j MCP specific types
export interface Neo4jNode {
  identity: number;
  labels: string[];
  properties: Record<string, any>;
}

export interface Neo4jRelationship {
  identity: number;
  start: number;
  end: number;
  type: string;
  properties: Record<string, any>;
}

export interface Neo4jQueryResult {
  records: Array<{
    keys: string[];
    values: any[];
  }>;
  summary: {
    executionTime: number;
    resultAvailableAfter: number;
    resultConsumedAfter: number;
  };
}

export interface Neo4jSchema {
  nodeTypes: Array<{
    label: string;
    properties: Array<{
      key: string;
      type: string;
      indexed?: boolean;
    }>;
  }>;
  relationshipTypes: Array<{
    type: string;
    properties: Array<{
      key: string;
      type: string;
    }>;
  }>;
}