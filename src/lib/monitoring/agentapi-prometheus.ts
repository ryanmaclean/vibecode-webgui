/**
 * Prometheus Metrics Exporter for AgentAPI
 * Exposes custom and standard metrics in Prometheus format
 */

import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
// import { logger } from '@/lib/logger';
interface PrometheusConfig {
  port: number;
  endpoint: string;
  host?: string;
  preventServerStart?: boolean;
}

// Extended config interface for PrometheusExporter constructor which accepts more options
interface PrometheusExporterConfig {
  port: number;
  endpoint: string;
  host?: string;
  preventServerStart?: boolean;
}

// Interface for HTTP request/response handlers
interface HttpRequest {
  url?: string;
  method?: string;
}

interface HttpResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(data?: string): void;
}

interface MetricSnapshot {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

class AgentAPIPrometheusExporter {
  private exporter: PrometheusExporter | null = null;
  private meterProvider: MeterProvider | null = null;
  private customMetrics = new Map<string, MetricSnapshot[]>();

  /**
   * Initialize Prometheus exporter with OpenTelemetry integration
   */
  initialize(config: PrometheusConfig): void {
    if (this.exporter) {
      console.warn('Prometheus exporter already initialized');
      return;
    }

    try {
      // Create resource with service information
      const resource = new Resource({
        [ATTR_SERVICE_NAME]: 'agentapi',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        'service.namespace': 'vibecode',
        'deployment.environment': process.env.NODE_ENV || 'development'
      });

      // Create Prometheus exporter
      const exporterConfig: PrometheusExporterConfig = {
        port: config.port,
        endpoint: config.endpoint,
        host: config.host,
        preventServerStart: config.preventServerStart
      };
      this.exporter = new PrometheusExporter(
        exporterConfig as ConstructorParameters<typeof PrometheusExporter>[0],
        () => {
          console.info(
            `Prometheus metrics available at http://${config.host || 'localhost'}:${config.port}${config.endpoint}`
          );
        }
      );

      // Create meter provider with Prometheus exporter
      // PrometheusExporter extends MetricReader, so it can be used directly
      this.meterProvider = new MeterProvider({
        resource,
        readers: [this.exporter as unknown as PeriodicExportingMetricReader]
      });

      console.info('AgentAPI Prometheus exporter initialized');
    } catch (error) {
      console.error('Failed to initialize Prometheus exporter:', error);
      throw error;
    }
  }

  /**
   * Record custom metric
   */
  recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const snapshot: MetricSnapshot = {
      name,
      value,
      labels,
      timestamp: Date.now()
    };

    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, []);
    }

    const metrics = this.customMetrics.get(name)!;
    metrics.push(snapshot);

    // Keep only last 1000 metrics per name to prevent memory leak
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    if (!this.exporter) {
      throw new Error('Prometheus exporter not initialized');
    }

    // Collect metrics from the exporter (triggers collection cycle)
    // Note: PrometheusExporter serves metrics via HTTP endpoint, not getMetrics()
    // We collect our custom metrics in Prometheus format
    // The collect method exists at runtime but may not be in types
    if (typeof (this.exporter as unknown as { collect?: () => Promise<void> }).collect === 'function') {
      await (this.exporter as unknown as { collect: () => Promise<void> }).collect();
    }

    // Custom metrics in Prometheus format
    const customMetrics = this.formatCustomMetrics();

    return customMetrics;
  }

  /**
   * Format custom metrics in Prometheus exposition format
   */
  private formatCustomMetrics(): string {
    const lines: string[] = [];

    for (const [name, snapshots] of this.customMetrics.entries()) {
      if (snapshots.length === 0) continue;

      // Add HELP and TYPE comments
      lines.push(`# HELP ${name} Custom metric from AgentAPI`);
      lines.push(`# TYPE ${name} gauge`);

      // Add metric values
      for (const snapshot of snapshots) {
        const labels = Object.entries(snapshot.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');

        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${name}${labelStr} ${snapshot.value} ${snapshot.timestamp}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Shutdown exporter
   */
  async shutdown(): Promise<void> {
    if (this.meterProvider) {
      await this.meterProvider.shutdown();
      console.info('Prometheus exporter shutdown complete');
    }
  }

  /**
   * Get current metric snapshot
   */
  getMetricSnapshot(name: string): MetricSnapshot[] {
    return this.customMetrics.get(name) || [];
  }

  /**
   * Clear all custom metrics
   */
  clearCustomMetrics(): void {
    this.customMetrics.clear();
  }
}

// Export singleton instance
export const prometheusExporter = new AgentAPIPrometheusExporter();

/**
 * Standard Prometheus metrics collection
 */
export interface StandardMetrics {
  // Agent metrics
  agent_task_duration_seconds: number;
  agent_success_total: number;
  agent_failure_total: number;
  agent_active_count: number;
  agent_output_lines_total: number;
  agent_errors_total: number;

  // HTTP metrics
  http_requests_total: number;
  http_request_duration_seconds: number;

  // Process metrics
  process_cpu_seconds_total: number;
  process_resident_memory_bytes: number;
  process_virtual_memory_bytes: number;
  process_open_fds: number;
  process_max_fds: number;
  process_start_time_seconds: number;
}

/**
 * Collect standard process metrics
 */
export function collectProcessMetrics(): Partial<StandardMetrics> {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    process_cpu_seconds_total: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert microseconds to seconds
    process_resident_memory_bytes: memUsage.rss,
    process_virtual_memory_bytes: memUsage.heapTotal,
    process_start_time_seconds: Math.floor(Date.now() / 1000 - process.uptime())
  };
}

/**
 * Record process metrics to Prometheus
 */
export function recordProcessMetrics(): void {
  const metrics = collectProcessMetrics();

  for (const [name, value] of Object.entries(metrics)) {
    if (value !== undefined) {
      prometheusExporter.recordMetric(name, value, {
        service: 'agentapi',
        instance: process.env.HOSTNAME || 'localhost'
      });
    }
  }
}

/**
 * Start periodic process metrics collection
 */
export function startProcessMetricsCollection(intervalMs: number = 15000): NodeJS.Timeout {
  recordProcessMetrics(); // Collect immediately

  return setInterval(() => {
    recordProcessMetrics();
  }, intervalMs);
}

/**
 * Create metrics endpoint handler for Express/HTTP server
 */
export async function createMetricsHandler(): Promise<(req: HttpRequest, res: HttpResponse) => Promise<void>> {
  return async (_req: HttpRequest, res: HttpResponse) => {
    try {
      const metrics = await prometheusExporter.getPrometheusMetrics();

      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
      });
      res.end(metrics);
    } catch (error) {
      console.error('Error collecting metrics:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error collecting metrics');
    }
  };
}

/**
 * Initialize Prometheus exporter with default configuration
 */
export function initializeDefaultPrometheusExporter(): void {
  prometheusExporter.initialize({
    port: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    endpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics',
    host: process.env.PROMETHEUS_HOST || '0.0.0.0'
  });

  // Start automatic process metrics collection
  startProcessMetricsCollection();
}

// Export types
export type { PrometheusConfig, MetricSnapshot };
