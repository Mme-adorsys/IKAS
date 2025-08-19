import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { MCPResponse, MCPToolCall, ToolDefinition, MCPResponseMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      logger.info(`Calling MCP tool [${this.serverName}:${toolName}]`, {
        requestId,
        toolName,
        server: this.serverName,
        args: args
      });

      const response: AxiosResponse = await this.httpClient.post('/call-tool', {
        tool: toolName,
        arguments: args
      });

      const duration = Date.now() - startTime;
      const metadata: MCPResponseMetadata = {
        duration,
        source: this.serverName,
        toolName,
        requestId
      };

      logger.info(`MCP tool completed [${this.serverName}:${toolName}]`, {
        requestId,
        duration: `${duration}ms`,
        success: true
      });

      return {
        success: true,
        data: response.data,
        metadata
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`MCP tool failed [${this.serverName}:${toolName}]`, {
        requestId,
        duration: `${duration}ms`,
        error: errorMessage,
        toolName,
        server: this.serverName
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
      
      const response: AxiosResponse = await this.httpClient.get('/tools');
      
      return response.data.tools || [];
      
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
      const response = await this.httpClient.get('/health', {
        timeout: 3000 // Shorter timeout for health checks
      });
      
      return response.status >= 200 && response.status < 400;
      
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