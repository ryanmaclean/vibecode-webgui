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

const path = require('path');
const truthy = ['1', 'true', 'yes', 'on'];
const falsy = ['0', 'false', 'no', 'off'];

function parseFlag(value, defaultValue = false) {
  if (typeof value !== 'string') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (truthy.includes(normalized)) {
    return true;
  }
  if (falsy.includes(normalized)) {
    return false;
  }
  return defaultValue;
}

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
    let initializeOpenTelemetry, getServiceEnvVersion, getDatadogSite;
    
    try {
      const opentelemetryModule = require('./lib/monitoring/opentelemetry');
      initializeOpenTelemetry = opentelemetryModule.initializeOpenTelemetry;
    } catch (e) {
      console.log('⚠️ OpenTelemetry module not available');
      initializeOpenTelemetry = () => {};
    }
    
    const envModuleCandidates = [
      './lib/monitoring/datadog-env.shared.js',
      path.join(__dirname || '.', 'lib', 'monitoring', 'datadog-env.shared.js'),
      path.join(__dirname || '.', 'src', 'lib', 'monitoring', 'datadog-env.shared.js'),
      path.join(process.cwd(), 'src', 'lib', 'monitoring', 'datadog-env.shared.js'),
    ];

    for (const candidate of envModuleCandidates) {
      try {
        const datadogEnvModule = require(candidate);
        getServiceEnvVersion = datadogEnvModule.getServiceEnvVersion;
        getDatadogSite = datadogEnvModule.getDatadogSite;
        break;
      } catch (error) {
        // try next candidate
      }
    }

    if (!getServiceEnvVersion || !getDatadogSite) {
      console.log('⚠️ Datadog env module not available');
      getServiceEnvVersion = () => ({ env: 'development', service: 'vibecode-webgui', version: '0.1.0' });
      getDatadogSite = () => 'datadoghq.com';
    }

    // Initialize OpenTelemetry first for auto-instrumentation (if enabled)
    if (process.env.OTEL_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
      initializeOpenTelemetry();
    }

    // Resolve standardized env/service/version
    const { env, service, version } = getServiceEnvVersion();
    const site = getDatadogSite();

    const hasDatadogApiKey = Boolean(process.env.DD_API_KEY || process.env.DATADOG_API_KEY);

    let llmObservabilityAgentless = parseFlag(process.env.DD_LLMOBS_AGENTLESS_ENABLED, false);
    if (!process.env.DD_LLMOBS_AGENTLESS_ENABLED && hasDatadogApiKey) {
      llmObservabilityAgentless = true;
    }

    let llmObservabilityEnabled = parseFlag(process.env.DD_LLMOBS_ENABLED, false);
    if (!process.env.DD_LLMOBS_ENABLED && llmObservabilityAgentless) {
      llmObservabilityEnabled = true;
    }

    if (llmObservabilityAgentless && !hasDatadogApiKey) {
      console.warn('⚠️ Agentless LLM Observability requested but DD_API_KEY is missing');
      llmObservabilityAgentless = false;
    }

    const mlApp = process.env.DD_LLMOBS_ML_APP || 'vibecode-ai';

    // Initialize the tracer with Next.js 15 compatible config
    tracer.init({
      // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
      logInjection: false, // Disabled to avoid stack trace issues
      profiling: false, // Disabled to avoid compatibility issues
      runtimeMetrics: false, // Disabled to avoid Next.js compatibility issues
      site,
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
        openai: {
          enabled: true,
          service: `${service}-openai`,
          mlApp
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
        'ml.app': mlApp,
        'llm.observability.enabled': String(llmObservabilityEnabled),
        'llm.observability.agentless': String(llmObservabilityAgentless),
      },
      llmobs: {
        enabled: llmObservabilityEnabled,
        agentlessEnabled: llmObservabilityEnabled && llmObservabilityAgentless,
        mlApp,
      }
    });

    if (llmObservabilityEnabled) {
      console.log('✅ Datadog LLM Observability enabled for OpenAI spans', {
        mlApp,
        agentless: llmObservabilityAgentless
      });
    }

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
