import { Orchestrator } from '../../../src/orchestration/orchestrator';
import { LLMFactory } from '../../../src/llm/llm-factory';
import { LLMService, LLMProvider } from '../../../src/llm/llm-interface';
import { MCPToolDiscovery } from '../../../src/llm/tool-discovery';
import { IntelligentRouter } from '../../../src/orchestration/routing';
import { ExecutionStrategy, OrchestrationRequest } from '../../../src/types/orchestration';
import * as mcpModule from '../../../src/mcp';

// Mock dependencies
jest.mock('../../../src/llm/llm-factory');
jest.mock('../../../src/llm/tool-discovery');
jest.mock('../../../src/orchestration/routing');
jest.mock('../../../src/mcp');

const mockedLLMFactory = LLMFactory as jest.Mocked<typeof LLMFactory>;
const mockedMCPToolDiscovery = MCPToolDiscovery as jest.MockedClass<typeof MCPToolDiscovery>;
const mockedIntelligentRouter = IntelligentRouter as jest.MockedClass<typeof IntelligentRouter>;
const mockedMcp = mcpModule as jest.Mocked<typeof mcpModule>;

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockToolDiscovery: jest.Mocked<MCPToolDiscovery>;
  let mockRouter: jest.Mocked<IntelligentRouter>;
  let mockKeycloakClient: any;
  let mockNeo4jClient: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock LLM service
    mockLLMService = {
      provider: LLMProvider.GEMINI,
      model: 'gemini-2.5-pro',
      chat: jest.fn(),
      processFunctionCalls: jest.fn(),
      clearChatHistory: jest.fn(),
      isAvailable: jest.fn(),
      getActiveSessions: jest.fn(),
      getProviderInfo: jest.fn()
    } as any;
    
    // Mock tool discovery
    mockToolDiscovery = {
      discoverAllTools: jest.fn(),
      getToolsForIntent: jest.fn(),
      getCacheStatus: jest.fn()
    } as any;
    
    // Mock router
    mockRouter = {
      determineExecutionStrategy: jest.fn(),
      analyzeIntent: jest.fn(),
      getRecommendedTools: jest.fn(),
      checkGraphDataFreshness: jest.fn(),
      updatePatterns: jest.fn()
    } as any;
    
    // Mock MCP clients
    mockKeycloakClient = {
      callTool: jest.fn(),
      healthCheck: jest.fn()
    };
    
    mockNeo4jClient = {
      callTool: jest.fn(),
      checkDataFreshness: jest.fn(),
      healthCheck: jest.fn()
    };
    
    // Setup mocks
    mockedLLMFactory.createLLMService.mockReturnValue(mockLLMService);
    mockedMCPToolDiscovery.mockImplementation(() => mockToolDiscovery);
    mockedIntelligentRouter.mockImplementation(() => mockRouter);
    mockedMcp.getKeycloakClient.mockReturnValue(mockKeycloakClient);
    mockedMcp.getNeo4jClient.mockReturnValue(mockNeo4jClient);
    
    orchestrator = new Orchestrator();
  });
  
  describe('Initialization', () => {
    it('should initialize with LLM service and dependencies', () => {
      expect(mockedLLMFactory.createLLMService).toHaveBeenCalled();
      expect(mockedMCPToolDiscovery).toHaveBeenCalled();
      expect(mockedIntelligentRouter).toHaveBeenCalled();
    });
  });
  
  describe('processRequest', () => {
    const mockRequest: OrchestrationRequest = {
      userInput: 'List all users in master realm',
      sessionId: 'test-session-123'
    };
    
    it('should process simple request without function calls', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.COORDINATED_MULTI_MCP);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: {
          keycloak: [{
            name: 'list-users',
            description: 'List users',
            inputSchema: { type: 'object', properties: {} }
          }],
          neo4j: []
        },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: {
          totalTools: 1,
          serverCount: 1,
          healthyServers: 1,
          unhealthyServers: 0
        }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: 'Here are the users in the master realm',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      });
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.response).toBe('Here are the users in the master realm');
      expect(response.sessionId).toBe('test-session-123');
      expect(response.strategy).toBe(ExecutionStrategy.COORDINATED_MULTI_MCP);
      expect(response.usage?.totalTokens).toBe(30);
    });
    
    it('should process request with function calls', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.KEYCLOAK_FRESH_DATA);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: {
          keycloak: [{
            name: 'list-users',
            description: 'List users',
            inputSchema: {
              type: 'object',
              properties: {
                realm: { type: 'string' }
              }
            }
          }],
          neo4j: []
        },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: {
          totalTools: 1,
          serverCount: 1,
          healthyServers: 1,
          unhealthyServers: 0
        }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: '',
        functionCalls: [{
          name: 'keycloak_list-users',
          args: { realm: 'master' }
        }],
        finishReason: 'function_call'
      });
      
      mockKeycloakClient.callTool.mockResolvedValue({
        success: true,
        data: [
          { id: '1', username: 'admin', email: 'admin@test.com' },
          { id: '2', username: 'user1', email: 'user1@test.com' }
        ]
      });
      
      mockLLMService.processFunctionCalls.mockResolvedValue({
        response: 'Found 2 users in the master realm: admin and user1'
      });
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.response).toContain('Found 2 users');
      expect(mockKeycloakClient.callTool).toHaveBeenCalledWith('list-users', { realm: 'master' });
    });
    
    it('should handle multi-step function calls', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.SYNC_THEN_ANALYZE);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: {
          keycloak: [{
            name: 'list-users',
            description: 'List users',
            inputSchema: { type: 'object', properties: {} }
          }],
          neo4j: [{
            name: 'write_neo4j_cypher',
            description: 'Write to Neo4j',
            inputSchema: { type: 'object', properties: {} }
          }]
        },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: {
          totalTools: 2,
          serverCount: 2,
          healthyServers: 2,
          unhealthyServers: 0
        }
      });
      
      // First function call - list users
      mockLLMService.chat.mockResolvedValueOnce({
        response: '',
        functionCalls: [{
          name: 'keycloak_list-users',
          args: { realm: 'master' }
        }],
        finishReason: 'function_call'
      });
      
      mockKeycloakClient.callTool.mockResolvedValue({
        success: true,
        data: [{ id: '1', username: 'admin' }]
      });
      
      // Second function call from processing
      mockLLMService.processFunctionCalls.mockResolvedValue({
        response: 'Data synced successfully',
        additionalFunctionCalls: [{
          name: 'neo4j_write_neo4j_cypher',
          args: { query: 'CREATE (u:User {id: "1", username: "admin"})' }
        }]
      });
      
      mockNeo4jClient.callTool.mockResolvedValue({
        success: true,
        data: { summary: { nodesCreated: 1 } }
      });
      
      // Final response after second function call
      mockLLMService.processFunctionCalls.mockResolvedValueOnce({
        response: 'All users have been synced to the database successfully'
      });
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.success).toBe(true);
      expect(mockKeycloakClient.callTool).toHaveBeenCalled();
      expect(mockNeo4jClient.callTool).toHaveBeenCalled();
    });
    
    it('should handle function execution errors gracefully', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.KEYCLOAK_FRESH_DATA);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: {
          keycloak: [{
            name: 'list-users',
            description: 'List users',
            inputSchema: { type: 'object', properties: {} }
          }],
          neo4j: []
        },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: { totalTools: 1, serverCount: 1, healthyServers: 1, unhealthyServers: 0 }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: '',
        functionCalls: [{
          name: 'keycloak_list-users',
          args: { realm: 'master' }
        }],
        finishReason: 'function_call'
      });
      
      mockKeycloakClient.callTool.mockResolvedValue({
        success: false,
        error: 'Authentication failed'
      });
      
      mockLLMService.processFunctionCalls.mockResolvedValue({
        response: 'I encountered an error accessing the user data. The authentication failed.'
      });
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.response).toContain('error');
    });
    
    it('should handle unknown function calls', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.COORDINATED_MULTI_MCP);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: { keycloak: [], neo4j: [] },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: { totalTools: 0, serverCount: 0, healthyServers: 0, unhealthyServers: 0 }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: '',
        functionCalls: [{
          name: 'unknown_function',
          args: { param: 'value' }
        }],
        finishReason: 'function_call'
      });
      
      mockLLMService.processFunctionCalls.mockResolvedValue({
        response: 'I\'m not sure how to execute that function. It\'s not available in the current system.'
      });
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.response).toContain('not sure');
    });
    
    it('should respect execution strategy', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.NEO4J_ANALYSIS_ONLY);
      
      const neo4jTools = [{
        name: 'read_neo4j_cypher',
        description: 'Read from Neo4j',
        inputSchema: { type: 'object', properties: {} }
      }];
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: { keycloak: [], neo4j: neo4jTools },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: { totalTools: 1, serverCount: 1, healthyServers: 1, unhealthyServers: 0 }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: 'Analysis complete',
        finishReason: 'stop'
      });
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.strategy).toBe(ExecutionStrategy.NEO4J_ANALYSIS_ONLY);
      expect(response.success).toBe(true);
    });
    
    it('should handle pre-processing based on strategy', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.SYNC_THEN_ANALYZE);
      mockNeo4jClient.checkDataFreshness.mockResolvedValue({
        success: true,
        data: { records: [{ freshness: { needsRefresh: true } }] }
      });
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: { keycloak: [], neo4j: [] },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: { totalTools: 0, serverCount: 0, healthyServers: 0, unhealthyServers: 0 }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: 'Pre-processing completed',
        finishReason: 'stop'
      });
      
      await orchestrator.processRequest(mockRequest);
      
      expect(mockNeo4jClient.checkDataFreshness).toHaveBeenCalled();
    });
    
    it('should handle LLM errors', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.COORDINATED_MULTI_MCP);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: { keycloak: [], neo4j: [] },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: { totalTools: 0, serverCount: 0, healthyServers: 0, unhealthyServers: 0 }
      });
      
      mockLLMService.chat.mockRejectedValue(new Error('LLM service unavailable'));
      
      const response = await orchestrator.processRequest(mockRequest);
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('LLM service unavailable');
    });
    
    it('should generate session ID if not provided', async () => {
      mockRouter.determineExecutionStrategy.mockResolvedValue(ExecutionStrategy.COORDINATED_MULTI_MCP);
      
      mockToolDiscovery.discoverAllTools.mockResolvedValue({
        tools: { keycloak: [], neo4j: [] },
        timestamp: new Date().toISOString(),
        servers: [],
        summary: { totalTools: 0, serverCount: 0, healthyServers: 0, unhealthyServers: 0 }
      });
      
      mockLLMService.chat.mockResolvedValue({
        response: 'Response without session ID',
        finishReason: 'stop'
      });
      
      const response = await orchestrator.processRequest({
        userInput: 'Test message'
        // No sessionId provided
      });
      
      expect(response.success).toBe(true);
      expect(response.sessionId).toMatch(/^session-\d+$/);
    });
  });
  
  describe('clearChatHistory', () => {
    it('should clear chat history for session', () => {
      orchestrator.clearChatHistory('test-session');
      expect(mockLLMService.clearChatHistory).toHaveBeenCalledWith('test-session');
    });
  });
  
  describe('getStatus', () => {
    it('should return orchestrator status', () => {
      mockLLMService.getActiveSessions.mockReturnValue(['session1', 'session2']);
      mockToolDiscovery.getCacheStatus.mockReturnValue({
        cached: true,
        lastUpdated: new Date().toISOString(),
        toolCount: 5
      });
      
      const status = orchestrator.getStatus();
      
      expect(status).toEqual({
        activeSessions: 2,
        toolCacheStatus: {
          cached: true,
          lastUpdated: expect.any(String),
          toolCount: 5
        }
      });
    });
  });
  
  describe('Tool Conversion', () => {
    it('should convert MCP tools to LLM format', () => {
      const mcpTools = [{
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          },
          required: ['param']
        }
      }];
      
      const llmTools = (orchestrator as any).convertToolsToLLMFormat(mcpTools);
      
      expect(llmTools).toHaveLength(1);
      expect(llmTools[0]).toEqual({
        name: 'test-tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          },
          required: ['param']
        }
      });
    });
    
    it('should handle tools with no required fields', () => {
      const mcpTools = [{
        name: 'optional-tool',
        description: 'Tool with optional params',
        inputSchema: {
          type: 'object',
          properties: {
            optional: { type: 'string' }
          }
        }
      }];
      
      const llmTools = (orchestrator as any).convertToolsToLLMFormat(mcpTools);
      
      expect(llmTools[0].parameters.required).toEqual([]);
    });
    
    it('should handle tools with empty properties', () => {
      const mcpTools = [{
        name: 'empty-tool',
        description: 'Tool with no params',
        inputSchema: {
          type: 'object'
        }
      }];
      
      const llmTools = (orchestrator as any).convertToolsToLLMFormat(mcpTools);
      
      expect(llmTools[0].parameters.properties).toEqual({});
      expect(llmTools[0].parameters.required).toEqual([]);
    });
  });
});