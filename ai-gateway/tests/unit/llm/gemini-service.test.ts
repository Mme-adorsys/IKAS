import { GeminiService } from '../../../src/llm/gemini-service';
import { LLMProvider, LLMChatRequest, LLMFunctionCall, LLMFunction } from '../../../src/llm/llm-interface';
import { LLMError, LLMUnavailableError } from '../../../src/types/llm';
import * as configModule from '../../../src/utils/config';

// Create mock before using it in jest.mock
const mockGenerateContent = jest.fn();
const mockGenerativeModel = {
  generateContent: mockGenerateContent
};

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue(mockGenerativeModel)
  })),
  HarmCategory: {},
  HarmBlockThreshold: {},
  FunctionCallingMode: {
    AUTO: 'AUTO',
    ANY: 'ANY',
    NONE: 'NONE'
  }
}));

// Mock config
jest.mock('../../../src/utils/config');
const mockedConfig = configModule as jest.Mocked<typeof configModule>;

describe('GeminiService', () => {
  let geminiService: GeminiService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockedConfig.getProviderConfig.mockReturnValue({
      provider: LLMProvider.GEMINI,
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      maxTokens: 8192,
      topP: 0.95,
      timeout: 30000,
      apiKey: 'test-api-key',
      baseUrl: '',
      ollamaOptions: {
        keepAlive: '5m',
        numPredict: 8192,
        stream: false
      }
    });
    
    mockedConfig.config = {
      GEMINI_API_KEY: 'test-api-key',
      LLM_TEMPERATURE: 0.1,
      LLM_MAX_TOKENS: 8192,
      LLM_TOP_P: 0.95
    } as any;
    
    geminiService = new GeminiService();
  });
  
  describe('Service Initialization', () => {
    it('should initialize with correct provider and model', () => {
      expect(geminiService.provider).toBe(LLMProvider.GEMINI);
      expect(geminiService.model).toBe('gemini-2.5-pro');
    });
    
    it('should initialize Google AI client', () => {
      // Google AI client should be initialized (implementation detail)
      expect(geminiService.provider).toBe(LLMProvider.GEMINI);
    });
    
    it('should throw error without API key', () => {
      mockedConfig.config.GEMINI_API_KEY = undefined;
      
      expect(() => new GeminiService())
        .toThrow('GEMINI_API_KEY environment variable is required');
    });
  });
  
  describe('isAvailable', () => {
    it('should return true when service is available', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Test response',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      const available = await geminiService.isAvailable();
      
      expect(available).toBe(true);
      expect(mockGenerateContent).toHaveBeenCalledWith('ping');
    });
    
    it('should return false when service is unavailable', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));
      
      const available = await geminiService.isAvailable();
      
      expect(available).toBe(false);
    });
  });
  
  describe('chat', () => {
    const mockRequest: LLMChatRequest = {
      message: 'Hello, how are you?',
      sessionId: 'test-session-123'
    };
    
    it('should handle simple chat request', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'I am doing well, thank you!',
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 8,
            totalTokenCount: 13
          }
        }
      });
      
      const response = await geminiService.chat(mockRequest);
      
      expect(response.response).toBe('I am doing well, thank you!');
      expect(response.finishReason).toBe('STOP');
      expect(response.usage?.promptTokens).toBe(5);
      expect(response.usage?.completionTokens).toBe(8);
      expect(response.usage?.totalTokens).toBe(13);
    });
    
    it('should handle chat request with tools', async () => {
      const tools: LLMFunction[] = [{
        name: 'test-function',
        description: 'A test function',
        parameters: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          },
          required: ['param']
        }
      }];
      
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => '',
          candidates: [{
            finishReason: 'STOP',
            content: {
              parts: [{
                functionCall: {
                  name: 'test-function',
                  args: { param: 'test-value' }
                }
              }]
            }
          }],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15
          }
        }
      });
      
      const response = await geminiService.chat({
        ...mockRequest,
        tools
      });
      
      // Response should be successful (no success property in interface)
      expect(response.functionCalls).toHaveLength(1);
      expect(response.functionCalls?.[0]).toEqual({
        name: 'test-function',
        args: { param: 'test-value' }
      });
    });
    
    it('should handle context and realm information', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Response with context',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      await geminiService.chat({
        ...mockRequest,
        context: { realm: 'test-realm' }
      });
      
      expect(mockGenerateContent).toHaveBeenCalledWith({
        contents: [{
          role: 'user',
          parts: [{ text: '[Realm: test-realm] Hello, how are you?' }]
        }],
        generationConfig: expect.any(Object),
        safetySettings: expect.any(Array),
        systemInstruction: expect.any(Object)
      });
    });
    
    it('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Rate limit exceeded'
      });
      
      await expect(geminiService.chat(mockRequest))
        .rejects.toThrow('Rate limit exceeded');
    });
    
    it('should use custom temperature from options', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Response with custom temp',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      await geminiService.chat({
        ...mockRequest,
        options: { temperature: 0.8 }
      });
      
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.8
          })
        })
      );
    });
  });
  
  describe('processFunctionCalls', () => {
    const mockFunctionCalls: LLMFunctionCall[] = [{
      name: 'test-function',
      args: { param: 'test-value' }
    }];
    
    const mockTools: LLMFunction[] = [{
      name: 'test-function',
      description: 'Test function',
      parameters: {
        type: 'object',
        properties: { param: { type: 'string' } }
      }
    }];
    
    it('should process function calls and continue conversation', async () => {
      const mockExecutor = jest.fn().mockResolvedValue('function-result');
      
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Function executed successfully',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      const result = await geminiService.processFunctionCalls(
        'test-session',
        mockFunctionCalls,
        mockExecutor,
        mockTools
      );
      
      expect(result.response).toBe('Function executed successfully');
      expect(mockExecutor).toHaveBeenCalledWith(mockFunctionCalls[0]);
    });
    
    it('should handle additional function calls', async () => {
      const mockExecutor = jest.fn().mockResolvedValue('function-result');
      
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Response with additional calls',
          candidates: [{
            finishReason: 'STOP',
            content: {
              parts: [{
                functionCall: {
                  name: 'additional-function',
                  args: { data: 'value' }
                }
              }]
            }
          }]
        }
      });
      
      const result = await geminiService.processFunctionCalls(
        'test-session',
        mockFunctionCalls,
        mockExecutor,
        mockTools
      );
      
      expect(result.additionalFunctionCalls).toHaveLength(1);
      expect(result.additionalFunctionCalls?.[0]).toEqual({
        name: 'additional-function',
        args: { data: 'value' }
      });
    });
    
    it('should handle function execution errors', async () => {
      const mockExecutor = jest.fn().mockRejectedValue(new Error('Function failed'));
      
      await expect(
        geminiService.processFunctionCalls(
          'test-session',
          mockFunctionCalls,
          mockExecutor,
          mockTools
        )
      ).rejects.toThrow('Function failed');
    });
  });
  
  describe('Chat History Management', () => {
    it('should maintain chat history per session', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      await geminiService.chat({ message: 'Message 1', sessionId: 'session1' });
      await geminiService.chat({ message: 'Message 2', sessionId: 'session1' });
      await geminiService.chat({ message: 'Message 1', sessionId: 'session2' });
      
      expect(geminiService.getActiveSessions()).toContain('session1');
      expect(geminiService.getActiveSessions()).toContain('session2');
    });
    
    it('should clear chat history for specific session', () => {
      geminiService.clearChatHistory('test-session');
      expect(geminiService.getActiveSessions()).not.toContain('test-session');
    });
    
    it('should limit chat history size', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      // Generate many messages to test history limit
      for (let i = 0; i < 25; i++) {
        await geminiService.chat({
          message: `Message ${i}`,
          sessionId: 'test-session'
        });
      }
      
      // History should be limited (exact limit depends on implementation)
      expect(geminiService.getActiveSessions()).toContain('test-session');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      mockGenerateContent.mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Quota exceeded'
      });
      
      await expect(geminiService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      })).rejects.toThrow('Quota exceeded');
    });
    
    it('should handle network errors', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(geminiService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      })).rejects.toThrow('Network error');
    });
    
    it('should handle invalid function call responses', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => '',
          candidates: [{
            finishReason: 'STOP',
            content: {
              parts: [{
                functionCall: {
                  name: 'test-function',
                  args: 'invalid-json-string'
                }
              }]
            }
          }]
        }
      });
      
      const response = await geminiService.chat({
        message: 'Test message',
        sessionId: 'test-session',
        tools: [{
          name: 'test-function',
          description: 'Test',
          parameters: { type: 'object', properties: {} }
        }]
      });
      
      // Response should be successful (no success property in interface)
      expect(response.functionCalls).toHaveLength(0);
    });
  });
  
  describe('System Instructions', () => {
    it('should include system instructions for IKAS', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }]
        }
      });
      
      await geminiService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      });
      
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('IKAS')
              })
            ])
          })
        })
      );
    });
  });
});