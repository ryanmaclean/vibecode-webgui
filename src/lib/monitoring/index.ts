/**
 * Monitoring module exports
 */

export { monitoring } from './datadog-client';

// Export from health-monitoring
export {
  logger,
  tracer,
  metrics,
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

// Export from gastown-cli-tracing
export type {
  CLITraceContext,
  CLICommandResult,
  CLICommandOptions,
  GTCommandCategory,
  BDCommandCategory,
} from './gastown-cli-tracing';
export {
  createCLITraceContext,
  getDatadogEnvVars,
  categorizeGTCommand,
  categorizeBDCommand,
  executeWithTracing,
  gt,
  gtUp,
  gtDown,
  gtStatus,
  gtSling,
  gtRefineryStart,
  gtRefineryStop,
  gtPolecatStatus,
  gtHook,
  gtMailInbox,
  bd,
  bdCreate,
  bdList,
  bdShow,
  bdComplete,
  bdSearch,
  executeCommandSequence,
  executeCommandsParallel,
  recordCLIMetrics,
  createTracedCommand,
} from './gastown-cli-tracing';

// Export from performance utilities
export type {
  PerformanceThresholds,
  MemorySnapshot,
  CpuSnapshot,
  RequestTimingResult,
  QueryTimingResult,
  ApiCallTimingResult,
  ApiHandler
} from './performance';
export {
  // Configuration
  configureThresholds,
  getThresholds,
  // Request timing
  requestTimingMiddleware,
  createRequestTimer,
  // Memory tracking
  getMemorySnapshot,
  trackMemoryUsage,
  withMemoryTracking,
  // CPU tracking
  getCpuSnapshot,
  trackCpuUsage,
  withCpuTracking,
  // Database query timing
  trackDatabaseQuery,
  createDatabaseTimer,
  // External API timing
  trackExternalApiCall,
  createTimedFetch,
  createExternalApiTimer,
  // Performance tracker class
  PerformanceTracker,
  // Utilities
  formatDuration,
  formatBytes
} from './performance';
