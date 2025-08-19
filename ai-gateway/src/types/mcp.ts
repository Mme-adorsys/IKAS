export interface MCPServer {
  name: 'keycloak' | 'neo4j';
  url: string;
  transport: 'stdio' | 'http' | 'sse';
  status: 'healthy' | 'unhealthy' | 'unknown';
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPToolCall {
  server: 'keycloak' | 'neo4j';
  tool: string;
  arguments: Record<string, any>;
  context?: MCPContext;
}

export interface MCPContext {
  realm?: string;
  userId?: string;
  sessionId: string;
  timestamp: string;
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: MCPResponseMetadata;
}

export interface MCPResponseMetadata {
  duration: number;
  source: 'keycloak' | 'neo4j';
  cached?: boolean;
  toolName: string;
  requestId: string;
}

export interface MCPToolsResponse {
  tools: Record<string, ToolDefinition[]>;
  timestamp: string;
  servers: MCPServer[];
}

export interface MCPHealth {
  server: string;
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  lastChecked: string;
}