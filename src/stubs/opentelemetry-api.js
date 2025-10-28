// Stub for @opentelemetry/api to prevent bundling issues
module.exports = {
  trace: {
    getTracer: () => ({
      startSpan: () => ({
        end: () => {},
        setAttribute: () => {},
        setAttributes: () => {},
        addEvent: () => {},
        setStatus: () => {},
        updateName: () => {},
        isRecording: () => false,
      }),
      startActiveSpan: (name, fn) => fn({ end: () => {}, setAttribute: () => {} }),
    }),
  },
  context: {
    active: () => ({}),
    with: (ctx, fn) => fn(),
  },
  propagation: {
    extract: () => ({}),
    inject: () => {},
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
  // Add createContextKey function
  createContextKey: (description) => Symbol(description),
  ROOT_CONTEXT: {},
};