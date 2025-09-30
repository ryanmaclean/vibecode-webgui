// Development stub for Datadog instrumentation.
// Ensures Next.js can bundle the app without pulling in dd-trace when running locally.

const tracerStub = {
  init: () => {},
}

export const tracer = tracerStub

export default tracerStub
