/**
 * Mock logger for tests
 * Must export all functions used by the real logger module
 */

// Create mock logger methods
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => createMockLogger()),
});

// Main logger instance
export const logger = createMockLogger();

// Child logger factory - must be exported for modules that use it
export const createChildLogger = jest.fn((contextMetadata: Record<string, unknown>) => {
  const childLogger = createMockLogger();
  (childLogger as any)._context = contextMetadata;
  return childLogger;
});

// Alternative factory name
export const createLogger = jest.fn((contextMetadata: Record<string, unknown>) => {
  return createChildLogger(contextMetadata);
});

// Helper functions
export const logPerformance = jest.fn();
export const logApiRequest = jest.fn();
export const logDatabaseOperation = jest.fn();

// Type exports
export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof createLogger>;
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

export default logger;
