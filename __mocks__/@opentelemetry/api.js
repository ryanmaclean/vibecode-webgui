module.exports = {
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
};
