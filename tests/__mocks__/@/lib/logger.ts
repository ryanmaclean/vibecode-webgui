/**
 * Mock logger for testing
 * Provides jest mock functions for all logger methods
 */

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  log: jest.fn(),
  child: jest.fn(),
};

// Make child return a logger with the same methods
mockLogger.child.mockImplementation(() => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  log: jest.fn(),
  child: jest.fn(),
}));

export const logger = mockLogger;

export const createLogger = jest.fn((contextMetadata: Record<string, unknown>) => {
  // Call logger.child to match the real implementation behavior
  return logger.child(contextMetadata);
});

export const createChildLogger = jest.fn((contextMetadata: Record<string, unknown>) => {
  // Call logger.child to match the real implementation behavior
  return logger.child(contextMetadata);
});

export const logPerformance = jest.fn((
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
) => {
  logger.info('Performance metric', {
    operation,
    durationMs,
    ...metadata,
  });
});

export const logApiRequest = jest.fn((
  method: string,
  url: string,
  statusCode: number,
  responseTimeMs: number,
  metadata?: Record<string, unknown>
) => {
  logger.http('API Request', {
    method,
    url,
    statusCode,
    responseTimeMs,
    ...metadata,
  });
});

export const logDatabaseOperation = jest.fn((
  operation: string,
  table: string,
  durationMs: number,
  metadata?: Record<string, unknown>
) => {
  logger.debug('Database operation', {
    operation,
    table,
    durationMs,
    ...metadata,
  });
});

export type Logger = typeof mockLogger;
export type ChildLogger = ReturnType<typeof createLogger>;
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';
