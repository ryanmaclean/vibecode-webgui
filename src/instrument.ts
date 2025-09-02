// Complete monitoring bypass during Docker build to prevent ERR_INVALID_URL
// This file is imported during Next.js build, so we need to completely bypass monitoring

// Hard-coded Docker build detection - most aggressive approach
const isDockerBuild = (
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
    console.log('🚫 Monitoring disabled by environment flags/bypass conditions');
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

    // Initialize the tracer with simplified config to avoid Next.js 15 compatibility issues
    tracer.init({
      // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
      logInjection: false, // Disabled to avoid stack trace issues
      profiling: false, // Disabled to avoid compatibility issues
      runtimeMetrics: true,
      env,
      service,
      version,
      
      // Enhanced sampling for better observability
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Enable database monitoring and other essential plugins
      plugins: {
        // Database monitoring for PostgreSQL
        pg: {
          dbmPropagationMode: 'full',
          service: 'vibecode-postgres'
        },
        // Disable problematic plugins that cause Next.js 15 issues
        fs: false,
        winston: false
      },
      
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
