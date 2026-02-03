export async function register() {
  try {
    const otel = await import('@vercel/otel');
    if (typeof otel.registerOTel === 'function') {
      otel.registerOTel({
        serviceName: 'vibecode-webgui',
      });
    }
  } catch (error) {
    console.warn('⚠️ Failed to initialize OpenTelemetry', error);
  }
  
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
