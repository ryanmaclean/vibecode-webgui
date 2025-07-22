import tracer from 'dd-trace';

// Initialize the tracer with LLM observability support
tracer.init({
  // Docs: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
  logInjection: true,
  profiling: true,
  runtimeMetrics: true,
  env: process.env.DD_ENV || process.env.NODE_ENV === 'production' ? 'production' : 'development',
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  version: process.env.DD_VERSION || process.env.npm_package_version || '1.0.0',
  
  // Enhanced sampling for better observability
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Enable LLM observability
  experimental: {
    llmobs: {
      enabled: process.env.DD_LLMOBS_ENABLED === '1' || process.env.DD_LLMOBS_ENABLED === 'true',
      agentlessEnabled: process.env.DD_LLMOBS_AGENTLESS_ENABLED === '1' || process.env.DD_LLMOBS_AGENTLESS_ENABLED === 'true',
      mlApp: process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
      site: process.env.DD_SITE || 'datadoghq.com',
      apiKey: process.env.DD_API_KEY,
    }
  },
  
  // Database monitoring
  plugins: {
    pg: {
      enabled: true,
      service: 'vibecode-postgres',
    },
    redis: {
      enabled: true,
      service: 'vibecode-redis',
    },
    http: {
      enabled: true,
      headers: ['user-agent', 'host'],
    },
    express: {
      enabled: true,
    },
    next: {
      enabled: true,
    }
  },
  
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
