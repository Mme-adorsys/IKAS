import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

export interface WebSocketConfig {
  url?: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface AnalysisRequest {
  analysisType: 'user_patterns' | 'compliance_check' | 'security_audit' | 'usage_statistics';
  parameters: Record<string, any>;
  sessionId: string;
}

export interface AIGatewayEvent {
  type: 'analysis_request' | 'chat_message';
  sessionId: string;
  payload: any;
  timestamp: string;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private eventHandlers: Map<string, (event: any) => void> = new Map();

  constructor(private wsConfig: WebSocketConfig = {}) {
    this.maxReconnectAttempts = wsConfig.reconnectionAttempts || 5;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.wsConfig.url || process.env.WEBSOCKET_SERVER_URL || 'http://localhost:3001';
        
        logger.info('Connecting to WebSocket server', { url: wsUrl });

        this.socket = io(wsUrl, {
          auth: {
            userId: 'ai-gateway',
            realm: 'system',
            service: 'ai-gateway'
          },
          reconnection: this.wsConfig.reconnection !== false,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.wsConfig.reconnectionDelay || 1000,
          timeout: 20000
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          logger.info('Connected to WebSocket server', {
            socketId: this.socket?.id
          });

          // Subscribe to analysis + compliance events. Voice/chat is no longer routed via WS —
          // the frontend hits the AI Gateway's /api/chat endpoints directly.
          this.socket?.emit('subscribe', {
            eventTypes: [
              'analysis:started',
              'compliance:check'
            ],
            room: 'global'
          });

          resolve();
        });

        this.socket.on('connected', (data) => {
          logger.info('WebSocket session established', {
            sessionId: data.sessionId,
            message: data.message
          });
        });

        this.socket.on('disconnect', (reason) => {
          this.isConnected = false;
          
          logger.warn('Disconnected from WebSocket server', {
            reason,
            reconnectAttempts: this.reconnectAttempts
          });
        });

        this.socket.on('connect_error', (error) => {
          this.reconnectAttempts++;
          
          logger.error('WebSocket connection error', {
            error: error.message,
            attempts: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts
          });

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
          }
        });

        // Handle incoming events
        this.socket.on('event', (event) => {
          this.handleIncomingEvent(event);
        });

        this.socket.on('subscriptionConfirmed', (data) => {
          logger.debug('Subscription confirmed', data);
        });

        this.socket.on('error', (error) => {
          logger.error('WebSocket error', { error });
        });

      } catch (error) {
        logger.error('Failed to initialize WebSocket connection', { error });
        reject(error);
      }
    });
  }

  private handleIncomingEvent(event: any): void {
    logger.debug('Received WebSocket event', {
      eventId: event.id,
      eventType: event.type,
      sessionId: event.sessionId
    });

    switch (event.type) {
      case 'analysis:started':
        this.handleAnalysisRequest(event);
        break;
      
      case 'compliance:check':
        this.handleComplianceCheck(event);
        break;
      
      default:
        logger.debug('Unhandled event type', { eventType: event.type });
    }

    // Call registered event handlers
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Error in event handler', {
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async handleAnalysisRequest(event: any): Promise<void> {
    try {
      const payload = event.payload;
      
      logger.info('Processing analysis request', {
        analysisId: payload.analysisId,
        analysisType: payload.analysisType,
        sessionId: event.sessionId
      });

      // Send progress update
      await this.sendAnalysisProgress(event.sessionId, payload.analysisId, 25, 'Initialisierung...');

      // Process analysis through orchestrator
      const analysisQuery = this.buildAnalysisQuery(payload.analysisType);
      const response = await this.processWithOrchestrator({
        userInput: analysisQuery,
        sessionId: event.sessionId,
        context: {
          source: 'analysis',
          analysisId: payload.analysisId,
          analysisType: payload.analysisType
        }
      });

      // Send progress update
      await this.sendAnalysisProgress(event.sessionId, payload.analysisId, 75, 'Daten analysieren...');

      // Send completion
      await this.sendAnalysisComplete(event.sessionId, payload.analysisId, {
        patterns: response.data?.patterns || [],
        summary: response.response,
        duration: response.duration
      });

    } catch (error) {
      logger.error('Error processing analysis request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id
      });

      await this.sendAnalysisError(event.sessionId, event.payload.analysisId, error);
    }
  }

  private async handleComplianceCheck(event: any): Promise<void> {
    // Handle compliance check events if needed
    logger.info('Compliance check received', {
      checkId: event.payload.checkId,
      severity: event.payload.severity
    });
  }

  private buildAnalysisQuery(analysisType: string): string {
    switch (analysisType) {
      case 'user_patterns':
        return 'Analysiere die Benutzermuster und finde Anomalien in der Benutzerverteilung';
      case 'compliance_check':
        return 'Führe eine vollständige Compliance-Prüfung durch und identifiziere Verstöße';
      case 'security_audit':
        return 'Erstelle ein Sicherheitsaudit und finde potenzielle Schwachstellen';
      case 'usage_statistics':
        return 'Erstelle Nutzungsstatistiken und analysiere die Systemnutzung';
      default:
        return `Analysiere das System für ${analysisType}`;
    }
  }

  private async processWithOrchestrator(request: any): Promise<any> {
    // Import orchestrator dynamically to avoid circular dependencies
    const { Orchestrator } = await import('../orchestration');
    const orchestrator = new Orchestrator();
    
    return await orchestrator.processRequest(request);
  }

  async sendDataUpdate(sessionId: string, dataType: string, data: any): Promise<void> {
    if (!this.isConnected || !this.socket) {
      logger.warn('Cannot send data update - not connected');
      return;
    }

    const dataEvent = {
      type: 'data:update',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        dataType,
        data
      }
    };

    this.socket.emit('event', dataEvent);
    
    logger.info('📡 Sent data update via WebSocket', {
      sessionId,
      dataType,
      eventType: 'data:update',
      recordCount: Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 0),
      dataSize: JSON.stringify(data).length,
      timestamp: dataEvent.timestamp,
      isArray: Array.isArray(data),
      sampleKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).slice(0, 5) : []
    });
  }

  async sendAnalysisProgress(
    sessionId: string, 
    analysisId: string, 
    progress: number, 
    status: string
  ): Promise<void> {
    if (!this.isConnected || !this.socket) return;

    const progressEvent = {
      type: 'analysis:progress',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        analysisId,
        progress,
        status
      }
    };

    this.socket.emit('event', progressEvent);
  }

  async sendAnalysisComplete(
    sessionId: string, 
    analysisId: string, 
    result: any
  ): Promise<void> {
    if (!this.isConnected || !this.socket) return;

    const completeEvent = {
      type: 'analysis:completed',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        analysisId,
        result,
        status: 'completed'
      }
    };

    this.socket.emit('event', completeEvent);
  }

  async sendAnalysisError(
    sessionId: string, 
    analysisId: string, 
    error: any
  ): Promise<void> {
    if (!this.isConnected || !this.socket) return;

    const errorEvent = {
      type: 'analysis:failed',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      }
    };

    this.socket.emit('event', errorEvent);
  }

  onEvent(eventType: string, handler: (event: any) => void): void {
    this.eventHandlers.set(eventType, handler);
  }

  offEvent(eventType: string): void {
    this.eventHandlers.delete(eventType);
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      
      logger.info('Disconnected from WebSocket server');
    }
  }

  getConnectionStatus(): {
    connected: boolean;
    socketId?: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Singleton instance
export const wsClient = new WebSocketClient({
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});