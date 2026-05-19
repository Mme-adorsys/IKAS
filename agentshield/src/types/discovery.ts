export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface TransportConfig {
  protocol: 'mcp-jsonrpc' | 'rest-keycloak' | 'unknown';
  endpoint: string;
  supportsSSE: boolean;
  sessionManagement: boolean;
}

export interface DiscoveredServer {
  baseUrl: string;
  serverName?: string;
  version?: string;
  transport: TransportConfig['protocol'];
  endpoint: string;
  tools: ToolDefinition[];
  healthEndpoint?: string;
  hasAuth: boolean;
  responseTimeMs: number;
}
