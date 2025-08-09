import tracer from 'dd-trace';
import { initializeOpenTelemetry } from './lib/monitoring/opentelemetry';

// Initialize OpenTelemetry first for auto-instrumentation (if enabled)
if (process.env.OTEL_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
  initializeOpenTelemetry();
}

// Initialize the tracer with LLM observability support
tracer.init({
  // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
  logInjection: true,
  profiling: true,
  runtimeMetrics: true,
  env: process.env.DD_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  version: process.env.DD_VERSION || process.env.npm_package_version || '1.0.0',
  
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
  // Note: clientToken and site are not valid TracerOptions properties
  // They should be set via DD_CLIENT_TOKEN and DD_SITE environment variables
  
  // Configure specific plugins
  // Note: These will be applied on top of the default configuration
  // when the plugins are required
  
  // Tag all traces with deployment info
  tags: {
    'deployment.environment': process.env.DD_ENV || 'development',
    'service.name': process.env.DD_SERVICE || 'vibecode-webgui',
    'service.version': process.env.DD_VERSION || '1.0.0',
    'git.commit.sha': process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
    'git.repository.url': 'https://github.com/vibecode/vibecode-webgui',
  }
});

// Export tracer for manual instrumentation
export default tracer;
