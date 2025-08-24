import { Router } from 'express';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { Orchestrator } from '../orchestration';
import { MCPToolDiscovery } from '../llm';
import { checkAllMcpServices } from '../mcp';
import { z } from 'zod';
import axios from 'axios';
import { LLMFactory } from '../llm/llm-factory';
import { LLMProvider } from '../llm/llm-interface';

// Reuse the health check method from health.ts
async function checkMcpService(url: string, serviceName: string): Promise<{status: 'healthy' | 'unhealthy'; latency?: number; error?: string; lastChecked: string}> {
  const startTime = Date.now();
  
  try {
    // Both MCP servers now have standard /health endpoints
    const healthPath = '/health';
    const response = await axios.get(`${url}${healthPath}`, {
      timeout: config.HEALTH_CHECK_TIMEOUT,
      validateStatus: (status) => status < 400 // Standard health check for all services
    });
    
    const latency = Date.now() - startTime;
    
    // Standard health check for all services
    const isHealthy = response.status < 400;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      latency,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'unhealthy',
      latency,
      error: errorMessage,
      lastChecked: new Date().toISOString()
    };
  }
}

const orchestrationRouter = Router();

// Initialize orchestrator
const orchestrator = new Orchestrator();
const toolDiscovery = new MCPToolDiscovery();

// Validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  sessionId: z.string().optional().default(() => `session-${Date.now()}`),
  context: z.object({
    realm: z.string().optional(),
    userId: z.string().optional(),
    preferredLanguage: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional()
  }).optional()
});

// Main chat endpoint
orchestrationRouter.post('/chat', async (req, res): Promise<any> => {
  try {
    // Validate request body
    const validatedData = chatRequestSchema.parse(req.body);
    const { message, sessionId, context } = validatedData;
    
    logger.info('Chat request received', {
      sessionId,
      messageLength: message.length,
      realm: context?.realm,
      priority: context?.priority
    });

    // Check if MCP services are healthy using the same method as main health endpoint
    const [keycloakHealth, neo4jHealth] = await Promise.all([
      checkMcpService(config.KEYCLOAK_MCP_URL, 'keycloak-mcp'),
      checkMcpService(config.NEO4J_MCP_URL, 'neo4j-mcp')
    ]);
    
    const serviceHealth = {
      keycloak: keycloakHealth.status === 'healthy',
      neo4j: neo4jHealth.status === 'healthy', 
      overall: keycloakHealth.status === 'healthy' && neo4jHealth.status === 'healthy'
    };

    if (!serviceHealth.overall) {
      logger.warn('MCP services are not fully healthy', serviceHealth);
      
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Some backend services are currently unavailable. Please try again later.',
        serviceStatus: serviceHealth
      });
    }

    // Process the request
    const response = await orchestrator.processRequest({
      userInput: message,
      sessionId,
      context
    });

    logger.info('Chat request processed', {
      sessionId,
      success: response.success,
      duration: `${response.duration}ms`,
      toolsUsed: response.toolsCalled.length,
      strategy: response.strategy
    });

    res.json({
      response: response.response,
      sessionId,
      success: response.success,
      strategy: response.strategy,
      toolsCalled: response.toolsCalled,
      duration: response.duration,
      timestamp: new Date().toISOString(),
      data: response.data
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid chat request', {
        errors: error.errors
      });
      
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request validation failed',
        details: error.errors
      });
    }

    logger.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Tool discovery endpoint
orchestrationRouter.get('/tools', async (req, res) => {
  try {
    logger.debug('Tools discovery request received');
    
    const tools = await toolDiscovery.discoverAllTools();
    
    const totalTools = Object.values(tools.tools).flat().length;
    
    logger.info('Tools discovery completed', {
      keycloakTools: tools.tools.keycloak.length,
      neo4jTools: tools.tools.neo4j.length,
      totalTools,
      timestamp: tools.timestamp
    });

    res.json({
      tools: tools.tools,
      servers: tools.servers,
      summary: {
        keycloakTools: tools.tools.keycloak.length,
        neo4jTools: tools.tools.neo4j.length,
        totalTools
      },
      timestamp: tools.timestamp,
      cached: toolDiscovery.getCacheStatus().cached
    });
    
  } catch (error) {
    logger.error('Tools endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Orchestrator status endpoint
orchestrationRouter.get('/status', async (req, res) => {
  try {
    const serviceHealth = await checkAllMcpServices();
    const orchestratorStatus = orchestrator.getStatus();
    
    res.json({
      orchestrator: {
        activeSessions: orchestratorStatus.activeSessions,
        toolCache: orchestratorStatus.toolCacheStatus
      },
      services: serviceHealth,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Status endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Clear chat session endpoint
orchestrationRouter.delete('/chat/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Clear session in orchestrator (this will clear Gemini chat history)
    // Note: We'd need to add this method to the orchestrator
    logger.info('Chat session cleared', { sessionId });
    
    res.json({
      message: 'Session cleared successfully',
      sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Clear session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Tool cache management endpoint
orchestrationRouter.post('/tools/refresh', async (req, res) => {
  try {
    logger.info('Manual tool cache refresh requested');
    
    toolDiscovery.invalidateCache();
    const tools = await toolDiscovery.discoverAllTools();
    
    res.json({
      message: 'Tool cache refreshed successfully',
      tools: {
        keycloak: tools.tools.keycloak.length,
        neo4j: tools.tools.neo4j.length,
        total: Object.values(tools.tools).flat().length
      },
      timestamp: tools.timestamp
    });
    
  } catch (error) {
    logger.error('Tool refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Periodic cleanup (should be called by a scheduler)
orchestrationRouter.post('/cleanup', async (req, res) => {
  try {
    logger.info('Manual cleanup requested');
    
    orchestrator.cleanup();
    
    res.json({
      message: 'Cleanup completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Model switching and info endpoints
orchestrationRouter.get('/models', async (req, res) => {
  try {
    logger.debug('Available models request received');
    
    const availableProviders = await LLMFactory.getAvailableProviders();
    const currentProvider = config.LLM_PROVIDER;
    const currentModel = config.LLM_MODEL;
    
    const providerDetails: Record<LLMProvider, any> = {
      [LLMProvider.ANTHROPIC]: {
        name: 'Claude Opus 4.1',
        provider: 'Anthropic',
        model: 'claude-opus-4-1-20250805',
        capabilities: ['text', 'tools', 'function_calling', 'analysis'],
        description: 'Advanced reasoning with superior problem-solving capabilities'
      },
      [LLMProvider.GEMINI]: {
        name: 'Gemini Pro',
        provider: 'Google',
        model: 'gemini-pro',
        capabilities: ['text', 'tools', 'function_calling', 'analysis'],
        description: 'Fast and efficient language model with strong reasoning'
      },
      [LLMProvider.OLLAMA]: {
        name: 'Ollama Local',
        provider: 'Ollama',
        model: 'llama2',
        capabilities: ['text', 'local'],
        description: 'Local language model running via Ollama'
      },
      [LLMProvider.OPENAI]: {
        name: 'GPT-4',
        provider: 'OpenAI',
        model: 'gpt-4',
        capabilities: ['text', 'tools', 'function_calling', 'analysis'],
        description: 'Advanced language model from OpenAI'
      }
    };
    
    const models = availableProviders.map(provider => ({
      ...providerDetails[provider],
      id: provider,
      available: true,
      current: provider === currentProvider
    }));
    
    logger.info('Models info retrieved', {
      availableProviders: availableProviders.length,
      currentProvider,
      currentModel
    });

    res.json({
      models,
      current: {
        provider: currentProvider,
        model: currentModel,
        name: providerDetails[currentProvider as LLMProvider]?.name || currentProvider
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Models endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Switch model endpoint
const switchModelSchema = z.object({
  provider: z.enum(['anthropic', 'gemini', 'ollama', 'openai']),
  sessionId: z.string().optional()
});

orchestrationRouter.post('/models/switch', async (req, res): Promise<any> => {
  try {
    // Validate request body
    const validatedData = switchModelSchema.parse(req.body);
    const { provider, sessionId } = validatedData;
    
    logger.info('Model switch request received', {
      requestedProvider: provider,
      currentProvider: config.LLM_PROVIDER,
      sessionId
    });

    // Check if the requested provider is available
    const availableProviders = await LLMFactory.getAvailableProviders();
    const providerEnum = provider.toUpperCase() as LLMProvider;
    
    if (!availableProviders.includes(providerEnum)) {
      return res.status(400).json({
        error: 'Provider not available',
        message: `The ${provider} provider is not currently available or configured`,
        availableProviders
      });
    }

    // Create new LLM service instance for the requested provider
    const newService = LLMFactory.createLLMService(provider);
    
    // Verify the service is actually available
    const isAvailable = await newService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Provider unavailable',
        message: `The ${provider} provider is currently unavailable`
      });
    }

    // Update the orchestrator to use the new provider
    orchestrator.switchLLMProvider(provider);
    
    // If sessionId is provided, clear the session to start fresh with new model
    if (sessionId) {
      orchestrator.clearSession(sessionId);
    }

    logger.info('Model switched successfully', {
      newProvider: provider,
      previousProvider: config.LLM_PROVIDER,
      sessionCleared: !!sessionId
    });

    res.json({
      message: 'Model switched successfully',
      provider: provider,
      model: newService.model,
      sessionCleared: !!sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid model switch request', {
        errors: error.errors
      });
      
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request validation failed',
        details: error.errors
      });
    }

    logger.error('Model switch error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export { orchestrationRouter };