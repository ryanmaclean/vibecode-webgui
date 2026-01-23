/**
 * Metrics Provider Interface and Implementations
 *
 * This module provides a pluggable metrics abstraction layer for better testability
 * and flexibility in choosing metrics backends (DataDog, StatsD, Console, NoOp).
 *
 * Usage:
 *   // Get the default provider (auto-configured based on environment)
 *   const provider = getMetricsProvider();
 *   provider.increment('api.requests', { endpoint: '/users' });
 *
 *   // Use a specific provider
 *   const datadogProvider = createDataDogProvider({ apiKey: '...' });
 *   metricsRegistry.setProvider(datadogProvider);
 *
 *   // For testing, use the mock provider
 *   const mockProvider = createMockProvider();
 *   metricsRegistry.setProvider(mockProvider);
 */

import { loadSecret } from '@/lib/security/macos-keychain-server';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Tags for metrics - key-value pairs for metric dimensions
 */
export type MetricTags = Record<string, string | number | boolean>;

/**
 * Options for metric operations
 */
export interface MetricOptions {
  /** Additional tags to attach to the metric */
  tags?: MetricTags;
  /** Unix timestamp (seconds) for the metric. Defaults to current time */
  timestamp?: number;
  /** Sample rate for the metric (0.0 to 1.0). Defaults to 1.0 */
  sampleRate?: number;
}

/**
 * Configuration for metrics providers
 */
export interface MetricsProviderConfig {
  /** Whether metrics collection is enabled */
  enabled: boolean;
  /** Environment name (development, staging, production) */
  environment: string;
  /** Service name for metric namespacing */
  service: string;
  /** Application version */
  version: string;
  /** Default tags to apply to all metrics */
  defaultTags?: MetricTags;
  /** Prefix for all metric names */
  prefix?: string;
}

/**
 * Core metrics provider interface
 *
 * All metrics implementations must implement this interface to be pluggable.
 * This abstraction enables:
 * - Easy testing with mock providers
 * - Switching between metrics backends without code changes
 * - Running in environments without external dependencies
 */
export interface IMetricsProvider {
  /** Provider name for identification */
  readonly name: string;

  /** Whether the provider is enabled and operational */
  readonly enabled: boolean;

  /**
   * Increment a counter metric
   * @param name - Metric name (e.g., 'api.requests', 'errors.count')
   * @param value - Amount to increment (default: 1)
   * @param options - Additional options including tags
   */
  increment(name: string, value?: number, options?: MetricOptions): void;

  /**
   * Decrement a counter metric
   * @param name - Metric name
   * @param value - Amount to decrement (default: 1)
   * @param options - Additional options including tags
   */
  decrement(name: string, value?: number, options?: MetricOptions): void;

  /**
   * Set a gauge metric value (point-in-time measurement)
   * @param name - Metric name (e.g., 'system.memory', 'queue.size')
   * @param value - Current value
   * @param options - Additional options including tags
   */
  gauge(name: string, value: number, options?: MetricOptions): void;

  /**
   * Record a histogram/distribution value
   * @param name - Metric name (e.g., 'api.response_time', 'query.duration')
   * @param value - Value to record
   * @param options - Additional options including tags
   */
  histogram(name: string, value: number, options?: MetricOptions): void;

  /**
   * Record a timing metric (convenience wrapper around histogram)
   * @param name - Metric name
   * @param duration - Duration in milliseconds
   * @param options - Additional options including tags
   */
  timing(name: string, duration: number, options?: MetricOptions): void;

  /**
   * Record a distribution metric (similar to histogram but with percentiles)
   * @param name - Metric name
   * @param value - Value to record
   * @param options - Additional options including tags
   */
  distribution(name: string, value: number, options?: MetricOptions): void;

  /**
   * Record a set metric (count unique occurrences)
   * @param name - Metric name
   * @param value - Unique value to track
   * @param options - Additional options including tags
   */
  set(name: string, value: string | number, options?: MetricOptions): void;

  /**
   * Flush any buffered metrics
   * @returns Promise that resolves when flush is complete
   */
  flush(): Promise<void>;

  /**
   * Shutdown the provider and release resources
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;
}

/**
 * Extended provider with health check capabilities
 */
export interface IMetricsProviderWithHealth extends IMetricsProvider {
  /**
   * Check if the provider is healthy and can send metrics
   */
  healthCheck(): Promise<{ healthy: boolean; message: string }>;
}

// =============================================================================
// NoOp Provider - For testing and disabled environments
// =============================================================================

/**
 * No-operation metrics provider
 *
 * Use this provider when metrics collection should be completely disabled,
 * such as in unit tests or environments without metrics infrastructure.
 */
export class NoOpMetricsProvider implements IMetricsProvider {
  readonly name = 'noop';
  readonly enabled = false;

  increment(): void { /* noop */ }
  decrement(): void { /* noop */ }
  gauge(): void { /* noop */ }
  histogram(): void { /* noop */ }
  timing(): void { /* noop */ }
  distribution(): void { /* noop */ }
  set(): void { /* noop */ }
  async flush(): Promise<void> { /* noop */ }
  async shutdown(): Promise<void> { /* noop */ }
}

// =============================================================================
// Console Provider - For debugging and development
// =============================================================================

export interface ConsoleProviderOptions {
  /** Whether to enable the provider */
  enabled?: boolean;
  /** Log level for metrics output */
  logLevel?: 'debug' | 'info' | 'warn';
  /** Prefix for console output */
  prefix?: string;
  /** Whether to include timestamps */
  timestamps?: boolean;
}

/**
 * Console metrics provider for debugging
 *
 * Outputs all metrics to the console. Useful for:
 * - Local development debugging
 * - Verifying metric names and tags
 * - Environments without external metrics services
 */
export class ConsoleMetricsProvider implements IMetricsProvider {
  readonly name = 'console';
  readonly enabled: boolean;

  private readonly prefix: string;
  private readonly logLevel: 'debug' | 'info' | 'warn';
  private readonly timestamps: boolean;
  private buffer: Array<{ type: string; name: string; value: any; tags?: MetricTags }> = [];

  constructor(options: ConsoleProviderOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.prefix = options.prefix ?? '[Metrics]';
    this.logLevel = options.logLevel ?? 'debug';
    this.timestamps = options.timestamps ?? true;
  }

  private log(type: string, name: string, value: any, options?: MetricOptions): void {
    if (!this.enabled) return;

    const timestamp = this.timestamps ? new Date().toISOString() : '';
    const tagsStr = options?.tags ? ` ${JSON.stringify(options.tags)}` : '';
    const message = `${this.prefix} ${timestamp} ${type.toUpperCase()}: ${name} = ${value}${tagsStr}`;

    switch (this.logLevel) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
    }

    this.buffer.push({ type, name, value, tags: options?.tags });
  }

  increment(name: string, value: number = 1, options?: MetricOptions): void {
    this.log('increment', name, value, options);
  }

  decrement(name: string, value: number = 1, options?: MetricOptions): void {
    this.log('decrement', name, -value, options);
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.log('gauge', name, value, options);
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    this.log('histogram', name, value, options);
  }

  timing(name: string, duration: number, options?: MetricOptions): void {
    this.log('timing', name, `${duration}ms`, options);
  }

  distribution(name: string, value: number, options?: MetricOptions): void {
    this.log('distribution', name, value, options);
  }

  set(name: string, value: string | number, options?: MetricOptions): void {
    this.log('set', name, value, options);
  }

  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      console.info(`${this.prefix} Flushing ${this.buffer.length} buffered metrics`);
      this.buffer = [];
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    console.info(`${this.prefix} Console metrics provider shutdown`);
  }

  /** Get buffered metrics (useful for testing) */
  getBuffer(): Array<{ type: string; name: string; value: any; tags?: MetricTags }> {
    return [...this.buffer];
  }

  /** Clear the buffer */
  clearBuffer(): void {
    this.buffer = [];
  }
}

// =============================================================================
// DataDog Provider
// =============================================================================

export interface DataDogProviderOptions {
  /** DataDog API key (will attempt to load from keychain if not provided) */
  apiKey?: string;
  /** DataDog site (e.g., 'datadoghq.com', 'datadoghq.eu') */
  site?: string;
  /** Service name */
  service?: string;
  /** Environment */
  environment?: string;
  /** Application version */
  version?: string;
  /** Default tags for all metrics */
  defaultTags?: MetricTags;
  /** Buffer flush interval in milliseconds */
  flushIntervalMs?: number;
  /** Maximum buffer size before auto-flush */
  maxBufferSize?: number;
}

interface DataDogMetricPoint {
  metric: string;
  type: 'count' | 'gauge' | 'rate';
  points: Array<[number, number]>;
  tags: string[];
}

/**
 * DataDog metrics provider
 *
 * Sends metrics to DataDog via their HTTP API. Features:
 * - Automatic batching for efficiency
 * - Configurable flush intervals
 * - Support for all metric types
 */
export class DataDogMetricsProvider implements IMetricsProviderWithHealth {
  readonly name = 'datadog';
  readonly enabled: boolean;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly service: string;
  private readonly environment: string;
  private readonly version: string;
  private readonly defaultTags: string[];
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;

  private buffer: DataDogMetricPoint[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(options: DataDogProviderOptions = {}) {
    // Try to load API key from various sources
    this.apiKey = options.apiKey
      || loadSecret('DD_API_KEY')
      || loadSecret('DATADOG_API_KEY')
      || process.env.DD_API_KEY
      || process.env.DATADOG_API_KEY;

    const site = options.site || process.env.DD_SITE || 'datadoghq.com';
    this.baseUrl = `https://api.${site}/api/v1`;

    this.service = options.service || 'vibecode-webgui';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || process.env.APP_VERSION || '0.1.0';

    this.enabled = !!this.apiKey && this.apiKey !== 'placeholder-set-real-key';

    // Build default tags
    const defaultTagsObj: MetricTags = {
      env: this.environment,
      service: this.service,
      version: this.version,
      ...options.defaultTags
    };
    this.defaultTags = Object.entries(defaultTagsObj).map(([k, v]) => `${k}:${v}`);

    this.flushIntervalMs = options.flushIntervalMs ?? 10000;
    this.maxBufferSize = options.maxBufferSize ?? 100;

    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        console.error('[DataDog] Flush error:', err);
      });
    }, this.flushIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private formatTags(options?: MetricOptions): string[] {
    const tags = [...this.defaultTags];
    if (options?.tags) {
      for (const [key, value] of Object.entries(options.tags)) {
        tags.push(`${key}:${value}`);
      }
    }
    return tags;
  }

  private addToBuffer(
    name: string,
    value: number,
    type: 'count' | 'gauge' | 'rate',
    options?: MetricOptions
  ): void {
    if (!this.enabled) return;

    const timestamp = options?.timestamp ?? Math.floor(Date.now() / 1000);
    const tags = this.formatTags(options);

    this.buffer.push({
      metric: name.startsWith('vibecode.') ? name : `vibecode.${name}`,
      type,
      points: [[timestamp, value]],
      tags
    });

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch(err => {
        console.error('[DataDog] Auto-flush error:', err);
      });
    }
  }

  increment(name: string, value: number = 1, options?: MetricOptions): void {
    this.addToBuffer(name, value, 'count', options);
  }

  decrement(name: string, value: number = 1, options?: MetricOptions): void {
    this.addToBuffer(name, -value, 'count', options);
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.addToBuffer(name, value, 'gauge', options);
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    // DataDog histograms are sent as gauges with distribution suffix
    this.addToBuffer(`${name}.histogram`, value, 'gauge', options);
  }

  timing(name: string, duration: number, options?: MetricOptions): void {
    this.histogram(`${name}.timing`, duration, options);
  }

  distribution(name: string, value: number, options?: MetricOptions): void {
    this.addToBuffer(`${name}.distribution`, value, 'gauge', options);
  }

  set(name: string, value: string | number, options?: MetricOptions): void {
    // Sets are approximated as gauges in this implementation
    const numericValue = typeof value === 'string' ? value.length : value;
    this.addToBuffer(`${name}.set`, numericValue, 'gauge', options);
  }

  async flush(): Promise<void> {
    if (!this.enabled || this.buffer.length === 0) return;

    const metricsToSend = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(`${this.baseUrl}/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey!
        },
        body: JSON.stringify({ series: metricsToSend })
      });

      if (!response.ok) {
        console.error(`[DataDog] Failed to send metrics: ${response.status} ${response.statusText}`);
        // Re-add metrics to buffer for retry (with limit to prevent memory issues)
        if (this.buffer.length < this.maxBufferSize * 2) {
          this.buffer = [...metricsToSend, ...this.buffer];
        }
      }
    } catch (error) {
      console.error('[DataDog] Error sending metrics:', error);
      // Re-add metrics to buffer for retry
      if (this.buffer.length < this.maxBufferSize * 2) {
        this.buffer = [...metricsToSend, ...this.buffer];
      }
    }
  }

  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.enabled) {
      return { healthy: false, message: 'DataDog provider is disabled (no API key)' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': this.apiKey!
        }
      });

      if (response.ok) {
        return { healthy: true, message: 'DataDog API connection successful' };
      } else {
        return { healthy: false, message: `DataDog API error: ${response.status}` };
      }
    } catch (error) {
      return {
        healthy: false,
        message: `DataDog connection failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// =============================================================================
// StatsD Provider
// =============================================================================

export interface StatsDProviderOptions {
  /** StatsD host */
  host?: string;
  /** StatsD port */
  port?: number;
  /** Metric prefix */
  prefix?: string;
  /** Default tags */
  defaultTags?: MetricTags;
  /** Global sample rate */
  sampleRate?: number;
}

/**
 * StatsD metrics provider
 *
 * Sends metrics to a StatsD server. This is a lightweight implementation
 * that uses UDP for metric transmission.
 *
 * Note: For production use, consider using a full StatsD client library.
 */
export class StatsDMetricsProvider implements IMetricsProvider {
  readonly name = 'statsd';
  readonly enabled: boolean;

  private readonly host: string;
  private readonly port: number;
  private readonly prefix: string;
  private readonly defaultTags: MetricTags;
  private readonly sampleRate: number;
  private buffer: string[] = [];

  constructor(options: StatsDProviderOptions = {}) {
    this.host = options.host || process.env.STATSD_HOST || 'localhost';
    this.port = options.port || parseInt(process.env.STATSD_PORT || '8125', 10);
    this.prefix = options.prefix || 'vibecode';
    this.defaultTags = options.defaultTags || {};
    this.sampleRate = options.sampleRate ?? 1.0;
    this.enabled = true;
  }

  private formatMetric(
    name: string,
    value: number | string,
    type: string,
    options?: MetricOptions
  ): string {
    const fullName = `${this.prefix}.${name}`;
    const tags = { ...this.defaultTags, ...options?.tags };
    const tagStr = Object.entries(tags)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    const sampleRate = options?.sampleRate ?? this.sampleRate;
    const sampleStr = sampleRate < 1 ? `|@${sampleRate}` : '';
    const tagsStr = tagStr ? `|#${tagStr}` : '';

    return `${fullName}:${value}|${type}${sampleStr}${tagsStr}`;
  }

  private send(metric: string): void {
    if (!this.enabled) return;

    // In a real implementation, this would send via UDP
    // For now, we buffer and log
    this.buffer.push(metric);

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[StatsD] ${metric}`);
    }
  }

  increment(name: string, value: number = 1, options?: MetricOptions): void {
    this.send(this.formatMetric(name, value, 'c', options));
  }

  decrement(name: string, value: number = 1, options?: MetricOptions): void {
    this.send(this.formatMetric(name, -value, 'c', options));
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.send(this.formatMetric(name, value, 'g', options));
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    this.send(this.formatMetric(name, value, 'h', options));
  }

  timing(name: string, duration: number, options?: MetricOptions): void {
    this.send(this.formatMetric(name, duration, 'ms', options));
  }

  distribution(name: string, value: number, options?: MetricOptions): void {
    this.send(this.formatMetric(name, value, 'd', options));
  }

  set(name: string, value: string | number, options?: MetricOptions): void {
    this.send(this.formatMetric(name, value, 's', options));
  }

  async flush(): Promise<void> {
    // In a real implementation, this would flush the UDP buffer
    this.buffer = [];
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  /** Get buffered metrics (useful for testing) */
  getBuffer(): string[] {
    return [...this.buffer];
  }
}

// =============================================================================
// Mock Provider - For Testing
// =============================================================================

export interface MockMetricCall {
  method: string;
  name: string;
  value?: number | string;
  options?: MetricOptions;
  timestamp: number;
}

/**
 * Mock metrics provider for testing
 *
 * Records all metric calls for later assertion. Features:
 * - Full call history
 * - Helpers to find specific metrics
 * - Reset capability between tests
 */
export class MockMetricsProvider implements IMetricsProvider {
  readonly name = 'mock';
  readonly enabled = true;

  private calls: MockMetricCall[] = [];
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  private record(method: string, name: string, value?: number | string, options?: MetricOptions): void {
    this.calls.push({
      method,
      name,
      value,
      options,
      timestamp: Date.now()
    });
  }

  increment(name: string, value: number = 1, options?: MetricOptions): void {
    this.record('increment', name, value, options);
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  }

  decrement(name: string, value: number = 1, options?: MetricOptions): void {
    this.record('decrement', name, value, options);
    this.counters.set(name, (this.counters.get(name) || 0) - value);
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.record('gauge', name, value, options);
    this.gauges.set(name, value);
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    this.record('histogram', name, value, options);
    const existing = this.histograms.get(name) || [];
    existing.push(value);
    this.histograms.set(name, existing);
  }

  timing(name: string, duration: number, options?: MetricOptions): void {
    this.record('timing', name, duration, options);
    this.histogram(name, duration, options);
  }

  distribution(name: string, value: number, options?: MetricOptions): void {
    this.record('distribution', name, value, options);
    this.histogram(name, value, options);
  }

  set(name: string, value: string | number, options?: MetricOptions): void {
    this.record('set', name, value, options);
  }

  async flush(): Promise<void> {
    // Mock flush - no-op
  }

  async shutdown(): Promise<void> {
    // Mock shutdown - no-op
  }

  // ==========================================================================
  // Test Helper Methods
  // ==========================================================================

  /** Get all recorded calls */
  getCalls(): MockMetricCall[] {
    return [...this.calls];
  }

  /** Get calls for a specific method */
  getCallsForMethod(method: string): MockMetricCall[] {
    return this.calls.filter(c => c.method === method);
  }

  /** Get calls for a specific metric name */
  getCallsForMetric(name: string): MockMetricCall[] {
    return this.calls.filter(c => c.name === name);
  }

  /** Get current counter value */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /** Get current gauge value */
  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  /** Get histogram values */
  getHistogramValues(name: string): number[] {
    return this.histograms.get(name) || [];
  }

  /** Check if a metric was called */
  wasMetricCalled(name: string, method?: string): boolean {
    return this.calls.some(c => c.name === name && (!method || c.method === method));
  }

  /** Get the number of times a metric was called */
  getCallCount(name: string, method?: string): number {
    return this.calls.filter(c => c.name === name && (!method || c.method === method)).length;
  }

  /** Reset all recorded data */
  reset(): void {
    this.calls = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /** Get a summary of all metrics */
  getSummary(): {
    totalCalls: number;
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; avg: number; min: number; max: number }>;
  } {
    const histogramStats: Record<string, { count: number; sum: number; avg: number; min: number; max: number }> = {};

    for (const [name, values] of this.histograms.entries()) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        histogramStats[name] = {
          count: values.length,
          sum,
          avg: sum / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }

    return {
      totalCalls: this.calls.length,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: histogramStats
    };
  }
}

// =============================================================================
// Composite Provider - For sending to multiple backends
// =============================================================================

/**
 * Composite metrics provider that sends to multiple backends
 *
 * Use this when you need to send metrics to multiple destinations,
 * such as both DataDog and a local console for debugging.
 */
export class CompositeMetricsProvider implements IMetricsProvider {
  readonly name = 'composite';
  readonly enabled: boolean;

  private readonly providers: IMetricsProvider[];

  constructor(providers: IMetricsProvider[]) {
    this.providers = providers.filter(p => p.enabled);
    this.enabled = this.providers.length > 0;
  }

  private forEachProvider(fn: (provider: IMetricsProvider) => void): void {
    for (const provider of this.providers) {
      try {
        fn(provider);
      } catch (error) {
        console.error(`[CompositeMetrics] Error in provider ${provider.name}:`, error);
      }
    }
  }

  increment(name: string, value?: number, options?: MetricOptions): void {
    this.forEachProvider(p => p.increment(name, value, options));
  }

  decrement(name: string, value?: number, options?: MetricOptions): void {
    this.forEachProvider(p => p.decrement(name, value, options));
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.forEachProvider(p => p.gauge(name, value, options));
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    this.forEachProvider(p => p.histogram(name, value, options));
  }

  timing(name: string, duration: number, options?: MetricOptions): void {
    this.forEachProvider(p => p.timing(name, duration, options));
  }

  distribution(name: string, value: number, options?: MetricOptions): void {
    this.forEachProvider(p => p.distribution(name, value, options));
  }

  set(name: string, value: string | number, options?: MetricOptions): void {
    this.forEachProvider(p => p.set(name, value, options));
  }

  async flush(): Promise<void> {
    await Promise.all(this.providers.map(p => p.flush()));
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.providers.map(p => p.shutdown()));
  }

  /** Get list of active provider names */
  getProviderNames(): string[] {
    return this.providers.map(p => p.name);
  }
}

// =============================================================================
// Metrics Registry - Singleton for managing the active provider
// =============================================================================

/**
 * Metrics Registry
 *
 * Manages the global metrics provider instance. Allows:
 * - Setting/getting the active provider
 * - Convenience methods that delegate to the active provider
 * - Provider swapping for testing
 */
class MetricsRegistry {
  private provider: IMetricsProvider;
  private isInitialized = false;

  constructor() {
    // Start with NoOp provider until explicitly initialized
    this.provider = new NoOpMetricsProvider();
  }

  /**
   * Initialize the registry with auto-detected provider
   */
  initialize(): void {
    if (this.isInitialized) return;

    // Auto-detect the best provider based on environment
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      // Use mock provider for tests
      this.provider = new MockMetricsProvider();
    } else if (process.env.DD_API_KEY || process.env.DATADOG_API_KEY) {
      // Use DataDog if API key is available
      this.provider = new DataDogMetricsProvider();
    } else if (process.env.STATSD_HOST) {
      // Use StatsD if configured
      this.provider = new StatsDMetricsProvider();
    } else if (process.env.NODE_ENV === 'development') {
      // Use console in development
      this.provider = new ConsoleMetricsProvider({
        enabled: process.env.METRICS_DEBUG === 'true',
        logLevel: 'debug'
      });
    } else {
      // Default to NoOp
      this.provider = new NoOpMetricsProvider();
    }

    this.isInitialized = true;
  }

  /**
   * Get the current provider
   */
  getProvider(): IMetricsProvider {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.provider;
  }

  /**
   * Set a custom provider
   */
  setProvider(provider: IMetricsProvider): void {
    // Shutdown existing provider
    if (this.provider && this.provider.shutdown) {
      this.provider.shutdown().catch(err => {
        console.error('[MetricsRegistry] Error shutting down previous provider:', err);
      });
    }
    this.provider = provider;
    this.isInitialized = true;
  }

  /**
   * Reset to a new mock provider (for testing)
   */
  resetForTesting(): MockMetricsProvider {
    const mockProvider = new MockMetricsProvider();
    this.provider = mockProvider;
    this.isInitialized = true;
    return mockProvider;
  }

  // Convenience methods that delegate to the active provider
  increment(name: string, value?: number, options?: MetricOptions): void {
    this.getProvider().increment(name, value, options);
  }

  decrement(name: string, value?: number, options?: MetricOptions): void {
    this.getProvider().decrement(name, value, options);
  }

  gauge(name: string, value: number, options?: MetricOptions): void {
    this.getProvider().gauge(name, value, options);
  }

  histogram(name: string, value: number, options?: MetricOptions): void {
    this.getProvider().histogram(name, value, options);
  }

  timing(name: string, duration: number, options?: MetricOptions): void {
    this.getProvider().timing(name, duration, options);
  }

  distribution(name: string, value: number, options?: MetricOptions): void {
    this.getProvider().distribution(name, value, options);
  }

  set(name: string, value: string | number, options?: MetricOptions): void {
    this.getProvider().set(name, value, options);
  }

  async flush(): Promise<void> {
    await this.getProvider().flush();
  }

  async shutdown(): Promise<void> {
    await this.getProvider().shutdown();
  }
}

// =============================================================================
// Exports
// =============================================================================

// Singleton registry instance
export const metricsRegistry = new MetricsRegistry();

// Convenience function to get the current provider
export function getMetricsProvider(): IMetricsProvider {
  return metricsRegistry.getProvider();
}

// Provider factory functions
export function createNoOpProvider(): NoOpMetricsProvider {
  return new NoOpMetricsProvider();
}

export function createConsoleProvider(options?: ConsoleProviderOptions): ConsoleMetricsProvider {
  return new ConsoleMetricsProvider(options);
}

export function createDataDogProvider(options?: DataDogProviderOptions): DataDogMetricsProvider {
  return new DataDogMetricsProvider(options);
}

export function createStatsDProvider(options?: StatsDProviderOptions): StatsDMetricsProvider {
  return new StatsDMetricsProvider(options);
}

export function createMockProvider(): MockMetricsProvider {
  return new MockMetricsProvider();
}

export function createCompositeProvider(providers: IMetricsProvider[]): CompositeMetricsProvider {
  return new CompositeMetricsProvider(providers);
}

// Default export for convenience
export default metricsRegistry;
