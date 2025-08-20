import { io, Socket } from 'socket.io-client';
import { IKASEvent, EventType, VoiceCommand, Subscription } from '@/types/events';

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, (event: any) => void> = new Map();
  private sessionId: string | null = null;

  constructor(private url: string = 'http://localhost:3001') {}

  async connect(userId?: string, realm?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔗 Connecting to IKAS WebSocket server...', this.url);

        this.socket = io(this.url, {
          auth: {
            userId: userId || 'frontend-user',
            realm: realm || 'master'
          },
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          timeout: 20000
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
          console.error('🚫 WebSocket connection error', {
            error: error.message,
            attempts: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts
          });

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
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
}

// Singleton instance
export const websocketService = new WebSocketService();