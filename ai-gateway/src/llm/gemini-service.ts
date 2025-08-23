import { GoogleGenerativeAI, GenerativeModel, SchemaType, FunctionCallingMode } from '@google/generative-ai';
import { logger, geminiLogger, RequestTracker } from '../utils/logger';
import { config, getProviderConfig } from '../utils/config';
import { ToolDefinition } from '../types';
import { withRetry, CircuitBreaker, GEMINI_RETRY_CONFIG, GEMINI_CIRCUIT_BREAKER_CONFIG, CircuitBreakerOpenError } from '../utils/retry';
import { LLMService, LLMProvider, LLMChatRequest, LLMChatResponse, LLMFunctionProcessingResult, LLMFunction, LLMFunctionCall } from './llm-interface';
import { LLMUtils, LLMError } from '../types/llm';

export interface GeminiFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: any[];
}

export interface GeminiChatRequest {
  message: string;
  sessionId: string;
  tools: GeminiFunction[];
  context?: {
    realm?: string;
    userId?: string;
    language?: string;
  };
  functionCallingMode?: FunctionCallingMode;
}

export interface GeminiChatResponse {
  response: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class GeminiService extends LLMService {
  readonly provider = LLMProvider.GEMINI;
  readonly model: string;
  
  private genAI: GoogleGenerativeAI;
  private generativeModel: GenerativeModel;
  private chatHistory: Map<string, GeminiMessage[]> = new Map();
  private circuitBreaker: CircuitBreaker;

  constructor() {
    super();
    
    const providerConfig = getProviderConfig();
    if (!providerConfig.apiKey) {
      throw new LLMError(LLMProvider.GEMINI, 'NO_API_KEY', 'Gemini API key is required');
    }
    
    this.model = providerConfig.model;
    this.genAI = new GoogleGenerativeAI(providerConfig.apiKey);
    this.circuitBreaker = new CircuitBreaker(GEMINI_CIRCUIT_BREAKER_CONFIG);

    // Initialize the model with function calling support
    this.generativeModel = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: providerConfig.temperature,
        topK: 40,
        topP: providerConfig.topP,
        maxOutputTokens: providerConfig.maxTokens,
      },
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO // Let Gemini decide when to call functions
        }
      },
      systemInstruction: `You are IKAS, an intelligent assistant for Keycloak and Neo4j system management.

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

IMPORTANT: When writing to Neo4j, always include a complete 'query' parameter with valid Cypher syntax.`
    });

    logger.info('Gemini service initialized', {
      provider: this.provider,
      model: this.model,
      apiConfigured: !!providerConfig.apiKey,
      temperature: providerConfig.temperature,
      maxTokens: providerConfig.maxTokens
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple request to check if the service is available
      const testModel = this.genAI.getGenerativeModel({ model: this.model });
      await testModel.generateContent('test');
      return true;
    } catch (error) {
      geminiLogger.warn('Gemini service availability check failed', {
        provider: this.provider,
        model: this.model,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  convertMcpToolsToGeminiFormat(mcpTools: Record<string, ToolDefinition[]>): GeminiFunction[] {
    const geminiTools: GeminiFunction[] = [];

    Object.entries(mcpTools).forEach(([serverName, tools]) => {
      tools.forEach(tool => {
        // Convert MCP tool definition to Gemini function format
        const geminiFunction: GeminiFunction = {
          name: `${serverName}_${tool.name}`,
          description: `[${serverName.toUpperCase()}] ${tool.description}`,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties || {},
            required: tool.inputSchema.required || []
          }
        };

        geminiTools.push(geminiFunction);
      });
    });

    logger.debug('Converted MCP tools to Gemini format', {
      mcpToolCount: Object.values(mcpTools).flat().length,
      geminiToolCount: geminiTools.length
    });

    return geminiTools;
  }

  private convertToGeminiTools(llmTools: LLMFunction[]): GeminiFunction[] {
    return llmTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    // Convert LLM interface types to Gemini-specific types
    const geminiRequest: GeminiChatRequest = {
      message: request.message,
      sessionId: request.sessionId,
      tools: this.convertToGeminiTools(request.tools || []),
      context: request.context,
      functionCallingMode: FunctionCallingMode.AUTO
    };
    
    return this.chatWithGeminiTypes(geminiRequest);
  }

  async chatWithGeminiTypes(request: GeminiChatRequest): Promise<LLMChatResponse> {
    const { message, sessionId, tools, context, functionCallingMode = FunctionCallingMode.AUTO } = request;
    const requestId = RequestTracker.startRequest({ sessionId, type: 'gemini_chat' });

    try {
      geminiLogger.info('🚀 Starting Gemini chat request', {
        requestId,
        sessionId,
        userMessage: message,
        messageLength: message.length,
        toolCount: tools.length,
        availableTools: tools.map(t => t.name),
        context
      });

      // Get or create chat history for this session and validate it
      let history = this.validateChatHistory(this.chatHistory.get(sessionId) || []);

      // Create chat session with tools
      const chat = this.generativeModel.startChat({
        history: history,
        tools: tools.length > 0 ? [{
          functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: {
              type: SchemaType.OBJECT,
              properties: tool.parameters.properties,
              required: tool.parameters.required
            }
          }))
        }] : undefined,
        toolConfig: {
          functionCallingConfig: {
            mode: functionCallingMode
          }
        }
      });

      // Add context to the message if provided
      let contextualMessage = message;
      if (context?.realm) {
        contextualMessage = `[Realm: ${context.realm}] ${message}`;
      }
      if (context?.language && context.language !== 'en') {
        contextualMessage = `[Language: ${context.language}] ${contextualMessage}`;
      }

      geminiLogger.debug('📤 Sending message to Gemini', {
        requestId,
        sessionId,
        originalMessage: message,
        contextualMessage,
        historyLength: history.length
      });

      // Send message and get response with retry logic
      const result = await withRetry(async () => {
        return await this.circuitBreaker.execute(async () => {
          const chatResult = await chat.sendMessage(contextualMessage);
          return await chatResult.response;
        });
      }, GEMINI_RETRY_CONFIG);
      
      const response = result;
      const responseText = response.text() || '';

      geminiLogger.debug('📥 Raw Gemini response received', {
        requestId,
        sessionId,
        responseText: response.text(),
        candidates: response.candidates?.map(c => ({
          finishReason: c.finishReason,
          partCount: c.content?.parts?.length || 0,
          parts: c.content?.parts?.map(p => ({
            hasText: !!p.text,
            hasFunctionCall: !!p.functionCall,
            functionCall: p.functionCall ? {
              name: p.functionCall.name,
              argsKeys: Object.keys(p.functionCall.args || {})
            } : null
          }))
        })),
        usageMetadata: response.usageMetadata
      });

      // Parse function calls if any with enhanced diagnostics
      const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];

      const candidates = response.candidates;
      
      geminiLogger.debug('🔍 Function call analysis', {
        requestId,
        sessionId,
        candidatesCount: candidates?.length || 0,
        hasFirstCandidate: !!(candidates && candidates[0]),
        hasContent: !!(candidates && candidates[0]?.content),
        partsCount: candidates?.[0]?.content?.parts?.length || 0,
        finishReason: candidates?.[0]?.finishReason,
        toolsProvided: tools.length,
        functionCallingMode
      });
      
      if (candidates && candidates[0]?.content?.parts) {
        const parts = candidates[0].content.parts;
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          
          geminiLogger.debug(`🔍 Part ${i + 1} analysis`, {
            requestId,
            sessionId,
            partIndex: i,
            hasText: !!part.text,
            hasFunctionCall: !!part.functionCall,
            textLength: part.text?.length || 0,
            functionCallName: part.functionCall?.name
          });
          
          if (part.functionCall) {
            const functionCall = {
              name: part.functionCall.name,
              args: part.functionCall.args || {}
            };
            functionCalls.push(functionCall);

            geminiLogger.info('🔧 Gemini decided to call function', {
              requestId,
              sessionId,
              functionName: functionCall.name,
              functionArgs: functionCall.args,
              argCount: Object.keys(functionCall.args).length
            });
          }
        }
      } else {
        geminiLogger.warn('⚠️ No content parts found for function call analysis', {
          requestId,
          sessionId,
          hasCandidates: !!candidates,
          candidatesLength: candidates?.length || 0,
          hasFirstCandidate: !!(candidates && candidates[0]),
          firstCandidateKeys: candidates?.[0] ? Object.keys(candidates[0]) : [],
          toolCount: tools.length
        });
      }

      if (functionCalls.length > 0) {
        geminiLogger.info('⚙️ Gemini function call summary', {
          requestId,
          sessionId,
          totalFunctionCalls: functionCalls.length,
          functions: functionCalls.map(fc => ({ name: fc.name, argKeys: Object.keys(fc.args) }))
        });
      } else {
        geminiLogger.warn('⚠️ No function calls generated despite tools being available', {
          requestId,
          sessionId,
          toolsAvailable: tools.length,
          availableToolNames: tools.map(t => t.name),
          functionCallingMode,
          messageLength: message.length,
          hasResponse: !!responseText,
          finishReason: response.candidates?.[0]?.finishReason
        });
      }

      // Update chat history with validation
      const newUserMessage = { role: 'user' as const, parts: [{ text: contextualMessage }] };
      const modelParts = response.candidates?.[0]?.content?.parts || [];
      const newModelMessage = { role: 'model' as const, parts: modelParts };
      
      history.push(newUserMessage, newModelMessage);

      // Keep only last 20 messages to avoid context window issues
      if (history.length > 20) {
        history = history.slice(-20);
      }

      this.chatHistory.set(sessionId, history);
      
      // Handle empty responses from Gemini
      if (!responseText || responseText.trim().length === 0) {
        geminiLogger.warn('⚠️ Gemini returned empty response', {
          requestId,
          sessionId,
          candidates: response.candidates?.length || 0,
          finishReason: response.candidates?.[0]?.finishReason,
          partCount: response.candidates?.[0]?.content?.parts?.length || 0,
          usageMetadata: response.usageMetadata
        });
        
        // If we have function calls but no text response, that's expected
        if (functionCalls.length > 0) {
          geminiLogger.info('✅ Empty text response is normal - function calls detected', {
            requestId,
            sessionId,
            functionCallCount: functionCalls.length
          });
        } else {
          // No function calls and no text - this is a problem
          geminiLogger.error('❌ Gemini returned neither text nor function calls', {
            requestId,
            sessionId,
            toolCount: tools.length,
            messageLength: message.length,
            functionCallingMode
          });
          
          return {
            response: 'I understand your request, but I\'m having trouble processing it right now. Could you please try rephrasing your question?',
            finishReason: 'EMPTY_RESPONSE'
          };
        }
      }
      const duration = RequestTracker.endRequest(requestId);

      geminiLogger.info('✅ Gemini chat response completed', {
        requestId,
        sessionId,
        responseText,
        responseLength: responseText.length,
        functionCallCount: functionCalls.length,
        finishReason: response.candidates?.[0]?.finishReason,
        duration: `${duration}ms`,
        usageMetadata: response.usageMetadata
      });

      const finalResponseText = responseText || (functionCalls.length > 0 ? '' : 'I understand your request, but I need more specific information to help you.');
      
      return {
        response: finalResponseText,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount
        } : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCircuitBreakerError = error instanceof CircuitBreakerOpenError;

      geminiLogger.error('❌ Gemini chat request failed', {
        requestId,
        sessionId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        circuitBreakerOpen: isCircuitBreakerError,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      // Clear problematic chat history on repeated failures
      if (isCircuitBreakerError) {
        this.clearChatHistory(sessionId);
        geminiLogger.info('🧹 Cleared chat history due to circuit breaker', { sessionId });
      }

      const fallbackMessage = isCircuitBreakerError 
        ? 'The AI service is temporarily unavailable. Please try again in a moment.'
        : `Sorry, there was an error processing your request: ${errorMessage}`;

      return {
        response: fallbackMessage,
        finishReason: 'ERROR'
      };
    }
  }

  async processFunctionCalls(
    sessionId: string,
    functionCalls: LLMFunctionCall[],
    functionExecutor: (call: LLMFunctionCall) => Promise<any>,
    tools: LLMFunction[]
  ): Promise<LLMFunctionProcessingResult> {
    // Convert to Gemini types for internal processing
    const geminiTools: GeminiFunction[] = this.convertToGeminiTools(tools);
    const geminiCalls = functionCalls.map(call => ({ name: call.name, args: call.args }));
    
    return this.processFunctionCallsWithGeminiTypes(
      sessionId, 
      geminiCalls, 
      functionExecutor as any, 
      geminiTools
    );
  }

  async processFunctionCallsWithGeminiTypes(
    sessionId: string,
    functionCalls: Array<{ name: string; args: Record<string, any> }>,
    functionExecutor: (call: { name: string; args: Record<string, any> }) => Promise<any>,
    tools: GeminiFunction[],
    functionCallingMode: FunctionCallingMode = FunctionCallingMode.AUTO
  ): Promise<LLMFunctionProcessingResult> {
    const requestId = RequestTracker.startRequest({ sessionId, type: 'function_processing' });

    try {
      geminiLogger.info('🔄 Starting function call processing', {
        requestId,
        sessionId,
        functionCallCount: functionCalls.length,
        functions: functionCalls.map(fc => fc.name)
      });

      const history = this.validateChatHistory(this.chatHistory.get(sessionId) || []);

      // Get the last model response which should contain the function calls
      const lastModelMessage = history[history.length - 1];
      if (!lastModelMessage || lastModelMessage.role !== 'model') {
        throw new Error('No model message found for function calls');
      }

      // Execute function calls and collect results
      const functionResults: Array<{ name: string; response: any }> = [];

      for (const functionCall of functionCalls) {
        geminiLogger.info('🛠️ Executing function call', {
          requestId,
          sessionId,
          functionName: functionCall.name,
          args: functionCall.args
        });

        const startTime = Date.now();
        const result = await functionExecutor(functionCall);
        const executionTime = Date.now() - startTime;

        geminiLogger.debug('📊 Function call result', {
          requestId,
          sessionId,
          functionName: functionCall.name,
          executionTime: `${executionTime}ms`,
          resultSuccess: result?.success,
          resultType: typeof result,
          resultKeys: result && typeof result === 'object' ? Object.keys(result) : [],
          dataSize: result?.data ? (Array.isArray(result.data) ? result.data.length : Object.keys(result.data).length) : 0
        });

        functionResults.push({
          name: functionCall.name,
          response: result
        });
      }

      // Create a new chat session with the updated history including function responses
      const chat = this.generativeModel.startChat({
        history: history,
        tools: tools.length > 0 ? [{
          functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: {
              type: SchemaType.OBJECT,
              properties: tool.parameters.properties,
              required: tool.parameters.required
            }
          }))
        }] : undefined,
        toolConfig: {
          functionCallingConfig: {
            mode: functionCallingMode
          }
        }
      });

      // Validate and sanitize function responses before sending
      const functionResponseParts = functionResults.map(result => {
        let sanitizedResponse = result.response;
        
        // Ensure response is serializable
        try {
          JSON.stringify(sanitizedResponse);
        } catch (jsonError) {
          geminiLogger.warn('⚠️ Function response not serializable, converting to string', {
            requestId,
            sessionId,
            functionName: result.name,
            jsonError: jsonError instanceof Error ? jsonError.message : String(jsonError)
          });
          sanitizedResponse = { 
            success: false, 
            error: 'Response not serializable', 
            originalType: typeof result.response 
          };
        }
        
        // Ensure response has required structure
        if (typeof sanitizedResponse !== 'object' || sanitizedResponse === null) {
          sanitizedResponse = { result: sanitizedResponse };
        }
        
        return {
          functionResponse: {
            name: result.name,
            response: sanitizedResponse
          }
        };
      });

      geminiLogger.debug('📤 Sending function results back to Gemini', {
        requestId,
        sessionId,
        functionResultCount: functionResults.length,
        functionResults: functionResults.map(fr => ({
          name: fr.name,
          responseSuccess: fr.response?.success,
          responseSize: JSON.stringify(fr.response || {}).length
        }))
      });

      // Send ONLY function responses first, as per Gemini documentation
      // Do not mix function responses with text messages
      const result = await withRetry(async () => {
        return await this.circuitBreaker.execute(async () => {
          const chatResult = await chat.sendMessage(functionResponseParts);
          return await chatResult.response;
        });
      }, GEMINI_RETRY_CONFIG);
      
      const response = result;
      const responseText = response.text();

      // Check if Gemini wants to call more functions
      const additionalFunctionCalls: Array<{ name: string; args: Record<string, any> }> = [];
      const candidates = response.candidates;
      
      geminiLogger.debug('🔍 Analyzing Gemini response for additional function calls', {
        requestId,
        sessionId,
        candidatesCount: candidates?.length || 0,
        partsCount: candidates?.[0]?.content?.parts?.length || 0,
        finishReason: candidates?.[0]?.finishReason,
        parts: candidates?.[0]?.content?.parts?.map(part => ({
          hasText: !!part.text,
          textLength: part.text?.length || 0,
          hasFunctionCall: !!part.functionCall,
          functionName: part.functionCall?.name
        }))
      });
      
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.functionCall) {
            const functionCall = {
              name: part.functionCall.name,
              args: part.functionCall.args || {}
            };
            additionalFunctionCalls.push(functionCall);

            geminiLogger.info('🔧 Gemini wants to call another function', {
              requestId,
              sessionId,
              functionName: functionCall.name,
              functionArgs: functionCall.args
            });
          }
        }
      }

      geminiLogger.info('🎯 Gemini response after function processing', {
        requestId,
        sessionId,
        finalResponse: responseText,
        responseLength: responseText.length,
        finishReason: response.candidates?.[0]?.finishReason,
        additionalFunctionCalls: additionalFunctionCalls.length
      });

      // Update history with function responses and final model response
      const functionMessage = { role: 'user' as const, parts: functionResponseParts };
      const finalModelParts = response.candidates?.[0]?.content?.parts || [];
      const finalModelMessage = { role: 'model' as const, parts: finalModelParts };
      
      history.push(functionMessage, finalModelMessage);

      // Keep only last 20 messages to avoid context window issues
      if (history.length > 20) {
        const trimmedHistory = history.slice(-20);
        this.chatHistory.set(sessionId, trimmedHistory);
      } else {
        this.chatHistory.set(sessionId, history);
      }

      const duration = RequestTracker.endRequest(requestId);

      geminiLogger.info('✅ Function call processing completed', {
        requestId,
        sessionId,
        duration: `${duration}ms`,
        finalResponseLength: responseText.length
      });

      return {
        response: responseText,
        additionalFunctionCalls: additionalFunctionCalls.length > 0 ? 
          additionalFunctionCalls.map(call => ({ name: call.name, args: call.args })) : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = RequestTracker.endRequest(requestId);
      const isCircuitBreakerError = error instanceof CircuitBreakerOpenError;

      geminiLogger.error('❌ Function call processing failed', {
        requestId,
        sessionId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        functionCallCount: functionCalls.length,
        duration: `${duration}ms`,
        circuitBreakerOpen: isCircuitBreakerError,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      // Clear history and provide degraded response on circuit breaker failures
      if (isCircuitBreakerError) {
        this.clearChatHistory(sessionId);
        geminiLogger.info('🧹 Cleared chat history due to function processing circuit breaker failure', { sessionId });
        
        return {
          response: 'The AI service is temporarily unavailable. The requested functions were executed, but I cannot provide a detailed response right now.',
          additionalFunctionCalls: undefined
        };
      }

      // For other errors, try to provide a helpful response based on function results
      const executedFunctions = functionCalls.map(fc => fc.name).join(', ');
      return {
        response: `I executed the following functions: ${executedFunctions}. However, there was an error processing the results: ${errorMessage}`,
        additionalFunctionCalls: undefined
      };
    }
  }

  clearChatHistory(sessionId: string): void {
    this.chatHistory.delete(sessionId);
    geminiLogger.info('🧹 Chat history cleared', { sessionId });
  }

  
  private validateChatHistory(history: GeminiMessage[]): GeminiMessage[] {
    if (!Array.isArray(history)) {
      return [];
    }
    
    return history.filter((message, index) => {
      // Validate message structure
      if (!message || typeof message !== 'object') {
        geminiLogger.warn('⚠️ Invalid message in chat history', { index, messageType: typeof message });
        return false;
      }
      
      // Validate role
      if (!message.role || !['user', 'model'].includes(message.role)) {
        geminiLogger.warn('⚠️ Invalid role in chat history', { index, role: message.role });
        return false;
      }
      
      // Validate parts
      if (!Array.isArray(message.parts)) {
        geminiLogger.warn('⚠️ Invalid parts in chat history', { index, parts: typeof message.parts });
        return false;
      }
      
      // Validate each part
      message.parts = message.parts.filter((part, partIndex) => {
        if (!part || typeof part !== 'object') {
          geminiLogger.warn('⚠️ Invalid part in chat history', { index, partIndex, partType: typeof part });
          return false;
        }
        
        // Allow text parts, function calls, and function responses
        const hasValidContent = part.text || part.functionCall || part.functionResponse;
        if (!hasValidContent) {
          geminiLogger.warn('⚠️ Part has no valid content', { index, partIndex, partKeys: Object.keys(part) });
          return false;
        }
        
        return true;
      });
      
      // Keep message only if it has valid parts
      return message.parts.length > 0;
    });
  }
  
  private sanitizeForGemini(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }
    
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForGemini(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip functions and undefined values
        if (typeof value === 'function' || value === undefined) {
          continue;
        }
        
        // Convert symbols to strings
        if (typeof value === 'symbol') {
          sanitized[key] = value.toString();
          continue;
        }
        
        try {
          sanitized[key] = this.sanitizeForGemini(value);
        } catch (error) {
          // Skip values that can't be sanitized
          geminiLogger.warn('⚠️ Could not sanitize object property', {
            key,
            valueType: typeof value,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      return sanitized;
    }
    
    // For other types, convert to string
    return String(data);
  }

  getChatHistorySize(sessionId: string): number {
    return this.chatHistory.get(sessionId)?.length || 0;
  }

  // Method to get all active sessions
  getActiveSessions(): string[] {
    return Array.from(this.chatHistory.keys());
  }

  // Cleanup old sessions (older than 1 hour)
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
        sessionsRemoved: cleaned,
        remainingSessions: this.chatHistory.size
      });
    }
  }

}
