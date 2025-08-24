import { AnthropicService } from '../../../src/llm/anthropic-service';
import { LLMProvider, LLMChatRequest, LLMFunctionCall, LLMFunction } from '../../../src/llm/llm-interface';
import { LLMError, LLMUnavailableError } from '../../../src/types/llm';
import * as configModule from '../../../src/utils/config';

// Mock Anthropic SDK
const mockCreate = jest.fn();
const mockAnthropicClient = {
  messages: {
    create: mockCreate
  }
};

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => mockAnthropicClient);
});

// Mock config
jest.mock('../../../src/utils/config');
const mockedConfig = configModule as jest.Mocked<typeof configModule>;

describe('AnthropicService', () => {
  let anthropicService: AnthropicService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockedConfig.getProviderConfig.mockReturnValue({
      provider: LLMProvider.ANTHROPIC,
      model: 'claude-3-sonnet-20240229',
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
      ANTHROPIC_API_KEY: 'test-api-key',
      LLM_TEMPERATURE: 0.1,
      LLM_MAX_TOKENS: 8192,
      LLM_TOP_P: 0.95
    } as any;
    
    anthropicService = new AnthropicService();
  });
  
  describe('Service Initialization', () => {
    it('should initialize with correct provider and model', () => {
      expect(anthropicService.provider).toBe(LLMProvider.ANTHROPIC);
      expect(anthropicService.model).toBe('claude-3-sonnet-20240229');
    });
    
    it('should throw error without API key', () => {
      mockedConfig.config.ANTHROPIC_API_KEY = undefined;
      
      expect(() => new AnthropicService())
        .toThrow('ANTHROPIC_API_KEY environment variable is required');
    });
  });
  
  describe('isAvailable', () => {
    it('should return true when service is available', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'test response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 2 }
      });
      
      const available = await anthropicService.isAvailable();
      
      expect(available).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
    });
    
    it('should return false when service is unavailable', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));
      
      const available = await anthropicService.isAvailable();
      
      expect(available).toBe(false);
    });
  });
  
  describe('chat', () => {
    const mockRequest: LLMChatRequest = {
      message: 'Hello, how are you?',
      sessionId: 'test-session-123'
    };
    
    it('should handle simple chat request', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I am doing well, thank you!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 5,
          output_tokens: 8
        }
      });
      
      const response = await anthropicService.chat(mockRequest);
      
      expect(response.response).toBe('I am doing well, thank you!');
      expect(response.finishReason).toBe('stop');
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
      
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'tool_use',
          id: 'toolu_123',
          name: 'test-function',
          input: { param: 'test-value' }
        }],
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 10,
          output_tokens: 5
        }
      });
      
      const response = await anthropicService.chat({
        ...mockRequest,
        tools
      });
      
      expect(response.functionCalls).toHaveLength(1);
      expect(response.functionCalls?.[0]).toEqual({
        id: 'toolu_123',
        name: 'test-function',
        args: { param: 'test-value' }
      });
      expect(response.finishReason).toBe('function_call');
    });
    
    it('should handle context and realm information', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response with context' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      await anthropicService.chat({
        ...mockRequest,
        context: { realm: 'test-realm' }
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: '[Realm: test-realm] Hello, how are you?'
            })
          ])
        })
      );
    });
    
    it('should include system instructions for IKAS', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      await anthropicService.chat(mockRequest);
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('You are IKAS')
        })
      );
    });
    
    it('should handle API errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('rate_limit exceeded'));
      
      await expect(anthropicService.chat(mockRequest))
        .rejects.toThrow('Rate limit exceeded');
    });
    
    it('should use custom temperature from options', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response with custom temp' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      await anthropicService.chat({
        ...mockRequest,
        options: { temperature: 0.8 }
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8
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
      
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Function executed successfully' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 8 }
      });
      
      const result = await anthropicService.processFunctionCalls(
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
      
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: 'Response with additional calls'
        }, {
          type: 'tool_use',
          id: 'toolu_456',
          name: 'additional-function',
          input: { data: 'value' }
        }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 8 }
      });
      
      const result = await anthropicService.processFunctionCalls(
        'test-session',
        mockFunctionCalls,
        mockExecutor,
        mockTools
      );
      
      expect(result.additionalFunctionCalls).toHaveLength(1);
      expect(result.additionalFunctionCalls?.[0]).toEqual({
        id: 'toolu_456',
        name: 'additional-function',
        args: { data: 'value' }
      });
    });
    
    it('should handle function execution errors', async () => {
      const mockExecutor = jest.fn().mockRejectedValue(new Error('Function failed'));
      
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Error handled' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 8 }
      });
      
      const result = await anthropicService.processFunctionCalls(
        'test-session',
        mockFunctionCalls,
        mockExecutor,
        mockTools
      );
      
      // Should not throw - errors are sent as tool_result with is_error: true
      expect(result.response).toBe('Error handled');
      
      // Check that tool result with error was sent
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'tool_result',
                  is_error: true,
                  content: expect.stringContaining('Error: Function failed')
                })
              ])
            })
          ])
        })
      );
    });
    
    it('should handle processing failures', async () => {
      const mockExecutor = jest.fn().mockResolvedValue('result');
      
      mockCreate.mockRejectedValueOnce(new Error('Processing failed'));
      
      await expect(
        anthropicService.processFunctionCalls(
          'test-session',
          mockFunctionCalls,
          mockExecutor,
          mockTools
        )
      ).rejects.toThrow(LLMError);
    });
  });
  
  describe('Chat History Management', () => {
    it('should maintain chat history per session', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      await anthropicService.chat({ message: 'Message 1', sessionId: 'session1' });
      await anthropicService.chat({ message: 'Message 2', sessionId: 'session1' });
      await anthropicService.chat({ message: 'Message 1', sessionId: 'session2' });
      
      expect(anthropicService.getActiveSessions()).toContain('session1');
      expect(anthropicService.getActiveSessions()).toContain('session2');
    });
    
    it('should clear chat history for specific session', () => {
      anthropicService.clearChatHistory('test-session');
      expect(anthropicService.getActiveSessions()).not.toContain('test-session');
    });
    
    it('should limit chat history size', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      // Generate many messages to test history limit
      for (let i = 0; i < 25; i++) {
        await anthropicService.chat({
          message: `Message ${i}`,
          sessionId: 'test-session'
        });
      }
      
      // Check the call to ensure history is limited (system message adds 1)
      const lastCall = mockCreate.mock.calls.slice(-1)[0][0];
      expect(lastCall.messages.length).toBeLessThanOrEqual(22); // Allow for system instruction impact
    });
  });
  
  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      mockCreate.mockRejectedValueOnce(new Error('rate_limit exceeded'));
      
      await expect(anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      })).rejects.toThrow('Rate limit exceeded');
    });
    
    it('should handle authentication errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('authentication failed'));
      
      await expect(anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      })).rejects.toThrow('Authentication failed');
    });
    
    it('should handle model not found errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('model_not_found'));
      
      await expect(anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      })).rejects.toThrow('Model claude-3-sonnet-20240229 not available');
    });
  });
  
  describe('Tool Conversion', () => {
    it('should convert LLM tools to Anthropic format', () => {
      const tools: LLMFunction[] = [{
        name: 'test-tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First parameter' },
            param2: { type: 'number', description: 'Second parameter' }
          },
          required: ['param1']
        }
      }];
      
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session',
        tools
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{
            name: 'test-tool',
            description: 'A test tool',
            input_schema: {
              type: 'object',
              properties: {
                param1: { type: 'string', description: 'First parameter' },
                param2: { type: 'number', description: 'Second parameter' }
              },
              required: ['param1']
            }
          }]
        })
      );
    });
    
    it('should handle tools with no parameters', async () => {
      const tools: LLMFunction[] = [{
        name: 'simple-tool',
        description: 'Simple tool with no params',
        parameters: {
          type: 'object',
          properties: {}
        }
      }];
      
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      await anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session',
        tools
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{
            name: 'simple-tool',
            description: 'Simple tool with no params',
            input_schema: {
              type: 'object',
              properties: {},
              required: []
            }
          }]
        })
      );
    });
  });
  
  describe('Response Processing', () => {
    it('should handle mixed content blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Here is some text ' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'test-function',
            input: { param: 'value' }
          },
          { type: 'text', text: ' and more text' }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 15 }
      });
      
      const response = await anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      });
      
      expect(response.response).toBe('Here is some text  and more text');
      expect(response.functionCalls).toHaveLength(1);
      expect(response.functionCalls?.[0]).toEqual({
        id: 'toolu_123',
        name: 'test-function',
        args: { param: 'value' }
      });
    });
    
    it('should map stop reasons correctly', async () => {
      const stopReasonTests = [
        { anthropic: 'end_turn', expected: 'stop' },
        { anthropic: 'tool_use', expected: 'function_call' },
        { anthropic: 'max_tokens', expected: 'length' },
        { anthropic: 'stop_sequence', expected: 'stop' }
      ];
      
      for (const test of stopReasonTests) {
        mockCreate.mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: test.anthropic,
          usage: { input_tokens: 5, output_tokens: 8 }
        });
        
        const response = await anthropicService.chat({
          message: 'Test message',
          sessionId: 'test-session'
        });
        
        expect(response.finishReason).toBe(test.expected);
      }
    });
  });
  
  describe('System Instructions', () => {
    it('should include IKAS system instructions', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 8 }
      });
      
      await anthropicService.chat({
        message: 'Test message',
        sessionId: 'test-session'
      });
      
      const systemMessage = mockCreate.mock.calls[0][0].system;
      expect(systemMessage).toContain('You are IKAS');
      expect(systemMessage).toContain('FUNCTION CALLING BEHAVIOR');
      expect(systemMessage).toContain('DATA SYNCHRONIZATION');
      expect(systemMessage).toContain('Neo4j: get_neo4j_schema, read_neo4j_cypher, write_neo4j_cypher');
    });
  });
});