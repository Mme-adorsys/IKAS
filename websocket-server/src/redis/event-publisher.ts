import { Redis } from 'ioredis';
import { IKASEvent, validateEvent } from '../types/events';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface PublishOptions {
  persistent?: boolean;
  ttl?: number;
  priority?: 'low' | 'normal' | 'high';
}

export class EventPublisher {
  private redis: Redis;
  private logger: winston.Logger;
  private keyPrefix: string;

  constructor(redis: Redis, logger: winston.Logger, keyPrefix = 'ikas:') {
    this.redis = redis;
    this.logger = logger;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Publish an event to Redis for distribution to WebSocket clients
   */
  async publishEvent(event: IKASEvent, options: PublishOptions = {}): Promise<void> {
    try {
      // Validate event structure
      const validatedEvent = validateEvent(event);

      // Add event ID if not present
      if (!validatedEvent.id) {
        validatedEvent.id = uuidv4();
      }

      const eventData = JSON.stringify(validatedEvent);
      const channel = this.getEventChannel(validatedEvent.type);

      // Publish to Redis channel for immediate distribution
      await this.redis.publish(channel, eventData);

      // Store event for persistence if requested
      if (options.persistent) {
        await this.storeEvent(validatedEvent, options.ttl);
      }

      // Update event metrics
      await this.updateEventMetrics(validatedEvent.type);

      this.logger.debug('Event published', {
        eventId: validatedEvent.id,
        eventType: validatedEvent.type,
        channel,
        sessionId: validatedEvent.sessionId,
        persistent: options.persistent
      });

    } catch (error) {
      this.logger.error('Failed to publish event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Publish multiple events in batch for better performance
   */
  async publishBatch(events: IKASEvent[], options: PublishOptions = {}): Promise<void> {
    if (events.length === 0) return;

    const pipeline = this.redis.pipeline();

    try {
      for (const event of events) {
        const validatedEvent = validateEvent(event);
        
        if (!validatedEvent.id) {
          validatedEvent.id = uuidv4();
        }

        const eventData = JSON.stringify(validatedEvent);
        const channel = this.getEventChannel(validatedEvent.type);

        // Add publish command to pipeline
        pipeline.publish(channel, eventData);

        // Add persistence command if requested
        if (options.persistent) {
          const key = `${this.keyPrefix}event:${validatedEvent.id}`;
          const ttl = options.ttl || 3600; // 1 hour default
          pipeline.setex(key, ttl, eventData);
        }
      }

      // Execute all commands in batch
      await pipeline.exec();

      // Update metrics for all event types
      const eventTypeCounts = events.reduce((counts, event) => {
        counts[event.type] = (counts[event.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      for (const [eventType, count] of Object.entries(eventTypeCounts)) {
        await this.updateEventMetrics(eventType, count);
      }

      this.logger.info('Event batch published', {
        eventCount: events.length,
        eventTypes: Object.keys(eventTypeCounts),
        persistent: options.persistent
      });

    } catch (error) {
      this.logger.error('Failed to publish event batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventCount: events.length,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Store event for historical access
   */
  private async storeEvent(event: IKASEvent, ttl = 3600): Promise<void> {
    const key = `${this.keyPrefix}event:${event.id}`;
    const eventData = JSON.stringify(event);

    await this.redis.setex(key, ttl, eventData);

    // Add to session event history
    if (event.sessionId) {
      const historyKey = `${this.keyPrefix}session:${event.sessionId}:events`;
      await this.redis.lpush(historyKey, event.id);
      await this.redis.expire(historyKey, ttl);
      
      // Keep only last 100 events per session
      await this.redis.ltrim(historyKey, 0, 99);
    }

    // Add to type-specific index
    const typeKey = `${this.keyPrefix}events:by_type:${event.type}`;
    await this.redis.zadd(
      typeKey,
      Date.parse(event.timestamp),
      event.id
    );
    await this.redis.expire(typeKey, ttl);
  }

  /**
   * Update event metrics for monitoring
   */
  private async updateEventMetrics(eventType: string, count = 1): Promise<void> {
    const now = new Date();
    const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    // Hourly metrics
    const hourlyKey = `${this.keyPrefix}metrics:events:${eventType}:${hour.getTime()}`;
    await this.redis.incrby(hourlyKey, count);
    await this.redis.expire(hourlyKey, 86400); // Keep for 24 hours

    // Daily total
    const dailyKey = `${this.keyPrefix}metrics:events:${eventType}:daily`;
    await this.redis.incrby(dailyKey, count);
    await this.redis.expire(dailyKey, 86400);

    // All-time total
    const totalKey = `${this.keyPrefix}metrics:events:${eventType}:total`;
    await this.redis.incrby(totalKey, count);
  }

  /**
   * Get the Redis channel name for an event type
   */
  private getEventChannel(eventType: string): string {
    return `${this.keyPrefix}events:${eventType}`;
  }

  /**
   * Get event history for a session
   */
  async getSessionEventHistory(sessionId: string, limit = 50): Promise<IKASEvent[]> {
    const historyKey = `${this.keyPrefix}session:${sessionId}:events`;
    const eventIds = await this.redis.lrange(historyKey, 0, limit - 1);

    if (eventIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    for (const eventId of eventIds) {
      pipeline.get(`${this.keyPrefix}event:${eventId}`);
    }

    const results = await pipeline.exec();
    const events: IKASEvent[] = [];

    if (results) {
      for (const [error, result] of results) {
        if (!error && result) {
          try {
            const event = JSON.parse(result as string);
            events.push(validateEvent(event));
          } catch (parseError) {
            this.logger.warn('Failed to parse stored event', {
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Get events by type within a time range
   */
  async getEventsByType(
    eventType: string, 
    fromTime: Date, 
    toTime: Date, 
    limit = 100
  ): Promise<IKASEvent[]> {
    const typeKey = `${this.keyPrefix}events:by_type:${eventType}`;
    const eventIds = await this.redis.zrangebyscore(
      typeKey,
      fromTime.getTime(),
      toTime.getTime(),
      'LIMIT',
      0,
      limit
    );

    if (eventIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    for (const eventId of eventIds) {
      pipeline.get(`${this.keyPrefix}event:${eventId}`);
    }

    const results = await pipeline.exec();
    const events: IKASEvent[] = [];

    if (results) {
      for (const [error, result] of results) {
        if (!error && result) {
          try {
            const event = JSON.parse(result as string);
            events.push(validateEvent(event));
          } catch (parseError) {
            this.logger.warn('Failed to parse stored event', {
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Get event metrics for monitoring
   */
  async getEventMetrics(): Promise<Record<string, any>> {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    const keys = await this.redis.keys(`${this.keyPrefix}metrics:events:*`);
    const pipeline = this.redis.pipeline();

    for (const key of keys) {
      pipeline.get(key);
    }

    const results = await pipeline.exec();
    const metrics: Record<string, any> = {
      currentHour: currentHour.toISOString(),
      events: {}
    };

    if (results) {
      for (let i = 0; i < keys.length; i++) {
        const [error, result] = results[i];
        if (!error && result) {
          const key = keys[i];
          const value = parseInt(result as string, 10);
          const keyParts = key.replace(this.keyPrefix, '').split(':');
          
          if (keyParts.length >= 3) {
            const eventType = keyParts[2];
            const metricType = keyParts[3] || 'unknown';
            
            if (!metrics.events[eventType]) {
              metrics.events[eventType] = {};
            }
            
            metrics.events[eventType][metricType] = value;
          }
        }
      }
    }

    return metrics;
  }
}