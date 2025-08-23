import { LLMService, LLMProvider, LLMChatRequest, LLMChatResponse, LLMFunctionCall, LLMFunction, LLMFunctionProcessingResult } from '../../../src/llm/llm-interface';

// Mock implementation for testing abstract class
class MockLLMService extends LLMService {
  readonly provider = LLMProvider.GEMINI;
  readonly model = 'mock-model';
  
  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    return {
      response: `Mock response to: ${request.message}`,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      }
    };
  }
  
  async processFunctionCalls(
    sessionId: string,
    functionCalls: LLMFunctionCall[],
    functionExecutor: (call: LLMFunctionCall) => Promise<any>,
    tools: LLMFunction[]
  ): Promise<LLMFunctionProcessingResult> {
    const results = [];
    for (const call of functionCalls) {
      const result = await functionExecutor(call);
      results.push(result);
    }
    return {
      response: `Processed ${functionCalls.length} function calls: ${results.join(', ')}`
    };
  }
  
  clearChatHistory(sessionId: string): void {
    // Mock implementation
  }
  
  async isAvailable(): Promise<boolean> {
    return true;
  }
  
  getActiveSessions(): string[] {
    return ['session1', 'session2'];
  }
}

describe('LLMService Abstract Class', () => {
  let mockService: MockLLMService;
  
  beforeEach(() => {
    mockService = new MockLLMService();
  });
  
  describe('Abstract Class Implementation', () => {
    it('should have required abstract properties', () => {
      expect(mockService.provider).toBe(LLMProvider.GEMINI);
      expect(mockService.model).toBe('mock-model');
    });
    
    it('should implement abstract chat method', async () => {
      const request: LLMChatRequest = {
        message: 'Test message',
        sessionId: 'test-session'
      };
      
      const response = await mockService.chat(request);
      
      expect(response.response).toContain('Mock response to: Test message');
      expect(response.finishReason).toBe('stop');
      expect(response.usage).toBeDefined();
      expect(response.usage?.totalTokens).toBe(30);
    });
    
    it('should implement abstract processFunctionCalls method', async () => {
      const functionCalls: LLMFunctionCall[] = [
        { name: 'test-function', args: { param: 'value' } }
      ];
      const functionExecutor = jest.fn().mockResolvedValue('mock-result');
      const tools: LLMFunction[] = [];
      
      const result = await mockService.processFunctionCalls(
        'test-session',
        functionCalls,
        functionExecutor,
        tools
      );
      
      expect(result.response).toContain('Processed 1 function calls');
      expect(functionExecutor).toHaveBeenCalledWith(functionCalls[0]);
    });
    
    it('should implement clearChatHistory method', () => {
      // Should not throw
      expect(() => mockService.clearChatHistory('test-session')).not.toThrow();
    });
    
    it('should implement isAvailable method', async () => {
      const available = await mockService.isAvailable();
      expect(available).toBe(true);
    });
    
    it('should implement getActiveSessions method', () => {
      const sessions = mockService.getActiveSessions();
      expect(sessions).toEqual(['session1', 'session2']);
    });
  });
  
  describe('getProviderInfo method', () => {
    it('should return provider and model information', () => {
      const info = mockService.getProviderInfo();
      
      expect(info).toEqual({
        provider: LLMProvider.GEMINI,
        model: 'mock-model'
      });
    });
  });
  
  describe('LLM Function Interfaces', () => {
    it('should validate LLMFunction structure', () => {
      const testFunction: LLMFunction = {
        name: 'test-function',
        description: 'A test function',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
            param2: { type: 'number' }
          },
          required: ['param1']
        }
      };
      
      expect(testFunction.name).toBe('test-function');
      expect(testFunction.parameters.type).toBe('object');
      expect(testFunction.parameters.required).toContain('param1');
    });
    
    it('should validate LLMFunctionCall structure', () => {
      const functionCall: LLMFunctionCall = {
        name: 'test-function',
        args: {
          param1: 'test-value',
          param2: 42
        }
      };
      
      expect(functionCall.name).toBe('test-function');
      expect(functionCall.args.param1).toBe('test-value');
      expect(functionCall.args.param2).toBe(42);
    });
  });
  
  describe('Provider Capabilities', () => {
    it('should define all provider types', () => {
      expect(LLMProvider.GEMINI).toBe('gemini');
      expect(LLMProvider.OLLAMA).toBe('ollama');
      expect(LLMProvider.ANTHROPIC).toBe('anthropic');
      expect(LLMProvider.OPENAI).toBe('openai');
    });
  });
  
  describe('Request and Response Interfaces', () => {
    it('should validate LLMChatRequest structure', () => {
      const request: LLMChatRequest = {
        message: 'Test message',
        sessionId: 'test-session',
        tools: [{
          name: 'test-tool',
          description: 'Test tool',
          parameters: { type: 'object', properties: {} }
        }],
        context: { realm: 'test-realm' },
        options: {
          temperature: 0.7,
          maxTokens: 1000,
          topP: 0.9
        }
      };
      
      expect(request.message).toBe('Test message');
      expect(request.sessionId).toBe('test-session');
      expect(request.tools).toHaveLength(1);
      expect(request.context?.realm).toBe('test-realm');
      expect(request.options?.temperature).toBe(0.7);
    });
    
    it('should validate LLMChatResponse structure', () => {
      const response: LLMChatResponse = {
        response: 'Test response',
        functionCalls: [{
          name: 'test-function',
          args: { param: 'value' }
        }],
        finishReason: 'function_call',
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300
        }
      };
      
      expect(response.response).toBe('Test response');
      expect(response.functionCalls).toHaveLength(1);
      expect(response.finishReason).toBe('function_call');
      expect(response.usage?.totalTokens).toBe(300);
    });
    
    it('should validate LLMFunctionProcessingResult structure', () => {
      const result: LLMFunctionProcessingResult = {
        response: 'Processing complete',
        additionalFunctionCalls: [{
          name: 'follow-up-function',
          args: { data: 'result' }
        }]
      };
      
      expect(result.response).toBe('Processing complete');
      expect(result.additionalFunctionCalls).toHaveLength(1);
      expect(result.additionalFunctionCalls?.[0].name).toBe('follow-up-function');
    });
  });
});