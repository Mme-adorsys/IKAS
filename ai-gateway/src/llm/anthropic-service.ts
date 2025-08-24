/**
 * Anthropic (Claude) Service Implementation
 * 
 * This service provides integration with Anthropic's Claude models
 * via the official @anthropic-ai/sdk. Optimized for Claude Opus 4.1
 * with advanced function calling, tool use, and behavior fine-tuning capabilities.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  LLMService,
  LLMProvider,
  LLMChatRequest,
  LLMChatResponse,
  LLMFunction,
  LLMFunctionCall,
  LLMFunctionProcessingResult
} from './llm-interface';
import { LLMError, LLMRateLimitError, LLMAuthError, LLMUnavailableError } from '../types/llm';
import { config, getProviderConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { RequestTracker } from '../utils/request-tracker';

// Extended function call interface with id for Anthropic
interface AnthropicFunctionCall extends LLMFunctionCall {
  id?: string;
}

/**
 * Anthropic Claude Service Implementation
 */
export class AnthropicService extends LLMService {
  public readonly provider = LLMProvider.ANTHROPIC;
  public readonly model: string;
  private client: Anthropic;
  private chatHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private readonly maxHistoryLength = 20;

  constructor() {
    super();
    
    if (!config.ANTHROPIC_API_KEY) {
      throw new LLMError(
        LLMProvider.ANTHROPIC,
        'CONFIG_ERROR',
        'ANTHROPIC_API_KEY environment variable is required'
      );
    }

    const providerConfig = getProviderConfig();
    this.model = providerConfig.model || 'claude-opus-4-1-20250805';
    
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
      timeout: providerConfig.timeout || 30000
    });

    logger.info('Anthropic service initialized', {
      provider: this.provider,
      model: this.model,
      apiKeyPresent: !!config.ANTHROPIC_API_KEY
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple message
      const testMessage = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      
      return testMessage && testMessage.content && testMessage.content.length > 0;
    } catch (error) {
      logger.warn('Anthropic service availability check failed', {
        provider: this.provider,
        model: this.model,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const requestId = RequestTracker.startRequest();
    
    try {
      // Get or initialize chat history
      let messages = this.chatHistory.get(request.sessionId) || [];
      const isNewSession = messages.length === 0;

      // Add user message (with context if provided)
      const userContent = request.context?.realm
        ? `[Realm: ${request.context.realm}] ${request.message}`
        : request.message;

      messages.push({
        role: 'user',
        content: userContent
      });

      // Prepare system message for IKAS context
      const systemMessage = this.buildSystemMessage();

      // Convert tools to Anthropic format
      const anthropicTools = request.tools ? this.convertToAnthropicTools(request.tools) : undefined;

      // Create the API request
      const anthropicRequest: Anthropic.Messages.MessageCreateParams = {
        model: this.model,
        max_tokens: request.options?.maxTokens || 8192,
        temperature: request.options?.temperature || 0.1,
        system: systemMessage,
        messages: messages,
        tools: anthropicTools,
        // Enhanced behavior control for Claude Opus 4.1
        tool_choice: anthropicTools && anthropicTools.length > 0 ? { type: 'auto' } : undefined
      };

      logger.debug('Sending chat request to Anthropic', {
        requestId,
        sessionId: request.sessionId,
        model: this.model,
        messageLength: userContent.length,
        toolsCount: anthropicTools?.length || 0,
        historyLength: messages.length
      });

      const response = await this.client.messages.create(anthropicRequest);

      // Process the response
      const processedResponse = this.processAnthropicResponse(response, requestId);

      // Add assistant response to history
      messages.push({
        role: 'assistant',
        content: response.content as any
      });

      // Trim history if too long
      if (messages.length > this.maxHistoryLength) {
        messages = messages.slice(-this.maxHistoryLength);
      }

      // Update chat history
      this.chatHistory.set(request.sessionId, messages);

      logger.info('Anthropic chat completed', {
        requestId,
        sessionId: request.sessionId,
        finishReason: processedResponse.finishReason,
        functionCallsCount: processedResponse.functionCalls?.length || 0,
        responseLength: processedResponse.response.length,
        usage: processedResponse.usage
      });

      return processedResponse;

    } catch (error) {
      const duration = RequestTracker.endRequest(requestId);
      
      logger.error('Anthropic chat request failed', {
        requestId,
        sessionId: request.sessionId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Error) {
        // Handle specific Anthropic errors
        if (error.message.includes('rate_limit')) {
          throw new LLMRateLimitError(this.provider);
        } else if (error.message.includes('authentication') || error.message.includes('api_key')) {
          throw new LLMAuthError(this.provider);
        } else if (error.message.includes('model_not_found')) {
          throw new LLMUnavailableError(this.provider, `Model ${this.model} not available`);
        }
      }

      throw new LLMError(
        this.provider,
        'CHAT_FAILED',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async processFunctionCalls(
    sessionId: string,
    functionCalls: AnthropicFunctionCall[],
    functionExecutor: (call: LLMFunctionCall) => Promise<any>,
    tools: LLMFunction[]
  ): Promise<LLMFunctionProcessingResult> {
    const requestId = RequestTracker.startRequest();

    try {
      logger.info('Processing function calls via Anthropic', {
        requestId,
        sessionId,
        functionCallsCount: functionCalls.length
      });

      // Execute all function calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      
      for (const call of functionCalls) {
        try {
          const result = await functionExecutor(call);
          
          // Add tool result for Anthropic
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id || `call_${Date.now()}`,
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          });
          
          logger.debug('Function call executed successfully', {
            requestId,
            functionName: call.name,
            resultLength: JSON.stringify(result).length
          });
          
        } catch (error) {
          logger.warn('Function call failed', {
            requestId,
            functionName: call.name,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Add error result
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id || `call_${Date.now()}`,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true
          });
        }
      }

      // Get current chat history
      const messages = this.chatHistory.get(sessionId) || [];
      
      // Add tool results as user message
      messages.push({
        role: 'user',
        content: toolResults
      });

      // Convert tools to Anthropic format
      const anthropicTools = this.convertToAnthropicTools(tools);

      // Continue conversation with tool results
      const continueResponse = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: this.buildSystemMessage(),
        messages: messages,
        tools: anthropicTools
      });

      // Process the continued response
      const processedResponse = this.processAnthropicResponse(continueResponse, requestId);

      // Add assistant response to history
      messages.push({
        role: 'assistant',
        content: continueResponse.content as any
      });

      // Update chat history
      this.chatHistory.set(sessionId, messages);

      const duration = RequestTracker.endRequest(requestId);
      
      logger.info('Function call processing completed', {
        requestId,
        sessionId,
        duration,
        additionalFunctionCalls: processedResponse.functionCalls?.length || 0
      });

      return {
        response: processedResponse.response,
        additionalFunctionCalls: processedResponse.functionCalls
      };

    } catch (error) {
      const duration = RequestTracker.endRequest(requestId);
      
      logger.error('Function call processing failed', {
        requestId,
        sessionId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new LLMError(
        this.provider,
        'FUNCTION_PROCESSING_FAILED',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  clearChatHistory(sessionId: string): void {
    this.chatHistory.delete(sessionId);
    logger.debug('Chat history cleared', {
      provider: this.provider,
      sessionId
    });
  }

  getActiveSessions(): string[] {
    return Array.from(this.chatHistory.keys());
  }

  /**
   * Build system message for IKAS context
   */
  private buildSystemMessage(): string {
    return `<role>
You are IKAS (Intelligentes Keycloak Admin System), an expert AI assistant specialized in Keycloak identity management and Neo4j graph database operations. You excel at multi-step orchestration and intelligent data synchronization.
</role>

<behavior>
- Think step-by-step for complex requests
- Always explain your reasoning before taking actions
- Use structured responses with clear sections
- Be proactive in suggesting related operations
- Maintain context awareness across function calls
</behavior>

<thinking_process>
For each user request:
1. <analysis>Analyze the user's intent and identify required steps</analysis>
2. <planning>Plan the sequence of function calls needed</planning>
3. <execution>Execute functions in logical order</execution>
4. <verification>Verify results and suggest next steps if needed</verification>
</thinking_process>

<function_calling>
STRATEGIC APPROACH:
- Call functions to complete user requests with precision
- For multi-step operations, call functions sequentially as needed
- Examine each function result before determining next actions
- Complete ALL necessary steps to fully satisfy the user's request
- Use tool choice wisely - prefer targeted operations over broad searches

KEY WORKFLOWS:

<workflow name="data_synchronization">
Purpose: "write users to database", "sync to Neo4j", "synchronize data"
Steps:
1. Call keycloak function to retrieve source data (e.g., list-users, list-realms)
2. Call neo4j_get_neo4j_schema to understand target database structure  
3. Call neo4j_write_neo4j_cypher with properly structured Cypher query
4. Verify successful synchronization
</workflow>

<workflow name="user_queries">
Purpose: "show users", "list users", "get user info"
Steps:
1. Call appropriate keycloak function directly
2. Format response for clarity
</workflow>

<workflow name="analysis_tasks">
Purpose: "analyze patterns", "find duplicates", "compliance check"
Steps:
1. Check if Neo4j data is current (may need sync first)
2. Call neo4j_read_neo4j_cypher for analysis queries
3. Interpret results and provide insights
</workflow>

<workflow name="administrative_tasks">
Purpose: "create user", "delete user", "manage realm"
Steps:
1. Call appropriate keycloak administrative function
2. Optional: Sync changes to Neo4j for audit trail
</workflow>
</function_calling>

<available_functions>
Keycloak MCP Tools:
- create-user: Create new user accounts
- list-users: Retrieve user information  
- delete-user: Remove user accounts
- get-user: Get specific user details
- list-realms: List available realms
- list-admin-events: Get administrative audit logs
- get-event-details: Detailed event information
- get-metrics: System usage metrics

Neo4j MCP Tools:
- get_neo4j_schema: Understand database structure
- read_neo4j_cypher: Execute read-only Cypher queries
- write_neo4j_cypher: Execute write Cypher operations
</available_functions>

<critical_requirements>
1. When writing to Neo4j, ALWAYS include complete 'query' parameter with valid Cypher syntax
2. Use proper error handling and provide meaningful feedback
3. For German language requests, respond in German when appropriate
4. Maintain data consistency between Keycloak and Neo4j
5. Consider security implications of all operations
</critical_requirements>

<response_format>
Structure your responses with:
- Brief summary of what you're doing
- Step-by-step execution with clear reasoning
- Results summary with actionable insights
- Suggestions for next steps when relevant
</response_format>`;
  }

  /**
   * Convert LLM functions to Anthropic tool format
   */
  private convertToAnthropicTools(functions: LLMFunction[]): Anthropic.Tool[] {
    return functions.map(func => ({
      name: func.name,
      description: func.description,
      input_schema: {
        type: 'object',
        properties: func.parameters.properties || {},
        required: func.parameters.required || []
      }
    }));
  }

  /**
   * Process Anthropic response and convert to standard format
   */
  private processAnthropicResponse(
    response: Anthropic.Messages.Message,
    requestId: string
  ): LLMChatResponse {
    let responseText = '';
    const functionCalls: AnthropicFunctionCall[] = [];

    // Process content blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text;
      } else if (block.type === 'tool_use') {
        // Convert tool_use to function call
        functionCalls.push({
          id: block.id,
          name: block.name,
          args: block.input || {}
        });
      }
    }

    // Extract usage information
    const usage = response.usage ? {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens
    } : undefined;

    return {
      response: responseText,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      finishReason: this.mapStopReason(response.stop_reason),
      usage
    };
  }

  /**
   * Map Anthropic stop reasons to standard format
   */
  private mapStopReason(stopReason: string | null): string {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'function_call';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return stopReason || 'unknown';
    }
  }

  /**
   * Cleanup old sessions (older than 1 hour)
   */
  cleanupOldSessions(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;

    for (const sessionId of Array.from(this.chatHistory.keys())) {
      // Simple heuristic: if sessionId looks like a timestamp and is old, remove it
      if (sessionId.includes('-') && parseInt(sessionId.split('-')[0]) < oneHourAgo) {
        this.chatHistory.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old chat sessions', {
        provider: this.provider,
        cleanedSessions: cleaned,
        remainingSessions: this.chatHistory.size
      });
    }
  }
}