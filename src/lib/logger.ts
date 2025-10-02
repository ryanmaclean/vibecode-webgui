/**
 * Winston-based structured logging utility for VibeCode WebGUI
 *
 * This logger provides structured logging with multiple transports,
 * log levels, and metadata support for production environments.
 *
 * @module logger
 * @see https://github.com/winstonjs/winston
 */

import * as winston from 'winston';
import type { Logger as WinstonLogger } from 'winston';

/**
 * Log levels supported by the logger
 * - error: Critical errors requiring immediate attention
 * - warn: Warning messages for potential issues
 * - info: Informational messages about application flow
 * - http: HTTP request/response logging
 * - debug: Detailed debugging information
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

/**
 * Environment-aware log level configuration
 * - production: info (minimal logging)
 * - development: debug (verbose logging)
 * - test: error (quiet tests)
 */
const getLogLevel = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const configuredLevel = process.env.LOG_LEVEL;

  if (configuredLevel) {
    return configuredLevel;
  }

  switch (env) {
    case 'production':
      return 'info';
    case 'test':
      return 'error';
    case 'development':
    default:
      return 'debug';
  }
};

/**
 * Custom format for development - colorized and human-readable
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    const metaKeys = Object.keys(metadata);
    if (metaKeys.length > 0) {
      // Remove Winston's internal Symbol properties
      const cleanMeta = metaKeys
        .filter(key => typeof key === 'string')
        .reduce((acc, key) => ({ ...acc, [key]: metadata[key] }), {});

      if (Object.keys(cleanMeta).length > 0) {
        msg += `\n${JSON.stringify(cleanMeta, null, 2)}`;
      }
    }

    return msg;
  })
);

/**
 * Sensitive data patterns to filter from logs
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session[_-]?id/i,
];

/**
 * Filter sensitive data from log metadata
 */
const filterSensitiveData = winston.format((info) => {
  const sanitize = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key matches sensitive patterns
      const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize the entire info object
  const { level, message, timestamp, ...metadata } = info;
  return {
    level,
    message,
    timestamp,
    ...sanitize(metadata),
  };
});

/**
 * Custom format for production - JSON structured logs with security filtering
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  filterSensitiveData(),
  winston.format.json()
);

/**
 * Configure transports based on environment
 */
const getTransports = (): winston.transport[] => {
  const env = process.env.NODE_ENV || 'development';
  const transports: winston.transport[] = [];

  // Console transport - always enabled
  transports.push(
    new winston.transports.Console({
      format: env === 'production' ? productionFormat : developmentFormat,
    })
  );

  // File transports - production only
  if (env === 'production') {
    // Error log file - errors only
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );

    // Combined log file - all levels
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    );
  }

  return transports;
};

/**
 * Create the Winston logger instance
 */
const createLogger = (): WinstonLogger => {
  return winston.createLogger({
    level: getLogLevel(),
    transports: getTransports(),
    // Prevent unhandled exceptions from crashing the app
    exitOnError: false,
    // Add default metadata to all logs
    defaultMeta: {
      service: 'vibecode-webgui',
      environment: process.env.NODE_ENV || 'development',
    },
  });
};

/**
 * Global logger instance
 *
 * @example
 * ```typescript
 * // Basic logging
 * logger.info('Application started');
 * logger.error('Database connection failed');
 *
 * // Logging with metadata
 * logger.info('User logged in', { userId: '123', ip: '192.168.1.1' });
 * logger.error('API request failed', {
 *   endpoint: '/api/users',
 *   statusCode: 500,
 *   error: error.message
 * });
 *
 * // Logging errors with stack traces
 * try {
 *   throw new Error('Something went wrong');
 * } catch (error) {
 *   logger.error('Operation failed', { error });
 * }
 *
 * // Debug logging (only in development)
 * logger.debug('Cache hit', { key: 'user:123', ttl: 3600 });
 *
 * // HTTP request logging
 * logger.http('GET /api/users', {
 *   method: 'GET',
 *   url: '/api/users',
 *   statusCode: 200,
 *   responseTime: 45
 * });
 * ```
 */
export const logger: WinstonLogger = createLogger();

/**
 * Create a child logger with additional context
 *
 * Useful for adding persistent metadata to all logs in a specific module or context.
 *
 * @example
 * ```typescript
 * // Create a logger for a specific module
 * const dbLogger = createChildLogger({ module: 'database' });
 * dbLogger.info('Connected to database'); // Includes module: 'database'
 *
 * // Create a logger for a specific user request
 * const requestLogger = createChildLogger({
 *   requestId: req.id,
 *   userId: req.user.id
 * });
 * requestLogger.info('Processing request'); // Includes requestId and userId
 * ```
 */
export const createChildLogger = (metadata: Record<string, unknown>): WinstonLogger => {
  return logger.child(metadata);
};

/**
 * Create a request logger with request ID for tracing
 *
 * @example
 * ```typescript
 * const requestLogger = createRequestLogger('req-123', { userId: '456' });
 * requestLogger.info('Processing user request');
 * ```
 */
export const createRequestLogger = (
  requestId: string,
  metadata?: Record<string, unknown>
): WinstonLogger => {
  return createChildLogger({
    requestId,
    ...metadata,
  });
};

/**
 * Log performance metrics
 *
 * @example
 * ```typescript
 * const start = Date.now();
 * await someOperation();
 * logPerformance('someOperation', Date.now() - start, { userId: '123' });
 * ```
 */
export const logPerformance = (
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void => {
  logger.info('Performance metric', {
    operation,
    durationMs,
    ...metadata,
  });
};

/**
 * Log API requests
 *
 * @example
 * ```typescript
 * logApiRequest('GET', '/api/users', 200, 45, { userId: '123' });
 * ```
 */
export const logApiRequest = (
  method: string,
  url: string,
  statusCode: number,
  responseTimeMs: number,
  metadata?: Record<string, unknown>
): void => {
  logger.http('API Request', {
    method,
    url,
    statusCode,
    responseTimeMs,
    ...metadata,
  });
};

/**
 * Log database operations
 *
 * @example
 * ```typescript
 * logDatabaseOperation('SELECT', 'users', 25, { userId: '123' });
 * ```
 */
export const logDatabaseOperation = (
  operation: string,
  table: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void => {
  logger.debug('Database operation', {
    operation,
    table,
    durationMs,
    ...metadata,
  });
};

/**
 * Export logger as default for convenience
 */
export default logger;
