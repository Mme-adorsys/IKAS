import { ToolDefinition, MCPToolsResponse } from '../types';
import { getKeycloakClient, getNeo4jClient } from '../mcp';
import { logger } from '../utils/logger';
import { GeminiFunction } from './gemini-service';

export class MCPToolDiscovery {
  private toolsCache: MCPToolsResponse | null = null;
  private cacheExpiry: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  async discoverAllTools(): Promise<MCPToolsResponse> {
    // Check cache first
    if (this.toolsCache && Date.now() < this.cacheExpiry) {
      logger.debug('Returning cached MCP tools');
      return this.toolsCache;
    }

    logger.info('Discovering MCP tools from servers');
    
    try {
      const keycloakClient = getKeycloakClient();
      const neo4jClient = getNeo4jClient();

      // Discover tools from both MCP servers
      const [keycloakTools, neo4jTools] = await Promise.all([
        this.discoverKeycloakTools(keycloakClient),
        this.discoverNeo4jTools(neo4jClient)
      ]);

      // Check server health
      const [keycloakHealthy, neo4jHealthy] = await Promise.all([
        keycloakClient.healthCheck(),
        neo4jClient.healthCheck()
      ]);

      const toolsResponse: MCPToolsResponse = {
        tools: {
          keycloak: keycloakTools,
          neo4j: neo4jTools
        },
        timestamp: new Date().toISOString(),
        servers: [
          {
            name: 'keycloak',
            url: keycloakClient.getServerInfo().url,
            transport: 'http',
            status: keycloakHealthy ? 'healthy' : 'unhealthy'
          },
          {
            name: 'neo4j',
            url: neo4jClient.getServerInfo().url,
            transport: 'http',
            status: neo4jHealthy ? 'healthy' : 'unhealthy'
          }
        ]
      };

      // Update cache
      this.toolsCache = toolsResponse;
      this.cacheExpiry = Date.now() + this.cacheTTL;

      logger.info('MCP tool discovery completed', {
        keycloakTools: keycloakTools.length,
        neo4jTools: neo4jTools.length,
        totalTools: keycloakTools.length + neo4jTools.length,
        keycloakHealthy,
        neo4jHealthy
      });

      return toolsResponse;

    } catch (error) {
      logger.error('MCP tool discovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return empty tools response on error
      return {
        tools: { keycloak: [], neo4j: [] },
        timestamp: new Date().toISOString(),
        servers: []
      };
    }
  }

  private async discoverKeycloakTools(client: any): Promise<ToolDefinition[]> {
    try {
      const tools = await client.listTools();
      
      // Enhance Keycloak tools with context hints for better LLM routing
      const enhancedTools = tools.map((tool: ToolDefinition) => ({
        ...tool,
        description: this.enhanceKeycloakToolDescription(tool.name, tool.description)
      }));

      logger.debug('Keycloak tools discovered', { count: enhancedTools.length });
      return enhancedTools;

    } catch (error) {
      logger.warn('Failed to discover Keycloak tools', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private async discoverNeo4jTools(client: any): Promise<ToolDefinition[]> {
    try {
      const tools = await client.listTools();
      
      // Enhance Neo4j tools with context hints for better LLM routing
      const enhancedTools = tools.map((tool: ToolDefinition) => ({
        ...tool,
        description: this.enhanceNeo4jToolDescription(tool.name, tool.description)
      }));

      logger.debug('Neo4j tools discovered', { count: enhancedTools.length });
      return enhancedTools;

    } catch (error) {
      logger.warn('Failed to discover Neo4j tools', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private enhanceKeycloakToolDescription(toolName: string, originalDescription: string): string {
    const enhancements: Record<string, string> = {
      'create-user': originalDescription + ' Verwende dies für das Erstellen neuer Benutzer in Keycloak.',
      'delete-user': originalDescription + ' Verwende dies zum Löschen von Benutzern. Erfordert Bestätigung.',
      'list-users': originalDescription + ' Verwende dies für aktuelle Live-Benutzerdaten aus Keycloak.',
      'list-realms': originalDescription + ' Zeigt verfügbare Keycloak-Realms.',
      'list-admin-events': originalDescription + ' Für aktuelle administrative Aktionen und Audit-Trails.',
      'get-event-details': originalDescription + ' Für detaillierte Informationen zu spezifischen Events.',
      'list-user-events': originalDescription + ' Für Benutzer-spezifische Event-Analyse.',
      'get-metrics': originalDescription + ' Für aktuelle System-Metriken und Statistiken.'
    };

    return enhancements[toolName] || originalDescription;
  }

  private enhanceNeo4jToolDescription(toolName: string, originalDescription: string): string {
    const enhancements: Record<string, string> = {
      'get_neo4j_schema': originalDescription + ' Verwende dies um die Datenstruktur vor komplexen Abfragen zu verstehen.',
      'read_neo4j_cypher': originalDescription + ' Für Musteranalyse, Beziehungsabfragen und historische Datenanalyse.',
      'write_neo4j_cypher': originalDescription + ' Für Daten-Updates, Synchronisation und Strukturänderungen.'
    };

    return enhancements[toolName] || originalDescription;
  }

  convertToGeminiTools(mcpTools: Record<string, ToolDefinition[]>): GeminiFunction[] {
    const geminiTools: GeminiFunction[] = [];

    Object.entries(mcpTools).forEach(([serverName, tools]) => {
      tools.forEach(tool => {
        const geminiFunction: GeminiFunction = {
          name: `${serverName}_${tool.name}`,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties || {},
            required: tool.inputSchema.required || []
          }
        };

        geminiTools.push(geminiFunction);
      });
    });

    return geminiTools;
  }

  // Get tools optimized for specific use cases
  async getToolsForIntent(intent: 'read' | 'write' | 'analyze' | 'all' = 'all'): Promise<GeminiFunction[]> {
    const allTools = await this.discoverAllTools();
    const allGeminiTools = this.convertToGeminiTools(allTools.tools);

    if (intent === 'all') {
      return allGeminiTools;
    }

    // Filter tools based on intent
    return allGeminiTools.filter(tool => {
      switch (intent) {
        case 'read':
          return tool.name.includes('list') || 
                 tool.name.includes('get') || 
                 tool.name.includes('read') ||
                 tool.name.includes('schema');

        case 'write':
          return tool.name.includes('create') || 
                 tool.name.includes('delete') || 
                 tool.name.includes('update') ||
                 tool.name.includes('write');

        case 'analyze':
          return tool.name.includes('neo4j') || 
                 tool.name.includes('metric') ||
                 tool.name.includes('event');

        default:
          return true;
      }
    });
  }

  // Invalidate cache manually
  invalidateCache(): void {
    this.toolsCache = null;
    this.cacheExpiry = 0;
    logger.debug('MCP tools cache invalidated');
  }

  // Get cache status
  getCacheStatus(): { cached: boolean; age: number; expires: number } {
    return {
      cached: this.toolsCache !== null && Date.now() < this.cacheExpiry,
      age: this.toolsCache ? Date.now() - (this.cacheExpiry - this.cacheTTL) : 0,
      expires: this.cacheExpiry
    };
  }
}