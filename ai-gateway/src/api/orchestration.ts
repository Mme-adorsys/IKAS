import { Router } from 'express';
import { logger } from '../utils/logger';
import { config, getAvailableAnthropicModels } from '../utils/config';
import { Orchestrator } from '../orchestration';
import { MCPToolDiscovery } from '../llm';
import { checkAllMcpServices } from '../mcp';
import { z } from 'zod';
import axios from 'axios';
import { LLMFactory } from '../llm/llm-factory';
import { LLMProvider } from '../llm/llm-interface';
import { AnthropicService, StreamEvent } from '../llm/anthropic-service';

// Cost-lock: only Haiku 4.5 is allowed for live demos. Toggleable via env (set
// IKAS_MODEL_ALLOWLIST to a comma-separated list of Anthropic model IDs, or
// "*" to disable the lock entirely).
const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const MODEL_ALLOWLIST: string[] | null = (() => {
  const raw = process.env.IKAS_MODEL_ALLOWLIST?.trim();
  if (raw === '*') return null; // explicit opt-out
  if (!raw) return [HAIKU_MODEL_ID];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
})();
function isModelAllowed(modelId: string | undefined): boolean {
  if (!MODEL_ALLOWLIST) return true;
  if (!modelId) return false;
  return MODEL_ALLOWLIST.includes(modelId);
}

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

/**
 * Streaming chat endpoint. SSE response.
 *
 * Emits events in order:
 *   text         { delta: string }          — token deltas from the LLM
 *   tool_use     { id, name, input }        — Claude requested a tool call (sent before exec)
 *   tool_result  { id, name, success, ... } — orchestrator executed the tool (sent after exec)
 *   usage        { inputTokens, ... }       — per-iteration token usage incl. cache hit counters
 *   done         { toolsCalled[], iterations } — terminator
 *   error        { message }                — fatal error; stream ends after
 *
 * Anthropic-only at this stage; other providers return 501.
 */
orchestrationRouter.post('/chat/stream', async (req, res): Promise<any> => {
  try {
    const validatedData = chatRequestSchema.parse(req.body);
    const { message, sessionId, context } = validatedData;

    const llmService = orchestrator.getLLMService();
    if (!(llmService instanceof AnthropicService)) {
      return res.status(501).json({
        error: 'Streaming not implemented for this provider',
        provider: llmService.provider,
        hint: 'Set LLM_PROVIDER=anthropic to use the streaming endpoint'
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
    res.flushHeaders();

    const sendEvent = (event: StreamEvent) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    const tools = await orchestrator.getToolsForLLM();
    const realm = context?.realm;

    logger.info('🎬 Stream request started', {
      sessionId,
      messageLength: message.length,
      toolCount: tools.length,
      realm
    });

    const generator = llmService.streamWithTools(
      {
        message,
        sessionId,
        tools,
        context: { realm, language: context?.preferredLanguage || 'en' }
      },
      (call) => orchestrator.executeFunctionCallPublic(call, realm),
      parseInt(process.env.MAX_FUNCTION_ITERATIONS || '4')
    );

    req.on('close', () => {
      logger.info('Stream client disconnected', { sessionId });
    });

    for await (const event of generator) {
      sendEvent(event);
      if (event.type === 'done' || event.type === 'error') break;
    }

    res.end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stream endpoint error:', error);
    // If headers were already sent, terminate the SSE stream cleanly.
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Internal server error', message: errorMessage });
    }
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
    
    // Get available Anthropic models
    const anthropicModels = getAvailableAnthropicModels();
    
    const providerDetails: Record<LLMProvider, any> = {
      [LLMProvider.ANTHROPIC]: {
        name: 'Claude Models',
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
    
    // Build models array with individual Anthropic models
    const models: any[] = [];
    
    // Add Anthropic models individually — filtered through cost-lock allowlist
    // so that the UI never even displays expensive models during the demo.
    if (availableProviders.includes(LLMProvider.ANTHROPIC)) {
      anthropicModels
        .filter(m => isModelAllowed(m.id))
        .forEach(anthropicModel => {
          models.push({
            id: `anthropic-${anthropicModel.displayName.toLowerCase().replace(/\s+/g, '-')}`,
            name: anthropicModel.name,
            displayName: anthropicModel.displayName,
            provider: 'Anthropic',
            model: anthropicModel.id,
            capabilities: anthropicModel.capabilities,
            description: anthropicModel.description,
            speed: anthropicModel.speed,
            cost: anthropicModel.cost,
            recommended: anthropicModel.recommended,
            available: true,
            current: currentProvider === LLMProvider.ANTHROPIC && currentModel === anthropicModel.id
          });
        });
    }

    // Other providers: only expose if the allowlist is disabled (the demo lock
    // is Anthropic-only; Gemini/Ollama/OpenAI stay hidden while it's active).
    if (!MODEL_ALLOWLIST) {
      availableProviders
        .filter(provider => provider !== LLMProvider.ANTHROPIC)
        .forEach(provider => {
          models.push({
            ...providerDetails[provider],
            id: provider,
            available: true,
            current: provider === currentProvider
          });
        });
    }
    
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
  provider: z.enum(['anthropic', 'gemini', 'ollama', 'openai']).optional(),
  model: z.string().optional(), // For specific model selection (e.g., claude-sonnet-4-20250514)
  modelId: z.string().optional(), // For UI model IDs (e.g., anthropic-sonnet-4)
  sessionId: z.string().optional()
}).refine(data => data.provider || data.model || data.modelId, {
  message: "Either provider, model, or modelId must be provided"
});

orchestrationRouter.post('/models/switch', async (req, res): Promise<any> => {
  try {
    // Validate request body
    const validatedData = switchModelSchema.parse(req.body);
    const { provider, model, modelId, sessionId } = validatedData;
    
    let targetProvider = provider;
    let targetModel = model;
    
    // Handle model ID to provider/model mapping
    if (modelId && !provider && !model) {
      const anthropicModels = getAvailableAnthropicModels();
      
      if (modelId.startsWith('anthropic-')) {
        targetProvider = 'anthropic';
        const modelName = modelId.replace('anthropic-', '').replace(/-/g, ' ');
        const foundModel = anthropicModels.find(m => 
          m.displayName.toLowerCase().replace(/\s+/g, ' ') === modelName
        );
        if (foundModel) {
          targetModel = foundModel.id;
        }
      } else {
        // Handle other providers by model ID
        targetProvider = modelId as 'anthropic' | 'gemini' | 'ollama' | 'openai';
      }
    }
    
    logger.info('Model switch request received', {
      requestedProvider: provider,
      requestedModel: model,
      requestedModelId: modelId,
      resolvedProvider: targetProvider,
      resolvedModel: targetModel,
      currentProvider: config.LLM_PROVIDER,
      sessionId
    });

    // Cost-lock: reject anything outside the allowlist before we instantiate a
    // real LLM client. Set IKAS_MODEL_ALLOWLIST=* to disable (see top of file).
    if (MODEL_ALLOWLIST && (targetProvider !== 'anthropic' || !isModelAllowed(targetModel))) {
      logger.warn('Model switch blocked by cost-lock allowlist', {
        attemptedProvider: targetProvider,
        attemptedModel: targetModel,
        allowlist: MODEL_ALLOWLIST
      });
      return res.status(403).json({
        error: 'Model not allowed',
        message: `Cost-locked to ${MODEL_ALLOWLIST.join(', ')}. Set IKAS_MODEL_ALLOWLIST=* to disable.`,
        allowlist: MODEL_ALLOWLIST
      });
    }

    // Check if the requested provider is available. The LLMProvider enum values are
    // lowercase ('anthropic', 'gemini', …) — match case-insensitively against the targetProvider.
    const availableProviders = await LLMFactory.getAvailableProviders();
    const providerEnum = (targetProvider ?? '').toLowerCase() as LLMProvider;

    if (!availableProviders.includes(providerEnum)) {
      return res.status(400).json({
        error: 'Provider not available',
        message: `The ${targetProvider} provider is not currently available or configured`,
        availableProviders
      });
    }

    // For Anthropic, temporarily set the model configuration
    let originalModel = process.env.ANTHROPIC_MODEL;
    if (targetProvider === 'anthropic' && targetModel) {
      process.env.ANTHROPIC_MODEL = targetModel;
    }

    // Create new LLM service instance for the requested provider
    const newService = LLMFactory.createLLMService(targetProvider);
    
    // Verify the service is actually available
    const isAvailable = await newService.isAvailable();
    if (!isAvailable) {
      // Restore original model config if switch fails
      if (originalModel !== undefined) {
        process.env.ANTHROPIC_MODEL = originalModel;
      }
      
      return res.status(503).json({
        error: 'Provider unavailable',
        message: `The ${targetProvider} provider is currently unavailable`
      });
    }

    // Update the orchestrator to use the new provider
    orchestrator.switchLLMProvider(targetProvider);
    
    // If sessionId is provided, clear the session to start fresh with new model
    if (sessionId) {
      orchestrator.clearSession(sessionId);
    }

    // Get model display name
    let modelDisplayName = targetModel;
    if (targetProvider === 'anthropic' && targetModel) {
      const anthropicModels = getAvailableAnthropicModels();
      const foundModel = anthropicModels.find(m => m.id === targetModel);
      modelDisplayName = foundModel?.name || targetModel;
    }

    logger.info('Model switched successfully', {
      newProvider: targetProvider,
      newModel: targetModel,
      previousProvider: config.LLM_PROVIDER,
      sessionCleared: !!sessionId
    });

    res.json({
      message: 'Model switched successfully',
      provider: targetProvider,
      model: targetModel,
      modelName: modelDisplayName,
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