/**
 * Container Metrics Service
 *
 * Queries cAdvisor metrics via Prometheus HTTP API to provide real-time
 * container resource monitoring (CPU, memory, network, storage).
 *
 * Usage:
 *   const service = new ContainerMetricsService();
 *   const metrics = await service.getContainerMetrics();
 *   const history = await service.getContainerHistory('vibecode-app', 'cpu', '1h');
 */

import { fetchWithRetry, FetchError } from '@/lib/utils/fetch';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration for the container metrics service
 */
export interface ContainerMetricsConfig {
  /** Prometheus server URL (default: http://localhost:9090) */
  prometheusUrl?: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
  /** Cache TTL in ms (default: 30000) */
  cacheTTL?: number;
  /** Whether to enable caching (default: true) */
  enableCache?: boolean;
}

/**
 * Container resource metrics
 */
export interface ContainerMetrics {
  /** Container name/ID */
  name: string;
  /** Container image */
  image: string;
  /** CPU usage in cores (e.g., 0.5 = 50% of one core) */
  cpuUsage: number;
  /** CPU usage percentage (0-100) */
  cpuPercent: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Memory usage percentage (0-100) */
  memoryPercent: number;
  /** Network receive bytes per second */
  networkRxBytes: number;
  /** Network transmit bytes per second */
  networkTxBytes: number;
  /** Storage usage in bytes */
  storageUsage: number;
  /** Container state (running, stopped, etc.) */
  state: string;
  /** Timestamp when metrics were collected */
  timestamp: number;
}

/**
 * Time-series data point for historical metrics
 */
export interface MetricDatapoint {
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Metric value */
  value: number;
}

/**
 * Historical container metrics
 */
export interface ContainerHistory {
  /** Container name */
  container: string;
  /** Metric type */
  metric: 'cpu' | 'memory' | 'network_rx' | 'network_tx' | 'storage';
  /** Time-series datapoints */
  datapoints: MetricDatapoint[];
  /** Start time of the range */
  startTime: number;
  /** End time of the range */
  endTime: number;
}

/**
 * Prometheus query response structure
 */
interface PrometheusQueryResponse {
  status: 'success' | 'error';
  data?: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
  error?: string;
  errorType?: string;
}

/**
 * Cached metrics entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// =============================================================================
// Container Metrics Service
// =============================================================================

export class ContainerMetricsService {
  private readonly prometheusUrl: string;
  private readonly timeout: number;
  private readonly cacheTTL: number;
  private readonly enableCache: boolean;
  private cache: Map<string, CacheEntry<any>>;

  constructor(config: ContainerMetricsConfig = {}) {
    this.prometheusUrl = config.prometheusUrl || process.env.PROMETHEUS_URL || 'http://localhost:9090';
    this.timeout = config.timeout || 10000;
    this.cacheTTL = config.cacheTTL || 30000; // 30 seconds default
    this.enableCache = config.enableCache !== false;
    this.cache = new Map();
  }

  /**
   * Get current metrics for all containers
   */
  async getContainerMetrics(): Promise<ContainerMetrics[]> {
    const cacheKey = 'container_metrics_all';

    // Check cache
    if (this.enableCache) {
      const cached = this.getFromCache<ContainerMetrics[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Query all container names first
      const containers = await this.queryContainerNames();

      // Fetch metrics for each container
      const metricsPromises = containers.map(async (containerName) => {
        return this.getContainerMetricsByName(containerName);
      });

      const metrics = await Promise.all(metricsPromises);
      const validMetrics = metrics.filter((m): m is ContainerMetrics => m !== null);

      // Cache the results
      if (this.enableCache) {
        this.setCache(cacheKey, validMetrics);
      }

      return validMetrics;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch container metrics');
    }
  }

  /**
   * Get metrics for a specific container by name
   */
  async getContainerMetricsByName(containerName: string): Promise<ContainerMetrics | null> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);

      // Query CPU usage
      const cpuQuery = `rate(container_cpu_usage_seconds_total{name="${containerName}"}[5m])`;
      const cpuResult = await this.executeQuery(cpuQuery);
      const cpuUsage = this.extractSingleValue(cpuResult) || 0;

      // Query memory usage
      const memoryQuery = `container_memory_working_set_bytes{name="${containerName}"}`;
      const memoryResult = await this.executeQuery(memoryQuery);
      const memoryUsage = this.extractSingleValue(memoryResult) || 0;

      // Query memory limit
      const memoryLimitQuery = `container_spec_memory_limit_bytes{name="${containerName}"}`;
      const memoryLimitResult = await this.executeQuery(memoryLimitQuery);
      const memoryLimit = this.extractSingleValue(memoryLimitResult) || 0;

      // Query network receive rate
      const networkRxQuery = `rate(container_network_receive_bytes_total{name="${containerName}"}[5m])`;
      const networkRxResult = await this.executeQuery(networkRxQuery);
      const networkRxBytes = this.extractSingleValue(networkRxResult) || 0;

      // Query network transmit rate
      const networkTxQuery = `rate(container_network_transmit_bytes_total{name="${containerName}"}[5m])`;
      const networkTxResult = await this.executeQuery(networkTxQuery);
      const networkTxBytes = this.extractSingleValue(networkTxResult) || 0;

      // Query storage usage
      const storageQuery = `container_fs_usage_bytes{name="${containerName}"}`;
      const storageResult = await this.executeQuery(storageQuery);
      const storageUsage = this.extractSingleValue(storageResult) || 0;

      // Get container image from first successful query
      const image = this.extractMetricLabel(cpuResult, 'image') ||
                   this.extractMetricLabel(memoryResult, 'image') ||
                   'unknown';

      // Calculate percentages
      const cpuPercent = Math.round(cpuUsage * 100);
      const memoryPercent = memoryLimit > 0
        ? Math.round((memoryUsage / memoryLimit) * 100)
        : 0;

      return {
        name: containerName,
        image,
        cpuUsage,
        cpuPercent,
        memoryUsage,
        memoryLimit,
        memoryPercent,
        networkRxBytes,
        networkTxBytes,
        storageUsage,
        state: 'running', // Could be enhanced with actual state query
        timestamp
      };
    } catch (error) {
      // Return null for containers that don't have metrics (e.g., stopped containers)
      return null;
    }
  }

  /**
   * Get historical metrics for a container
   */
  async getContainerHistory(
    containerName: string,
    metric: 'cpu' | 'memory' | 'network_rx' | 'network_tx' | 'storage',
    duration: string = '1h',
    step: string = '1m'
  ): Promise<ContainerHistory> {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - this.parseDuration(duration);

      // Build query based on metric type
      let query: string;
      switch (metric) {
        case 'cpu':
          query = `rate(container_cpu_usage_seconds_total{name="${containerName}"}[5m])`;
          break;
        case 'memory':
          query = `container_memory_working_set_bytes{name="${containerName}"}`;
          break;
        case 'network_rx':
          query = `rate(container_network_receive_bytes_total{name="${containerName}"}[5m])`;
          break;
        case 'network_tx':
          query = `rate(container_network_transmit_bytes_total{name="${containerName}"}[5m])`;
          break;
        case 'storage':
          query = `container_fs_usage_bytes{name="${containerName}"}`;
          break;
        default:
          throw new Error(`Unknown metric type: ${metric}`);
      }

      // Execute range query
      const result = await this.executeRangeQuery(query, startTime, endTime, step);
      const datapoints = this.extractTimeSeries(result);

      return {
        container: containerName,
        metric,
        datapoints,
        startTime,
        endTime
      };
    } catch (error) {
      throw this.handleError(error, `Failed to fetch container history for ${containerName}`);
    }
  }

  /**
   * Query all container names from Prometheus
   */
  private async queryContainerNames(): Promise<string[]> {
    try {
      // Query for all containers with CPU metrics (indicates active containers)
      const query = 'container_cpu_usage_seconds_total';
      const result = await this.executeQuery(query);

      if (!result.data?.result) {
        return [];
      }

      // Extract unique container names
      const names = new Set<string>();
      for (const item of result.data.result) {
        const name = item.metric.name;
        if (name && name !== '' && name !== 'POD') {
          names.add(name);
        }
      }

      return Array.from(names);
    } catch (error) {
      throw this.handleError(error, 'Failed to query container names');
    }
  }

  /**
   * Execute instant Prometheus query
   */
  private async executeQuery(query: string): Promise<PrometheusQueryResponse> {
    const url = `${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`;

    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
        timeout: this.timeout,
        retries: 2,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new FetchError(
          `Prometheus query failed: ${response.statusText}`,
          response.status,
          url
        );
      }

      const data: PrometheusQueryResponse = await response.json();

      if (data.status === 'error') {
        throw new Error(`Prometheus error: ${data.error} (${data.errorType})`);
      }

      return data;
    } catch (error) {
      throw this.handleError(error, `Failed to execute Prometheus query: ${query}`);
    }
  }

  /**
   * Execute range Prometheus query
   */
  private async executeRangeQuery(
    query: string,
    start: number,
    end: number,
    step: string
  ): Promise<PrometheusQueryResponse> {
    const params = new URLSearchParams({
      query,
      start: start.toString(),
      end: end.toString(),
      step
    });

    const url = `${this.prometheusUrl}/api/v1/query_range?${params.toString()}`;

    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
        timeout: this.timeout,
        retries: 2,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new FetchError(
          `Prometheus range query failed: ${response.statusText}`,
          response.status,
          url
        );
      }

      const data: PrometheusQueryResponse = await response.json();

      if (data.status === 'error') {
        throw new Error(`Prometheus error: ${data.error} (${data.errorType})`);
      }

      return data;
    } catch (error) {
      throw this.handleError(error, `Failed to execute Prometheus range query: ${query}`);
    }
  }

  /**
   * Extract single numeric value from Prometheus result
   */
  private extractSingleValue(response: PrometheusQueryResponse): number | null {
    if (!response.data?.result || response.data.result.length === 0) {
      return null;
    }

    const value = response.data.result[0].value;
    if (!value) {
      return null;
    }

    return parseFloat(value[1]);
  }

  /**
   * Extract metric label from Prometheus result
   */
  private extractMetricLabel(response: PrometheusQueryResponse, label: string): string | null {
    if (!response.data?.result || response.data.result.length === 0) {
      return null;
    }

    return response.data.result[0].metric[label] || null;
  }

  /**
   * Extract time-series datapoints from Prometheus range query result
   */
  private extractTimeSeries(response: PrometheusQueryResponse): MetricDatapoint[] {
    if (!response.data?.result || response.data.result.length === 0) {
      return [];
    }

    const values = response.data.result[0].values;
    if (!values) {
      return [];
    }

    return values.map(([timestamp, value]) => ({
      timestamp,
      value: parseFloat(value)
    }));
  }

  /**
   * Parse duration string (e.g., "1h", "30m", "1d") to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };

    return amount * multipliers[unit];
  }

  /**
   * Get value from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Handle errors with consistent error messages
   */
  private handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`, { cause: error });
    }
    return new Error(`${context}: Unknown error`);
  }

  /**
   * Check if the service can connect to Prometheus
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await fetchWithRetry(`${this.prometheusUrl}/-/healthy`, {
        method: 'GET',
        timeout: 5000,
        retries: 1
      });

      if (response.ok) {
        return { healthy: true, message: 'Prometheus is healthy' };
      }

      return {
        healthy: false,
        message: `Prometheus returned status ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Default container metrics service instance
 */
export const containerMetricsService = new ContainerMetricsService();
