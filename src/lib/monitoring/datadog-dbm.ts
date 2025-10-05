/**
 * Datadog Database Monitoring (DBM) Integration
 * Provides database performance monitoring, connection pool alerts, and query analysis
 */

import tracer from 'dd-trace';

export interface DatadogDBMConfig {
  enabled: boolean;
  instanceId: string;
  service: string;
  host: string;
  port: number;
  database: string;
  username: string;
}

export interface DBMMetrics {
  activeConnections: number;
  totalConnections: number;
  connectionPoolUtilization: number;
  averageQueryTime: number;
  slowQueryCount: number;
  errorRate: number;
  throughput: number;
}

export interface DBMAlert {
  type: 'connection_pool_exhaustion' | 'slow_queries' | 'high_error_rate';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export class DatadogDBM {
  private config: DatadogDBMConfig;
  private tracer: any;

  constructor() {
    this.config = {
      enabled: process.env.DD_DBM_ENABLED === 'true',
      instanceId: process.env.DD_DB_INSTANCE_ID || 'vibecode-postgres',
      service: process.env.DD_SERVICE || 'vibecode-webgui',
      host: process.env.DD_DB_HOST || 'localhost',
      port: parseInt(process.env.DD_DB_PORT || '5432'),
      database: process.env.DD_DB_DATABASE_NAME || 'vibecode',
      username: process.env.DD_DB_USERNAME || 'vibecode'
    };

    this.tracer = tracer;
  }

  /**
   * Record database connection metrics
   */
  recordConnectionMetrics(metrics: {
    activeConnections: number;
    totalConnections: number;
    waitingConnections: number;
    idleConnections: number;
  }): void {
    if (!this.config.enabled) return;

    const utilizationPercent = (metrics.activeConnections / metrics.totalConnections) * 100;

    // Send connection pool metrics to Datadog
    this.tracer.dogstatsd.gauge('database.connections.active', metrics.activeConnections, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database
    });

    this.tracer.dogstatsd.gauge('database.connections.total', metrics.totalConnections, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database
    });

    this.tracer.dogstatsd.gauge('database.connections.utilization', utilizationPercent, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database
    });

    this.tracer.dogstatsd.gauge('database.connections.waiting', metrics.waitingConnections, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database
    });

    this.tracer.dogstatsd.gauge('database.connections.idle', metrics.idleConnections, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database
    });
  }

  /**
   * Record query performance metrics
   */
  recordQueryMetrics(metrics: {
    duration: number;
    query: string;
    success: boolean;
    rowCount?: number;
  }): void {
    if (!this.config.enabled) return;

    // Record query duration
    this.tracer.dogstatsd.histogram('database.query.duration', metrics.duration, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database,
      query_type: this.getQueryType(metrics.query)
    });

    // Record query count
    this.tracer.dogstatsd.increment('database.query.count', 1, {
      service: this.config.service,
      db_instance: this.config.instanceId,
      db_host: this.config.host,
      db_name: this.config.database,
      query_type: this.getQueryType(metrics.query),
      status: metrics.success ? 'success' : 'error'
    });

    // Record row count if available
    if (metrics.rowCount !== undefined) {
      this.tracer.dogstatsd.histogram('database.query.rows_affected', metrics.rowCount, {
        service: this.config.service,
        db_instance: this.config.instanceId,
        db_host: this.config.host,
        db_name: this.config.database,
        query_type: this.getQueryType(metrics.query)
      });
    }
  }

  /**
   * Generate connection pool alerts based on thresholds
   */
  generatePoolAlerts(metrics: DBMMetrics): DBMAlert[] {
    if (!this.config.enabled) return [];

    const alerts: DBMAlert[] = [];
    const now = new Date().toISOString();

    // Connection pool utilization alerts
    if (metrics.connectionPoolUtilization >= 95) {
      alerts.push({
        type: 'connection_pool_exhaustion',
        severity: 'critical',
        message: `Database connection pool is at ${metrics.connectionPoolUtilization.toFixed(1)}% utilization`,
        value: metrics.connectionPoolUtilization,
        threshold: 95,
        timestamp: now
      });
    } else if (metrics.connectionPoolUtilization >= 80) {
      alerts.push({
        type: 'connection_pool_exhaustion',
        severity: 'warning',
        message: `Database connection pool is at ${metrics.connectionPoolUtilization.toFixed(1)}% utilization`,
        value: metrics.connectionPoolUtilization,
        threshold: 80,
        timestamp: now
      });
    }

    // Slow query alerts
    if (metrics.slowQueryCount > 10) {
      alerts.push({
        type: 'slow_queries',
        severity: 'warning',
        message: `${metrics.slowQueryCount} slow queries detected`,
        value: metrics.slowQueryCount,
        threshold: 10,
        timestamp: now
      });
    }

    // Error rate alerts
    if (metrics.errorRate > 5) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `Database error rate is ${metrics.errorRate.toFixed(2)}%`,
        value: metrics.errorRate,
        threshold: 5,
        timestamp: now
      });
    }

    // Send alerts to Datadog as events
    alerts.forEach(alert => this.sendAlertEvent(alert));

    return alerts;
  }

  /**
   * Send alert event to Datadog
   */
  private sendAlertEvent(alert: DBMAlert): void {
    const event = {
      title: `Database Alert: ${alert.type}`,
      text: alert.message,
      alert_type: alert.severity,
      source_type_name: 'database',
      tags: [
        `service:${this.config.service}`,
        `db_instance:${this.config.instanceId}`,
        `db_host:${this.config.host}`,
        `db_name:${this.config.database}`,
        `alert_type:${alert.type}`,
        `severity:${alert.severity}`
      ]
    };

    // Send to Datadog events API
    this.tracer.dogstatsd.event(event);
  }

  /**
   * Get query type from SQL query
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (normalizedQuery.startsWith('SELECT')) return 'select';
    if (normalizedQuery.startsWith('INSERT')) return 'insert';
    if (normalizedQuery.startsWith('UPDATE')) return 'update';
    if (normalizedQuery.startsWith('DELETE')) return 'delete';
    if (normalizedQuery.startsWith('CREATE')) return 'create';
    if (normalizedQuery.startsWith('DROP')) return 'drop';
    if (normalizedQuery.startsWith('ALTER')) return 'alter';
    
    return 'other';
  }

  /**
   * Get current DBM configuration
   */
  getConfig(): DatadogDBMConfig {
    return { ...this.config };
  }

  /**
   * Check if DBM is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Singleton instance
export const datadogDBM = new DatadogDBM();