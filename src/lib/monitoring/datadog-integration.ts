/**
 * Datadog Integration Service
 * Handles sending custom metrics and events to Datadog for embedding operations monitoring
 */

// Simple StatsD implementation for Datadog
import dgram from 'dgram';
// import { logger } from '@/lib/logger';
interface DatadogConfig {
  host?: string;
  port?: number;
  prefix?: string;
  tags?: string[];
  globalTags?: string[];
  maxBufferSize?: number;
  bufferFlushInterval?: number;
}

interface EmbeddingMetrics {
  operation: 'generate' | 'store' | 'search' | 'rag';
  duration: number;
  tokens: number;
  cost: number;
  success: boolean;
  errorType?: string;
  model: string;
  inputLength: number;
}

interface PoolMetrics {
  poolName: string;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
  utilization: number;
}

interface DatabaseMetrics {
  operation: 'query' | 'insert' | 'update' | 'delete';
  duration: number;
  table: string;
  success: boolean;
  errorType?: string;
}

// Simple StatsD client implementation
class SimpleStatsD {
  private client: dgram.Socket;
  private host: string;
  private port: number;
  private prefix: string;
  private globalTags: string[];

  constructor(host: string, port: number, prefix: string, globalTags: string[] = []) {
    this.client = dgram.createSocket('udp4');
    this.host = host;
    this.port = port;
    this.prefix = prefix;
    this.globalTags = globalTags;
  }

  private send(message: string): void {
    const buffer = Buffer.from(message);
    this.client.send(buffer, this.port, this.host, (error) => {
      if (error) {
        console.error('Error sending metric to Datadog:', error);
      }
    });
  }

  private formatTags(tags: string[] = []): string {
    const allTags = [...this.globalTags, ...tags];
    return allTags.length > 0 ? `|#${allTags.join(',')}` : '';
  }

  gauge(metric: string, value: number, tags: string[] = []): void {
    const message = `${this.prefix}${metric}:${value}|g${this.formatTags(tags)}`;
    this.send(message);
  }

  histogram(metric: string, value: number, tags: string[] = []): void {
    const message = `${this.prefix}${metric}:${value}|h${this.formatTags(tags)}`;
    this.send(message);
  }

  timing(metric: string, value: number, tags: string[] = []): void {
    const message = `${this.prefix}${metric}:${value}|ms${this.formatTags(tags)}`;
    this.send(message);
  }

  increment(metric: string, value: number = 1, tags: string[] = []): void {
    const message = `${this.prefix}${metric}:${value}|c${this.formatTags(tags)}`;
    this.send(message);
  }

  event(title: string, text: string, options: any = {}): void {
    const timestamp = Math.floor(Date.now() / 1000);
    const tags = this.formatTags(options.tags || []);
    const alertType = options.alert_type || 'info';
    
    const event = `_e{${title.length},${text.length}}:${title}|${text}|d:${timestamp}|t:${alertType}${tags}`;
    this.send(event);
  }

  close(): void {
    this.client.close();
  }
}

export class DatadogIntegration {
  private statsd: SimpleStatsD;
  private environment: string;
  private service: string;

  constructor(config: DatadogConfig = {}) {
    this.environment = process.env.NODE_ENV || 'development';
    this.service = 'vibecode-webgui';

    const defaultTags = [
      `env:${this.environment}`,
      `service:${this.service}`,
      `version:${process.env.npm_package_version || 'unknown'}`
    ];

    this.statsd = new SimpleStatsD(
      config.host || process.env.DD_AGENT_HOST || 'localhost',
      config.port || parseInt(process.env.DD_DOGSTATSD_PORT || '8125'),
      config.prefix || 'vibecode.',
      [...defaultTags, ...(config.globalTags || [])]
    );
  }

  /**
   * Send embedding operation metrics to Datadog
   */
  public recordEmbeddingMetrics(metrics: EmbeddingMetrics): void {
    const tags = [
      `operation:${metrics.operation}`,
      `model:${metrics.model}`,
      `success:${metrics.success}`
    ];

    if (metrics.errorType) {
      tags.push(`error_type:${metrics.errorType}`);
    }

    // Duration metrics
    this.statsd.histogram('embedding.duration', metrics.duration, tags);
    this.statsd.timing('embedding.duration.timing', metrics.duration, tags);

    // Token and cost metrics
    this.statsd.histogram('embedding.tokens', metrics.tokens, tags);
    this.statsd.histogram('embedding.cost', metrics.cost * 1000000, tags); // Convert to microseconds for precision
    this.statsd.histogram('embedding.input_length', metrics.inputLength, tags);

    // Counter metrics
    this.statsd.increment('embedding.requests.total', 1, tags);
    
    if (metrics.success) {
      this.statsd.increment('embedding.requests.success', 1, tags);
    } else {
      this.statsd.increment('embedding.requests.errors', 1, tags);
    }

    // Rate metrics for different operations
    this.statsd.increment(`embedding.${metrics.operation}.rate`, 1, tags);
  }

  /**
   * Send connection pool metrics to Datadog
   */
  public recordPoolMetrics(metrics: PoolMetrics): void {
    const tags = [`pool_name:${metrics.poolName}`];

    // Gauge metrics for current state
    this.statsd.gauge('db.pool.active_connections', metrics.activeConnections, tags);
    this.statsd.gauge('db.pool.idle_connections', metrics.idleConnections, tags);
    this.statsd.gauge('db.pool.total_connections', metrics.totalConnections, tags);
    this.statsd.gauge('db.pool.waiting_requests', metrics.waitingRequests, tags);
    this.statsd.gauge('db.pool.utilization', metrics.utilization * 100, tags); // Convert to percentage

    // Alert on high utilization
    if (metrics.utilization > 0.8) {
      this.sendEvent({
        title: 'High Database Pool Utilization',
        text: `Pool ${metrics.poolName} is at ${(metrics.utilization * 100).toFixed(1)}% utilization`,
        alertType: 'warning',
        tags: [...tags, 'alert_type:pool_utilization']
      });
    }
  }

  /**
   * Send database operation metrics to Datadog
   */
  public recordDatabaseMetrics(metrics: DatabaseMetrics): void {
    const tags = [
      `operation:${metrics.operation}`,
      `table:${metrics.table}`,
      `success:${metrics.success}`
    ];

    if (metrics.errorType) {
      tags.push(`error_type:${metrics.errorType}`);
    }

    // Duration and performance metrics
    this.statsd.histogram('db.query.duration', metrics.duration, tags);
    this.statsd.timing('db.query.duration.timing', metrics.duration, tags);

    // Counter metrics
    this.statsd.increment('db.query.total', 1, tags);
    
    if (metrics.success) {
      this.statsd.increment('db.query.success', 1, tags);
    } else {
      this.statsd.increment('db.query.errors', 1, tags);
    }
  }

  /**
   * Send custom event to Datadog
   */
  public sendEvent(event: {
    title: string;
    text: string;
    alertType?: 'info' | 'success' | 'warning' | 'error';
    sourceTypeName?: string;
    tags?: string[];
  }): void {
    const defaultTags = [
      `env:${this.environment}`,
      `service:${this.service}`
    ];

    this.statsd.event(
      event.title,
      event.text,
      {
        alert_type: event.alertType || 'info',
        source_type_name: event.sourceTypeName || 'embedding-service',
        tags: [...defaultTags, ...(event.tags || [])]
      }
    );
  }

  /**
   * Send API usage alert to Datadog
   */
  public sendUsageAlert(alert: {
    type: 'token_limit' | 'cost_limit' | 'error_rate' | 'latency_high';
    threshold: number;
    current: number;
    message: string;
  }): void {
    const alertType = alert.type === 'error_rate' || alert.type === 'latency_high' ? 'error' : 'warning';
    
    this.sendEvent({
      title: `Azure Embedding API Alert: ${alert.type}`,
      text: alert.message,
      alertType,
      tags: [
        `alert_type:${alert.type}`,
        `threshold:${alert.threshold}`,
        `current:${alert.current}`
      ]
    });

    // Send metric for alert
    this.statsd.increment('embedding.alerts', 1, [`alert_type:${alert.type}`]);
    this.statsd.gauge(`embedding.alert.${alert.type}.current`, alert.current);
    this.statsd.gauge(`embedding.alert.${alert.type}.threshold`, alert.threshold);
  }

  /**
   * Send service health check to Datadog
   */
  public sendHealthCheck(service: string, healthy: boolean, message?: string): void {
    const tags = [`service_name:${service}`, `healthy:${healthy}`];
    
    this.statsd.gauge('service.health', healthy ? 1 : 0, tags);
    this.statsd.increment('service.health.checks', 1, tags);

    if (!healthy && message) {
      this.sendEvent({
        title: `Service Health Check Failed: ${service}`,
        text: message,
        alertType: 'error',
        tags: [...tags, 'alert_type:health_check']
      });
    }
  }

  /**
   * Record connection pool alert metrics
   */
  public recordPoolAlert(alert: {
    poolKey: string;
    severity: 'warning' | 'critical';
    utilizationPercent: number;
    availableConnections: number;
    activeConnections: number;
    totalConnections: number;
  }): void {
    const tags = [
      `env:${this.environment}`,
      `service:${this.service}`,
      `pool_key:${alert.poolKey}`,
      `severity:${alert.severity}`
    ];

    // Record pool utilization metrics
    this.statsd.gauge('db.pool.utilization_percent', alert.utilizationPercent, tags);
    this.statsd.gauge('db.pool.available_connections', alert.availableConnections, tags);
    this.statsd.gauge('db.pool.active_connections', alert.activeConnections, tags);
    this.statsd.gauge('db.pool.total_connections', alert.totalConnections, tags);

    // Increment alert counter
    this.statsd.increment('db.pool.alerts', 1, tags);
    this.statsd.increment(`db.pool.alerts.${alert.severity}`, 1, tags.filter(t => !t.startsWith('severity:')));

    // Send event for critical alerts
    if (alert.severity === 'critical') {
      this.sendEvent({
        title: `Critical Database Pool Alert: ${alert.poolKey}`,
        text: `Database connection pool "${alert.poolKey}" is critically full (${alert.utilizationPercent}% utilization, ${alert.availableConnections} connections available)`,
        alertType: 'error',
        sourceTypeName: 'database-pool',
        tags: [`pool_key:${alert.poolKey}`, 'alert_type:pool_exhaustion']
      });
    }
  }

  /**
   * Record pool status metrics (for regular monitoring)
   */
  public recordPoolStatus(poolStatus: {
    pools: Array<{
      key: string;
      activeConnections: number;
      totalConnections: number;
      availableConnections: number;
      pendingConnections: number;
      statistics: {
        totalQueries: number;
        averageQueryTime: number;
        errors: number;
      };
    }>;
    totalPools: number;
    healthStatus: string;
  }): void {
    const baseTags = [
      `env:${this.environment}`,
      `service:${this.service}`
    ];

    // Overall pool metrics
    this.statsd.gauge('db.pool.total_pools', poolStatus.totalPools, baseTags);
    this.statsd.gauge('db.pool.health_status', poolStatus.healthStatus === 'healthy' ? 1 : 0, [
      ...baseTags,
      `health_status:${poolStatus.healthStatus}`
    ]);

    // Per-pool metrics
    for (const pool of poolStatus.pools) {
      const poolTags = [...baseTags, `pool_key:${pool.key}`];
      const utilizationPercent = (pool.activeConnections / pool.totalConnections) * 100;

      this.statsd.gauge('db.pool.active_connections', pool.activeConnections, poolTags);
      this.statsd.gauge('db.pool.total_connections', pool.totalConnections, poolTags);
      this.statsd.gauge('db.pool.available_connections', pool.availableConnections, poolTags);
      this.statsd.gauge('db.pool.pending_connections', pool.pendingConnections, poolTags);
      this.statsd.gauge('db.pool.utilization_percent', utilizationPercent, poolTags);

      // Statistics metrics
      this.statsd.gauge('db.pool.total_queries', pool.statistics.totalQueries, poolTags);
      this.statsd.gauge('db.pool.average_query_time', pool.statistics.averageQueryTime, poolTags);
      this.statsd.gauge('db.pool.errors', pool.statistics.errors, poolTags);
    }
  }

  /**
   * Close the StatsD connection
   */
  public close(): void {
    this.statsd.close();
  }

  /**
   * Get Datadog dashboard configuration for embedding metrics
   */
  public getDashboardConfig(): any {
    return {
      title: "Vector Database & Embedding Operations",
      description: "Comprehensive monitoring of Azure embedding service and vector database operations",
      template_variables: [
        {
          name: "env",
          default: this.environment,
          prefix: "env",
          available_values: ["production", "staging", "development"]
        },
        {
          name: "service",
          default: this.service,
          prefix: "service"
        }
      ],
      widgets: [
        {
          definition: {
            type: "timeseries",
            title: "Embedding Request Rate",
            requests: [
              {
                q: "sum:vibecode.embedding.requests.total{$env,$service}.as_rate()",
                display_type: "line"
              }
            ]
          }
        },
        {
          definition: {
            type: "timeseries",
            title: "Embedding Latency (P95)",
            requests: [
              {
                q: "p95:vibecode.embedding.duration{$env,$service} by {operation}",
                display_type: "line"
              }
            ]
          }
        },
        {
          definition: {
            type: "query_value",
            title: "Token Usage Rate",
            requests: [
              {
                q: "sum:vibecode.embedding.tokens{$env,$service}.as_rate()",
                aggregator: "avg"
              }
            ]
          }
        },
        {
          definition: {
            type: "query_value",
            title: "Daily Cost Estimate",
            requests: [
              {
                q: "sum:vibecode.embedding.cost{$env,$service}.as_rate()*86400",
                aggregator: "avg"
              }
            ]
          }
        },
        {
          definition: {
            type: "timeseries",
            title: "Error Rate",
            requests: [
              {
                q: "sum:vibecode.embedding.requests.errors{$env,$service}.as_rate() / sum:vibecode.embedding.requests.total{$env,$service}.as_rate() * 100",
                display_type: "line"
              }
            ]
          }
        },
        {
          definition: {
            type: "timeseries",
            title: "Database Pool Utilization",
            requests: [
              {
                q: "avg:vibecode.db.pool.utilization{$env,$service} by {pool_name}",
                display_type: "area"
              }
            ]
          }
        },
        {
          definition: {
            type: "toplist",
            title: "Top Error Types",
            requests: [
              {
                q: "top(sum:vibecode.embedding.requests.errors{$env,$service} by {error_type}, 10, 'sum', 'desc')"
              }
            ]
          }
        }
      ],
      layout_type: "ordered"
    };
  }
}

// Singleton instance
const datadogIntegration = new DatadogIntegration();

// Export convenience functions
export function initDatadog(config?: DatadogConfig): void {
  // Initialization happens in constructor, this is just for API compatibility
  if (config?.host || config?.port) {
    // Would reinitialize with new config
    console.info('Datadog integration initialized', config);
  }
}

export function isDatadogEnabled(): boolean {
  return Boolean(process.env.DD_API_KEY || process.env.DATADOG_API_KEY);
}

// Export types
export type { DatadogConfig, EmbeddingMetrics, PoolMetrics, DatabaseMetrics };

// Export the singleton instance as default
export default datadogIntegration;