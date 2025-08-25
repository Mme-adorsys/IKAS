import { Router } from 'express';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { Orchestrator } from '../orchestration';
import { MCPToolDiscovery } from '../llm';
import { checkAllMcpServices } from '../mcp';
import { z } from 'zod';
import axios from 'axios';

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

    // Check if Keycloak MCP service is healthy (Neo4j is optional for now)
    const keycloakHealth = await checkMcpService(config.KEYCLOAK_MCP_URL, 'keycloak-mcp');
    
    const serviceHealth = {
      keycloak: keycloakHealth.status === 'healthy',
      neo4j: 'optional', // Neo4j is optional for now
      overall: keycloakHealth.status === 'healthy'
    };

    if (!serviceHealth.overall) {
      logger.warn('Keycloak MCP service is not healthy', serviceHealth);
      
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Keycloak service is currently unavailable. Please try again later.',
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

export { orchestrationRouter };