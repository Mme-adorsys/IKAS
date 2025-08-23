import { GoogleGenerativeAI, GenerativeModel, SchemaType } from '@google/generative-ai';
import { logger, geminiLogger, RequestTracker } from '../utils/logger';
import { config } from '../utils/config';
import { ToolDefinition } from '../types';

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
    candidatesTokens: number;
    totalTokens: number;
  };
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private chatHistory: Map<string, GeminiMessage[]> = new Map();

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    
    // Initialize the model with function calling support
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent responses
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      systemInstruction: `You are IKAS (Intelligent Keycloak Admin System), an AI assistant for Keycloak administration.

IMPORTANT CHARACTERISTICS:
- Respond in English unless explicitly requested otherwise
- Help with Keycloak administration using natural language
- You can manage users, perform analysis, and check compliance
- You have access to Keycloak data and Neo4j graph analysis tools

AVAILABLE FUNCTIONS:
- Keycloak MCP: User management, realm management, events, metrics
- Neo4j MCP: Data analysis, duplicate detection, compliance reports

RESPONSE FORMAT:
- Be precise and helpful
- Use available tools for current data
- Explain what you're doing before executing
- Provide concrete recommendations

For errors or problems:
- Explain what went wrong
- Offer alternative solutions
- Ask for clarification when unclear`
    });

    logger.info('Gemini service initialized', { 
      model: 'gemini-1.5-pro',
      apiConfigured: !!config.GEMINI_API_KEY 
    });
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

  async chat(request: GeminiChatRequest): Promise<GeminiChatResponse> {
    const { message, sessionId, tools, context } = request;
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

      // Get or create chat history for this session
      let history = this.chatHistory.get(sessionId) || [];

      // Create chat session with tools
      const chat = this.model.startChat({
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
        }] : undefined
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

      // Send message and get response
      const result = await chat.sendMessage(contextualMessage);
      const response = await result.response;

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

      // Parse function calls if any
      const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];
      
      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
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
      }

      if (functionCalls.length > 0) {
        geminiLogger.info('⚙️ Gemini function call summary', {
          requestId,
          sessionId,
          totalFunctionCalls: functionCalls.length,
          functions: functionCalls.map(fc => ({ name: fc.name, argKeys: Object.keys(fc.args) }))
        });
      }

      // Update chat history
      history.push(
        { role: 'user', parts: [{ text: contextualMessage }] },
        { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] }
      );
      
      // Keep only last 20 messages to avoid context window issues
      if (history.length > 20) {
        history = history.slice(-20);
      }
      
      this.chatHistory.set(sessionId, history);

      const responseText = response.text() || 'Sorry, I could not generate a response.';
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

      return {
        response: responseText,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          candidatesTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount
        } : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Gemini chat request failed', {
        sessionId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        response: `Sorry, there was an error processing your request: ${errorMessage}`,
        finishReason: 'ERROR'
      };
    }
  }

  async processFunctionCalls(
    sessionId: string, 
    functionCalls: Array<{ name: string; args: Record<string, any> }>,
    functionExecutor: (call: { name: string; args: Record<string, any> }) => Promise<any>
  ): Promise<string> {
    const requestId = RequestTracker.startRequest({ sessionId, type: 'function_processing' });
    
    try {
      geminiLogger.info('🔄 Starting function call processing', {
        requestId,
        sessionId,
        functionCallCount: functionCalls.length,
        functions: functionCalls.map(fc => fc.name)
      });

      const history = this.chatHistory.get(sessionId) || [];
      
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
      const chat = this.model.startChat({
        history: history
      });

      // Send function responses back to the model
      const functionResponseParts = functionResults.map(result => ({
        functionResponse: {
          name: result.name,
          response: result.response
        }
      }));

      geminiLogger.debug('📤 Sending function results back to Gemini', {
        requestId,
        sessionId,
        functionResultCount: functionResults.length,
        functionResults: functionResults.map(fr => ({
          name: fr.name,
          responseSuccess: fr.response?.success,
          responseSize: JSON.stringify(fr.response).length
        }))
      });

      const result = await chat.sendMessage(functionResponseParts);
      const response = await result.response;
      const responseText = response.text();

      geminiLogger.info('🎯 Final Gemini response after function processing', {
        requestId,
        sessionId,
        finalResponse: responseText,
        responseLength: responseText.length,
        finishReason: response.candidates?.[0]?.finishReason
      });

      // Update history with function responses and final model response
      history.push(
        { role: 'model', parts: functionResponseParts },
        { role: 'model', parts: [{ text: responseText }] }
      );

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

      return responseText;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = RequestTracker.endRequest(requestId);
      
      geminiLogger.error('❌ Function call processing failed', {
        requestId,
        sessionId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        functionCallCount: functionCalls.length,
        duration: `${duration}ms`
      });

      return `Sorry, there was an error processing the function calls: ${errorMessage}`;
    }
  }

  clearChatHistory(sessionId: string): void {
    this.chatHistory.delete(sessionId);
    logger.debug('Chat history cleared', { sessionId });
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

    for (const sessionId of this.chatHistory.keys()) {
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