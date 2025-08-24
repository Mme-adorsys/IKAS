import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Redis } from 'ioredis';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';

import { SessionManager } from './rooms/session-manager';
import { EventPublisher } from './redis/event-publisher';
import { EventSubscriber } from './redis/event-subscriber';
import { EventHandlers } from './events/handlers';
import { IKASEvent, EventType, createVoiceEvent, createAnalysisEvent } from './types/events';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Configuration
const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  CORS_ORIGIN: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3002'],
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10),
  AI_GATEWAY_URL: process.env.AI_GATEWAY_URL || 'http://localhost:8005'
};

class IKASWebSocketServer {
  private httpServer;
  private io: SocketIOServer;
  private redis: Redis;
  private sessionManager: SessionManager;
  private eventPublisher: EventPublisher;
  private eventSubscriber: EventSubscriber;
  private eventHandlers: EventHandlers;

  constructor() {
    // Create HTTP server with health endpoint handler
    this.httpServer = createServer((req, res) => {
      // Handle health check endpoint
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
          status: 'healthy',
          service: 'ikas-websocket-server',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          connections: this.io.engine.clientsCount
        }));
        return;
      }
      
      // For all other requests, let them fall through to Socket.IO
      // This ensures Socket.IO still handles WebSocket upgrades properly
    });

    // Configure Socket.IO
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.CORS_ORIGIN,
        credentials: config.CORS_CREDENTIALS,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    // Initialize Redis
    this.redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Initialize components
    this.sessionManager = new SessionManager(this.redis, logger);
    this.eventPublisher = new EventPublisher(this.redis, logger);
    this.eventSubscriber = new EventSubscriber(this.redis, logger);
    this.eventHandlers = new EventHandlers(
      this.io,
      this.sessionManager,
      this.eventPublisher,
      logger
    );

    this.setupSocketHandlers();
    this.setupEventSubscriptions();
    this.setupHealthCheck();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', async (socket) => {
      try {
        logger.info('New WebSocket connection', {
          socketId: socket.id,
          userAgent: socket.handshake.headers['user-agent'],
          remoteAddress: socket.handshake.address
        });

        // Create session
        const session = await this.sessionManager.createSession(
          socket.id,
          socket.handshake.headers['user-agent'],
          socket.handshake.address,
          socket.handshake.auth?.userId,
          socket.handshake.auth?.realm
        );

        // Send welcome message
        socket.emit('connected', {
          sessionId: session.id,
          timestamp: new Date().toISOString(),
          message: 'Welcome to IKAS! Connection established successfully.'
        });

        // Handle voice commands
        socket.on('voiceCommand', async (data) => {
          await this.handleVoiceCommand(socket, data);
        });

        // Handle text commands
        socket.on('textCommand', async (data) => {
          await this.handleTextCommand(socket, data);
        });

        // Handle subscription requests
        socket.on('subscribe', async (data) => {
          await this.handleSubscription(socket, data);
        });

        // Handle unsubscription requests
        socket.on('unsubscribe', async (data) => {
          await this.handleUnsubscription(socket, data);
        });

        // Handle room join requests
        socket.on('joinRoom', async (data) => {
          await this.handleJoinRoom(socket, data);
        });

        // Handle room leave requests
        socket.on('leaveRoom', async (data) => {
          await this.handleLeaveRoom(socket, data);
        });

        // Handle ping/pong for heartbeat
        socket.on('ping', () => {
          socket.emit('pong', { timestamp: new Date().toISOString() });
        });

        // Handle analysis requests
        socket.on('startAnalysis', async (data) => {
          await this.handleStartAnalysis(socket, data);
        });

        // Handle disconnect
        socket.on('disconnect', async (reason) => {
          await this.handleDisconnect(socket, reason);
        });

      } catch (error) {
        logger.error('Error handling new connection', {
          error: error instanceof Error ? error.message : 'Unknown error',
          socketId: socket.id,
          stack: error instanceof Error ? error.stack : undefined
        });
        socket.disconnect(true);
      }
    });
  }

  private async handleVoiceCommand(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Create voice command event
      const voiceEvent = createVoiceEvent(
        session.id,
        EventType.VOICE_COMMAND,
        {
          command: data.command,
          transcript: data.transcript,
          confidence: data.confidence || 1.0
        }
      );

      await this.eventPublisher.publishEvent(voiceEvent);

      // Send acknowledgment
      socket.emit('voiceCommandReceived', {
        eventId: voiceEvent.id,
        timestamp: voiceEvent.timestamp
      });

      // Forward to AI Gateway for processing
      await this.forwardToAIGateway(voiceEvent);

    } catch (error) {
      logger.error('Error handling voice command', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
      socket.emit('error', { 
        message: 'Error processing voice command' 
      });
    }
  }

  private async handleTextCommand(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Create text command event (using VOICE_COMMAND type as it's processed the same way)
      const textEvent = createVoiceEvent(
        session.id,
        EventType.VOICE_COMMAND,
        {
          command: data.message,
          transcript: data.message,
          confidence: 1.0
        }
      );

      await this.eventPublisher.publishEvent(textEvent);

      // Send acknowledgment
      socket.emit('textCommandReceived', {
        eventId: textEvent.id,
        timestamp: textEvent.timestamp
      });

      // Forward to AI Gateway for processing
      await this.forwardToAIGateway(textEvent, data.sessionId);

    } catch (error) {
      logger.error('Error handling text command', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
      socket.emit('error', { 
        message: 'Error processing text command' 
      });
    }
  }

  private async handleSubscription(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const { eventTypes, room, filters } = data;

      this.sessionManager.subscribe(session.id, {
        sessionId: session.id,
        eventTypes: eventTypes || [],
        room,
        filters,
        active: true
      });

      socket.emit('subscriptionConfirmed', {
        eventTypes,
        room,
        timestamp: new Date().toISOString()
      });

      logger.debug('Subscription created', {
        sessionId: session.id,
        eventTypes,
        room
      });

    } catch (error) {
      logger.error('Error handling subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
      socket.emit('error', { 
        message: 'Error creating subscription' 
      });
    }
  }

  private async handleUnsubscription(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        return;
      }

      const { eventTypes, room } = data;

      this.sessionManager.unsubscribe(session.id, eventTypes, room);

      socket.emit('unsubscriptionConfirmed', {
        eventTypes,
        room,
        timestamp: new Date().toISOString()
      });

      logger.debug('Unsubscription processed', {
        sessionId: session.id,
        eventTypes,
        room
      });

    } catch (error) {
      logger.error('Error handling unsubscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
    }
  }

  private async handleJoinRoom(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const { room } = data;
      const success = await this.sessionManager.joinRoom(session.id, room);

      if (success) {
        socket.join(room);
        socket.emit('roomJoined', {
          room,
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('error', { 
          message: `Unable to join room '${room}'` 
        });
      }

    } catch (error) {
      logger.error('Error joining room', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
    }
  }

  private async handleLeaveRoom(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        return;
      }

      const { room } = data;
      await this.sessionManager.leaveRoom(session.id, room);
      socket.leave(room);

      socket.emit('roomLeft', {
        room,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error leaving room', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
    }
  }

  private async handleStartAnalysis(socket: any, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const { analysisType, parameters } = data;
      const analysisId = randomUUID();

      // Create analysis started event
      const analysisEvent = createAnalysisEvent(
        session.id,
        analysisId,
        analysisType || 'user_patterns',
        'started'
      );

      await this.eventPublisher.publishEvent(analysisEvent);

      socket.emit('analysisStarted', {
        analysisId,
        type: analysisType,
        timestamp: new Date().toISOString()
      });

      // Forward to AI Gateway for actual analysis
      await this.forwardAnalysisRequest(analysisEvent, parameters);

    } catch (error) {
      logger.error('Error starting analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });
      socket.emit('error', { 
        message: 'Error starting analysis' 
      });
    }
  }

  private async handleDisconnect(socket: any, reason: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSessionBySocket(socket.id);
      if (session) {
        await this.sessionManager.removeSession(session.id);
        
        logger.info('WebSocket disconnected', {
          sessionId: session.id,
          socketId: socket.id,
          reason,
          duration: Date.now() - session.connectedAt.getTime()
        });
      }
    } catch (error) {
      logger.error('Error handling disconnect', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        reason
      });
    }
  }

  private setupEventSubscriptions(): void {
    // Subscribe to all events to distribute to connected clients
    this.eventSubscriber.subscribeToAll(async (event: IKASEvent) => {
      await this.eventHandlers.handleEvent(event);
    });

    logger.info('Event subscriptions set up');
  }

  private setupHealthCheck(): void {
    // Perform health checks every 30 seconds
    setInterval(async () => {
      try {
        await this.eventHandlers.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 30000);
  }

  private async forwardToAIGateway(event: IKASEvent, sessionId?: string): Promise<void> {
    try {
      logger.debug('Forwarding event to AI Gateway', {
        eventId: event.id,
        eventType: event.type,
        aiGatewayUrl: config.AI_GATEWAY_URL
      });

      // Extract command from event payload
      const payload = event.payload as any;
      const command = payload.command || payload.transcript;
      const source = payload.source || 'voice';

      if (!command) {
        logger.warn('No command found in event payload', { eventId: event.id });
        return;
      }

      // Make HTTP request to AI Gateway
      const requestBody = {
        message: command,
        sessionId: sessionId || event.sessionId,
        source: source
      };

      const response = await fetch(`${config.AI_GATEWAY_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`AI Gateway responded with status ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json() as any;

      // Create response event with AI Gateway's response
      const responseEvent = createVoiceEvent(
        event.sessionId,
        EventType.VOICE_RESPONSE,
        {
          response: responseData.response || 'Processing completed',
          executionTime: responseData.executionTime || 0,
          confidence: responseData.confidence || 1.0
        }
      );

      await this.eventPublisher.publishEvent(responseEvent);

      logger.debug('AI Gateway response processed', {
        eventId: event.id,
        responseLength: responseData.response?.length || 0,
        executionTime: responseData.executionTime
      });

    } catch (error) {
      logger.error('Error forwarding to AI Gateway', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Create error response event
      const errorEvent = createVoiceEvent(
        event.sessionId,
        EventType.VOICE_RESPONSE,
        {
          response: 'Sorry, I encountered an error processing your request. Please try again.',
          executionTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      await this.eventPublisher.publishEvent(errorEvent);
    }
  }

  private async forwardAnalysisRequest(event: IKASEvent, parameters: any): Promise<void> {
    try {
      // Forward analysis request to AI Gateway
      logger.debug('Forwarding analysis request to AI Gateway', {
        eventId: event.id,
        parameters
      });

      // Simulate analysis progress
      setTimeout(async () => {
        const progressEvent = createAnalysisEvent(
          event.sessionId,
          (event.payload as any).analysisId,
          (event.payload as any).analysisType,
          'running',
          50
        );

        await this.eventPublisher.publishEvent(progressEvent);
      }, 2000);

      setTimeout(async () => {
        const completedEvent = createAnalysisEvent(
          event.sessionId,
          (event.payload as any).analysisId,
          (event.payload as any).analysisType,
          'completed',
          100,
          { 
            patterns: [],
            summary: 'Analysis completed successfully'
          }
        );

        await this.eventPublisher.publishEvent(completedEvent);
      }, 5000);

    } catch (error) {
      logger.error('Error forwarding analysis request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id
      });
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer.listen(config.PORT, () => {
          logger.info('IKAS WebSocket Server started', {
            port: config.PORT,
            corsOrigins: config.CORS_ORIGIN,
            redisUrl: config.REDIS_URL.replace(/:[^:@]*@/, ':***@') // Hide password
          });
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    logger.info('Shutting down IKAS WebSocket Server...');

    // Close Socket.IO
    this.io.close();

    // Shutdown components
    await this.sessionManager.shutdown();
    await this.eventSubscriber.shutdown();

    // Close Redis connection
    await this.redis.quit();

    // Close HTTP server
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        logger.info('IKAS WebSocket Server stopped');
        resolve();
      });
    });
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new IKASWebSocketServer();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start server
  server.start().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export default IKASWebSocketServer;