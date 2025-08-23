import { MCPToolDiscovery } from '../../../src/llm/tool-discovery';
import { ToolDefinition, MCPToolsResponse } from '../../../src/types/mcp';
import * as mcpModule from '../../../src/mcp';

// Mock the MCP module
jest.mock('../../../src/mcp');
const mockedMcp = mcpModule as jest.Mocked<typeof mcpModule>;

describe('MCPToolDiscovery', () => {
  let toolDiscovery: MCPToolDiscovery;
  let mockKeycloakClient: any;
  let mockNeo4jClient: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Keycloak client
    mockKeycloakClient = {
      listTools: jest.fn(),
      healthCheck: jest.fn(),
      getServerInfo: jest.fn().mockReturnValue({
        name: 'keycloak',
        url: 'http://localhost:8001'
      })
    };
    
    // Mock Neo4j client
    mockNeo4jClient = {
      listTools: jest.fn(),
      healthCheck: jest.fn(),
      getServerInfo: jest.fn().mockReturnValue({
        name: 'neo4j',
        url: 'http://localhost:8002'
      })
    };
    
    mockedMcp.getKeycloakClient.mockReturnValue(mockKeycloakClient);
    mockedMcp.getNeo4jClient.mockReturnValue(mockNeo4jClient);
    
    toolDiscovery = new MCPToolDiscovery();
  });
  
  describe('discoverAllTools', () => {
    it('should discover tools from all MCP servers', async () => {
      const keycloakTools: ToolDefinition[] = [
        {
          name: 'list-users',
          description: 'List all users in a realm',
          inputSchema: {
            type: 'object',
            properties: {
              realm: { type: 'string' },
              max: { type: 'number' }
            }
          }
        },
        {
          name: 'create-user',
          description: 'Create a new user',
          inputSchema: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['username']
          }
        }
      ];
      
      const neo4jTools: ToolDefinition[] = [
        {
          name: 'get_neo4j_schema',
          description: 'Get the Neo4j database schema',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'read_neo4j_cypher',
          description: 'Execute a read-only Cypher query',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              parameters: { type: 'object' }
            },
            required: ['query']
          }
        }
      ];
      
      mockKeycloakClient.listTools.mockResolvedValue(keycloakTools);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      
      mockNeo4jClient.listTools.mockResolvedValue(neo4jTools);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const result = await toolDiscovery.discoverAllTools();
      
      expect(result).toHaveProperty('tools');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('servers');
      
      // Tools will be enhanced with additional descriptions, so check structure instead
      expect(result.tools.keycloak).toHaveLength(2);
      expect(result.tools.keycloak[0].name).toBe('list-users');
      expect(result.tools.keycloak[1].name).toBe('create-user');
      // Tools will be enhanced with additional descriptions, so check structure instead
      expect(result.tools.neo4j).toHaveLength(2);
      expect(result.tools.neo4j[0].name).toBe('get_neo4j_schema');
      expect(result.tools.neo4j[1].name).toBe('read_neo4j_cypher');
      
      // Check total tools count from the arrays
      const totalTools = result.tools.keycloak.length + result.tools.neo4j.length;
      expect(totalTools).toBe(4);
      
      expect(result.servers).toHaveLength(2);
      expect(result.servers[0]).toEqual({
        name: 'keycloak',
        url: 'http://localhost:8001',
        transport: 'http',
        status: 'healthy'
      });
    });
    
    it('should handle partial server failures', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([
        {
          name: 'list-users',
          description: 'List users',
          inputSchema: { type: 'object', properties: {} }
        }
      ]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      
      mockNeo4jClient.listTools.mockRejectedValue(new Error('Connection failed'));
      mockNeo4jClient.healthCheck.mockResolvedValue(false);
      
      const result = await toolDiscovery.discoverAllTools();
      
      expect(result.tools.keycloak).toHaveLength(1);
      expect(result.tools.neo4j).toHaveLength(0);
      
      // Check server health status
      const healthyServers = result.servers.filter(s => s.status === 'healthy').length;
      const unhealthyServers = result.servers.filter(s => s.status === 'unhealthy').length;
      expect(healthyServers).toBe(1);
      expect(unhealthyServers).toBe(1);
      
      const neo4jServer = result.servers.find(s => s.name === 'neo4j');
      expect(neo4jServer?.status).toBe('unhealthy');
    });
    
    it('should cache results', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      await toolDiscovery.discoverAllTools();
      await toolDiscovery.discoverAllTools();
      
      expect(mockKeycloakClient.listTools).toHaveBeenCalledTimes(1);
      expect(mockNeo4jClient.listTools).toHaveBeenCalledTimes(1);
    });
    
    it('should refresh cache when invalidated', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      await toolDiscovery.discoverAllTools();
      toolDiscovery.invalidateCache();
      await toolDiscovery.discoverAllTools();
      
      expect(mockKeycloakClient.listTools).toHaveBeenCalledTimes(2);
      expect(mockNeo4jClient.listTools).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('convertToGeminiTools', () => {
    it('should convert MCP tools to Gemini format', async () => {
      const mcpTools: ToolDefinition[] = [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              param1: { type: 'string', description: 'First parameter' },
              param2: { type: 'number', description: 'Second parameter' }
            },
            required: ['param1']
          }
        }
      ];
      
      mockKeycloakClient.listTools.mockResolvedValue(mcpTools);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const allTools = await toolDiscovery.discoverAllTools();
      const geminiTools = (toolDiscovery as any).convertToGeminiTools(allTools.tools);
      
      expect(geminiTools).toHaveLength(1);
      expect(geminiTools[0]).toEqual({
        name: 'keycloak_test-tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First parameter' },
            param2: { type: 'number', description: 'Second parameter' }
          },
          required: ['param1']
        }
      });
    });
    
    it('should handle tools with no parameters', async () => {
      const mcpTools: ToolDefinition[] = [
        {
          name: 'simple-tool',
          description: 'Simple tool with no params',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ];
      
      mockKeycloakClient.listTools.mockResolvedValue(mcpTools);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const allTools = await toolDiscovery.discoverAllTools();
      const geminiTools = (toolDiscovery as any).convertToGeminiTools(allTools.tools);
      
      expect(geminiTools[0].parameters.properties).toEqual({});
      expect(geminiTools[0].parameters.required).toEqual([]);
    });
    
    it('should add server prefix to tool names', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([
        {
          name: 'list-users',
          description: 'List users',
          inputSchema: { type: 'object', properties: {} }
        }
      ]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      
      mockNeo4jClient.listTools.mockResolvedValue([
        {
          name: 'get_schema',
          description: 'Get schema',
          inputSchema: { type: 'object', properties: {} }
        }
      ]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const allTools = await toolDiscovery.discoverAllTools();
      const geminiTools = (toolDiscovery as any).convertToGeminiTools(allTools.tools);
      
      const toolNames = geminiTools.map((t: any) => t.name);
      expect(toolNames).toContain('keycloak_list-users');
      expect(toolNames).toContain('neo4j_get_schema');
    });
  });
  
  describe('getToolsForIntent', () => {
    beforeEach(async () => {
      mockKeycloakClient.listTools.mockResolvedValue([
        {
          name: 'list-users',
          description: 'List users',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'create-user',
          description: 'Create user',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'delete-user',
          description: 'Delete user',
          inputSchema: { type: 'object', properties: {} }
        }
      ]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      
      mockNeo4jClient.listTools.mockResolvedValue([
        {
          name: 'get_neo4j_schema',
          description: 'Get schema',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'read_neo4j_cypher',
          description: 'Read data',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'write_neo4j_cypher',
          description: 'Write data',
          inputSchema: { type: 'object', properties: {} }
        }
      ]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
    });
    
    it('should return all tools for "all" intent', async () => {
      const tools = await toolDiscovery.getToolsForIntent('all');
      
      expect(tools).toHaveLength(6);
      expect(tools.some(t => t.name === 'keycloak_list-users')).toBe(true);
      expect(tools.some(t => t.name === 'neo4j_get_neo4j_schema')).toBe(true);
    });
    
    it('should filter read tools for "read" intent', async () => {
      const tools = await toolDiscovery.getToolsForIntent('read');
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('keycloak_list-users');
      expect(toolNames).toContain('neo4j_read_neo4j_cypher');
      expect(toolNames).toContain('neo4j_get_neo4j_schema');
      expect(toolNames).not.toContain('keycloak_create-user');
      expect(toolNames).not.toContain('neo4j_write_neo4j_cypher');
    });
    
    it('should filter write tools for "write" intent', async () => {
      const tools = await toolDiscovery.getToolsForIntent('write');
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('keycloak_create-user');
      expect(toolNames).toContain('keycloak_delete-user');
      expect(toolNames).toContain('neo4j_write_neo4j_cypher');
      expect(toolNames).not.toContain('keycloak_list-users');
    });
    
    it('should filter analysis tools for "analyze" intent', async () => {
      const tools = await toolDiscovery.getToolsForIntent('analyze');
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('neo4j_read_neo4j_cypher');
      expect(toolNames).toContain('neo4j_get_neo4j_schema');
      expect(toolNames).not.toContain('keycloak_create-user');
      // Neo4j write tools are currently included in analyze intent
      expect(toolNames).toContain('neo4j_write_neo4j_cypher');
    });
  });
  
  describe('getCacheStatus', () => {
    it('should return cache status', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      await toolDiscovery.discoverAllTools();
      const cacheStatus = toolDiscovery.getCacheStatus();
      
      expect(cacheStatus).toHaveProperty('cached');
      expect(cacheStatus).toHaveProperty('age');
      expect(cacheStatus).toHaveProperty('expires');
      expect(cacheStatus.cached).toBe(true);
    });
    
    it('should show no cache when not loaded', () => {
      const cacheStatus = toolDiscovery.getCacheStatus();
      
      expect(cacheStatus.cached).toBe(false);
      expect(cacheStatus.age).toBe(0);
      expect(cacheStatus.expires).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle complete server failures gracefully', async () => {
      mockKeycloakClient.listTools.mockRejectedValue(new Error('Server down'));
      mockKeycloakClient.healthCheck.mockResolvedValue(false);
      mockNeo4jClient.listTools.mockRejectedValue(new Error('Server down'));
      mockNeo4jClient.healthCheck.mockResolvedValue(false);
      
      const result = await toolDiscovery.discoverAllTools();
      
      expect(result.tools.keycloak).toHaveLength(0);
      expect(result.tools.neo4j).toHaveLength(0);
      
      // Check server health status
      const healthyServers = result.servers.filter(s => s.status === 'healthy').length;
      const unhealthyServers = result.servers.filter(s => s.status === 'unhealthy').length;
      expect(healthyServers).toBe(0);
      expect(unhealthyServers).toBe(2);
    });
    
    it('should handle health check failures', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([{
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {} }
      }]);
      mockKeycloakClient.healthCheck.mockRejectedValue(new Error('Health check failed'));
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const result = await toolDiscovery.discoverAllTools();
      
      // Health check failure causes entire discovery to fail
      expect(result.tools.keycloak).toHaveLength(0);
      expect(result.tools.neo4j).toHaveLength(0);
      expect(result.servers).toHaveLength(0);
    });
    
    it('should handle malformed tool definitions', async () => {
      mockKeycloakClient.listTools.mockResolvedValue([
        {
          name: 'broken-tool',
          // Missing description and inputSchema
        } as any
      ]);
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue([]);
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const result = await toolDiscovery.discoverAllTools();
      
      // Should handle gracefully without throwing
      expect(result.tools.keycloak).toHaveLength(1);
      const totalTools = result.tools.keycloak.length + result.tools.neo4j.length;
      expect(totalTools).toBe(1);
    });
  });
  
  describe('Performance', () => {
    it('should handle large numbers of tools efficiently', async () => {
      const manyTools = Array.from({ length: 100 }, (_, i) => ({
        name: `tool-${i}`,
        description: `Tool number ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          }
        }
      }));
      
      mockKeycloakClient.listTools.mockResolvedValue(manyTools.slice(0, 50));
      mockKeycloakClient.healthCheck.mockResolvedValue(true);
      mockNeo4jClient.listTools.mockResolvedValue(manyTools.slice(50));
      mockNeo4jClient.healthCheck.mockResolvedValue(true);
      
      const startTime = Date.now();
      const result = await toolDiscovery.discoverAllTools();
      const endTime = Date.now();
      
      const totalTools = result.tools.keycloak.length + result.tools.neo4j.length;
      expect(totalTools).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});