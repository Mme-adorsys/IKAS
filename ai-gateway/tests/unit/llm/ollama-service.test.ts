import { OllamaService } from '../../../src/llm/ollama-service';
import { LLMProvider, LLMChatRequest, LLMFunctionCall, LLMFunction } from '../../../src/llm/llm-interface';
import { LLMError, LLMUnavailableError } from '../../../src/types/llm';
import axios from 'axios';
import * as configModule from '../../../src/utils/config';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../../../src/utils/config');
const mockedConfig = configModule as jest.Mocked<typeof configModule>;

describe('OllamaService', () => {
  let ollamaService: OllamaService;
  let mockAxiosInstance: jest.Mocked<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Mock config
    mockedConfig.getProviderConfig.mockReturnValue({
      provider: LLMProvider.OLLAMA,
      model: 'llama3',
      temperature: 0.1,
      maxTokens: 8192,
      topP: 0.95,
      timeout: 30000,
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      ollamaOptions: {
        keepAlive: '5m',
        numPredict: 8192,
        stream: false
      }
    });
    
    mockedConfig.config = {
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_KEEP_ALIVE: '5m',
      OLLAMA_NUM_PREDICT: 8192,
      LLM_TEMPERATURE: 0.1,
      LLM_TOP_P: 0.95
    } as any;
    
    ollamaService = new OllamaService();
  });
  
  describe('Service Initialization', () => {
    it('should initialize with correct provider and model', () => {
      expect(ollamaService.provider).toBe(LLMProvider.OLLAMA);
      expect(ollamaService.model).toBe('llama3');
    });
    
    it('should create axios client with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:11434',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });
  });
  
  describe('isAvailable', () => {
    it('should return true when Ollama server is running and model exists', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'llama3:latest' },
            { name: 'codellama:7b' }
          ]
        }
      });
      
      const available = await ollamaService.isAvailable();
      
      expect(available).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tags', { timeout: 5000 });
    });
    
    it('should attempt to pull model if not found locally', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'other-model:latest' }
          ]
        }
      });
      
      mockAxiosInstance.post.mockResolvedValueOnce({ data: {} }); // Mock pull success
      
      const available = await ollamaService.isAvailable();
      
      expect(available).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/pull', {
        name: 'llama3',
        stream: false
      }, { timeout: 300000 });
    });
    
    it('should return false when server is not running', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      
      const available = await ollamaService.isAvailable();
      
      expect(available).toBe(false);
    });
    
    it('should return false when model pull fails', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { models: [] }
      });
      
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Pull failed'));
      
      const available = await ollamaService.isAvailable();
      
      expect(available).toBe(false);
    });
  });
  
  describe('chat', () => {
    const mockRequest: LLMChatRequest = {
      message: 'Hello, how are you?',
      sessionId: 'test-session-123'
    };
    
    it('should handle simple chat request', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          model: 'llama3',
          message: {
            role: 'assistant',
            content: 'I am doing well, thank you!'
          },
          done: true,
          prompt_eval_count: 5,
          eval_count: 8,
          total_duration: 1000000
        }
      });
      
      const response = await ollamaService.chat(mockRequest);
      
      expect(response.response).toBe('I am doing well, thank you!');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.promptTokens).toBe(5);
      expect(response.usage?.completionTokens).toBe(8);
      expect(response.usage?.totalTokens).toBe(13);
    });
    
    it('should add system instruction for new sessions', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: { role: 'assistant', content: 'Response' },
          done: true
        }
      });
      
      await ollamaService.chat(mockRequest);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/chat', {
        model: 'llama3',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('You are IKAS')
          },
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.95,
          num_predict: 8192,
          keep_alive: '5m'
        }
      });
    });
    
    it('should include tools in request when provided', async () => {
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
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: { role: 'assistant', content: 'Response with tools' },
          done: true
        }
      });
      
      await ollamaService.chat({
        ...mockRequest,
        tools
      });
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/chat',
        expect.objectContaining({
          tools: [{
            type: 'function',
            function: {
              name: 'test-function',
              description: 'A test function',
              parameters: {
                type: 'object',
                properties: {
                  param: { type: 'string' }
                },
                required: ['param']
              }
            }
          }]
        })
      );
    });
    
    it('should handle function calls in response', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'test-function',
                arguments: JSON.stringify({ param: 'test-value' })
              }
            }]
          },
          done: true
        }
      });
      
      const response = await ollamaService.chat({
        ...mockRequest,
        tools: [{
          name: 'test-function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }]
      });
      
      expect(response.functionCalls).toHaveLength(1);
      expect(response.functionCalls?.[0]).toEqual({
        name: 'test-function',
        args: { param: 'test-value' }
      });
    });
    
    it('should add realm context to user message', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: { role: 'assistant', content: 'Response' },
          done: true
        }
      });
      
      await ollamaService.chat({
        ...mockRequest,
        context: { realm: 'test-realm' }
      });
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/chat',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: '[Realm: test-realm] Hello, how are you?'
            })
          ])
        })
      );
    });
    
    it('should limit chat history to 20 messages', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          message: { role: 'assistant', content: 'Response' },
          done: true
        }
      });
      
      // Send many messages to test history limit
      for (let i = 0; i < 25; i++) {
        await ollamaService.chat({
          message: `Message ${i}`,
          sessionId: 'test-session'
        });
      }
      
      // Check that history is limited
      const lastCall = mockAxiosInstance.post.mock.calls.slice(-1)[0][1];
      expect(lastCall.messages.length).toBeLessThanOrEqual(20);
    });
    
    it('should handle API errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED'
      });
      
      await expect(ollamaService.chat(mockRequest))
        .rejects.toThrow(LLMUnavailableError);
    });
    
    it('should handle model not found error', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: { status: 404 }
      });
      
      await expect(ollamaService.chat(mockRequest))
        .rejects.toThrow(LLMError);
    });
    
    it('should handle invalid function call arguments', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'test-function',
                arguments: 'invalid-json'
              }
            }]
          },
          done: true
        }
      });
      
      const response = await ollamaService.chat({
        ...mockRequest,
        tools: [{
          name: 'test-function',
          description: 'Test function',
          parameters: { type: 'object', properties: {} }
        }]
      });
      
      expect(response.functionCalls).toHaveLength(0);
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
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: {
            role: 'assistant',
            content: 'Function executed successfully'
          },
          done: true
        }
      });
      
      const result = await ollamaService.processFunctionCalls(
        'test-session',
        mockFunctionCalls,
        mockExecutor,
        mockTools
      );
      
      expect(result.response).toBe('Function executed successfully');
      expect(mockExecutor).toHaveBeenCalledWith(mockFunctionCalls[0]);
    });
    
    it('should add function results as user messages', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ result: 'success' });
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: { role: 'assistant', content: 'Processed' },
          done: true
        }
      });
      
      await ollamaService.processFunctionCalls(
        'test-session',
        mockFunctionCalls,
        mockExecutor,
        mockTools
      );
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/chat',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Function test-function result')
            })
          ])
        })
      );
    });
    
    it('should handle additional function calls', async () => {
      const mockExecutor = jest.fn().mockResolvedValue('result');
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: {
            role: 'assistant',
            content: 'Response with additional calls',
            tool_calls: [{
              id: 'call_456',
              type: 'function',
              function: {
                name: 'additional-function',
                arguments: JSON.stringify({ data: 'value' })
              }
            }]
          },
          done: true
        }
      });
      
      const result = await ollamaService.processFunctionCalls(
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
    
    it('should handle function processing errors', async () => {
      const mockExecutor = jest.fn().mockRejectedValue(new Error('Function failed'));
      
      await expect(
        ollamaService.processFunctionCalls(
          'test-session',
          mockFunctionCalls,
          mockExecutor,
          mockTools
        )
      ).rejects.toThrow(LLMError);
    });
  });
  
  describe('Chat History Management', () => {
    it('should track active sessions', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          message: { role: 'assistant', content: 'Response' },
          done: true
        }
      });
      
      await ollamaService.chat({ message: 'Test', sessionId: 'session1' });
      await ollamaService.chat({ message: 'Test', sessionId: 'session2' });
      
      const sessions = ollamaService.getActiveSessions();
      expect(sessions).toContain('session1');
      expect(sessions).toContain('session2');
    });
    
    it('should clear specific session history', () => {
      ollamaService.clearChatHistory('test-session');
      expect(ollamaService.getActiveSessions()).not.toContain('test-session');
    });
  });
  
  describe('Model Management', () => {
    it('should pull model when not available', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { models: [] }
      });
      
      mockAxiosInstance.post.mockResolvedValueOnce({ data: {} });
      
      const available = await ollamaService.isAvailable();
      
      expect(available).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/pull', {
        name: 'llama3',
        stream: false
      }, { timeout: 300000 });
    });
    
    it('should handle pull failures', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { models: [] }
      });
      
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Pull failed'));
      
      await expect(ollamaService.isAvailable()).resolves.toBe(false);
    });
  });
  
  describe('System Instructions', () => {
    it('should include IKAS system instructions', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          message: { role: 'assistant', content: 'Response' },
          done: true
        }
      });
      
      await ollamaService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      });
      
      const systemMessage = mockAxiosInstance.post.mock.calls[0][1].messages[0];
      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('You are IKAS');
      expect(systemMessage.content).toContain('FUNCTION CALLING BEHAVIOR');
      expect(systemMessage.content).toContain('DATA SYNCHRONIZATION');
    });
  });
});