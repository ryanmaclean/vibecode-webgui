import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';
import { logger } from './utils/logger';

// Minimal OTEL bootstrap. Controlled by ENABLE_TRACING=true
const ENABLE_TRACING = String(process.env.ENABLE_TRACING || '').toLowerCase() === 'true';

if (ENABLE_TRACING) {
  const serviceName = process.env.OTEL_SERVICE_NAME || process.env.DD_SERVICE || process.env.SERVICE_NAME || 'vibecode-ai-gateway';
  const environment = process.env.DD_ENV || process.env.NODE_ENV || 'development';

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS || '';
  const ratio = process.env.OTEL_TRACES_SAMPLER_ARG || process.env.TRACE_SAMPLE_RATE || '0.1';
  const sampleRate = Math.max(0, Math.min(1, Number(ratio) || 0.1));

  const exporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
    headers: headers
      .split(',')
      .map(kv => kv.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, pair) => {
        const [k, v] = pair.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {})
  });

  // Ensure service/env are visible to the SDK via standard OTEL envs
  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = serviceName;
  }
  const envAttr = `deployment.environment=${environment}`;
  if (!process.env.OTEL_RESOURCE_ATTRIBUTES) {
    process.env.OTEL_RESOURCE_ATTRIBUTES = envAttr;
  } else if (!process.env.OTEL_RESOURCE_ATTRIBUTES.includes('deployment.environment=')) {
    process.env.OTEL_RESOURCE_ATTRIBUTES = `${process.env.OTEL_RESOURCE_ATTRIBUTES},${envAttr}`;
  }

  const sdk = new NodeSDK({
    traceExporter: exporter,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(sampleRate) })
  });

  try {
    sdk.start();

    logger.info(`[OTEL] Tracing initialized (service=${serviceName}, env=${environment}, endpoint=${endpoint}, rate=${sampleRate})`);
  } catch (err: unknown) {
    logger.warn('[OTEL] Failed to start tracing', { err });
  }

  const shutdown = async () => {
    try {
      await sdk.shutdown();
      logger.info('[OTEL] Tracing shut down');
    } catch (e: unknown) {
      logger.warn('[OTEL] Error during tracing shutdown', { err: e });
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
