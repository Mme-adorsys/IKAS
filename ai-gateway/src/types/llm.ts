/**
 * Unified LLM Types
 * 
 * This file contains provider-agnostic types and utilities for working
 * with different LLM providers in a consistent way.
 */

import { LLMProvider, LLMFunction, LLMFunctionCall } from '../llm/llm-interface';

/**
 * Standard message format used internally
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  functionCalls?: LLMFunctionCall[];
  functionResults?: LLMFunctionResult[];
  timestamp?: string;
}

/**
 * Function execution result
 */
export interface LLMFunctionResult {
  name: string;
  result: any;
  success: boolean;
  error?: string;
  executionTime?: number;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Conversation context shared across providers
 */
export interface ConversationContext {
  sessionId: string;
  userId?: string;
  realm?: string;
  language?: string;
  metadata?: Record<string, any>;
}

/**
 * Provider-specific error types
 */
export class LLMError extends Error {
  public provider: LLMProvider;
  public code: string;
  public override cause?: Error;

  constructor(
    provider: LLMProvider,
    code: string,
    message: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'LLMError';
    this.provider = provider;
    this.code = code;
    this.cause = cause;
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: LLMProvider, retryAfter?: number) {
    super(provider, 'RATE_LIMIT', `Rate limit exceeded for ${provider}`);
    this.retryAfter = retryAfter;
  }
  retryAfter?: number;
}

export class LLMAuthError extends LLMError {
  constructor(provider: LLMProvider) {
    super(provider, 'AUTH_ERROR', `Authentication failed for ${provider}`);
  }
}

export class LLMUnavailableError extends LLMError {
  constructor(provider: LLMProvider, reason?: string) {
    super(provider, 'UNAVAILABLE', `${provider} service is unavailable${reason ? ': ' + reason : ''}`);
  }
}

/**
 * Function calling mode enum (standardized across providers)
 */
export enum FunctionCallingMode {
  AUTO = 'auto',    // Let the model decide
  FORCED = 'forced', // Force function calling
  NONE = 'none'     // Disable function calling
}

/**
 * Model performance metrics
 */
export interface ModelMetrics {
  provider: LLMProvider;
  model: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageLatency: number;
  averageTokensUsed: number;
  totalCost?: number;
}

/**
 * Utility functions for working with different providers
 */
export class LLMUtils {
  /**
   * Convert function from MCP format to provider-specific format
   */
  static convertFunctionToProvider(
    mcpFunction: any, 
    targetProvider: LLMProvider
  ): any {
    const baseFunction: LLMFunction = {
      name: mcpFunction.name,
      description: mcpFunction.description,
      parameters: {
        type: 'object',
        properties: mcpFunction.inputSchema?.properties || {},
        required: mcpFunction.inputSchema?.required || []
      }
    };

    switch (targetProvider) {
      case LLMProvider.GEMINI:
        return {
          name: baseFunction.name,
          description: baseFunction.description,
          parameters: {
            type: 'object',
            properties: baseFunction.parameters.properties,
            required: baseFunction.parameters.required
          }
        };

      case LLMProvider.ANTHROPIC:
        return {
          name: baseFunction.name,
          description: baseFunction.description,
          input_schema: {
            type: 'object',
            properties: baseFunction.parameters.properties,
            required: baseFunction.parameters.required
          }
        };

      case LLMProvider.OLLAMA:
        return {
          type: 'function',
          function: {
            name: baseFunction.name,
            description: baseFunction.description,
            parameters: baseFunction.parameters
          }
        };

      case LLMProvider.OPENAI:
        return {
          type: 'function',
          function: {
            name: baseFunction.name,
            description: baseFunction.description,
            parameters: baseFunction.parameters
          }
        };

      default:
        return baseFunction;
    }
  }

  /**
   * Extract function calls from provider-specific response format
   */
  static extractFunctionCalls(
    response: any, 
    provider: LLMProvider
  ): LLMFunctionCall[] {
    const functionCalls: LLMFunctionCall[] = [];

    switch (provider) {
      case LLMProvider.GEMINI:
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.functionCall) {
              functionCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args || {}
              });
            }
          }
        }
        break;

      case LLMProvider.ANTHROPIC:
        if (response.content) {
          for (const content of response.content) {
            if (content.type === 'tool_use') {
              functionCalls.push({
                name: content.name,
                args: content.input || {}
              });
            }
          }
        }
        break;

      case LLMProvider.OLLAMA:
      case LLMProvider.OPENAI:
        if (response.choices?.[0]?.message?.tool_calls) {
          for (const toolCall of response.choices[0].message.tool_calls) {
            functionCalls.push({
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments || '{}')
            });
          }
        }
        break;
    }

    return functionCalls;
  }

  /**
   * Get model display name for UI
   */
  static getModelDisplayName(provider: LLMProvider, model: string): string {
    const modelMap: Record<LLMProvider, Record<string, string>> = {
      [LLMProvider.GEMINI]: {
        'gemini-2.5-pro': 'Gemini 2.5 Pro',
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro'
      },
      [LLMProvider.ANTHROPIC]: {
        'claude-3-opus-20240229': 'Claude 3 Opus',
        'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
        'claude-3-haiku-20240307': 'Claude 3 Haiku'
      },
      [LLMProvider.OLLAMA]: {
        'llama3': 'Llama 3',
        'mixtral': 'Mixtral 8x7B',
        'codellama': 'Code Llama',
        'phi': 'Phi-3'
      },
      [LLMProvider.OPENAI]: {
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-4': 'GPT-4',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo'
      }
    };

    return modelMap[provider]?.[model] || model;
  }

  /**
   * Validate provider configuration
   */
  static validateConfig(config: ProviderConfig): boolean {
    switch (config.provider) {
      case LLMProvider.GEMINI:
        return !!config.apiKey;
      case LLMProvider.ANTHROPIC:
        return !!config.apiKey;
      case LLMProvider.OPENAI:
        return !!config.apiKey;
      case LLMProvider.OLLAMA:
        return !!config.baseUrl;
      default:
        return false;
    }
  }
}