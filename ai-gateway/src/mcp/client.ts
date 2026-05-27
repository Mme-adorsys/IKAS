import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger, mcpLogger, RequestTracker } from '../utils/logger';
import { config } from '../utils/config';
import { MCPResponse, MCPToolCall, ToolDefinition, MCPResponseMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Hardcoded input schemas for Neo4j MCP tools.
// The Neo4j MCP server's /tools endpoint only returns tool names (strings) — no schema.
// Without these schemas the LLM receives an empty input_schema and calls the tools
// with no arguments, causing "Query parameter is required" errors.
const NEO4J_TOOL_SCHEMAS: Record<string, ToolDefinition> = {
  get_neo4j_schema: {
    name: 'get_neo4j_schema',
    description: 'Retrieve the Neo4j graph schema including node labels, relationship types, property keys, constraints, and indexes.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  read_neo4j_cypher: {
    name: 'read_neo4j_cypher',
    description: 'Execute a read-only Cypher MATCH query against Neo4j and return the results. Only MATCH queries are allowed.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The Cypher MATCH query to execute. Must be a read-only query (MATCH, RETURN, WITH, etc). No MERGE, CREATE, SET, DELETE, REMOVE, or ADD.'
        },
        params: {
          type: 'object',
          description: 'Optional query parameters as key-value pairs.'
        },
        database: {
          type: 'string',
          description: 'Optional Neo4j database name. Defaults to "neo4j".'
        }
      },
      required: ['query']
    }
  },
  write_neo4j_cypher: {
    name: 'write_neo4j_cypher',
    description: 'Execute a write Cypher query against Neo4j (MERGE, CREATE, SET, DELETE, REMOVE, ADD). Use for data updates and synchronisation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The Cypher write query to execute. Must contain at least one write keyword: MERGE, CREATE, SET, DELETE, REMOVE, or ADD.'
        },
        params: {
          type: 'object',
          description: 'Optional query parameters as key-value pairs.'
        },
        database: {
          type: 'string',
          description: 'Optional Neo4j database name. Defaults to "neo4j".'
        }
      },
      required: ['query']
    }
  }
};

export abstract class BaseMCPClient {
  protected httpClient: AxiosInstance;
  protected serverName: 'keycloak' | 'neo4j';
  protected baseUrl: string;

  constructor(serverName: 'keycloak' | 'neo4j', baseUrl: string) {
    this.serverName = serverName;
    this.baseUrl = baseUrl;

    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: config.HEALTH_CHECK_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'IKAS-AI-Gateway/1.0.0'
      }
    });

    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug(`MCP Request [${this.serverName}]`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        logger.error(`MCP Request Error [${this.serverName}]`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug(`MCP Response [${this.serverName}]`, {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error(`MCP Response Error [${this.serverName}]`, {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async callTool<T = any>(toolName: string, args: Record<string, any>): Promise<MCPResponse<T>> {
    const requestId = RequestTracker.startRequest({
      server: this.serverName,
      tool: toolName,
      type: 'mcp_call'
    });

    try {
      mcpLogger.info(`🔧 Calling MCP tool [${this.serverName}:${toolName}]`, {
        requestId,
        toolName,
        server: this.serverName,
        args: args,
        argKeys: Object.keys(args),
        argCount: Object.keys(args).length
      });

      let response: AxiosResponse;

      if (this.serverName === 'keycloak') {
        // Keycloak MCP uses custom REST endpoints
        response = await this.httpClient.post(`/tools/${toolName}`, args);
      } else if (this.serverName === 'neo4j') {
        // Neo4j MCP now uses REST API like Keycloak
        response = await this.httpClient.post(`/tools/${toolName}`, { arguments: args });
      } else {
        // Fallback to generic MCP protocol
        response = await this.httpClient.post('/call-tool', {
          tool: toolName,
          arguments: args
        });
      }

      const duration = RequestTracker.endRequest(requestId);
      const metadata: MCPResponseMetadata = {
        duration,
        source: this.serverName,
        toolName,
        requestId
      };

      mcpLogger.info(`✅ MCP tool completed [${this.serverName}:${toolName}]`, {
        requestId,
        duration: `${duration}ms`,
        success: true,
        statusCode: response.status,
        responseSize: JSON.stringify(response.data).length,
        hasData: !!response.data,
        dataType: response.data ? (Array.isArray(response.data) ? 'array' : typeof response.data) : 'none'
      });

      mcpLogger.debug(`📊 MCP response details [${this.serverName}:${toolName}]`, {
        requestId,
        fullResponse: response.data,
        responseHeaders: response.headers
      });

      // Both Neo4j and Keycloak now use REST API format.
      // Neo4j MCP wraps every result in `{success, data, error}` (ToolResponse).
      // Unwrap so downstream callers see the raw rows/objects they expect.
      let responseData = response.data;
      if (
        this.serverName === 'neo4j'
        && responseData
        && typeof responseData === 'object'
        && 'success' in responseData
        && 'data' in responseData
      ) {
        if (responseData.success === false) {
          throw new Error(responseData.error || 'Neo4j MCP returned error');
        }
        responseData = responseData.data;
      }

      return {
        success: true,
        data: responseData,
        metadata
      };

    } catch (error) {
      const duration = RequestTracker.endRequest(requestId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      mcpLogger.error(`❌ MCP tool failed [${this.serverName}:${toolName}]`, {
        requestId,
        duration: `${duration}ms`,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        toolName,
        server: this.serverName,
        status: error instanceof Error && 'response' in error ? (error as any).response?.status : undefined,
        responseData: error instanceof Error && 'response' in error ? (error as any).response?.data : undefined,
        requestUrl: `${this.baseUrl}/tools/${toolName}`,
        requestArgs: args
      });

      const metadata: MCPResponseMetadata = {
        duration,
        source: this.serverName,
        toolName,
        requestId
      };

      return {
        success: false,
        error: errorMessage,
        metadata
      };
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    try {
      logger.debug(`Listing tools for ${this.serverName}`);

      let response: AxiosResponse;

      if (this.serverName === 'keycloak') {
        // Keycloak MCP returns full tool objects with schema
        response = await this.httpClient.get('/tools');
        const toolsData = response.data.tools || [];

        // Handle both old format (strings) and new format (objects)
        if (Array.isArray(toolsData) && toolsData.length > 0) {
          if (typeof toolsData[0] === 'string') {
            // Old format: array of strings
            return toolsData.map((name: string) => ({
              name,
              description: `Keycloak ${name} tool`,
              inputSchema: { type: 'object', properties: {} }
            }));
          } else {
            // New format: array of tool objects
            return toolsData.map((tool: any) => ({
              name: tool.name,
              description: tool.description || `Keycloak ${tool.name} tool`,
              inputSchema: tool.inputSchema || { type: 'object', properties: {} }
            }));
          }
        }
        return [];
      } else if (this.serverName === 'neo4j') {
        // Neo4j MCP /tools returns only an array of tool name strings — no schema.
        // Use the hardcoded NEO4J_TOOL_SCHEMAS so the LLM receives proper parameter
        // definitions and knows to include the required `query` argument.
        response = await this.httpClient.get('/tools');
        const toolNames: string[] = response.data.tools || [];

        return toolNames.map((name: string) => {
          if (NEO4J_TOOL_SCHEMAS[name]) {
            return NEO4J_TOOL_SCHEMAS[name];
          }
          // Fallback for any unknown future tools
          return {
            name,
            description: `Neo4j ${name} tool`,
            inputSchema: { type: 'object', properties: {} }
          };
        });
      } else {
        // Fallback
        response = await this.httpClient.get('/tools');
        return response.data.tools || [];
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Failed to list tools for ${this.serverName}`, {
        error: errorMessage
      });

      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      let response: AxiosResponse;

      if (this.serverName === 'keycloak') {
        // Keycloak MCP has a custom health endpoint
        response = await this.httpClient.get('/health', {
          timeout: 3000
        });
      } else if (this.serverName === 'neo4j') {
        // Neo4j MCP now has a standard health endpoint
        response = await this.httpClient.get('/health', {
          timeout: 3000
        });
      } else {
        // Fallback
        response = await this.httpClient.get('/health', {
          timeout: 3000
        });
      }

      return response.status >= 200 && response.status < 500;

    } catch (error) {
      logger.warn(`Health check failed for ${this.serverName}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  getServerInfo(): { name: string; url: string } {
    return {
      name: this.serverName,
      url: this.baseUrl
    };
  }
}
