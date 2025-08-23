import { OrchestrationRequest, OrchestrationResponse, ExecutionStrategy, MCPToolCall } from '../types';
import { FunctionCallingMode } from '@google/generative-ai';
import { GeminiService, MCPToolDiscovery } from '../llm';
import { IntelligentRouter } from './routing';
import { getKeycloakClient, getNeo4jClient } from '../mcp';
import { logger, RequestTracker } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class Orchestrator {
  private geminiService: GeminiService;
  private toolDiscovery: MCPToolDiscovery;
  private router: IntelligentRouter;
  private toolResults: Map<string, any> = new Map();

  constructor() {
    this.geminiService = new GeminiService();
    this.toolDiscovery = new MCPToolDiscovery();
    this.router = new IntelligentRouter();

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

      // 4. Determine function calling mode based on request type
      const functionCallingMode = this.determineFunctionCallingMode(request.userInput);
      
      logger.info('🧠 Sending request to Gemini', {
        requestId,
        sessionId: request.sessionId,
        message: request.userInput,
        toolCount: availableTools.length,
        functionCallingMode,
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
        },
        functionCallingMode
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

      // 5. Execute function calls in loop until Gemini stops requesting them
      const toolsCalled: MCPToolCall[] = [];
      let finalResponse = geminiResponse.response;
      let aggregatedData: any = {};
      let currentResponse = geminiResponse;
      let maxIterations = 5; // Safety limit to prevent infinite loops
      let iteration = 0;

      // Clear previous tool results for this session
      this.toolResults.clear();

      while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0 && iteration < maxIterations) {
        logger.info(`⚙️ Starting function call execution (iteration ${iteration + 1})`, {
          requestId,
          sessionId: request.sessionId,
          iteration: iteration + 1,
          functionCount: currentResponse.functionCalls.length,
          functions: currentResponse.functionCalls.map(fc => ({
            name: fc.name,
            argKeys: Object.keys(fc.args || {})
          }))
        });

        // Track tools called for metadata
        for (const functionCall of currentResponse.functionCalls) {
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

        // Process function calls and get response from Gemini
        const processResult = await this.geminiService.processFunctionCalls(
          request.sessionId,
          currentResponse.functionCalls,
          (functionCall) => this.executeFunctionCall(functionCall, request.context?.realm),
          availableTools,
          functionCallingMode
        );

        finalResponse = processResult.response;

        // Check if Gemini wants to call more functions
        if (processResult.additionalFunctionCalls && processResult.additionalFunctionCalls.length > 0) {
          logger.info('🔧 Gemini requested more function calls', {
            requestId,
            sessionId: request.sessionId,
            iteration: iteration + 1,
            additionalFunctionCount: processResult.additionalFunctionCalls.length,
            functions: processResult.additionalFunctionCalls.map(fc => fc.name)
          });
          
          // Prepare for next iteration
          currentResponse = {
            response: processResult.response,
            functionCalls: processResult.additionalFunctionCalls,
            finishReason: 'CONTINUE'
          };
        } else {
          logger.info('✅ Gemini finished calling functions', {
            requestId,
            sessionId: request.sessionId,
            iteration: iteration + 1,
            totalToolsCalled: toolsCalled.length
          });
          
          // Clear function calls to exit loop
          currentResponse = {
            response: processResult.response,
            functionCalls: undefined,
            finishReason: 'STOP'
          };
        }

        iteration++;
      }

      if (iteration >= maxIterations) {
        logger.warn('⚠️ Function calling loop reached maximum iterations', {
          requestId,
          sessionId: request.sessionId,
          maxIterations,
          totalToolsCalled: toolsCalled.length
        });
      }

      // Aggregate tool results for response
      aggregatedData = this.aggregateToolResults(toolsCalled);
      
      logger.info('📊 Data aggregation completed', {
        requestId,
        sessionId: request.sessionId,
        totalIterations: iteration,
        toolResultsCount: this.toolResults.size,
        aggregatedDataKeys: Object.keys(aggregatedData),
        totalToolsCalled: toolsCalled.length,
        dataTypes: Object.entries(aggregatedData).map(([key, value]) => ({
          type: key,
          isArray: Array.isArray(value),
          size: Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0)
        }))
      });

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
    // No pre-processing needed - let Gemini orchestrate all operations
    logger.debug('Skipping pre-processing - Gemini will handle orchestration', { strategy, realm });
  }

  private async executePostProcessing(
    strategy: ExecutionStrategy, 
    toolsCalled: MCPToolCall[], 
    realm: string
  ): Promise<void> {
    // No post-processing needed - Gemini handles all synchronization
    logger.debug('Skipping post-processing - Gemini orchestrates all operations', { 
      strategy, 
      realm,
      toolsCalledCount: toolsCalled.length 
    });
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
      // Validate function call arguments
      const validatedArgs = this.validateAndSanitizeFunctionArgs(functionCall.args, toolName);
      
      let response: any;
      
      if (serverName === 'keycloak') {
        const client = getKeycloakClient();
        
        // Add realm to args if not present and available from context
        if (!validatedArgs.realm && realm) {
          validatedArgs.realm = realm;
        }
        
        response = await client.callTool(toolName, validatedArgs);
        
        // Validate and sanitize response
        response = this.validateToolResponse(response, serverName, toolName);
        
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
        
        return response;
      } 
      else if (serverName === 'neo4j') {
        const client = getNeo4jClient();
        response = await client.callTool(toolName, validatedArgs);
        
        // Validate and sanitize response
        response = this.validateToolResponse(response, serverName, toolName);
        
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
        server: serverName,
        data: null
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

  private determineFunctionCallingMode(userInput: string): FunctionCallingMode {
    const input = userInput.toLowerCase();
    
    // Force function calls for sync operations and multi-step workflows
    const syncKeywords = ['sync', 'synchron', 'list all', 'get all', 'fetch all', 'migrate', 'copy', 'transfer'];
    const actionKeywords = ['create', 'delete', 'update', 'add', 'remove', 'modify'];
    
    if (syncKeywords.some(keyword => input.includes(keyword)) || 
        actionKeywords.some(keyword => input.includes(keyword))) {
      return FunctionCallingMode.ANY; // Force function calls for operational tasks
    }
    
    // Use AUTO for informational queries
    const queryKeywords = ['what is', 'how many', 'show me', 'explain', 'describe'];
    if (queryKeywords.some(keyword => input.includes(keyword))) {
      return FunctionCallingMode.AUTO; // Let Gemini decide
    }
    
    // Default to ANY for unknown patterns to ensure action
    return FunctionCallingMode.ANY;
  }

  // Cleanup method for old chat sessions
  cleanup(): void {
    this.geminiService.cleanupOldSessions();
    logger.debug('Orchestrator cleanup completed');
  }

  private validateAndSanitizeFunctionArgs(args: Record<string, any>, toolName: string): Record<string, any> {
    if (!args || typeof args !== 'object') {
      logger.warn('Invalid function arguments', { toolName, args: typeof args });
      return {};
    }

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(args)) {
      // Skip undefined values
      if (value === undefined) {
        continue;
      }
      
      // Skip function values
      if (typeof value === 'function') {
        logger.warn('Function argument contains function value', { toolName, key });
        continue;
      }
      
      // Sanitize the value
      try {
        sanitized[key] = this.sanitizeValue(value);
      } catch (error) {
        logger.warn('Could not sanitize function argument', {
          toolName,
          key,
          valueType: typeof value,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return sanitized;
  }
  
  private validateToolResponse(response: any, serverName: string, toolName: string): any {
    // Ensure response has expected structure
    if (!response || typeof response !== 'object') {
      logger.warn('Tool response is not an object', {
        serverName,
        toolName,
        responseType: typeof response
      });
      
      return {
        success: false,
        error: 'Invalid response format',
        data: null,
        originalResponse: response
      };
    }
    
    // Ensure required properties exist
    const validatedResponse = {
      success: response.success === true,
      data: response.data || null,
      error: response.error || null,
      ...response
    };
    
    // Sanitize data if present
    if (validatedResponse.data) {
      try {
        validatedResponse.data = this.sanitizeValue(validatedResponse.data);
      } catch (error) {
        logger.warn('Could not sanitize tool response data', {
          serverName,
          toolName,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // If we can't sanitize the data, mark as error but preserve original
        validatedResponse.success = false;
        validatedResponse.error = 'Response data not serializable';
        validatedResponse.originalData = validatedResponse.data;
        validatedResponse.data = null;
      }
    }
    
    return validatedResponse;
  }
  
  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item));
    }
    
    if (typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'function' || val === undefined) {
          continue;
        }
        
        if (typeof val === 'symbol') {
          sanitized[key] = val.toString();
          continue;
        }
        
        sanitized[key] = this.sanitizeValue(val);
      }
      return sanitized;
    }
    
    // Convert other types to string
    return String(value);
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