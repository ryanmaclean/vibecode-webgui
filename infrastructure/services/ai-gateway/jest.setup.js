// Set environment variables FIRST before any imports
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock OpenTelemetry API globally
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        end: jest.fn(),
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        updateName: jest.fn(),
        isRecording: jest.fn(() => false),
      })),
    })),
    getActiveSpan: jest.fn(),
    setSpan: jest.fn(),
  },
  context: {
    active: jest.fn(() => ({})),
    with: jest.fn((ctx, fn) => fn()),
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
}));
