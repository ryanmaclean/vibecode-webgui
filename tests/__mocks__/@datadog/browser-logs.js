/**
 * Mock for @datadog/browser-logs library
 * Provides Jest-compatible mocks for Datadog Browser Logs
 * Used by tests to avoid actual Datadog Logs initialization
 */

// Create mock logger instance
const logger = {
  // Log levels
  debug: jest.fn((message, context) => {
    return undefined;
  }),

  info: jest.fn((message, context) => {
    return undefined;
  }),

  warn: jest.fn((message, context) => {
    return undefined;
  }),

  error: jest.fn((message, context) => {
    return undefined;
  }),

  // Log with custom level
  log: jest.fn((message, context, level) => {
    return undefined;
  }),

  // Context management
  setContext: jest.fn((context) => {
    return undefined;
  }),

  addContext: jest.fn((key, value) => {
    return undefined;
  }),

  removeContext: jest.fn((key) => {
    return undefined;
  }),

  clearContext: jest.fn(() => {
    return undefined;
  }),

  // User tracking
  setUser: jest.fn((user) => {
    return undefined;
  }),

  removeUser: jest.fn(() => {
    return undefined;
  }),

  // Logger instance management
  setLevel: jest.fn((level) => {
    return undefined;
  }),

  setHandler: jest.fn((handler) => {
    return undefined;
  }),
};

// Create main datadogLogs object
const datadogLogs = {
  // Initialization
  init: jest.fn(),

  // Default logger
  logger,

  // Create custom logger
  createLogger: jest.fn((name, config) => {
    return { ...logger }; // Return a new logger instance
  }),

  // Get logger by name
  getLogger: jest.fn((name) => {
    return logger;
  }),

  // User context (global)
  setUser: jest.fn((user) => {
    return undefined;
  }),

  removeUser: jest.fn(() => {
    return undefined;
  }),

  setUserProperty: jest.fn((key, value) => {
    return undefined;
  }),

  removeUserProperty: jest.fn((key) => {
    return undefined;
  }),

  // Global context
  setGlobalContext: jest.fn((context) => {
    return undefined;
  }),

  setGlobalContextProperty: jest.fn((key, value) => {
    return undefined;
  }),

  removeGlobalContextProperty: jest.fn((key) => {
    return undefined;
  }),

  clearGlobalContext: jest.fn(() => {
    return undefined;
  }),

  // Internal context access
  getInternalContext: jest.fn(() => ({
    session_id: 'mock-session-id',
    view_id: 'mock-view-id',
  })),

  // Custom log handling
  addLogHandler: jest.fn((handler) => {
    return undefined;
  }),

  removeLogHandler: jest.fn((handler) => {
    return undefined;
  }),
};

// Log status levels
const StatusType = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

// Handler types
const HandlerType = {
  console: 'console',
  http: 'http',
  silent: 'silent',
};

// Export as named exports (primary usage)
module.exports = {
  datadogLogs,
  StatusType,
  HandlerType,
};

// Also support default export for compatibility
module.exports.default = datadogLogs;
