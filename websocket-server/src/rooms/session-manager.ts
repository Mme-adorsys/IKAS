import { Session, RoomConfig, Subscription } from '../types/session';
import { EventType, IKASEvent } from '../types/events';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private socketToSession: Map<string, string> = new Map();
  private rooms: Map<string, RoomConfig> = new Map();
  private subscriptions: Map<string, Subscription[]> = new Map();
  private redis: Redis;
  private logger: winston.Logger;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
    
    // Initialize default rooms
    this.initializeDefaultRooms();
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  private initializeDefaultRooms(): void {
    // Global room for system-wide events
    this.rooms.set('global', {
      name: 'global',
      type: 'global',
      requiresAuth: false,
      permissions: ['system:read']
    });

    // Analysis room for real-time analysis updates
    this.rooms.set('analysis', {
      name: 'analysis',
      type: 'analysis',
      requiresAuth: false,
      permissions: ['analysis:read']
    });

    this.logger.info('Default rooms initialized', {
      rooms: Array.from(this.rooms.keys())
    });
  }

  // Session Management
  async createSession(
    socketId: string,
    userAgent?: string,
    ipAddress?: string,
    userId?: string,
    realm?: string
  ): Promise<Session> {
    const sessionId = uuidv4();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      userId,
      realm,
      socketId,
      userAgent,
      ipAddress,
      connectedAt: now,
      lastActivity: now,
      isActive: true,
      subscriptions: [],
      language: 'de-DE',
      metadata: {}
    };

    this.sessions.set(sessionId, session);
    this.socketToSession.set(socketId, sessionId);

    // Store session in Redis for persistence
    await this.redis.setex(
      `session:${sessionId}`,
      parseInt(process.env.SESSION_TIMEOUT || '3600'),
      JSON.stringify({
        ...session,
        connectedAt: session.connectedAt.toISOString(),
        lastActivity: session.lastActivity.toISOString()
      })
    );

    // Join global room by default
    await this.joinRoom(sessionId, 'global');

    // Join realm-specific room if realm is provided
    if (realm) {
      const realmRoomName = `realm:${realm}`;
      if (!this.rooms.has(realmRoomName)) {
        this.rooms.set(realmRoomName, {
          name: realmRoomName,
          type: 'realm',
          requiresAuth: true,
          permissions: [`realm:${realm}:read`]
        });
      }
      await this.joinRoom(sessionId, realmRoomName);
    }

    this.logger.info('Session created', {
      sessionId,
      socketId,
      userId,
      realm,
      ipAddress
    });

    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to load from Redis
      const stored = await this.redis.get(`session:${sessionId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        session = {
          ...parsed,
          connectedAt: new Date(parsed.connectedAt),
          lastActivity: new Date(parsed.lastActivity)
        };
        if (session) {
          this.sessions.set(sessionId, session);
        }
      }
    }

    return session;
  }

  async getSessionBySocket(socketId: string): Promise<Session | undefined> {
    const sessionId = this.socketToSession.get(socketId);
    return sessionId ? await this.getSession(sessionId) : undefined;
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date();
      await this.redis.setex(
        `session:${sessionId}`,
        parseInt(process.env.SESSION_TIMEOUT || '3600'),
        JSON.stringify({
          ...session,
          connectedAt: session.connectedAt.toISOString(),
          lastActivity: session.lastActivity.toISOString()
        })
      );
    }
  }

  async removeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      // Remove from local maps
      this.sessions.delete(sessionId);
      this.socketToSession.delete(session.socketId);
      this.subscriptions.delete(sessionId);

      // Remove from Redis
      await this.redis.del(`session:${sessionId}`);

      this.logger.info('Session removed', {
        sessionId,
        socketId: session.socketId,
        userId: session.userId
      });
    }
  }

  // Room Management
  createRoom(name: string, config: RoomConfig): void {
    this.rooms.set(name, config);
    this.logger.info('Room created', { name, type: config.type });
  }

  async joinRoom(sessionId: string, roomName: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    const room = this.rooms.get(roomName);

    if (!session || !room) {
      return false;
    }

    // Check permissions if required
    if (room.requiresAuth && room.permissions) {
      // In a real implementation, check user permissions here
      // For now, allow all authenticated users
      if (!session.userId) {
        return false;
      }
    }

    // Add to session's subscriptions if not already present
    if (!session.subscriptions.includes(roomName)) {
      session.subscriptions.push(roomName);
    }

    this.logger.debug('Session joined room', {
      sessionId,
      roomName,
      userId: session.userId
    });

    return true;
  }

  async leaveRoom(sessionId: string, roomName: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.subscriptions = session.subscriptions.filter(sub => sub !== roomName);

    this.logger.debug('Session left room', {
      sessionId,
      roomName,
      userId: session.userId
    });

    return true;
  }

  getRoomMembers(roomName: string): string[] {
    const members: string[] = [];
    for (const [sessionId, session] of this.sessions) {
      if (session.subscriptions.includes(roomName)) {
        members.push(sessionId);
      }
    }
    return members;
  }

  // Event Subscription Management
  subscribe(sessionId: string, subscription: Subscription): void {
    const currentSubs = this.subscriptions.get(sessionId) || [];
    currentSubs.push(subscription);
    this.subscriptions.set(sessionId, currentSubs);

    this.logger.debug('Subscription added', {
      sessionId,
      eventTypes: subscription.eventTypes,
      room: subscription.room
    });
  }

  unsubscribe(sessionId: string, eventTypes?: string[], room?: string): void {
    const currentSubs = this.subscriptions.get(sessionId) || [];
    
    const filteredSubs = currentSubs.filter(sub => {
      if (eventTypes && !eventTypes.some(et => sub.eventTypes.includes(et))) {
        return true;
      }
      if (room && sub.room !== room) {
        return true;
      }
      return false;
    });

    this.subscriptions.set(sessionId, filteredSubs);

    this.logger.debug('Subscription removed', {
      sessionId,
      eventTypes,
      room
    });
  }

  // Event Distribution
  getEventRecipients(event: IKASEvent): string[] {
    const recipients = new Set<string>();

    // Get all active sessions
    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive) continue;

      const subscriptions = this.subscriptions.get(sessionId) || [];

      for (const subscription of subscriptions) {
        if (!subscription.active) continue;

        // Check if session is subscribed to this event type
        if (subscription.eventTypes.includes(event.type)) {
          // Check room-based filtering
          if (subscription.room) {
            if (session.subscriptions.includes(subscription.room)) {
              recipients.add(sessionId);
            }
          } else {
            recipients.add(sessionId);
          }
        }

        // Check realm-based filtering
        if (event.realm && session.realm === event.realm) {
          recipients.add(sessionId);
        }

        // Check user-based filtering
        if (event.userId && session.userId === event.userId) {
          recipients.add(sessionId);
        }
      }
    }

    return Array.from(recipients);
  }

  // Statistics
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    totalRooms: number;
    totalSubscriptions: number;
    roomMemberCounts: Record<string, number>;
  } {
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => session.isActive).length;

    const roomMemberCounts: Record<string, number> = {};
    for (const roomName of this.rooms.keys()) {
      roomMemberCounts[roomName] = this.getRoomMembers(roomName).length;
    }

    const totalSubscriptions = Array.from(this.subscriptions.values())
      .reduce((total, subs) => total + subs.length, 0);

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalRooms: this.rooms.size,
      totalSubscriptions,
      roomMemberCounts
    };
  }

  // Cleanup
  private startCleanupInterval(): void {
    const interval = parseInt(process.env.CLEANUP_INTERVAL || '300000'); // 5 minutes
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, interval);

    this.logger.info('Cleanup interval started', { interval });
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    const timeout = parseInt(process.env.SESSION_TIMEOUT || '3600000'); // 1 hour
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const lastActivity = session.lastActivity.getTime();
      const age = now.getTime() - lastActivity;

      if (age > timeout) {
        await this.removeSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Inactive sessions cleaned up', { count: cleanedCount });
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clean up all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.removeSession(sessionId);
    }

    this.logger.info('Session manager shut down');
  }
}