/**
 * Abstract LLM Service Interface
 * 
 * This interface defines the contract that all LLM providers must implement.
 * It provides a unified API for chat, function calling, and session management
 * across different LLM providers (Gemini, Ollama, Anthropic, etc.).
 */

export enum LLMProvider {
  GEMINI = 'gemini',
  OLLAMA = 'ollama',
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai'
}

export interface LLMFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LLMFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface LLMChatRequest {
  message: string;
  sessionId: string;
  tools?: LLMFunction[];
  context?: {
    realm?: string;
    userId?: string;
    language?: string;
  };
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
  };
}

export interface LLMChatResponse {
  response: string;
  functionCalls?: LLMFunctionCall[];
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMFunctionProcessingResult {
  response: string;
  additionalFunctionCalls?: LLMFunctionCall[];
}

/**
 * Abstract base class for all LLM service implementations
 */
export abstract class LLMService {
  abstract readonly provider: LLMProvider;
  abstract readonly model: string;

  /**
   * Send a chat message and get a response, potentially with function calls
   */
  abstract chat(request: LLMChatRequest): Promise<LLMChatResponse>;

  /**
   * Process function call results and continue the conversation
   */
  abstract processFunctionCalls(
    sessionId: string,
    functionCalls: LLMFunctionCall[],
    functionExecutor: (call: LLMFunctionCall) => Promise<any>,
    tools: LLMFunction[]
  ): Promise<LLMFunctionProcessingResult>;

  /**
   * Clear chat history for a session
   */
  abstract clearChatHistory(sessionId: string): void;

  /**
   * Check if the LLM service is available and ready
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get active session IDs for monitoring and management
   */
  abstract getActiveSessions(): string[];

  /**
   * Get provider-specific information
   */
  getProviderInfo(): { provider: LLMProvider; model: string } {
    return {
      provider: this.provider,
      model: this.model
    };
  }
}

/**
 * Factory function type for creating LLM services
 */
export type LLMServiceFactory = () => LLMService;

/**
 * Provider capabilities matrix
 */
export interface ProviderCapabilities {
  functionCalling: boolean;
  streaming: boolean;
  maxTokens: number;
  supportedLanguages: string[];
  costPerToken?: number;
  isLocal: boolean;
}

export const PROVIDER_CAPABILITIES: Record<LLMProvider, ProviderCapabilities> = {
  [LLMProvider.GEMINI]: {
    functionCalling: true,
    streaming: true,
    maxTokens: 8192,
    supportedLanguages: ['en', 'de', 'fr', 'es', 'ja'],
    costPerToken: 0.000001, // Approximate
    isLocal: false
  },
  [LLMProvider.OLLAMA]: {
    functionCalling: true,
    streaming: true,
    maxTokens: 8192, // Model dependent
    supportedLanguages: ['en', 'de', 'fr', 'es'], // Model dependent
    isLocal: true
  },
  [LLMProvider.ANTHROPIC]: {
    functionCalling: true,
    streaming: true,
    maxTokens: 200000, // Claude 3
    supportedLanguages: ['en', 'de', 'fr', 'es', 'ja'],
    costPerToken: 0.000015, // Approximate for Claude 3
    isLocal: false
  },
  [LLMProvider.OPENAI]: {
    functionCalling: true,
    streaming: true,
    maxTokens: 8192, // GPT-4
    supportedLanguages: ['en', 'de', 'fr', 'es', 'ja'],
    costPerToken: 0.00003, // Approximate for GPT-4
    isLocal: false
  }
};