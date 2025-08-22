import { io, Socket } from 'socket.io-client';
import { IKASEvent, EventType, VoiceCommand, Subscription } from '@/types/events';

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private connectionTimeout: number;
  private eventHandlers: Map<string, (event: any) => void> = new Map();
  private sessionId: string | null = null;
  private debugMode: boolean;
  private url: string;

  constructor(url?: string) {
    // Use environment variables with fallbacks
    this.url = url || 
               process.env.NEXT_PUBLIC_WS_URL || 
               'ws://localhost:3001';
    
    this.maxReconnectAttempts = parseInt(process.env.NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS || '5');
    this.reconnectDelay = parseInt(process.env.NEXT_PUBLIC_WS_RECONNECT_DELAY || '1000');
    this.connectionTimeout = parseInt(process.env.NEXT_PUBLIC_WS_TIMEOUT || '10000');
    this.debugMode = process.env.NEXT_PUBLIC_DEBUG_WEBSOCKET === 'true';

    if (this.debugMode) {
      console.log('🔧 WebSocket Service Configuration:', {
        url: this.url,
        maxReconnectAttempts: this.maxReconnectAttempts,
        reconnectDelay: this.reconnectDelay,
        connectionTimeout: this.connectionTimeout
      });
    }
  }

  async connect(userId?: string, realm?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const connectionLog = this.debugMode ? console.log : () => {};
        connectionLog('🔗 Connecting to IKAS WebSocket server...', {
          url: this.url,
          userId: userId || 'frontend-user',
          realm: realm || 'master'
        });

        // Check if already connected
        if (this.isConnected && this.socket?.connected) {
          connectionLog('✅ Already connected to WebSocket server');
          resolve();
          return;
        }

        // Validate WebSocket URL
        if (!this.isValidWebSocketUrl(this.url)) {
          const error = new Error(`Invalid WebSocket URL: ${this.url}`);
          console.error('❌ WebSocket URL validation failed:', error.message);
          reject(error);
          return;
        }

        this.socket = io(this.url, {
          auth: {
            userId: userId || 'frontend-user',
            realm: realm || 'master'
          },
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          timeout: this.connectionTimeout,
          transports: ['websocket', 'polling'],
          forceNew: false,
          autoConnect: true
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          console.log('✅ Connected to IKAS WebSocket server', {
            socketId: this.socket?.id
          });

          resolve();
        });

        this.socket.on('connected', (data) => {
          this.sessionId = data.sessionId;
          console.log('🎯 IKAS session established', {
            sessionId: data.sessionId,
            message: data.message
          });
        });

        this.socket.on('disconnect', (reason) => {
          this.isConnected = false;
          console.warn('❌ Disconnected from IKAS WebSocket server', { reason });
        });

        this.socket.on('connect_error', (error) => {
          this.reconnectAttempts++;
          
          const errorDetails = {
            error: error.message,
            attempts: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            url: this.url,
            timestamp: new Date().toISOString()
          };

          console.error('🚫 WebSocket connection error', errorDetails);

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            const finalError = new Error(
              `WebSocket connection failed after ${this.maxReconnectAttempts} attempts. ` +
              `Check if WebSocket server is running at ${this.url}. ` +
              `Original error: ${error.message}`
            );
            
            this.callHandler('connectionFailed', errorDetails);
            reject(finalError);
          } else {
            this.callHandler('connectionRetrying', errorDetails);
          }
        });

        this.socket.on('event', (event: IKASEvent) => {
          this.handleIncomingEvent(event);
        });

        this.socket.on('voiceCommandReceived', (data) => {
          console.log('🎤 Voice command acknowledged', data);
          this.callHandler('voiceCommandReceived', data);
        });

        this.socket.on('subscriptionConfirmed', (data) => {
          console.log('📢 Subscription confirmed', data);
          this.callHandler('subscriptionConfirmed', data);
        });

        this.socket.on('error', (error) => {
          console.error('⚠️ WebSocket error', error);
          this.callHandler('error', error);
        });

      } catch (error) {
        console.error('Failed to initialize WebSocket connection', error);
        reject(error);
      }
    });
  }

  private handleIncomingEvent(event: IKASEvent): void {
    console.log('📨 Received IKAS event', {
      eventId: event.id,
      eventType: event.type,
      sessionId: event.sessionId
    });

    // Call type-specific handlers
    this.callHandler(event.type, event);
    this.callHandler('*', event); // Global handler
  }

  private callHandler(eventType: string, data: any): void {
    const handler = this.eventHandlers.get(eventType);
    if (handler) {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in event handler', {
          eventType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Event subscription methods
  on(eventType: EventType | string, handler: (event: any) => void): void {
    this.eventHandlers.set(eventType, handler);
  }

  off(eventType: EventType | string): void {
    this.eventHandlers.delete(eventType);
  }

  // Voice command methods
  async sendVoiceCommand(voiceCommand: VoiceCommand): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    console.log('🎤 Sending voice command', {
      command: voiceCommand.command,
      confidence: voiceCommand.confidence
    });

    this.socket.emit('voiceCommand', voiceCommand);
  }

  // Subscription methods
  async subscribe(subscription: Subscription): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    console.log('📢 Subscribing to events', subscription);
    this.socket.emit('subscribe', subscription);
  }

  async unsubscribe(eventTypes: EventType[], room?: string): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    console.log('📢 Unsubscribing from events', { eventTypes, room });
    this.socket.emit('unsubscribe', { eventTypes, room });
  }

  // Room methods
  async joinRoom(room: string): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    console.log('🚪 Joining room', { room });
    this.socket.emit('joinRoom', { room });
  }

  async leaveRoom(room: string): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    console.log('🚪 Leaving room', { room });
    this.socket.emit('leaveRoom', { room });
  }

  // Analysis methods
  async startAnalysis(analysisType: string, parameters: Record<string, any> = {}): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    console.log('🔍 Starting analysis', { analysisType, parameters });
    this.socket.emit('startAnalysis', { analysisType, parameters });
  }

  // Utility methods
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getConnectionStatus(): {
    connected: boolean;
    socketId?: string;
    sessionId?: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      sessionId: this.sessionId || undefined,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.sessionId = null;
      this.eventHandlers.clear();
      
      console.log('🔌 Disconnected from IKAS WebSocket server');
    }
  }

  // Ping/Pong for heartbeat
  ping(): void {
    if (this.socket) {
      this.socket.emit('ping');
    }
  }

  // URL validation
  private isValidWebSocketUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['ws:', 'wss:', 'http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // Connection health check
  async testConnection(): Promise<boolean> {
    if (!this.isConnected || !this.socket) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      this.socket!.emit('ping', (response: any) => {
        clearTimeout(timeout);
        resolve(response === 'pong');
      });
    });
  }

  // Enhanced connection status with service availability
  async getEnhancedConnectionStatus(): Promise<{
    connected: boolean;
    socketId?: string;
    sessionId?: string;
    reconnectAttempts: number;
    url: string;
    healthy: boolean;
    lastPingTime?: number;
  }> {
    const healthy = await this.testConnection();
    
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      sessionId: this.sessionId || undefined,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url,
      healthy,
      lastPingTime: healthy ? Date.now() : undefined
    };
  }

  // Force reconnection
  async forceReconnect(userId?: string, realm?: string): Promise<void> {
    console.log('🔄 Forcing WebSocket reconnection...');
    
    if (this.socket) {
      await this.disconnect();
    }
    
    // Reset reconnection attempts
    this.reconnectAttempts = 0;
    
    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.connect(userId, realm);
  }
}

// Singleton instance
export const websocketService = new WebSocketService();