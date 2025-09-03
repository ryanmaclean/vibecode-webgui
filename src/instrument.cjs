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
    // Import dd-trace normally in CommonJS
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

    // Initialize the tracer with Next.js 15 compatible config
    tracer.init({
      // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
      logInjection: false, // Disabled to avoid stack trace issues
      profiling: false, // Disabled to avoid compatibility issues
      runtimeMetrics: false, // Disabled to avoid Next.js compatibility issues
      startupLogs: false, // Reduce startup noise
      env,
      service,
      version,
      
      // Conservative sampling for development
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
      
      // Enable database monitoring with minimal plugin set for Next.js 15
      plugins: {
        // Database monitoring for PostgreSQL
        pg: {
          enabled: true,
          dbmPropagationMode: 'disabled', // Disable DBM propagation for compatibility
          service: 'vibecode-postgres'
        },
        // Disable all other plugins that might cause issues
        http: false,
        dns: false,
        fs: false,
        winston: false,
        express: false,
        'next': false
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
    // Log the actual error to understand why tracer failed
    console.error('🚨 Datadog tracer initialization failed:', error);
    console.log('⚠️ Monitoring failed to initialize, using mock tracer');
    return {
      init: () => console.log('Mock tracer initialized'),
      dogstatsd: {
        gauge: () => {},
        increment: () => {},
        histogram: () => {},
        event: () => {}
      }
    };
  }
}

// Export the tracer using CommonJS syntax
module.exports = getTracer();
