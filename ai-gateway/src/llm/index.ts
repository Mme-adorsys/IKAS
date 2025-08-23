// Re-export LLM services and interfaces
export { GeminiService } from './gemini-service';
export { OllamaService } from './ollama-service';
export { MCPToolDiscovery } from './tool-discovery';
export { LLMFactory } from './llm-factory';

// Export abstract interface and types
export { LLMService, LLMProvider } from './llm-interface';
export type { 
  LLMFunction,
  LLMFunctionCall,
  LLMChatRequest,
  LLMChatResponse,
  LLMFunctionProcessingResult,
  ProviderCapabilities
} from './llm-interface';

// Legacy Gemini types (for backward compatibility)
export type { 
  GeminiFunction, 
  GeminiMessage, 
  GeminiChatRequest, 
  GeminiChatResponse 
} from './gemini-service';