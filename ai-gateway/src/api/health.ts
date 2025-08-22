import { Router } from 'express';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { wsClient } from '../websocket';
import axios from 'axios';

const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    keycloakMcp: ServiceHealth;
    neo4jMcp: ServiceHealth;
    websocket: ServiceHealth;
    redis?: ServiceHealth;
  };
  version: string;
  environment: string;
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
  error?: string;
  lastChecked: string;
}

async function checkMcpService(url: string, serviceName: string): Promise<ServiceHealth> {
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
    
    logger.warn(`Health check failed for ${serviceName}`, {
      service: serviceName,
      url,
      error: errorMessage,
      latency
    });
    
    return {
      status: 'unhealthy',
      latency,
      error: errorMessage,
      lastChecked: new Date().toISOString()
    };
  }
}

// Basic health check endpoint
healthRouter.get('/', async (req, res) => {
  try {
    const [keycloakHealth, neo4jHealth] = await Promise.all([
      checkMcpService(config.KEYCLOAK_MCP_URL, 'keycloak-mcp'),
      checkMcpService(config.NEO4J_MCP_URL, 'neo4j-mcp')
    ]);

    // Check WebSocket connection status
    const wsStatus = wsClient.getConnectionStatus();
    const websocketHealth: ServiceHealth = {
      status: wsStatus.connected ? 'healthy' : 'unhealthy',
      lastChecked: new Date().toISOString()
    };
    
    const overallHealthy = keycloakHealth.status === 'healthy' && neo4jHealth.status === 'healthy' && websocketHealth.status === 'healthy';
    
    const healthStatus: HealthStatus = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        keycloakMcp: keycloakHealth,
        neo4jMcp: neo4jHealth,
        websocket: websocketHealth
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV
    };
    
    const statusCode = overallHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Health check error:', error);
    
    const errorResponse: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        keycloakMcp: {
          status: 'unknown',
          error: 'Health check failed',
          lastChecked: new Date().toISOString()
        },
        neo4jMcp: {
          status: 'unknown',
          error: 'Health check failed',
          lastChecked: new Date().toISOString()
        },
        websocket: {
          status: 'unknown',
          error: 'Health check failed',
          lastChecked: new Date().toISOString()
        }
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV
    };
    
    res.status(503).json(errorResponse);
  }
});

// Liveness probe (basic process check)
healthRouter.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness probe (dependency check)
healthRouter.get('/ready', async (req, res) => {
  try {
    // Quick health check with shorter timeout
    const [keycloakReady, neo4jReady] = await Promise.all([
      checkMcpService(config.KEYCLOAK_MCP_URL, 'keycloak-mcp'),
      checkMcpService(config.NEO4J_MCP_URL, 'neo4j-mcp')
    ]);
    
    const ready = keycloakReady.status === 'healthy' && neo4jReady.status === 'healthy';
    
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        keycloakMcp: keycloakReady.status,
        neo4jMcp: neo4jReady.status
      }
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: 'Dependency check failed'
    });
  }
});

export { healthRouter };