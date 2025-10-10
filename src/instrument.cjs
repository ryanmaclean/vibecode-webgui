let tracerInstance = null;
let tracerInitialized = false;

const bypassReasons = [
  { key: 'DOCKER_BUILD', expected: 'true', message: 'Docker build detected' },
  { key: 'SKIP_MONITORING', expected: 'true', message: 'SKIP_MONITORING flag set' },
  { key: 'DD_ENABLED', expected: 'false', message: 'Datadog explicitly disabled' },
  { key: 'CI', expected: 'true', message: 'CI environment detected' },
  { key: 'GITHUB_ACTIONS', expected: 'true', message: 'GitHub Actions environment detected' }
];

const noop = () => {};

function createMockTracer(reason) {
  if (reason) {
    console.log(`🟡 Datadog tracer mock: ${reason}`);
  }

  const mockSpan = () => ({
    setTag: noop,
    finish: noop
  });

  return {
    init: noop,
    startSpan: mockSpan,
    scope: () => ({
      activate: (_, fn) => fn(),
      active: () => null
    }),
    dogstatsd: {
      gauge: noop,
      increment: noop,
      histogram: noop,
      event: noop
    },
    use: noop,
    addTags: noop,
    setTag: noop
  };
}

function shouldBypassMonitoring() {
  for (const reason of bypassReasons) {
    if (process.env[reason.key] === reason.expected) {
      return reason.message;
    }
  }
  return null;
}

function resolveServiceEnvVersion() {
  try {
    const { getServiceEnvVersion } = require('./lib/monitoring/datadog-env');
    return getServiceEnvVersion();
  } catch (error) {
    console.warn('⚠️ Unable to resolve Datadog service/env/version via helper:', error);
    return {
      env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
      service: process.env.DD_SERVICE || 'vibecode-webgui',
      version:
        process.env.DD_VERSION ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        '0.1.0'
    };
  }
}

function initializeOpenTelemetryIfEnabled() {
  if (process.env.OTEL_ENABLED !== 'true' || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const { initializeOpenTelemetry } = require('./lib/monitoring/opentelemetry');
    initializeOpenTelemetry();
  } catch (error) {
    console.warn('⚠️ Failed to initialize OpenTelemetry before Datadog tracer:', error);
  }
}

function buildTracerConfig(service, env, version) {
  return {
    logInjection: true,
    profiling: process.env.NODE_ENV === 'production',
    runtimeMetrics: true,
    env,
    service,
    version,
    sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    plugins: true,
    experimental: {
      enableGetRumData: ['1', 'true'].includes(String(process.env.DD_ENABLE_GET_RUM_DATA || '').toLowerCase())
    },
    tags: {
      'deployment.environment': env,
      'service.name': service,
      'service.version': version,
      'git.commit.sha': process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
      'git.repository.url': process.env.DD_GIT_REPOSITORY_URL || 'https://github.com/vibecode/vibecode-webgui',
      'ml.app': process.env.DD_LLMOBS_ML_APP || 'vibecode-ai'
    }
  };
}

function getTracer() {
  if (tracerInstance) {
    return tracerInstance;
  }

  const bypassReason = shouldBypassMonitoring();
  if (bypassReason) {
    tracerInstance = createMockTracer(bypassReason);
    return tracerInstance;
  }

  try {
    const tracer = require('dd-trace');

    if (!tracerInitialized) {
      initializeOpenTelemetryIfEnabled();
      const { env, service, version } = resolveServiceEnvVersion();
      tracer.init(buildTracerConfig(service, env, version));
      tracerInitialized = true;

      const llmEnabled = process.env.DD_LLMOBS_ENABLED;
      const agentless = process.env.DD_LLMOBS_AGENTLESS_ENABLED;
      console.log(
        `✅ Datadog tracer initialized (service=${service}, env=${env}, version=${version}, llmobs=${llmEnabled}, agentless=${agentless})`
      );
    }

    tracerInstance = tracer;
    return tracerInstance;
  } catch (error) {
    console.error('⚠️ Datadog tracer initialization failed, using mock tracer:', error);
    tracerInstance = createMockTracer('Initialization error');
    return tracerInstance;
  }
}

module.exports = getTracer();
