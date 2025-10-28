// Stub for @opentelemetry/core to prevent bundling issues
module.exports = {
  W3CTraceContextPropagator: class {},
  CompositePropagator: class {},
  globalErrorHandler: {
    setHandler: () => {},
  },
};