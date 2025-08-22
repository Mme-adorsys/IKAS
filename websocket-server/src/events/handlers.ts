import { Server as SocketIOServer } from 'socket.io';
import { IKASEvent, EventType, validateEvent } from '../types/events';
import { SessionManager } from '../rooms/session-manager';
import { EventPublisher } from '../redis/event-publisher';
import winston from 'winston';
import { randomUUID } from 'crypto';

export class EventHandlers {
  private io: SocketIOServer;
  private sessionManager: SessionManager;
  private eventPublisher: EventPublisher;
  private logger: winston.Logger;

  constructor(
    io: SocketIOServer,
    sessionManager: SessionManager,
    eventPublisher: EventPublisher,
    logger: winston.Logger
  ) {
    this.io = io;
    this.sessionManager = sessionManager;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  /**
   * Main event handler - distributes events to connected clients
   */
  async handleEvent(event: IKASEvent): Promise<void> {
    try {
      // Get recipients for this event
      const recipients = this.sessionManager.getEventRecipients(event);
      
      if (recipients.length === 0) {
        this.logger.debug('No recipients for event', {
          eventId: event.id,
          eventType: event.type
        });
        return;
      }

      // Send event to each recipient
      await this.distributeEvent(event, recipients);

      // Handle event-specific logic
      await this.processEventSpecificLogic(event);

      this.logger.debug('Event distributed', {
        eventId: event.id,
        eventType: event.type,
        recipients: recipients.length
      });

    } catch (error) {
      this.logger.error('Failed to handle event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id,
        eventType: event.type,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Distribute event to specific recipients
   */
  private async distributeEvent(event: IKASEvent, recipients: string[]): Promise<void> {
    const socketPromises = recipients.map(async (sessionId) => {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || !session.isActive) {
        return;
      }

      // Get socket by session
      const socket = this.io.sockets.sockets.get(session.socketId);
      if (!socket) {
        this.logger.warn('Socket not found for session', {
          sessionId,
          socketId: session.socketId
        });
        return;
      }

      // Send event to socket
      socket.emit('event', event);

      // Update last activity
      await this.sessionManager.updateLastActivity(sessionId);
    });

    await Promise.allSettled(socketPromises);
  }

  /**
   * Handle event-specific business logic
   */
  private async processEventSpecificLogic(event: IKASEvent): Promise<void> {
    switch (event.type) {
      case EventType.USER_CREATED:
      case EventType.USER_UPDATED:
      case EventType.USER_DELETED:
        await this.handleUserEvent(event);
        break;

      case EventType.ANALYSIS_STARTED:
      case EventType.ANALYSIS_PROGRESS:
      case EventType.ANALYSIS_COMPLETED:
        await this.handleAnalysisEvent(event);
        break;

      case EventType.COMPLIANCE_ALERT:
        await this.handleComplianceEvent(event);
        break;

      case EventType.VOICE_COMMAND:
      case EventType.VOICE_RESPONSE:
        await this.handleVoiceEvent(event);
        break;

      case EventType.GRAPH_UPDATE:
        await this.handleGraphEvent(event);
        break;

      case EventType.CONNECTION_STATUS:
        await this.handleConnectionEvent(event);
        break;

      default:
        // No special handling required for other event types
        break;
    }
  }

  /**
   * Handle user-related events
   */
  private async handleUserEvent(event: IKASEvent): Promise<void> {
    if (event.type === EventType.USER_CREATED) {
      // When a user is created, notify realm administrators
      if (event.realm) {
        const realmAdminSessions = await this.getRealmAdminSessions(event.realm);
        if (realmAdminSessions.length > 0) {
          // Create notification event for admins
          const notificationEvent: any = {
            id: randomUUID(),
            type: EventType.COMPLIANCE_CHECK,
            timestamp: new Date().toISOString(),
            sessionId: event.sessionId,
            realm: event.realm,
            payload: {
              checkId: randomUUID(),
              severity: 'info' as const,
              rule: 'user_creation',
              description: `Neuer Benutzer wurde erstellt: ${(event.payload as any).user?.username}`,
              affected: [{
                type: 'user' as const,
                id: (event.payload as any).user?.id || '',
                name: (event.payload as any).user?.username || 'Unknown'
              }],
              autoFixAvailable: false
            }
          };

          const validatedEvent = validateEvent(notificationEvent);
          await this.distributeEvent(validatedEvent, realmAdminSessions);
        }
      }
    }
  }

  /**
   * Handle analysis events
   */
  private async handleAnalysisEvent(event: IKASEvent): Promise<void> {
    if (event.type === EventType.ANALYSIS_COMPLETED) {
      const payload = event.payload as any;
      
      // If analysis found patterns or issues, create follow-up events
      if (payload.result && payload.result.patterns) {
        for (const pattern of payload.result.patterns) {
          const patternEvent: any = {
            id: randomUUID(),
            type: EventType.PATTERN_DETECTED,
            timestamp: new Date().toISOString(),
            sessionId: event.sessionId,
            realm: event.realm,
            payload: {
              pattern: {
                type: pattern.type,
                confidence: pattern.confidence,
                description: pattern.description,
                affected: pattern.affected || []
              }
            }
          };

          const validatedEvent = validateEvent(patternEvent);
          await this.eventPublisher.publishEvent(validatedEvent);
        }
      }
    }
  }

  /**
   * Handle compliance events
   */
  private async handleComplianceEvent(event: IKASEvent): Promise<void> {
    const payload = event.payload as any;
    
    if (payload.severity === 'critical' || payload.severity === 'error') {
      // For critical compliance issues, notify all realm administrators
      if (event.realm) {
        const adminSessions = await this.getRealmAdminSessions(event.realm);
        if (adminSessions.length > 0) {
          await this.distributeEvent(event, adminSessions);
        }
      }

      // Log critical compliance issues
      this.logger.warn('Critical compliance issue detected', {
        eventId: event.id,
        rule: payload.rule,
        severity: payload.severity,
        description: payload.description,
        affected: payload.affected
      });
    }
  }

  /**
   * Handle voice command events
   */
  private async handleVoiceEvent(event: IKASEvent): Promise<void> {
    const payload = event.payload as any;

    if (event.type === EventType.VOICE_COMMAND && payload.command) {
      // Log voice commands for analytics
      this.logger.info('Voice command processed', {
        sessionId: event.sessionId,
        command: payload.command,
        confidence: payload.confidence,
        language: payload.language
      });

      // If voice command has low confidence, create a response event asking for clarification
      if (payload.confidence && payload.confidence < 0.7) {
        const clarificationEvent: any = {
          id: randomUUID(),
          type: EventType.VOICE_RESPONSE,
          timestamp: new Date().toISOString(),
          sessionId: event.sessionId,
          payload: {
            response: 'Entschuldigung, ich habe Sie nicht ganz verstanden. Können Sie das bitte wiederholen?',
            confidence: 1.0,
            language: 'de-DE'
          }
        };

        const validatedEvent = validateEvent(clarificationEvent);
        await this.eventPublisher.publishEvent(validatedEvent);
      }
    }
  }

  /**
   * Handle graph update events
   */
  private async handleGraphEvent(event: IKASEvent): Promise<void> {
    const payload = event.payload as any;

    if (payload.nodes || payload.relationships) {
      // Notify subscribers about graph changes
      const subscriptionChannel = 'graph:update';
      
      // Update graph statistics
      await this.updateGraphStatistics(payload);

      this.logger.debug('Graph updated', {
        eventId: event.id,
        nodeCount: payload.nodes?.length || 0,
        relationshipCount: payload.relationships?.length || 0
      });
    }
  }

  /**
   * Handle connection status events
   */
  private async handleConnectionEvent(event: IKASEvent): Promise<void> {
    const payload = event.payload as any;

    if (payload.status === 'disconnected') {
      // Clean up session on disconnect
      if (event.sessionId) {
        await this.sessionManager.removeSession(event.sessionId);
      }
    }

    // Broadcast connection status to monitoring dashboards
    this.io.to('monitoring').emit('connectionStatus', {
      status: payload.status,
      clientCount: payload.clientCount,
      timestamp: event.timestamp
    });
  }

  /**
   * Get admin sessions for a realm
   */
  private async getRealmAdminSessions(realm: string): Promise<string[]> {
    // In a real implementation, this would query the user roles and permissions
    // For now, return sessions that are subscribed to the realm room
    const roomName = `realm:${realm}:admin`;
    return this.sessionManager.getRoomMembers(roomName);
  }

  /**
   * Update graph statistics
   */
  private async updateGraphStatistics(payload: any): Promise<void> {
    // This would update Redis counters for graph analytics
    // Implementation depends on specific requirements
    if (payload.nodes) {
      // Update node type statistics
      const nodeTypes = payload.nodes.reduce((types: Record<string, number>, node: any) => {
        for (const label of node.labels || []) {
          types[label] = (types[label] || 0) + 1;
        }
        return types;
      }, {});

      this.logger.debug('Node statistics', { nodeTypes });
    }

    if (payload.relationships) {
      // Update relationship type statistics
      const relTypes = payload.relationships.reduce((types: Record<string, number>, rel: any) => {
        types[rel.type] = (types[rel.type] || 0) + 1;
        return types;
      }, {});

      this.logger.debug('Relationship statistics', { relTypes });
    }
  }

  /**
   * Create system-wide announcements
   */
  async createSystemAnnouncement(
    message: string,
    severity: 'info' | 'warning' | 'error' = 'info',
    targetRealm?: string
  ): Promise<void> {
    const announcementEvent: any = {
      id: randomUUID(),
      type: EventType.COMPLIANCE_ALERT,
      timestamp: new Date().toISOString(),
      sessionId: 'system',
      realm: targetRealm,
      payload: {
        checkId: randomUUID(),
        severity,
        rule: 'system_announcement',
        description: message,
        affected: [],
        autoFixAvailable: false
      }
    };

    const validatedEvent = validateEvent(announcementEvent);
    await this.eventPublisher.publishEvent(validatedEvent);
  }

  /**
   * Handle system health checks
   */
  async performHealthCheck(): Promise<void> {
    const stats = this.sessionManager.getStatistics();
    
    const healthEvent: any = {
      id: randomUUID(),
      type: EventType.CONNECTION_STATUS,
      timestamp: new Date().toISOString(),
      sessionId: 'system',
      payload: {
        status: 'connected' as const,
        clientCount: stats.activeSessions,
        uptime: process.uptime(),
        services: {
          websocket: {
            status: 'healthy' as const,
            lastChecked: new Date().toISOString()
          },
          redis: {
            status: 'healthy' as const, // Would check Redis health in real implementation
            lastChecked: new Date().toISOString()
          }
        }
      }
    };

    const validatedEvent = validateEvent(healthEvent);
    await this.eventPublisher.publishEvent(validatedEvent, { persistent: false });
  }
}