import { createRequire } from 'module';

const require = createRequire(import.meta.url);

<<<<<<< HEAD
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
=======
// Function to get the appropriate tracer based on environment
function getTracer() {
  if (isDockerBuild) {
    // Mock tracer for Docker build - completely bypass monitoring
    // Debug log removed
    return {
      init: () => {
        // Mock tracer initialized
      },
      // Add other tracer methods as needed
    };
>>>>>>> ai-sdk-openai-v2-test
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
<<<<<<< HEAD
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
=======
    // Dynamic imports to prevent static analysis issues
    const tracer = require('dd-trace');
    
    // Only import monitoring modules if not in Docker build
    let initializeOpenTelemetry, getServiceEnvVersion;
    
    try {
      const opentelemetryModule = require('./lib/monitoring/opentelemetry');
      initializeOpenTelemetry = opentelemetryModule.initializeOpenTelemetry;
    } catch (e) {
      // Debug log removed
      initializeOpenTelemetry = () => {};
    }
    
    try {
      const datadogEnvModule = require('./lib/monitoring/datadog-env');
      getServiceEnvVersion = datadogEnvModule.getServiceEnvVersion;
    } catch (e) {
      // Debug log removed
      getServiceEnvVersion = () => ({ env: 'development', service: 'vibecode-webgui', version: '0.1.0' });
    }

    // Initialize OpenTelemetry first for auto-instrumentation (if enabled)
    if (process.env.OTEL_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
      initializeOpenTelemetry();
    }

    // Resolve standardized env/service/version
    const { env, service, version } = getServiceEnvVersion();

    // Initialize the tracer with LLM observability support
    tracer.init({
      // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
      logInjection: true,
      profiling: true,
      runtimeMetrics: true,
      env,
      service,
      version,
      
      // Enhanced sampling for better observability
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Experimental, typed flags only. LLM Observability is controlled via env vars
      // (e.g., DD_LLMOBS_ENABLED, DD_API_KEY, DD_SITE) and is not configured here
      experimental: {
        enableGetRumData: process.env.DD_ENABLE_GET_RUM_DATA === '1' || process.env.DD_ENABLE_GET_RUM_DATA === 'true'
      },
      
      // Database monitoring - using type assertion for plugins config
      plugins: true, // Enable all plugins by default
      
      // Plugin-specific configuration
      // Note: These will be applied on top of the default configuration
      // when the plugins are required
      
      // Tag all traces with deployment info
      tags: {
        'deployment.environment': env,
        'service.name': service,
        'service.version': version,
        'git.commit.sha': process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
        'git.repository.url': 'https://github.com/vibecode/vibecode-webgui',
      }
    });

    return tracer;
  } catch (error) {
    // Fallback to mock tracer if monitoring fails
    // Debug log removed
    return {
      init: () => {
        // Mock tracer initialized
      },
      // Add other tracer methods as needed
>>>>>>> ai-sdk-openai-v2-test
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
