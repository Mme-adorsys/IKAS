import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { config } from './utils/config';
import { healthRouter } from './api/health';
import { orchestrationRouter } from './api/orchestration';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'test' 
    ? true // Allow all origins in test environment
    : process.env.NODE_ENV === 'production' 
      ? ['https://your-production-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api', orchestrationRouter);

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Graceful shutdown handler
const gracefulShutdown = (signal: string): void => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server only if this file is run directly
if (require.main === module) {
  server.listen(config.PORT, () => {
    logger.info(`IKAS AI Gateway started`, {
      port: config.PORT,
      environment: config.NODE_ENV,
      keycloakMcp: config.KEYCLOAK_MCP_URL,
      neo4jMcp: config.NEO4J_MCP_URL
    });
  });
}

export default app;
export { server };