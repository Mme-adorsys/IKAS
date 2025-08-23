import * as winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Custom formatter for development with pretty printing
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
    const reqId = requestId && typeof requestId === 'string' ? `[${requestId.slice(0, 8)}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? '\n' + JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}] ${reqId} ${message}${metaStr}`;
  })
);

// Production format (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create separate formatters for different log types
const geminiFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.label({ label: 'GEMINI' }),
  winston.format.json()
);

const mcpFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.label({ label: 'MCP' }),
  winston.format.json()
);

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'ikas-ai-gateway' },
  transports: [
    new winston.transports.Console({
      format: isDevelopment ? developmentFormat : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    // Separate log files for different components
    new winston.transports.File({
      filename: 'logs/gemini.log',
      format: geminiFormat,
      level: 'debug'
    }),
    new winston.transports.File({
      filename: 'logs/mcp.log', 
      format: mcpFormat,
      level: 'debug'
    })
  ],
});

// Request tracking helper
export class RequestTracker {
  private static activeRequests = new Map<string, { startTime: number; context: any }>();

  static startRequest(context: any = {}): string {
    const requestId = uuidv4();
    RequestTracker.activeRequests.set(requestId, {
      startTime: Date.now(),
      context
    });
    return requestId;
  }

  static endRequest(requestId: string): number {
    const request = RequestTracker.activeRequests.get(requestId);
    if (request) {
      RequestTracker.activeRequests.delete(requestId);
      return Date.now() - request.startTime;
    }
    return 0;
  }

  static getContext(requestId: string): any {
    return RequestTracker.activeRequests.get(requestId)?.context || {};
  }
}

// Specialized loggers for different components
export const geminiLogger = winston.createLogger({
  level: 'debug',
  format: geminiFormat,
  defaultMeta: { component: 'gemini' },
  transports: [
    new winston.transports.Console({
      format: developmentFormat
    }),
    new winston.transports.File({ filename: 'logs/gemini.log' })
  ]
});

export const mcpLogger = winston.createLogger({
  level: 'debug', 
  format: mcpFormat,
  defaultMeta: { component: 'mcp' },
  transports: [
    new winston.transports.Console({
      format: developmentFormat
    }),
    new winston.transports.File({ filename: 'logs/mcp.log' })
  ]
});

// Create logs directory if it doesn't exist
import { mkdir } from 'fs/promises';
mkdir('logs', { recursive: true }).catch(() => {
  // Directory might already exist, ignore error
});