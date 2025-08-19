import { GoogleGenerativeAI, GenerativeModel, SchemaType } from '@google/generative-ai';
import { logger } from '../utils/logger';
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
      systemInstruction: `Du bist IKAS (Intelligentes Keycloak Admin System), ein KI-Assistent für Keycloak-Administration.

WICHTIGE EIGENSCHAFTEN:
- Antworte auf Deutsch, außer wenn explizit anders gewünscht
- Du hilfst bei Keycloak-Administration mit natürlicher Sprache
- Du kannst Benutzer verwalten, Analysen durchführen und Compliance prüfen
- Du hast Zugriff auf Keycloak-Daten und Neo4j-Graph-Analyse-Tools

VERFÜGBARE FUNKTIONEN:
- Keycloak MCP: Benutzerverwaltung, Realm-Management, Events, Metriken
- Neo4j MCP: Datenanalyse, Duplicate-Erkennung, Compliance-Berichte

ANTWORT-FORMAT:
- Sei präzise und hilfsreich
- Verwende die verfügbaren Tools für aktuelle Daten
- Erkläre was du tust, bevor du es ausführst
- Gib konkrete Handlungsempfehlungen

Bei Fehlern oder Problemen:
- Erkläre was schiefgelaufen ist
- Biete alternative Lösungen an
- Frage nach bei Unklarheiten`
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
    
    try {
      logger.info('Processing Gemini chat request', {
        sessionId,
        messageLength: message.length,
        toolCount: tools.length,
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
      if (context?.language && context.language !== 'de') {
        contextualMessage = `[Language: ${context.language}] ${contextualMessage}`;
      }

      // Send message and get response
      const result = await chat.sendMessage(contextualMessage);
      const response = await result.response;

      // Parse function calls if any
      const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];
      
      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {}
            });
          }
        }
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

      const responseText = response.text() || 'Entschuldigung, ich konnte keine Antwort generieren.';

      logger.info('Gemini chat response generated', {
        sessionId,
        responseLength: responseText.length,
        functionCallCount: functionCalls.length,
        finishReason: response.candidates?.[0]?.finishReason
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
        response: `Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Anfrage: ${errorMessage}`,
        finishReason: 'ERROR'
      };
    }
  }

  async sendFunctionResponse(sessionId: string, functionName: string, result: any): Promise<void> {
    try {
      const history = this.chatHistory.get(sessionId) || [];
      
      // Add function response to history
      history.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: functionName,
            response: result
          }
        }]
      });

      this.chatHistory.set(sessionId, history);

      logger.debug('Function response sent to Gemini', {
        sessionId,
        functionName,
        resultType: typeof result
      });

    } catch (error) {
      logger.error('Failed to send function response to Gemini', {
        sessionId,
        functionName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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