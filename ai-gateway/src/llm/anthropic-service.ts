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
import { config, getProviderConfig, getAllSupportedAnthropicModels } from '../utils/config';
import { logger } from '../utils/logger';
import { RequestTracker } from '../utils/request-tracker';
import { buildIKASSystemPrompt } from './system-prompt';

// Extended function call interface with id for Anthropic
interface AnthropicFunctionCall extends LLMFunctionCall {
  id?: string;
}

/**
 * Events emitted by streamWithTools. Consumers (e.g. the SSE route) translate these
 * directly to network events for the client.
 */
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; name: string; success: boolean; data?: any; error?: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }
  | { type: 'done'; toolsCalled: string[]; iterations: number }
  | { type: 'error'; message: string };

/**
 * Anthropic Claude Service Implementation
 */
export class AnthropicService extends LLMService {
  public readonly provider = LLMProvider.ANTHROPIC;
  public readonly model: string;
  private client: Anthropic;
  private chatHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private readonly maxHistoryLength = 8;

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
    this.model = providerConfig.model;
    
    // Validate model is supported
    const supportedModels = getAllSupportedAnthropicModels();
    
    if (!supportedModels.includes(this.model)) {
      logger.warn('Unsupported Anthropic model, falling back to default', {
        requestedModel: this.model,
        supportedModels
      });
      this.model = 'claude-haiku-4-5-20251001';
    }

    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
      timeout: providerConfig.timeout || 30000
    });

    const modelName = this.model.includes('haiku') ? 'Haiku 4.5' :
                     this.model.includes('opus') ? 'Opus 4.1' :
                     this.model.includes('sonnet-4') ? 'Sonnet 4' :
                     this.model;

    logger.info('Anthropic service initialized', {
      provider: this.provider,
      model: this.model,
      modelName,
      apiKeyPresent: !!config.ANTHROPIC_API_KEY
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!(config.ANTHROPIC_API_KEY && this.client);
  }

  async chat(request: LLMChatRequest, isRetry: boolean = false): Promise<LLMChatResponse> {
    const requestId = RequestTracker.startRequest();
    
    try {
      // Get or initialize chat history
      let messages = this.chatHistory.get(request.sessionId) || [];
      const isNewSession = messages.length === 0;
      
      // Reset conversation history if it becomes too long to prevent tool_result corruption
      if (messages.length > this.maxHistoryLength) {
        logger.warn('Conversation history too long, resetting to prevent tool_result errors', {
          requestId,
          sessionId: request.sessionId,
          messageCount: messages.length
        });
        messages = [];
        this.chatHistory.set(request.sessionId, messages);
      }

      // Add user message (with context if provided)
      const userContent = request.context?.realm
        ? `[Realm: ${request.context.realm}] ${request.message}`
        : request.message;

      messages.push({
        role: 'user',
        content: userContent
      });

      // Prepare system message for IKAS context — wrapped as content block with cache_control
      // so Anthropic caches the system prompt + tools (saves ~90% input tokens on continuation calls).
      const systemMessage = this.buildSystemMessage();

      // Convert tools to Anthropic format. The last tool carries cache_control which caches the
      // entire tools array (and system prompt before it) for ~5 minutes.
      const anthropicTools = request.tools ? this.convertToAnthropicTools(request.tools) : undefined;

      const anthropicRequest: Anthropic.Messages.MessageCreateParams = {
        model: this.model,
        max_tokens: request.options?.maxTokens || config.LLM_MAX_TOKENS,
        temperature: request.options?.temperature || 0.1,
        system: [{ type: 'text', text: systemMessage, cache_control: { type: 'ephemeral' } }] as any,
        messages: messages,
        tools: anthropicTools,
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

      // Add complete assistant response to history including tool_use blocks
      // This is required so that tool_result blocks can be matched to tool_use blocks
      messages.push({
        role: 'assistant',
        content: response.content
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
        // Handle tool_result mismatch error by clearing history and retrying
        if (error.message.includes('unexpected `tool_use_id` found in `tool_result` blocks') && !isRetry) {
          logger.warn('Tool result mismatch detected, clearing conversation history and retrying', {
            requestId,
            sessionId: request.sessionId
          });
          
          // Clear conversation history and retry once
          this.chatHistory.delete(request.sessionId);
          return await this.chat(request, true);
        }
        
        // Handle other specific Anthropic errors
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

          // Compact + truncate tool result before it enters history.
          // Full MCP responses (e.g. list-users with 100 users) would otherwise be resent as
          // input tokens on every subsequent turn in the session.
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id || `call_${Date.now()}`,
            content: this.truncateToolResult(result)
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

      // Continue conversation with tool results. Reuse cached system+tools (cache_control set).
      const continueResponse = await this.client.messages.create({
        model: this.model,
        max_tokens: config.LLM_MAX_TOKENS,
        system: [{ type: 'text', text: this.buildSystemMessage(), cache_control: { type: 'ephemeral' } }] as any,
        messages: messages,
        tools: anthropicTools
      });

      // Process the continued response
      const processedResponse = this.processAnthropicResponse(continueResponse, requestId);

      // Add complete assistant response to history including any tool_use blocks
      // This ensures proper tool_use/tool_result matching in future conversations
      messages.push({
        role: 'assistant',
        content: continueResponse.content
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

  /**
   * Stream a chat with tool-use loop end-to-end. Yields text deltas as they arrive from
   * Claude, plus structured tool_use / tool_result events as the orchestrator executes each
   * MCP tool. Caller (the SSE route) just serialises each yielded event.
   *
   * Manages chat history the same way as chat() + processFunctionCalls(), so streaming and
   * non-streaming sessions are interchangeable.
   */
  async *streamWithTools(
    request: LLMChatRequest,
    functionExecutor: (call: AnthropicFunctionCall) => Promise<any>,
    maxIterations: number = 4
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const requestId = RequestTracker.startRequest();

    try {
      let messages = this.chatHistory.get(request.sessionId) || [];

      if (messages.length > this.maxHistoryLength) {
        messages = [];
        this.chatHistory.set(request.sessionId, messages);
      }

      const userContent = request.context?.realm
        ? `[Realm: ${request.context.realm}] ${request.message}`
        : request.message;
      messages.push({ role: 'user', content: userContent });

      const systemMessage = this.buildSystemMessage();
      const anthropicTools = request.tools ? this.convertToAnthropicTools(request.tools) : undefined;

      const toolsCalled: string[] = [];
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: request.options?.maxTokens || config.LLM_MAX_TOKENS,
          temperature: request.options?.temperature || 0.1,
          system: [{ type: 'text', text: systemMessage, cache_control: { type: 'ephemeral' } }] as any,
          messages,
          tools: anthropicTools,
          tool_choice: anthropicTools && anthropicTools.length > 0 ? { type: 'auto' } : undefined
        });

        // Iterate raw events for true incremental yields.
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && (event.delta as any).type === 'text_delta') {
            yield { type: 'text', delta: (event.delta as any).text as string };
          }
        }

        const finalMessage = await stream.finalMessage();

        // Persist the assistant turn (including any tool_use blocks) so future iterations and
        // future requests can match tool_result blocks to their tool_use ids.
        messages.push({ role: 'assistant', content: finalMessage.content });

        if (finalMessage.usage) {
          yield {
            type: 'usage',
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
            cacheReadInputTokens: (finalMessage.usage as any).cache_read_input_tokens,
            cacheCreationInputTokens: (finalMessage.usage as any).cache_creation_input_tokens
          };
        }

        // Collect any tool_use blocks from this turn.
        const toolUseBlocks = finalMessage.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          break;
        }

        // Execute each tool and append tool_result blocks for the next iteration.
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          toolsCalled.push(block.name);
          yield { type: 'tool_use', id: block.id, name: block.name, input: block.input };

          try {
            const result = await functionExecutor({ id: block.id, name: block.name, args: (block.input as any) || {} });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: this.truncateToolResult(result)
            });
            yield {
              type: 'tool_result',
              id: block.id,
              name: block.name,
              success: result?.success !== false,
              data: result?.data
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${errorMessage}`,
              is_error: true
            });
            yield { type: 'tool_result', id: block.id, name: block.name, success: false, error: errorMessage };
          }
        }

        messages.push({ role: 'user', content: toolResults });

        // Trim if needed before next iteration.
        if (messages.length > this.maxHistoryLength) {
          messages = messages.slice(-this.maxHistoryLength);
        }
      }

      this.chatHistory.set(request.sessionId, messages);
      yield { type: 'done', toolsCalled, iterations: iteration };

      logger.info('Anthropic streaming chat completed', {
        requestId,
        sessionId: request.sessionId,
        iterations: iteration,
        toolsCalled: toolsCalled.length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Anthropic streaming chat failed', { requestId, sessionId: request.sessionId, error: errorMessage });
      yield { type: 'error', message: errorMessage };
    } finally {
      RequestTracker.endRequest(requestId);
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

  private buildSystemMessage(): string {
    return buildIKASSystemPrompt();
  }

  /**
   * Compact + truncate a tool result before it enters chat history.
   * Pretty-printed MCP dumps (list-users with 100 users etc.) are paid for again as input
   * tokens on every subsequent LLM turn, so we cap the per-result size.
   */
  private truncateToolResult(result: any, maxChars = 2000): string {
    const serialized = typeof result === 'string' ? result : JSON.stringify(result);
    if (serialized.length <= maxChars) return serialized;
    return serialized.substring(0, maxChars) + `... [truncated, ${serialized.length} chars total]`;
  }

  /**
   * Convert LLM functions to Anthropic tool format. The last tool gets cache_control,
   * which caches the entire tools array + the preceding system prompt for ~5 minutes.
   */
  private convertToAnthropicTools(functions: LLMFunction[]): Anthropic.Tool[] {
    return functions.map((func, idx) => {
      const tool: any = {
        name: func.name,
        description: func.description,
        input_schema: {
          type: 'object',
          properties: func.parameters.properties || {},
          required: func.parameters.required || []
        }
      };
      if (idx === functions.length - 1) {
        tool.cache_control = { type: 'ephemeral' };
      }
      return tool as Anthropic.Tool;
    });
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