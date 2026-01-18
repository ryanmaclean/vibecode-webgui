/**
 * Mock for dd-trace library
 * Provides Jest-compatible mocks for Datadog APM tracer
 * Used by tests to avoid actual dd-trace initialization
 */

// Create noop span object that can be chained
const noopSpan = {
  setTag: jest.fn(function() { return this; }),
  addTags: jest.fn(function() { return this; }),
  finish: jest.fn(),
  context: jest.fn(() => ({
    toTraceId: jest.fn(() => '0'),
    toSpanId: jest.fn(() => '0'),
  })),
};

// Create mock scope object
const mockScope = {
  active: jest.fn(() => noopSpan),
  activate: jest.fn((span, fn) => {
    if (typeof fn === 'function') {
      return fn();
    }
    return undefined;
  }),
};

// Create mock dogstatsd client for metrics
const mockDogStatsd = {
  gauge: jest.fn(),
  increment: jest.fn(),
  histogram: jest.fn(),
  distribution: jest.fn(),
  set: jest.fn(),
  event: jest.fn(),
  check: jest.fn(),
  close: jest.fn(),
};

// Create the main tracer mock
const tracerMock = {
  // Core tracer methods
  init: jest.fn(function(config) {
    // Store config for inspection in tests
    this._config = config;
    return this;
  }),

  use: jest.fn(function(plugin, config) {
    // Store plugin config for inspection
    if (!this._plugins) this._plugins = {};
    this._plugins[plugin] = config;
    return this;
  }),

  trace: jest.fn((name, options, fn) => {
    // Handle both (name, fn) and (name, options, fn) signatures
    const callback = typeof options === 'function' ? options : fn;
    if (typeof callback === 'function') {
      return callback(noopSpan);
    }
    return undefined;
  }),

  wrap: jest.fn((name, options, fn) => {
    // Handle both (name, fn) and (name, options, fn) signatures
    const callback = typeof options === 'function' ? options : fn;
    return callback;
  }),

  startSpan: jest.fn(() => noopSpan),

  scope: jest.fn(() => mockScope),

  // Span management
  setUrl: jest.fn(function() { return this; }),
  set: jest.fn(function() { return this; }),

  // DogStatsD client
  dogstatsd: mockDogStatsd,

  // Additional methods for compatibility
  addTags: jest.fn(function() { return this; }),
  setTag: jest.fn(function() { return this; }),

  // LLM Observability methods (for dd-trace >= 4.x)
  llmobs: {
    enable: jest.fn(),
    disable: jest.fn(),
    trace: jest.fn((options, fn) => {
      if (typeof fn === 'function') {
        return fn();
      }
      return undefined;
    }),
  },

  // Internal state for tests
  _config: {},
  _plugins: {},
};

// Export both default and named exports for compatibility
module.exports = tracerMock;
module.exports.default = tracerMock;

// Also export individual components for direct access
module.exports.noopSpan = noopSpan;
module.exports.mockScope = mockScope;
module.exports.mockDogStatsd = mockDogStatsd;
