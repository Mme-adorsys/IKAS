import { OrchestrationRequest, OrchestrationResponse, ExecutionStrategy, MCPToolCall } from '../types';
import { GeminiService, MCPToolDiscovery } from '../llm';
import { IntelligentRouter } from './routing';
import { DataSynchronizer } from './sync';
import { getKeycloakClient, getNeo4jClient } from '../mcp';
import { logger, RequestTracker } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class Orchestrator {
  private geminiService: GeminiService;
  private toolDiscovery: MCPToolDiscovery;
  private router: IntelligentRouter;
  private synchronizer: DataSynchronizer;
  private toolResults: Map<string, any> = new Map();

  constructor() {
    this.geminiService = new GeminiService();
    this.toolDiscovery = new MCPToolDiscovery();
    this.router = new IntelligentRouter();
    this.synchronizer = new DataSynchronizer();

    logger.info('Orchestrator initialized');
  }

  async processRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const requestId = RequestTracker.startRequest({ 
      sessionId: request.sessionId, 
      type: 'orchestration',
      userInput: request.userInput,
      strategy: request.strategy
    });
    
    logger.info('🎯 Starting orchestration request', {
      requestId,
      sessionId: request.sessionId,
      userInput: request.userInput,
      inputLength: request.userInput.length,
      strategy: request.strategy,
      realm: request.context?.realm,
      context: request.context
    });

    try {
      // 1. Determine execution strategy (if not provided)
      const strategy = request.strategy || await this.router.determineExecutionStrategy(
        request.userInput, 
        { realm: request.context?.realm }
      );

      logger.info('📋 Strategy determined', {
        requestId,
        sessionId: request.sessionId,
        strategy,
        wasProvided: !!request.strategy,
        reasoning: strategy !== request.strategy ? 'Auto-selected by router' : 'User-provided'
      });

      // 2. Get appropriate tools for the strategy
      const intent = this.getIntentFromStrategy(strategy);
      const availableTools = await this.toolDiscovery.getToolsForIntent(intent);

      logger.info('🛠️ Tools selected for request', {
        requestId,
        sessionId: request.sessionId,
        strategy,
        intent,
        toolCount: availableTools.length,
        availableTools: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description.substring(0, 100)
        }))
      });

      // 3. Execute pre-processing based on strategy
      await this.executePreProcessing(strategy, request.context?.realm || 'master');

      // 4. Process with Gemini
      logger.info('🧠 Sending request to Gemini', {
        requestId,
        sessionId: request.sessionId,
        message: request.userInput,
        toolCount: availableTools.length,
        context: {
          realm: request.context?.realm,
          language: request.context?.preferredLanguage || 'en'
        }
      });

      const geminiResponse = await this.geminiService.chat({
        message: request.userInput,
        sessionId: request.sessionId,
        tools: availableTools,
        context: {
          realm: request.context?.realm,
          language: request.context?.preferredLanguage || 'en'
        }
      });

      logger.info('🎭 Gemini response received', {
        requestId,
        sessionId: request.sessionId,
        hasResponse: !!geminiResponse.response,
        responseLength: geminiResponse.response?.length || 0,
        hasFunctionCalls: !!(geminiResponse.functionCalls && geminiResponse.functionCalls.length > 0),
        functionCallCount: geminiResponse.functionCalls?.length || 0,
        functionNames: geminiResponse.functionCalls?.map(fc => fc.name) || []
      });

      // 5. Execute function calls if any
      const toolsCalled: MCPToolCall[] = [];
      let finalResponse = geminiResponse.response;
      let aggregatedData: any = {};

      if (geminiResponse.functionCalls && geminiResponse.functionCalls.length > 0) {
        logger.info('⚙️ Starting function call execution', {
          requestId,
          sessionId: request.sessionId,
          functionCount: geminiResponse.functionCalls.length,
          functions: geminiResponse.functionCalls.map(fc => ({
            name: fc.name,
            argKeys: Object.keys(fc.args || {})
          }))
        });

        // Clear previous tool results for this session
        this.toolResults.clear();

        // Track tools called for metadata
        for (const functionCall of geminiResponse.functionCalls) {
          toolsCalled.push({
            server: this.extractServerFromToolName(functionCall.name),
            tool: this.extractToolFromToolName(functionCall.name),
            arguments: functionCall.args,
            context: {
              sessionId: request.sessionId,
              realm: request.context?.realm,
              timestamp: new Date().toISOString()
            }
          });
        }

        // Process all function calls and get final response from Gemini
        finalResponse = await this.geminiService.processFunctionCalls(
          request.sessionId,
          geminiResponse.functionCalls,
          (functionCall) => this.executeFunctionCall(functionCall, request.context?.realm)
        );

        // Aggregate tool results for response
        aggregatedData = this.aggregateToolResults(toolsCalled);
        
        logger.info('📊 Data aggregation completed', {
          requestId,
          sessionId: request.sessionId,
          toolResultsCount: this.toolResults.size,
          aggregatedDataKeys: Object.keys(aggregatedData),
          dataTypes: Object.entries(aggregatedData).map(([key, value]) => ({
            type: key,
            isArray: Array.isArray(value),
            size: Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0)
          }))
        });
      }

      // 6. Execute post-processing if needed
      await this.executePostProcessing(strategy, toolsCalled, request.context?.realm || 'master');

      const duration = RequestTracker.endRequest(requestId);

      logger.info('✅ Orchestration request completed successfully', {
        requestId,
        sessionId: request.sessionId,
        duration: `${duration}ms`,
        strategy,
        toolsCalledCount: toolsCalled.length,
        finalResponseLength: finalResponse?.length || 0,
        dataKeys: Object.keys(aggregatedData),
        success: true
      });

      return {
        success: true,
        response: finalResponse,
        data: {
          ...aggregatedData,
          ...(geminiResponse.usage ? {
            usage: geminiResponse.usage,
            finishReason: geminiResponse.finishReason
          } : {})
        },
        toolsCalled,
        duration,
        strategy
      };

    } catch (error) {
      const duration = RequestTracker.endRequest(requestId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('❌ Orchestration request failed', {
        requestId,
        sessionId: request.sessionId,
        userInput: request.userInput,
        duration: `${duration}ms`,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        strategy: request.strategy,
        context: request.context
      });

      return {
        success: false,
        response: `Sorry, there was an error processing your request: ${errorMessage}`,
        toolsCalled: [],
        duration,
        strategy: request.strategy || ExecutionStrategy.COORDINATED_MULTI_MCP,
        error: errorMessage
      };
    }
  }

  private getIntentFromStrategy(strategy: ExecutionStrategy): 'read' | 'write' | 'analyze' | 'all' {
    switch (strategy) {
      case ExecutionStrategy.KEYCLOAK_FRESH_DATA:
        return 'read';
      case ExecutionStrategy.NEO4J_ANALYSIS_ONLY:
        return 'analyze';
      case ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC:
        return 'write';
      case ExecutionStrategy.SYNC_THEN_ANALYZE:
        return 'all';
      case ExecutionStrategy.COORDINATED_MULTI_MCP:
      default:
        return 'all';
    }
  }

  private async executePreProcessing(strategy: ExecutionStrategy, realm: string): Promise<void> {
    switch (strategy) {
      case ExecutionStrategy.SYNC_THEN_ANALYZE:
        logger.debug('Executing sync pre-processing', { strategy, realm });
        await this.synchronizer.syncKeycloakToNeo4j(realm);
        break;
      
      case ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC:
        // No pre-processing needed for write operations
        break;
      
      default:
        // No pre-processing needed
        break;
    }
  }

  private async executePostProcessing(
    strategy: ExecutionStrategy, 
    toolsCalled: MCPToolCall[], 
    realm: string
  ): Promise<void> {
    
    // Check if any write operations were performed on Keycloak
    const hasKeycloakWrites = toolsCalled.some(tool => 
      tool.server === 'keycloak' && 
      ['create-user', 'delete-user', 'update-user'].some(writeOp => tool.tool.includes(writeOp))
    );

    if (hasKeycloakWrites || strategy === ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC) {
      logger.debug('Executing sync post-processing after Keycloak writes', { 
        strategy, 
        realm,
        toolsCalledCount: toolsCalled.length 
      });
      
      // Sync changes to Neo4j
      await this.synchronizer.syncKeycloakToNeo4j(realm);
    }
  }

  private async executeFunctionCall(functionCall: { name: string; args: Record<string, any> }, realm?: string): Promise<any> {
    const serverName = this.extractServerFromToolName(functionCall.name);
    const toolName = this.extractToolFromToolName(functionCall.name);

    logger.debug('Executing function call', {
      serverName,
      toolName,
      args: functionCall.args
    });

    try {
      let response: any;
      
      if (serverName === 'keycloak') {
        const client = getKeycloakClient();
        
        // Add realm to args if not present and available from context
        if (!functionCall.args.realm && realm) {
          functionCall.args.realm = realm;
        }
        
        response = await client.callTool(toolName, functionCall.args);
        
        // Store result for aggregation
        const resultKey = `${serverName}_${toolName}`;
        this.toolResults.set(resultKey, response);
        
        logger.debug('🔗 Keycloak tool result stored', {
          serverName,
          toolName,
          resultKey,
          success: response.success,
          hasData: !!response.data,
          dataType: response.data ? (Array.isArray(response.data) ? 'array' : typeof response.data) : 'none',
          dataSize: response.data ? (Array.isArray(response.data) ? response.data.length : Object.keys(response.data).length) : 0
        });
        
        // Auto-sync to Neo4j if this is a read operation with data
        if (this.isReadOperation(toolName) && response.success && response.data) {
          try {
            await this.synchronizer.syncKeycloakToNeo4j(
              functionCall.args.realm || realm || 'master',
              false // Don't force if data is fresh
            );
            logger.debug('Auto-sync to Neo4j completed', { 
              toolName, 
              realm: functionCall.args.realm || realm 
            });
          } catch (syncError) {
            logger.warn('Auto-sync to Neo4j failed', {
              toolName,
              error: syncError instanceof Error ? syncError.message : 'Unknown error'
            });
          }
        }
        
        return response;
      } 
      else if (serverName === 'neo4j') {
        const client = getNeo4jClient();
        response = await client.callTool(toolName, functionCall.args);
        
        // Store result for aggregation
        const resultKey = `${serverName}_${toolName}`;
        this.toolResults.set(resultKey, response);
        
        logger.debug('🔗 Neo4j tool result stored', {
          serverName,
          toolName,
          resultKey,
          success: response.success,
          hasData: !!response.data,
          dataType: response.data ? (Array.isArray(response.data) ? 'array' : typeof response.data) : 'none',
          dataSize: response.data ? (Array.isArray(response.data) ? response.data.length : Object.keys(response.data).length) : 0
        });
        
        return response;
      } 
      else {
        throw new Error(`Unknown server: ${serverName}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Function call execution failed', {
        serverName,
        toolName,
        error: errorMessage,
        args: functionCall.args
      });

      return {
        success: false,
        error: errorMessage,
        toolName,
        server: serverName
      };
    }
  }

  private extractServerFromToolName(toolName: string): 'keycloak' | 'neo4j' {
    if (toolName.startsWith('keycloak_')) {
      return 'keycloak';
    } else if (toolName.startsWith('neo4j_')) {
      return 'neo4j';
    }
    
    // Fallback - try to determine from tool name patterns
    if (toolName.includes('user') || toolName.includes('realm') || toolName.includes('event')) {
      return 'keycloak';
    } else if (toolName.includes('cypher') || toolName.includes('neo4j') || toolName.includes('schema')) {
      return 'neo4j';
    }
    
    throw new Error(`Cannot determine server from tool name: ${toolName}`);
  }

  private extractToolFromToolName(toolName: string): string {
    // Remove server prefix (e.g., 'keycloak_' or 'neo4j_')
    const prefixes = ['keycloak_', 'neo4j_'];
    
    for (const prefix of prefixes) {
      if (toolName.startsWith(prefix)) {
        return toolName.substring(prefix.length);
      }
    }
    
    return toolName; // Return as-is if no prefix found
  }

  private isReadOperation(toolName: string): boolean {
    const readOperations = ['list-users', 'get-user', 'list-realms', 'get-realm', 'list-clients', 'get-client', 'get-metrics'];
    return readOperations.some(op => toolName.includes(op));
  }

  private aggregateToolResults(toolsCalled: MCPToolCall[]): any {
    const aggregatedData: any = {};
    
    for (const tool of toolsCalled) {
      const resultKey = `${tool.server}_${tool.tool}`;
      const result = this.toolResults.get(resultKey);
      
      if (result && result.success && result.data) {
        // Determine data type based on tool
        const dataType = this.getDataTypeFromTool(tool.tool);
        
        if (dataType) {
          aggregatedData[dataType] = result.data;
        }
      }
    }
    
    return aggregatedData;
  }

  private getDataTypeFromTool(toolName: string): string | null {
    if (toolName.includes('users')) return 'users';
    if (toolName.includes('realms')) return 'realms';
    if (toolName.includes('clients')) return 'clients';
    if (toolName.includes('roles')) return 'roles';
    if (toolName.includes('groups')) return 'groups';
    if (toolName.includes('metrics')) return 'metrics';
    return null;
  }

  // Cleanup method for old chat sessions
  cleanup(): void {
    this.geminiService.cleanupOldSessions();
    logger.debug('Orchestrator cleanup completed');
  }

  // Get orchestrator status
  getStatus(): {
    activeSessions: number;
    toolCacheStatus: any;
  } {
    return {
      activeSessions: this.geminiService.getActiveSessions().length,
      toolCacheStatus: this.toolDiscovery.getCacheStatus()
    };
  }
}