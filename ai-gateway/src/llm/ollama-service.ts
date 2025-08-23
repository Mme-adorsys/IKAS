/**
 * Ollama Service
 * 
 * Implementation of LLMService for Ollama local models.
 * Supports popular open-source models like Llama 3, Mixtral, CodeLlama, etc.
 * Provides local execution without API costs or external dependencies.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { LLMService, LLMProvider, LLMChatRequest, LLMChatResponse, LLMFunctionProcessingResult, LLMFunction, LLMFunctionCall } from './llm-interface';
import { LLMError, LLMUnavailableError, LLMUtils } from '../types/llm';
import { config, getProviderConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { RequestTracker } from '../utils/logger';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface OllamaGenerateRequest {
  model: string;
  prompt?: string;
  messages?: OllamaMessage[];
  tools?: OllamaTool[];
  stream?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
    stop?: string[];
    keep_alive?: string;
  };
}

interface OllamaResponse {
  model: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaService extends LLMService {
  readonly provider = LLMProvider.OLLAMA;
  readonly model: string;
  
  private client: AxiosInstance;
  private chatHistory: Map<string, OllamaMessage[]> = new Map();
  private baseURL: string;

  constructor() {
    super();
    
    const providerConfig = getProviderConfig();
    this.model = providerConfig.model;
    this.baseURL = providerConfig.baseUrl || config.OLLAMA_BASE_URL;
    
    // Create axios client for Ollama API
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: providerConfig.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Ollama service initialized', {
      provider: this.provider,
      model: this.model,
      baseURL: this.baseURL,
      temperature: providerConfig.temperature,
      maxTokens: providerConfig.maxTokens
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama server is running
      const response = await this.client.get('/api/tags', { timeout: 5000 });
      
      // Check if our model is available
      const models = response.data.models || [];
      const modelExists = models.some((m: any) => m.name.includes(this.model));
      
      if (!modelExists) {
        logger.info(`Model ${this.model} not found locally, attempting to pull...`, {
          provider: this.provider,
          model: this.model,
          availableModels: models.map((m: any) => m.name)
        });
        
        // Try to pull the model
        await this.pullModel(this.model);
      }
      
      return true;
    } catch (error) {
      logger.warn('Ollama service availability check failed', {
        provider: this.provider,
        model: this.model,
        baseURL: this.baseURL,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const requestId = RequestTracker.startRequest({ 
      sessionId: request.sessionId, 
      type: 'ollama_chat' 
    });

    try {
      logger.info('🚀 Starting Ollama chat request', {
        requestId,
        sessionId: request.sessionId,
        userMessage: request.message,
        messageLength: request.message.length,
        toolCount: request.tools?.length || 0,
        model: this.model
      });

      // Get or create chat history
      let history = this.chatHistory.get(request.sessionId) || [];

      // Add system instruction if this is the start of conversation
      if (history.length === 0) {
        history.push({
          role: 'system',
          content: this.buildSystemInstruction()
        });
      }

      // Add user message
      let userContent = request.message;
      if (request.context?.realm) {
        userContent = `[Realm: ${request.context.realm}] ${request.message}`;
      }

      history.push({
        role: 'user',
        content: userContent
      });

      // Prepare tools for Ollama
      const tools: OllamaTool[] = this.convertToOllamaTools(request.tools || []);

      // Make request to Ollama
      const ollamaRequest: OllamaGenerateRequest = {
        model: this.model,
        messages: history,
        tools: tools.length > 0 ? tools : undefined,
        stream: false,
        options: {
          temperature: request.options?.temperature || config.LLM_TEMPERATURE,
          top_p: request.options?.topP || config.LLM_TOP_P,
          num_predict: request.options?.maxTokens || config.OLLAMA_NUM_PREDICT,
          keep_alive: config.OLLAMA_KEEP_ALIVE
        }
      };

      const response: AxiosResponse<OllamaResponse> = await this.client.post('/api/chat', ollamaRequest);
      const ollamaResponse = response.data;

      if (!ollamaResponse.message) {
        throw new LLMError(this.provider, 'NO_RESPONSE', 'Ollama returned no message');
      }

      // Extract response text
      const responseText = ollamaResponse.message.content || '';

      // Extract function calls
      const functionCalls: LLMFunctionCall[] = [];
      if (ollamaResponse.message.tool_calls) {
        for (const toolCall of ollamaResponse.message.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            functionCalls.push({
              name: toolCall.function.name,
              args
            });
          } catch (parseError) {
            logger.warn('Failed to parse Ollama tool call arguments', {
              requestId,
              toolCall: toolCall.function.name,
              arguments: toolCall.function.arguments,
              error: parseError instanceof Error ? parseError.message : String(parseError)
            });
          }
        }
      }

      // Add assistant message to history
      history.push({
        role: 'assistant',
        content: responseText
      });

      // Update chat history (keep only last 20 messages)
      if (history.length > 20) {
        history = history.slice(-20);
      }
      this.chatHistory.set(request.sessionId, history);

      const duration = RequestTracker.endRequest(requestId);

      logger.info('✅ Ollama chat completed', {
        requestId,
        sessionId: request.sessionId,
        responseLength: responseText.length,
        functionCallCount: functionCalls.length,
        duration: `${duration}ms`,
        model: this.model
      });

      // Map usage information if available
      const usage = ollamaResponse.prompt_eval_count || ollamaResponse.eval_count ? {
        promptTokens: ollamaResponse.prompt_eval_count || 0,
        completionTokens: ollamaResponse.eval_count || 0,
        totalTokens: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0)
      } : undefined;

      return {
        response: responseText,
        functionCalls,
        finishReason: ollamaResponse.done ? 'stop' : 'length',
        usage
      };

    } catch (error) {
      const duration = RequestTracker.endRequest(requestId);
      
      logger.error('❌ Ollama chat failed', {
        requestId,
        sessionId: request.sessionId,
        model: this.model,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new LLMUnavailableError(this.provider, 'Ollama server is not running');
        } else if (error.response?.status === 404) {
          throw new LLMError(this.provider, 'MODEL_NOT_FOUND', `Model ${this.model} not found`);
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
    functionCalls: LLMFunctionCall[],
    functionExecutor: (call: LLMFunctionCall) => Promise<any>,
    tools: LLMFunction[]
  ): Promise<LLMFunctionProcessingResult> {
    const requestId = RequestTracker.startRequest({ 
      sessionId, 
      type: 'ollama_function_processing' 
    });

    try {
      logger.info('🔄 Starting Ollama function call processing', {
        requestId,
        sessionId,
        functionCallCount: functionCalls.length,
        functions: functionCalls.map(fc => fc.name)
      });

      // Execute function calls
      const functionResults: Array<{ name: string; result: any }> = [];
      
      for (const functionCall of functionCalls) {
        const result = await functionExecutor(functionCall);
        functionResults.push({
          name: functionCall.name,
          result
        });
      }

      // Get current chat history
      const history = this.chatHistory.get(sessionId) || [];

      // Add function results as user messages (Ollama format)
      for (const { name, result } of functionResults) {
        history.push({
          role: 'user',
          content: `Function ${name} result: ${JSON.stringify(result, null, 2)}`
        });
      }

      // Ask Ollama to continue the conversation
      const continueRequest: OllamaGenerateRequest = {
        model: this.model,
        messages: history,
        tools: this.convertToOllamaTools(tools),
        stream: false,
        options: {
          temperature: config.LLM_TEMPERATURE,
          top_p: config.LLM_TOP_P,
          num_predict: config.OLLAMA_NUM_PREDICT,
          keep_alive: config.OLLAMA_KEEP_ALIVE
        }
      };

      const response: AxiosResponse<OllamaResponse> = await this.client.post('/api/chat', continueRequest);
      const ollamaResponse = response.data;

      const responseText = ollamaResponse.message?.content || '';

      // Check for additional function calls
      const additionalFunctionCalls: LLMFunctionCall[] = [];
      if (ollamaResponse.message?.tool_calls) {
        for (const toolCall of ollamaResponse.message.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            additionalFunctionCalls.push({
              name: toolCall.function.name,
              args
            });
          } catch (parseError) {
            logger.warn('Failed to parse additional function call', {
              requestId,
              functionName: toolCall.function.name
            });
          }
        }
      }

      // Update history
      if (ollamaResponse.message) {
        history.push({
          role: 'assistant',
          content: responseText
        });
      }

      // Keep history manageable
      if (history.length > 20) {
        this.chatHistory.set(sessionId, history.slice(-20));
      } else {
        this.chatHistory.set(sessionId, history);
      }

      const duration = RequestTracker.endRequest(requestId);

      logger.info('✅ Ollama function call processing completed', {
        requestId,
        sessionId,
        responseLength: responseText.length,
        additionalFunctionCalls: additionalFunctionCalls.length,
        duration: `${duration}ms`
      });

      return {
        response: responseText,
        additionalFunctionCalls: additionalFunctionCalls.length > 0 ? additionalFunctionCalls : undefined
      };

    } catch (error) {
      const duration = RequestTracker.endRequest(requestId);
      
      logger.error('❌ Ollama function processing failed', {
        requestId,
        sessionId,
        duration: `${duration}ms`,
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
    logger.debug('Ollama chat history cleared', { sessionId });
  }

  getActiveSessions(): string[] {
    return Array.from(this.chatHistory.keys());
  }

  private convertToOllamaTools(llmTools: LLMFunction[]): OllamaTool[] {
    return llmTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  private buildSystemInstruction(): string {
    return `You are IKAS, an intelligent assistant for Keycloak and Neo4j system management.

FUNCTION CALLING BEHAVIOR:
- Call functions to complete user requests
- For multi-step operations, call functions sequentially as needed
- Examine each function result to determine if additional functions are required
- Complete all necessary steps to fully satisfy the user's request

COMMON WORKFLOWS:

1. DATA SYNCHRONIZATION ("write users to database", "sync to Neo4j"):
   Step 1: Call keycloak function to get user data (e.g., list-users)
   Step 2: Call neo4j_get_neo4j_schema to understand the database structure
   Step 3: Call neo4j_write_neo4j_cypher with proper Cypher query to store the data

2. USER QUERIES ("show users", "list users"):
   - Call appropriate keycloak function directly

3. ANALYSIS TASKS ("analyze patterns", "find duplicates"):  
   - Call neo4j functions for data analysis
   - May require sync first if data is stale

AVAILABLE FUNCTIONS:
Keycloak: create-user, list-users, delete-user, get-user, list-realms, list-admin-events, get-event-details, get-metrics
Neo4j: get_neo4j_schema, read_neo4j_cypher, write_neo4j_cypher

IMPORTANT: When writing to Neo4j, always include a complete 'query' parameter with valid Cypher syntax.`;
  }

  private async pullModel(modelName: string): Promise<void> {
    try {
      logger.info(`Pulling Ollama model: ${modelName}`, {
        provider: this.provider,
        model: modelName
      });

      // Pull the model - this is a streaming endpoint but we'll use it synchronously
      await this.client.post('/api/pull', {
        name: modelName,
        stream: false
      }, {
        timeout: 300000 // 5 minutes for model download
      });

      logger.info(`Successfully pulled Ollama model: ${modelName}`, {
        provider: this.provider,
        model: modelName
      });

    } catch (error) {
      logger.error(`Failed to pull Ollama model: ${modelName}`, {
        provider: this.provider,
        model: modelName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new LLMUnavailableError(this.provider, `Failed to pull model ${modelName}`);
    }
  }
}