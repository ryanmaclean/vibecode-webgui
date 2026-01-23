/**
 * Service Logger
 *
 * Creates service-specific loggers with consistent context.
 */

import { logger, createLogger } from '@/lib/logger';
import { LogLevel, LogMetadata, sanitizeLogData } from './format';

/**
 * Context that is automatically included in all log messages
 */
export interface LogContext {
  service: string;
  component: string;
  environment?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * Service logger interface
 */
export interface ServiceLogger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  child(additionalContext: Partial<LogContext>): ServiceLogger;
  withRequestId(requestId: string): ServiceLogger;
  withOperation(operation: string): ServiceLogger;
}

/**
 * Create a service-specific logger with consistent context
 *
 * @param context - Base context for all log messages
 * @returns ServiceLogger instance
 *
 * @example
 * ```typescript
 * const log = createServiceLogger({
 *   service: 'vibecode-webgui',
 *   component: 'workspace-api'
 * });
 *
 * log.info('Workspace created', { workspaceId: '123', duration: 150 });
 * ```
 */
export function createServiceLogger(context: LogContext): ServiceLogger {
  const baseContext = {
    service: context.service,
    component: context.component,
    environment: context.environment || process.env.NODE_ENV || 'development',
    version: context.version || process.env.APP_VERSION,
    ...sanitizeLogData(context)
  };

  const childLogger = createLogger(baseContext);

  function log(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata
  ): void {
    const sanitizedMetadata = metadata ? sanitizeLogData(metadata) : {};
    const logFn = childLogger[level] || childLogger.info;
    logFn(message, sanitizedMetadata);
  }

  const serviceLogger: ServiceLogger = {
    debug(message: string, metadata?: LogMetadata): void {
      log(LogLevel.DEBUG, message, metadata);
    },

    info(message: string, metadata?: LogMetadata): void {
      log(LogLevel.INFO, message, metadata);
    },

    warn(message: string, metadata?: LogMetadata): void {
      log(LogLevel.WARN, message, metadata);
    },

    error(message: string, metadata?: LogMetadata): void {
      log(LogLevel.ERROR, message, metadata);
    },

    child(additionalContext: Partial<LogContext>): ServiceLogger {
      return createServiceLogger({
        ...context,
        ...additionalContext
      } as LogContext);
    },

    withRequestId(requestId: string): ServiceLogger {
      return createServiceLogger({
        ...context,
        requestId
      } as LogContext);
    },

    withOperation(operation: string): ServiceLogger {
      return createServiceLogger({
        ...context,
        operation
      } as LogContext);
    }
  };

  return serviceLogger;
}

/**
 * Default application logger
 */
export const appLogger = createServiceLogger({
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  component: 'app'
});
