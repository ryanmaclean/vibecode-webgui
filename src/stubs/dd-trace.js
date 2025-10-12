// Comprehensive dd-trace stub for Next.js builds
const noopFunction = () => noopSpan;

const noopSpan = {
  setTag: () => noopSpan,
  addTags: () => noopSpan,
  finish: () => {},
  context: () => ({
    toTraceId: () => '0',
    toSpanId: () => '0',
  }),
};

const tracerStub = {
  init: () => tracerStub,
  use: () => tracerStub,
  setUrl: () => tracerStub,
  set: () => tracerStub,
  trace: (name, fn) => fn(noopSpan),
  wrap: (name, fn) => fn,
  startSpan: () => noopSpan,
  scope: () => ({
    active: () => noopSpan,
    activate: (span, fn) => fn(),
  }),
};

module.exports = tracerStub;
module.exports.default = tracerStub;
