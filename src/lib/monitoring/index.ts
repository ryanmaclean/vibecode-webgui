/**
 * Monitoring module exports
 *
 * This module provides a comprehensive monitoring solution with:
 * - Pluggable metrics providers (DataDog, StatsD, Console, NoOp, Mock)
 * - Dependency injection for better testability
 * - Backward-compatible API
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
export type { MetricOptions as DatadogMetricOptions } from './datadog-metrics';
export { increment, gauge, histogram } from './datadog-metrics';

// =============================================================================
// Metrics Provider System (Dependency Injection)
// =============================================================================

// Export the IMetricsProvider interface and all provider implementations
export type {
  IMetricsProvider,
  IMetricsProviderWithHealth,
  MetricTags,
  MetricOptions,
  MetricsProviderConfig,
  ConsoleProviderOptions,
  DataDogProviderOptions,
  StatsDProviderOptions,
  MockMetricCall,
} from './metrics-provider';

export {
  // Provider classes
  NoOpMetricsProvider,
  ConsoleMetricsProvider,
  DataDogMetricsProvider,
  StatsDMetricsProvider,
  MockMetricsProvider,
  CompositeMetricsProvider,

  // Factory functions
  createNoOpProvider,
  createConsoleProvider,
  createDataDogProvider,
  createStatsDProvider,
  createMockProvider,
  createCompositeProvider,

  // Registry
  metricsRegistry,
  getMetricsProvider,
} from './metrics-provider';

// Export from datadog-integration
export type { DatadogConfig } from './datadog-integration';
export { initDatadog, isDatadogEnabled } from './datadog-integration';

// gastown-cli-tracing module was removed in cleanup wave
// Re-exports removed: CLITraceContext, CLICommandResult, etc.

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
