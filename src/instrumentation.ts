import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({
    serviceName: 'vibecode-webgui',
  })
  
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Datadog Trace
    const ddTrace = require('dd-trace');
    ddTrace.init({
      logInjection: true,
      runtimeMetrics: true,
      startupLogs: true,
    });
    console.log('✅ Datadog Tracing Initialized (Node.js)');
  }
}
