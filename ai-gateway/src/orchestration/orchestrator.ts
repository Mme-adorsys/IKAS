import { OrchestrationRequest, OrchestrationResponse, ExecutionStrategy, MCPToolCall } from '../types';
import { GeminiService, MCPToolDiscovery } from '../llm';
import { IntelligentRouter } from './routing';
import { DataSynchronizer } from './sync';
import { getKeycloakClient, getNeo4jClient } from '../mcp';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class Orchestrator {
  private geminiService: GeminiService;
  private toolDiscovery: MCPToolDiscovery;
  private router: IntelligentRouter;
  private synchronizer: DataSynchronizer;

  constructor() {
    this.geminiService = new GeminiService();
    this.toolDiscovery = new MCPToolDiscovery();
    this.router = new IntelligentRouter();
    this.synchronizer = new DataSynchronizer();

    logger.info('Orchestrator initialized');
  }

  async processRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    logger.info('Processing orchestration request', {
      requestId,
      sessionId: request.sessionId,
      inputLength: request.userInput.length,
      strategy: request.strategy,
      realm: request.context?.realm
    });

    try {
      // 1. Determine execution strategy (if not provided)
      const strategy = request.strategy || await this.router.determineExecutionStrategy(
        request.userInput, 
        { realm: request.context?.realm }
      );

      // 2. Get appropriate tools for the strategy
      const intent = this.getIntentFromStrategy(strategy);
      const availableTools = await this.toolDiscovery.getToolsForIntent(intent);

      logger.debug('Tools selected for request', {
        requestId,
        strategy,
        intent,
        toolCount: availableTools.length
      });

      // 3. Execute pre-processing based on strategy
      await this.executePreProcessing(strategy, request.context?.realm || 'master');

      // 4. Process with Gemini
      const geminiResponse = await this.geminiService.chat({
        message: request.userInput,
        sessionId: request.sessionId,
        tools: availableTools,
        context: {
          realm: request.context?.realm,
          language: request.context?.preferredLanguage || 'de'
        }
      });

      // 5. Execute function calls if any
      const toolsCalled: MCPToolCall[] = [];
      let finalResponse = geminiResponse.response;

      if (geminiResponse.functionCalls && geminiResponse.functionCalls.length > 0) {
        logger.info('Executing function calls', {
          requestId,
          functionCount: geminiResponse.functionCalls.length
        });

        for (const functionCall of geminiResponse.functionCalls) {
          const toolResult = await this.executeFunctionCall(functionCall, request.context?.realm);
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

          // Send function result back to Gemini
          await this.geminiService.sendFunctionResponse(
            request.sessionId, 
            functionCall.name, 
            toolResult
          );
        }

        // Get final response from Gemini after function calls
        const finalGeminiResponse = await this.geminiService.chat({
          message: 'Basierend auf den Ergebnissen der ausgeführten Funktionen, erstelle eine zusammenfassende Antwort für den Benutzer.',
          sessionId: request.sessionId,
          tools: [], // No more tools needed for summary
          context: {
            realm: request.context?.realm,
            language: request.context?.preferredLanguage || 'de'
          }
        });

        finalResponse = finalGeminiResponse.response;
      }

      // 6. Execute post-processing if needed
      await this.executePostProcessing(strategy, toolsCalled, request.context?.realm || 'master');

      const duration = Date.now() - startTime;

      logger.info('Orchestration request completed', {
        requestId,
        sessionId: request.sessionId,
        duration: `${duration}ms`,
        strategy,
        toolsCalledCount: toolsCalled.length,
        success: true
      });

      return {
        success: true,
        response: finalResponse,
        data: geminiResponse.usage ? {
          usage: geminiResponse.usage,
          finishReason: geminiResponse.finishReason
        } : undefined,
        toolsCalled,
        duration,
        strategy
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Orchestration request failed', {
        requestId,
        sessionId: request.sessionId,
        duration: `${duration}ms`,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        response: `Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Anfrage: ${errorMessage}`,
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
      if (serverName === 'keycloak') {
        const client = getKeycloakClient();
        
        // Add realm to args if not present and available from context
        if (!functionCall.args.realm && realm) {
          functionCall.args.realm = realm;
        }
        
        const response = await client.callTool(toolName, functionCall.args);
        return response;
      } 
      else if (serverName === 'neo4j') {
        const client = getNeo4jClient();
        const response = await client.callTool(toolName, functionCall.args);
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