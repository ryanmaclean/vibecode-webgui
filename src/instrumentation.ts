import { registerOTel } from '@vercel/otel'

export function register() {
  // Skip instrumentation during production build (page data collection phase)
  // dd-trace's Prisma instrumentation calls new URL() with the raw datasource config
  // object instead of a string, causing ERR_INVALID_URL during build
  const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' ||
                    process.argv.some(a => a.includes('build')) ||
                    process.env.BUILDING === 'true';
  if (isBuilding) {
    return;
  }

  // Unified service tagging from DD_* environment variables
  const service = process.env.DD_SERVICE || 'vibecode-webgui';
  const env = process.env.DD_ENV || process.env.NODE_ENV || 'development';
  const version = process.env.DD_VERSION || process.env.npm_package_version || '1.0.0';

  registerOTel({
    serviceName: service,
  })

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Datadog Trace with unified service tagging
    const ddTrace = require('dd-trace');
    ddTrace.init({
      service,
      env,
      version,
      logInjection: true,
      runtimeMetrics: true,
      startupLogs: true,
      tags: {
        team: 'platform',
        component: 'webgui',
      },
    });
    console.log('Datadog Tracing Initialized (Node.js)', { service, env, version });
  }
}
