import { createRequire } from 'module';

const require = createRequire(import.meta.url);

type TracerLike = {
  init: (...args: any[]) => void;
  startSpan: (...args: any[]) => { setTag: (key: string, value: unknown) => void; finish: () => void } | undefined;
  scope: () => { activate: <T>(span: unknown, fn: () => Promise<T> | T) => Promise<T> | T; active: () => unknown };
  dogstatsd: {
    gauge: (...args: any[]) => void;
    increment: (...args: any[]) => void;
    histogram: (...args: any[]) => void;
    event: (...args: any[]) => void;
  };
  use: (...args: any[]) => void;
  addTags?: (tags: Record<string, unknown>) => void;
  setTag?: (key: string, value: unknown) => void;
};

let tracerInstance: TracerLike | null = null;
let tracerInitialized = false;

const bypassReasons: Array<{ key: string; expected: string | undefined; message: string }> = [
  { key: 'DOCKER_BUILD', expected: 'true', message: 'Docker build detected' },
  { key: 'SKIP_MONITORING', expected: 'true', message: 'SKIP_MONITORING flag set' },
  { key: 'DD_ENABLED', expected: 'false', message: 'Datadog explicitly disabled' },
  { key: 'CI', expected: 'true', message: 'CI environment detected' },
  { key: 'GITHUB_ACTIONS', expected: 'true', message: 'GitHub Actions environment detected' }
];

function shouldBypassMonitoring(): string | null {
  for (const reason of bypassReasons) {
    if (process.env[reason.key] === reason.expected) {
      return reason.message;
    }
  }
  return null;
}

function createMockTracer(reason: string): TracerLike {
  const logPrefix = '🟡 Datadog tracer mock:';
  if (reason) {
    console.log(`${logPrefix} ${reason}`);
  }

  const noop = () => {};
  const mockSpan = () => ({
    setTag: noop,
    finish: noop
  });

  return {
    init: noop,
    startSpan: mockSpan,
    scope: () => ({
      activate: (_: unknown, fn: () => unknown) => fn(),
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

function resolveServiceEnvVersion(): { env: string; service: string; version: string } {
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

function buildTracerConfig(service: string, env: string, version: string) {
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

function getTracer(): TracerLike {
  if (tracerInstance) {
    return tracerInstance;
  }

  const bypassReason = shouldBypassMonitoring();
  if (bypassReason) {
    tracerInstance = createMockTracer(bypassReason);
    return tracerInstance;
  }

  try {
    const tracer: TracerLike = require('dd-trace');

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

export default getTracer();
