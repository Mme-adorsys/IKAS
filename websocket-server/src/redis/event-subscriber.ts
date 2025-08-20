import { Redis } from 'ioredis';
import { IKASEvent, EventType, validateEvent } from '../types/events';
import winston from 'winston';

export type EventHandler = (event: IKASEvent) => Promise<void> | void;

export interface SubscriptionOptions {
  pattern?: boolean;
  filters?: {
    sessionId?: string;
    userId?: string;
    realm?: string;
    eventTypes?: EventType[];
  };
}

export class EventSubscriber {
  private redis: Redis;
  private subscriber: Redis;
  private logger: winston.Logger;
  private keyPrefix: string;
  private handlers: Map<string, EventHandler[]> = new Map();
  private isConnected = false;

  constructor(redis: Redis, logger: winston.Logger, keyPrefix = 'ikas:') {
    this.redis = redis;
    this.logger = logger;
    this.keyPrefix = keyPrefix;
    
    // Create dedicated subscriber connection
    this.subscriber = redis.duplicate();
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriber.on('message', this.handleMessage.bind(this));
    this.subscriber.on('pmessage', this.handlePatternMessage.bind(this));
    
    this.subscriber.on('connect', () => {
      this.isConnected = true;
      this.logger.info('Event subscriber connected to Redis');
    });

    this.subscriber.on('error', (error) => {
      this.isConnected = false;
      this.logger.error('Redis subscriber error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.subscriber.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis subscriber connection closed');
    });
  }

  /**
   * Subscribe to specific event types
   */
  async subscribe(
    eventTypes: EventType | EventType[],
    handler: EventHandler,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    for (const eventType of types) {
      const channel = this.getEventChannel(eventType);
      
      // Add handler to local registry
      const existingHandlers = this.handlers.get(channel) || [];
      existingHandlers.push(handler);
      this.handlers.set(channel, existingHandlers);

      // Subscribe to Redis channel
      if (options.pattern) {
        await this.subscriber.psubscribe(channel);
      } else {
        await this.subscriber.subscribe(channel);
      }

      this.logger.debug('Subscribed to event type', {
        eventType,
        channel,
        pattern: options.pattern,
        handlerCount: existingHandlers.length
      });
    }
  }

  /**
   * Subscribe to all events matching a pattern
   */
  async subscribePattern(
    pattern: string,
    handler: EventHandler,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    const channel = `${this.keyPrefix}events:${pattern}`;
    
    // Add handler to local registry
    const existingHandlers = this.handlers.get(channel) || [];
    existingHandlers.push(handler);
    this.handlers.set(channel, existingHandlers);

    // Subscribe to Redis pattern
    await this.subscriber.psubscribe(channel);

    this.logger.debug('Subscribed to event pattern', {
      pattern,
      channel,
      handlerCount: existingHandlers.length
    });
  }

  /**
   * Unsubscribe from specific event types
   */
  async unsubscribe(
    eventTypes: EventType | EventType[],
    handler?: EventHandler
  ): Promise<void> {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    for (const eventType of types) {
      const channel = this.getEventChannel(eventType);
      const existingHandlers = this.handlers.get(channel) || [];

      if (handler) {
        // Remove specific handler
        const index = existingHandlers.indexOf(handler);
        if (index > -1) {
          existingHandlers.splice(index, 1);
        }
      } else {
        // Remove all handlers
        existingHandlers.length = 0;
      }

      // Update handler registry
      if (existingHandlers.length === 0) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      } else {
        this.handlers.set(channel, existingHandlers);
      }

      this.logger.debug('Unsubscribed from event type', {
        eventType,
        channel,
        remainingHandlers: existingHandlers.length
      });
    }
  }

  /**
   * Handle incoming messages from Redis
   */
  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      const validatedEvent = validateEvent(event);

      await this.processEvent(channel, validatedEvent);
    } catch (error) {
      this.logger.error('Failed to process event message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channel,
        message: message.substring(0, 200),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Handle incoming pattern messages from Redis
   */
  private async handlePatternMessage(
    pattern: string,
    channel: string,
    message: string
  ): Promise<void> {
    try {
      const event = JSON.parse(message);
      const validatedEvent = validateEvent(event);

      await this.processEvent(pattern, validatedEvent);
    } catch (error) {
      this.logger.error('Failed to process pattern event message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pattern,
        channel,
        message: message.substring(0, 200),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Process event and call registered handlers
   */
  private async processEvent(channelOrPattern: string, event: IKASEvent): Promise<void> {
    const handlers = this.handlers.get(channelOrPattern);
    if (!handlers || handlers.length === 0) {
      return;
    }

    this.logger.debug('Processing event', {
      eventId: event.id,
      eventType: event.type,
      channel: channelOrPattern,
      handlerCount: handlers.length
    });

    // Execute all handlers concurrently
    const handlerPromises = handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Event handler error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          eventId: event.id,
          eventType: event.type,
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    });

    await Promise.allSettled(handlerPromises);
  }

  /**
   * Subscribe to all event types for debugging
   */
  async subscribeToAll(handler: EventHandler): Promise<void> {
    await this.subscribePattern('*', handler);
  }

  /**
   * Subscribe to session-specific events
   */
  async subscribeToSession(
    sessionId: string,
    handler: EventHandler
  ): Promise<void> {
    // Create a filtered handler that only processes events for this session
    const sessionHandler: EventHandler = (event) => {
      if (event.sessionId === sessionId) {
        return handler(event);
      }
    };

    await this.subscribeToAll(sessionHandler);
  }

  /**
   * Subscribe to realm-specific events
   */
  async subscribeToRealm(
    realm: string,
    handler: EventHandler
  ): Promise<void> {
    // Create a filtered handler that only processes events for this realm
    const realmHandler: EventHandler = (event) => {
      if (event.realm === realm) {
        return handler(event);
      }
    };

    await this.subscribeToAll(realmHandler);
  }

  /**
   * Subscribe to user-specific events
   */
  async subscribeToUser(
    userId: string,
    handler: EventHandler
  ): Promise<void> {
    // Create a filtered handler that only processes events for this user
    const userHandler: EventHandler = (event) => {
      if (event.userId === userId) {
        return handler(event);
      }
    };

    await this.subscribeToAll(userHandler);
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalSubscriptions: number;
    channels: string[];
    isConnected: boolean;
  } {
    return {
      totalSubscriptions: this.handlers.size,
      channels: Array.from(this.handlers.keys()),
      isConnected: this.isConnected
    };
  }

  /**
   * Get the Redis channel name for an event type
   */
  private getEventChannel(eventType: EventType): string {
    return `${this.keyPrefix}events:${eventType}`;
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down event subscriber');
    
    // Unsubscribe from all channels
    await this.subscriber.punsubscribe();
    await this.subscriber.unsubscribe();
    
    // Clear handlers
    this.handlers.clear();
    
    // Close subscriber connection
    await this.subscriber.quit();
    
    this.isConnected = false;
    this.logger.info('Event subscriber shutdown complete');
  }
}