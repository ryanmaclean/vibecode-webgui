/**
 * Mock logger for AI Gateway tests
 * Matches the Pino-based logger interface
 */

export const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn()
  }))
};

export const performanceLogger = {
  logRequest: jest.fn(),
  logError: jest.fn()
};

export const requestLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

export default logger;
