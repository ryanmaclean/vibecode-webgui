// Stub for @opentelemetry/api to prevent bundling issues
const noopSpan = {
  end: () => {},
  setAttribute: () => noopSpan,
  setAttributes: () => noopSpan,
  addEvent: () => noopSpan,
  setStatus: () => noopSpan,
  updateName: () => noopSpan,
  isRecording: () => false,
  recordException: () => noopSpan,
  spanContext: () => ({
    traceId: '00000000000000000000000000000000',
    spanId: '0000000000000000',
    traceFlags: 0,
  }),
};

const noopTracer = {
  startSpan: () => noopSpan,
  // startActiveSpan can be called with (name, fn) or (name, options, fn) or (name, options, context, fn)
  startActiveSpan: function(name, optionsOrFn, ctxOrFn, fn) {
    // Find the callback function
    const callback = typeof optionsOrFn === 'function' ? optionsOrFn
      : typeof ctxOrFn === 'function' ? ctxOrFn
      : fn;
    if (typeof callback === 'function') {
      return callback(noopSpan);
    }
    return noopSpan;
  },
};

module.exports = {
  trace: {
    getTracer: () => noopTracer,
    getSpan: () => null,
    getSpanContext: () => null,
    getActiveSpan: () => null,
    setSpan: (ctx) => ctx,
    deleteSpan: (ctx) => ctx,
  },
  context: {
    active: () => ({
      getValue: () => undefined,
      setValue: () => ({}),
      deleteValue: () => ({}),
    }),
    with: (ctx, fn) => fn(),
    bind: (ctx, fn) => fn,
    getValue: () => undefined,
    setValue: (ctx) => ctx,
  },
  propagation: {
    extract: () => ({}),
    inject: () => {},
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
    UNSET: 2,
  },
  SpanKind: {
    INTERNAL: 0,
    SERVER: 1,
    CLIENT: 2,
    PRODUCER: 3,
    CONSUMER: 4,
  },
  // Add createContextKey function
  createContextKey: (description) => Symbol(description),
  ROOT_CONTEXT: {
    getValue: () => undefined,
    setValue: () => ({}),
    deleteValue: () => ({}),
  },
  diag: {
    setLogger: () => {},
    verbose: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
};