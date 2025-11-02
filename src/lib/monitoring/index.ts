/**
 * Monitoring module exports
 */

export { monitoring } from './datadog-client';

// Export from health-monitoring
export {
  logger,
  tracer,
  metrics,
  console,
  performanceMiddleware,
  getHealthCheck,
  MetricsCollector,
  ApplicationLogger
} from './health-monitoring';

// Export from datadog-metrics
export type { MetricOptions } from './datadog-metrics';
export { increment, gauge, histogram } from './datadog-metrics';

// Export from datadog-integration
export type { DatadogConfig } from './datadog-integration';
export { initDatadog, isDatadogEnabled } from './datadog-integration';
