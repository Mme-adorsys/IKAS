import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN', 
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private nextAttempt: number = 0;
  private successCount: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError('Circuit breaker is OPEN');
      }
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to fully close
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;

      logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.options.failureThreshold,
        recoveryTimeout: this.options.recoveryTimeout,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class RetryableError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'RetryableError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true,
    retryCondition: (error) => isRetryableError(error),
    ...options
  };

  let lastError: any;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxAttempts || !config.retryCondition!(error)) {
        throw error;
      }

      logger.warn('Operation failed, retrying...', {
        attempt,
        maxAttempts: config.maxAttempts,
        delay,
        error: error instanceof Error ? error.message : String(error)
      });

      await sleep(delay);

      // Calculate next delay with exponential backoff and optional jitter
      delay = Math.min(delay * config.backoffFactor, config.maxDelay);
      if (config.jitter) {
        delay = delay + Math.random() * delay * 0.1; // Add 10% jitter
      }
    }
  }

  throw lastError;
}

export function isRetryableError(error: any): boolean {
  // Retry on specific HTTP status codes
  if (error?.response?.status) {
    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408;
  }

  // Retry on network errors
  if (error?.code) {
    const retryableCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    return retryableCodes.includes(error.code);
  }

  // Retry on Google Gemini specific errors
  if (error?.message) {
    const message = error.message.toLowerCase();
    return message.includes('500 internal server error') ||
           message.includes('rate limit') ||
           message.includes('quota exceeded') ||
           message.includes('service unavailable') ||
           message.includes('timeout');
  }

  return false;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Specific retry configuration for Gemini API
export const GEMINI_RETRY_CONFIG: Partial<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 8000,
  backoffFactor: 2,
  jitter: true,
  retryCondition: (error) => {
    // More specific retry conditions for Gemini
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      // Don't retry on authentication/authorization errors
      if (message.includes('401') || message.includes('403') || message.includes('invalid api key')) {
        return false;
      }
      
      // Don't retry on malformed request errors
      if (message.includes('400') || message.includes('bad request')) {
        return false;
      }
      
      // Retry on server errors and rate limits
      return message.includes('500') || 
             message.includes('503') || 
             message.includes('429') ||
             message.includes('rate limit') ||
             message.includes('quota exceeded') ||
             message.includes('internal error');
    }
    
    return isRetryableError(error);
  }
};

// Circuit breaker configuration for Gemini API
export const GEMINI_CIRCUIT_BREAKER_CONFIG: CircuitBreakerOptions = {
  failureThreshold: 5, // Open after 5 failures
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 60000 // 1 minute
};