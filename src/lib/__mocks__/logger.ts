/**
 * Jest Manual Mock for Logger Module
 *
 * This mock provides a complete implementation of the logger API
 * to prevent "createChildLogger is not a function" errors in tests.
 *
 * API Coverage:
 * - logger object with all log methods (error, warn, info, debug, http, log)
 * - createChildLogger() function
 * - createLogger() function
 * - Helper functions (logPerformance, logApiRequest, logDatabaseOperation)
 * - Type exports
 */

// Create a mock logger function that can be used by both main and child loggers
const createMockLoggerMethods = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  log: jest.fn(),
  child: jest.fn((contextMetadata: Record<string, unknown>) => createMockChildLogger(contextMetadata)),
});

// Create a mock child logger with the same interface
const createMockChildLogger = (contextMetadata: Record<string, unknown>) => {
  const childMethods = createMockLoggerMethods();
  // Store context for potential test assertions
  (childMethods as any)._context = contextMetadata;
  return childMethods;
};

// Main logger instance
export const logger = createMockLoggerMethods();

// Child logger factory functions
export const createChildLogger = jest.fn((contextMetadata: Record<string, unknown>) => {
  return createMockChildLogger(contextMetadata);
});

export const createLogger = jest.fn((contextMetadata: Record<string, unknown>) => {
  return createMockChildLogger(contextMetadata);
});

// Mock Pino instance for advanced usage
export const pinoInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
  level: 'debug',
};

// Helper functions
export const logPerformance = jest.fn(
  (
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void => {
    logger.info('Performance metric', {
      operation,
      durationMs: duration,
      ...metadata,
    });
  }
);

export const logApiRequest = jest.fn(
  (
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    metadata?: Record<string, unknown>
  ): void => {
    logger.http('API Request', {
      method,
      url,
      statusCode,
      responseTimeMs: responseTime,
      ...metadata,
    });
  }
);

export const logDatabaseOperation = jest.fn(
  (
    operation: string,
    table: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void => {
    logger.debug('Database operation', {
      operation,
      table,
      durationMs: duration,
      ...metadata,
    });
  }
);

// Type exports (mock types that match the real implementation)
export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof createLogger>;
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

// Additional exports that might be used in some modules
export const performance = jest.fn();
export const counter = jest.fn();

// Export default for cases where logger is imported as default
export default logger;
