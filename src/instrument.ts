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

let pathModule: any = null;
try {
  // Use eval to avoid bundlers complaining about Node built-ins in edge/dev environments
   
  const dynamicRequire = eval('require');
  pathModule = dynamicRequire('path');
} catch (error) {
  // path module not available (likely edge/dev build)
}
const truthy = ['1', 'true', 'yes', 'on'];
const falsy = ['0', 'false', 'no', 'off'];

function parseFlag(value: string | undefined, defaultValue = false) {
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
    // Dynamic imports to prevent static analysis issues
    const tracer = require('dd-trace');
    
    // Only import monitoring modules if not in Docker build
    let initializeOpenTelemetry, getServiceEnvVersion, getDatadogSite;
   
    try {
      const otelModulePath = process.env.NODE_ENV === 'production'
        ? './lib/monitoring/opentelemetry'
        : './lib/monitoring/opentelemetry.stub'

      const opentelemetryModule = require(otelModulePath);
      initializeOpenTelemetry = opentelemetryModule.initializeOpenTelemetry;
    } catch (e) {
      console.log('⚠️ OpenTelemetry module not available');
      initializeOpenTelemetry = () => {};
    }
    
    const envModuleCandidates = [
      './lib/monitoring/datadog-env.shared.js',
    ];

    if (pathModule) {
      envModuleCandidates.push(
        pathModule.join(__dirname ?? '.', 'lib', 'monitoring', 'datadog-env.shared.js'),
        pathModule.join(__dirname ?? '.', 'src', 'lib', 'monitoring', 'datadog-env.shared.js'),
        pathModule.join(process.cwd(), 'src', 'lib', 'monitoring', 'datadog-env.shared.js'),
      )
    }

    for (const candidate of envModuleCandidates) {
      try {
        const datadogEnvModule = require(candidate);
        getServiceEnvVersion = datadogEnvModule.getServiceEnvVersion;
        getDatadogSite = datadogEnvModule.getDatadogSite;
        break;
      } catch (error) {
        // Try next candidate
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

    // Determine if we should use agentless mode for both tracing and LLM observability
    let agentlessEnabled = parseFlag(process.env.DD_AGENTLESS_ENABLED, false);
    if (!process.env.DD_AGENTLESS_ENABLED && hasDatadogApiKey) {
      agentlessEnabled = true;
    }

    let llmObservabilityAgentless = parseFlag(process.env.DD_LLMOBS_AGENTLESS_ENABLED, false);
    if (!process.env.DD_LLMOBS_AGENTLESS_ENABLED && agentlessEnabled) {
      llmObservabilityAgentless = true;
    }

    let llmObservabilityEnabled = parseFlag(process.env.DD_LLMOBS_ENABLED, false);
    if (!process.env.DD_LLMOBS_ENABLED && llmObservabilityAgentless) {
      llmObservabilityEnabled = true;
    }

    if ((agentlessEnabled || llmObservabilityAgentless) && !hasDatadogApiKey) {
      console.warn('⚠️ Agentless mode requested but DD_API_KEY is missing');
      agentlessEnabled = false;
      llmObservabilityAgentless = false;
    }

    const mlApp = process.env.DD_LLMOBS_ML_APP || 'vibecode-ai';

    // Build the tracer configuration object
    const tracerConfig: any = {
      // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
      logInjection: true,
      profiling: true,
      runtimeMetrics: true,
      site,
      env,
      service,
      version,
      // Correlate DBM and APM by propagating service info into SQL comments
      // Docs: https://docs.datadoghq.com/database_monitoring/connect_dbm_and_apm/
      dbmPropagationMode: process.env.DD_DBM_PROPAGATION_MODE || 'full',

      // Enhanced sampling for better observability
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Experimental, typed flags only. LLM Observability is controlled via env vars
      // (e.g., DD_LLMOBS_ENABLED, DD_API_KEY, DD_SITE) and is not configured here
      experimental: {
        enableGetRumData:
          process.env.DD_ENABLE_GET_RUM_DATA === '1' || process.env.DD_ENABLE_GET_RUM_DATA === 'true'
      },
      llmobs: {
        enabled: llmObservabilityEnabled,
        agentlessEnabled: llmObservabilityEnabled && llmObservabilityAgentless,
        mlApp,
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
        'ml.app': mlApp,
        'llm.observability.enabled': String(llmObservabilityEnabled),
        'llm.observability.agentless': String(llmObservabilityAgentless),
        'agentless.enabled': String(agentlessEnabled)
      }
    };

    // Add agentless configuration if enabled
    if (agentlessEnabled && hasDatadogApiKey) {
      console.log('🌐 Configuring Datadog agentless mode - traces will be sent directly to Datadog');
      tracerConfig.traceUrl = `https://api.${site}/api/v2/traces`;
      tracerConfig.exporterOptions = {
        url: `https://api.${site}/api/v2/traces`,
        headers: {
          'DD-API-KEY': process.env.DD_API_KEY || process.env.DATADOG_API_KEY
        }
      };
    } else if (!agentlessEnabled) {
      console.log('🔗 Using Datadog agent mode - traces will be sent to local agent on 127.0.0.1:8126');
    }

    // Initialize the tracer with the configuration
    tracer.init(tracerConfig);

    if (llmObservabilityEnabled) {
      try {
        // Ensure OpenAI instrumentation uses a dedicated service name for clarity in Datadog APM
        tracer.use('openai', {
          service: `${service}-openai`,
          mlApp,
        });
        console.log('✅ Datadog LLM Observability enabled for OpenAI spans', {
          mlApp,
          agentless: llmObservabilityAgentless,
        });
      } catch (pluginError) {
        console.warn('⚠️ Failed to configure Datadog OpenAI plugin', pluginError);
      }
    }

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
