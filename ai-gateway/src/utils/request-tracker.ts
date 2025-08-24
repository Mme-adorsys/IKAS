/**
 * Request Tracker Utility
 * 
 * Simple utility for tracking request performance and generating unique request IDs
 */

import { v4 as uuidv4 } from 'uuid';

const activeRequests = new Map<string, number>();

export class RequestTracker {
  /**
   * Start tracking a new request
   */
  static startRequest(): string {
    const requestId = uuidv4();
    activeRequests.set(requestId, Date.now());
    return requestId;
  }

  /**
   * End request tracking and return duration
   */
  static endRequest(requestId: string): number {
    const startTime = activeRequests.get(requestId);
    if (!startTime) {
      return 0;
    }
    
    activeRequests.delete(requestId);
    return Date.now() - startTime;
  }

  /**
   * Get the number of active requests
   */
  static getActiveCount(): number {
    return activeRequests.size;
  }

  /**
   * Clear all tracked requests (for cleanup)
   */
  static clear(): void {
    activeRequests.clear();
  }
}