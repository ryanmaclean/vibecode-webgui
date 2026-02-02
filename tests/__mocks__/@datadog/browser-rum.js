/**
 * Mock for @datadog/browser-rum library
 * Provides Jest-compatible mocks for Datadog Real User Monitoring
 * Used by tests to avoid actual Datadog RUM initialization
 */

// Create mock RUM client
const datadogRum = {
  // Initialization
  init: jest.fn(),

  // Error tracking
  addError: jest.fn((error, context) => {
    // Simulate error recording
    return undefined;
  }),

  // User actions
  addAction: jest.fn((name, context) => {
    // Simulate action recording
    return undefined;
  }),

  // Timing/performance
  addTiming: jest.fn((name, time) => {
    // Simulate timing recording
    return undefined;
  }),

  // User context
  setUser: jest.fn((user) => {
    // Simulate user context setting
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

  // View tracking
  startView: jest.fn((options) => {
    return undefined;
  }),

  // Session replay
  startSessionReplayRecording: jest.fn(),
  stopSessionReplayRecording: jest.fn(),

  // Internal ID access
  getInternalContext: jest.fn(() => ({
    session_id: 'mock-session-id',
    view_id: 'mock-view-id',
  })),

  // RUM data access
  getRumData: jest.fn(() => ({
    sessionId: 'mock-session-id',
    viewId: 'mock-view-id',
  })),

  // Feature flags
  addFeatureFlagEvaluation: jest.fn((key, value) => {
    return undefined;
  }),

  // Custom events
  addCustomEvent: jest.fn((name, context) => {
    return undefined;
  }),
};

// Export as named export (primary usage)
module.exports = {
  datadogRum,
  DefaultPrivacyLevel: {
    ALLOW: 'allow',
    MASK: 'mask',
    MASK_USER_INPUT: 'mask-user-input',
  },
  TrackingConsent: {
    GRANTED: 'granted',
    NOT_GRANTED: 'not-granted',
  },
};

// Also support default export for compatibility
module.exports.default = datadogRum;
