// Complete monitoring bypass during Docker build to prevent ERR_INVALID_URL
// This file is imported during Next.js build, so we need to completely bypass monitoring

// Hard-coded Docker build detection - most aggressive approach
const isDockerBuild = (
  process.env.NODE_ENV === 'production' ||
  process.env.DOCKER_BUILD === 'true' || 
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Function to get the appropriate tracer based on environment
function getTracer() {
  if (isDockerBuild) {
    // Mock tracer for Docker build - completely bypass monitoring
    console.log('🚫 Monitoring completely disabled during Docker build');
    return {
      init: () => console.log('Mock tracer initialized'),
      // Add other tracer methods as needed
    };
  }

  // Normal monitoring initialization for development/production
  try {
    // Dynamic imports to prevent static analysis issues
    const tracer = require('dd-trace');
    
    // Only import monitoring modules if not in Docker build
    let initializeOpenTelemetry, getServiceEnvVersion;
    
    try {
      const opentelemetryModule = require('./lib/monitoring/opentelemetry');
      initializeOpenTelemetry = opentelemetryModule.initializeOpenTelemetry;
    } catch (e) {
      console.log('⚠️ OpenTelemetry module not available');
      initializeOpenTelemetry = () => {};
    }
    
    try {
      const datadogEnvModule = require('./lib/monitoring/datadog-env');
      getServiceEnvVersion = datadogEnvModule.getServiceEnvVersion;
    } catch (e) {
      console.log('⚠️ Datadog env module not available');
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
    console.log('⚠️ Monitoring failed to initialize, using mock tracer');
    return {
      init: () => console.log('Mock tracer initialized'),
      // Add other tracer methods as needed
    };
  }
}

// Export the tracer using ES module syntax
export default getTracer();
