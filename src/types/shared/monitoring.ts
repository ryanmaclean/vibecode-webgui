/**
 * Monitoring and Telemetry Types for VibeCode
 *
 * Comprehensive type definitions for monitoring, observability, and telemetry
 * across all VibeCode services. Supports Datadog integration, distributed tracing,
 * metrics collection, log aggregation, and health monitoring.
 *
 * @module types/shared/monitoring
 */

// ============================================================================
// Log Types
// ============================================================================

/**
 * Standard log levels following RFC 5424
 */
export type LogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency';

/**
 * Log severity numeric values (0 = emergency, 7 = debug)
 */
export const LOG_SEVERITY: Record<LogLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Unique log entry ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log severity level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Service name (e.g., 'rig', 'web', 'desktop') */
  service: string;
  /** Service instance/host identifier */
  hostname?: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Trace ID from distributed tracing */
  traceId?: string;
  /** Span ID from distributed tracing */
  spanId?: string;
  /** User ID if applicable */
  userId?: string;
  /** Workspace ID if applicable */
  workspaceId?: string;
  /** Session ID if applicable */
  sessionId?: string;
  /** Error object if log is error-level */
  error?: ErrorContext;
  /** Structured metadata */
  metadata?: Record<string, unknown>;
  /** Tags for filtering and grouping */
  tags?: string[];
  /** Environment (e.g., 'production', 'staging', 'development') */
  environment?: string;
  /** Git commit SHA */
  version?: string;
}

/**
 * Error context for error logs
 */
export interface ErrorContext {
  /** Error name/type */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Error code if applicable */
  code?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Causation chain for nested errors */
  cause?: ErrorContext;
  /** Additional error metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Metric Types
// ============================================================================

/**
 * Metric types following Datadog/Prometheus conventions
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer' | 'distribution' | 'set';

/**
 * Base metric data point
 */
export interface MetricDataPoint {
  /** Metric name (e.g., 'ai.request.duration') */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Metric value */
  value: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Metric tags for dimensions */
  tags: Record<string, string>;
  /** Metric unit (e.g., 'ms', 'bytes', 'count') */
  unit?: string;
  /** Hostname/instance */
  hostname?: string;
  /** Sample rate (0-1) for sampling metrics */
  sampleRate?: number;
}

/**
 * Counter metric (monotonically increasing)
 */
export interface CounterMetric extends MetricDataPoint {
  type: 'counter';
  /** Increment value (default: 1) */
  value: number;
}

/**
 * Gauge metric (point-in-time value)
 */
export interface GaugeMetric extends MetricDataPoint {
  type: 'gauge';
  /** Current gauge value */
  value: number;
}

/**
 * Histogram metric (distribution of values)
 */
export interface HistogramMetric extends MetricDataPoint {
  type: 'histogram';
  /** Histogram value */
  value: number;
  /** Histogram buckets for aggregation */
  buckets?: number[];
}

/**
 * Timer metric (duration measurement)
 */
export interface TimerMetric extends MetricDataPoint {
  type: 'timer';
  /** Duration in milliseconds */
  value: number;
  unit: 'ms';
}

/**
 * Distribution metric (statistical distribution)
 */
export interface DistributionMetric extends MetricDataPoint {
  type: 'distribution';
  /** Distribution value */
  value: number;
  /** Percentiles to calculate (e.g., [50, 95, 99]) */
  percentiles?: number[];
}

/**
 * Aggregated metric statistics
 */
export interface MetricAggregation {
  /** Metric name */
  name: string;
  /** Aggregation period start */
  periodStart: string;
  /** Aggregation period end */
  periodEnd: string;
  /** Number of data points */
  count: number;
  /** Sum of all values */
  sum: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Mean/average value */
  mean: number;
  /** Median value */
  median: number;
  /** Standard deviation */
  stddev: number;
  /** Percentile values */
  percentiles?: Record<number, number>;
  /** Tags for this aggregation */
  tags: Record<string, string>;
}

// ============================================================================
// Trace and Span Types
// ============================================================================

/**
 * Span kind (OpenTelemetry)
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

/**
 * Span status
 */
export type SpanStatus = 'unset' | 'ok' | 'error';

/**
 * Distributed trace span
 */
export interface Span {
  /** Unique span ID */
  spanId: string;
  /** Trace ID this span belongs to */
  traceId: string;
  /** Parent span ID (null for root span) */
  parentSpanId?: string;
  /** Span operation name */
  name: string;
  /** Span kind */
  kind: SpanKind;
  /** Span start time (ISO 8601) */
  startTime: string;
  /** Span end time (ISO 8601) */
  endTime?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Span status */
  status: SpanStatus;
  /** Status message if error */
  statusMessage?: string;
  /** Service name */
  service: string;
  /** Resource name (e.g., HTTP endpoint, DB query) */
  resource?: string;
  /** Span attributes/tags */
  attributes: Record<string, string | number | boolean>;
  /** Span events (logs within the span) */
  events?: SpanEvent[];
  /** Links to other spans */
  links?: SpanLink[];
  /** Error information if span failed */
  error?: ErrorContext;
}

/**
 * Event within a span
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event attributes */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Link to another span
 */
export interface SpanLink {
  /** Linked trace ID */
  traceId: string;
  /** Linked span ID */
  spanId: string;
  /** Link attributes */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Complete distributed trace
 */
export interface Trace {
  /** Unique trace ID */
  traceId: string;
  /** Root span of the trace */
  rootSpan: Span;
  /** All spans in the trace */
  spans: Span[];
  /** Trace start time */
  startTime: string;
  /** Trace end time */
  endTime?: string;
  /** Total trace duration in milliseconds */
  duration?: number;
  /** Trace status (derived from spans) */
  status: SpanStatus;
  /** Services involved in this trace */
  services: string[];
  /** Trace-level tags */
  tags?: Record<string, string>;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event severity levels
 */
export type EventSeverity = 'info' | 'low' | 'normal' | 'high' | 'critical';

/**
 * Event source types
 */
export type EventSource =
  | 'application'
  | 'system'
  | 'user'
  | 'api'
  | 'database'
  | 'ai_provider'
  | 'agent'
  | 'monitoring'
  | 'security';

/**
 * Application/system event
 */
export interface MonitoringEvent {
  /** Unique event ID */
  id: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event title */
  title: string;
  /** Event description */
  text: string;
  /** Event severity */
  severity: EventSeverity;
  /** Event source */
  source: EventSource;
  /** Service that generated the event */
  service: string;
  /** Event type/category */
  eventType: string;
  /** Related resource ID */
  resourceId?: string;
  /** User ID if user-initiated */
  userId?: string;
  /** Workspace ID if applicable */
  workspaceId?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Event metadata */
  metadata?: Record<string, unknown>;
  /** Alert type for Datadog */
  alertType?: 'info' | 'warning' | 'error' | 'success';
  /** Correlation ID */
  correlationId?: string;
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Component health check result
 */
export interface ComponentHealth {
  /** Component name */
  name: string;
  /** Health status */
  status: HealthStatus;
  /** Status message or details */
  message?: string;
  /** Last check timestamp (ISO 8601) */
  lastCheck: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Component-specific metadata */
  metadata?: Record<string, unknown>;
  /** Error if unhealthy */
  error?: ErrorContext;
}

/**
 * Service health check
 */
export interface ServiceHealth {
  /** Service name */
  service: string;
  /** Overall service status */
  status: HealthStatus;
  /** Service version */
  version: string;
  /** Health check timestamp (ISO 8601) */
  timestamp: string;
  /** Service uptime in seconds */
  uptime?: number;
  /** Component health checks */
  components: ComponentHealth[];
  /** Service dependencies */
  dependencies?: DependencyHealth[];
  /** Service metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Dependency health status
 */
export interface DependencyHealth {
  /** Dependency name (e.g., 'postgresql', 'redis', 'openai') */
  name: string;
  /** Dependency type */
  type: 'database' | 'cache' | 'api' | 'service' | 'queue' | 'storage';
  /** Health status */
  status: HealthStatus;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Last check timestamp */
  lastCheck: string;
  /** Error if unhealthy */
  error?: ErrorContext;
}

// ============================================================================
// Performance Metrics
// ============================================================================

/**
 * HTTP request performance metrics
 */
export interface HttpRequestMetrics {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** HTTP status code */
  statusCode: number;
  /** Request duration in milliseconds */
  duration: number;
  /** Request size in bytes */
  requestSize?: number;
  /** Response size in bytes */
  responseSize?: number;
  /** Time to first byte (ms) */
  ttfb?: number;
  /** User agent */
  userAgent?: string;
  /** Client IP address */
  clientIp?: string;
  /** Request timestamp */
  timestamp: string;
  /** Correlation ID */
  correlationId?: string;
  /** User ID if authenticated */
  userId?: string;
}

/**
 * Database query performance metrics
 */
export interface DatabaseQueryMetrics {
  /** Database type (e.g., 'postgresql', 'mongodb', 'redis') */
  database: string;
  /** Query operation type (e.g., 'SELECT', 'INSERT', 'UPDATE') */
  operation: string;
  /** Table/collection name */
  table: string;
  /** Query duration in milliseconds */
  duration: number;
  /** Number of rows affected/returned */
  rowCount?: number;
  /** Query execution plan cost */
  planCost?: number;
  /** Whether query was cached */
  cached?: boolean;
  /** Query timestamp */
  timestamp: string;
  /** Query hash for grouping */
  queryHash?: string;
}

/**
 * AI request performance metrics
 */
export interface AIRequestMetrics {
  /** AI provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Model ID */
  modelId: string;
  /** Request type (e.g., 'chat', 'completion', 'embedding') */
  requestType: string;
  /** Total request duration (ms) */
  duration: number;
  /** Time to first token (ms) for streaming */
  timeToFirstToken?: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Request cost in USD */
  cost: number;
  /** Request timestamp */
  timestamp: string;
  /** Whether request succeeded */
  success: boolean;
  /** Error if failed */
  error?: ErrorContext;
  /** User ID */
  userId?: string;
  /** Workspace ID */
  workspaceId?: string;
}

// ============================================================================
// System Metrics
// ============================================================================

/**
 * System resource metrics
 */
export interface SystemMetrics {
  /** Hostname/instance ID */
  hostname: string;
  /** Metrics timestamp */
  timestamp: string;
  /** CPU usage metrics */
  cpu: CpuMetrics;
  /** Memory usage metrics */
  memory: MemoryMetrics;
  /** Disk usage metrics */
  disk?: DiskMetrics;
  /** Network metrics */
  network?: NetworkMetrics;
  /** Process-specific metrics */
  process?: ProcessMetrics;
}

/**
 * CPU usage metrics
 */
export interface CpuMetrics {
  /** CPU usage percentage (0-100) */
  usagePercent: number;
  /** User CPU time percentage */
  userPercent?: number;
  /** System CPU time percentage */
  systemPercent?: number;
  /** Idle CPU percentage */
  idlePercent?: number;
  /** Number of CPU cores */
  cores?: number;
  /** Load average (1, 5, 15 minutes) */
  loadAverage?: [number, number, number];
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  /** Total memory in bytes */
  total: number;
  /** Used memory in bytes */
  used: number;
  /** Free memory in bytes */
  free: number;
  /** Memory usage percentage (0-100) */
  usagePercent: number;
  /** Available memory in bytes */
  available?: number;
  /** Swap total in bytes */
  swapTotal?: number;
  /** Swap used in bytes */
  swapUsed?: number;
}

/**
 * Disk usage metrics
 */
export interface DiskMetrics {
  /** Total disk space in bytes */
  total: number;
  /** Used disk space in bytes */
  used: number;
  /** Free disk space in bytes */
  free: number;
  /** Disk usage percentage (0-100) */
  usagePercent: number;
  /** Mount point */
  mountPoint?: string;
  /** Read operations per second */
  readOps?: number;
  /** Write operations per second */
  writeOps?: number;
  /** Read bytes per second */
  readBytes?: number;
  /** Write bytes per second */
  writeBytes?: number;
}

/**
 * Network usage metrics
 */
export interface NetworkMetrics {
  /** Bytes received */
  bytesReceived: number;
  /** Bytes sent */
  bytesSent: number;
  /** Packets received */
  packetsReceived?: number;
  /** Packets sent */
  packetsSent?: number;
  /** Error count */
  errors?: number;
  /** Dropped packets */
  dropped?: number;
  /** Network interface name */
  interface?: string;
}

/**
 * Process-specific metrics
 */
export interface ProcessMetrics {
  /** Process ID */
  pid: number;
  /** Process name */
  name: string;
  /** CPU usage percentage */
  cpuPercent: number;
  /** Memory usage in bytes */
  memoryBytes: number;
  /** Memory usage percentage */
  memoryPercent: number;
  /** Number of threads */
  threads?: number;
  /** Number of file descriptors */
  fileDescriptors?: number;
  /** Process uptime in seconds */
  uptime?: number;
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Alert severity
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'silenced';

/**
 * Monitoring alert
 */
export interface MonitoringAlert {
  /** Unique alert ID */
  id: string;
  /** Alert name/title */
  name: string;
  /** Alert description */
  description: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert status */
  status: AlertStatus;
  /** Alert source (metric, log, trace, etc.) */
  source: string;
  /** Alert condition */
  condition: string;
  /** Current value that triggered alert */
  currentValue?: number;
  /** Threshold value */
  threshold?: number;
  /** Alert triggered timestamp */
  triggeredAt: string;
  /** Alert acknowledged timestamp */
  acknowledgedAt?: string;
  /** Alert resolved timestamp */
  resolvedAt?: string;
  /** User who acknowledged */
  acknowledgedBy?: string;
  /** Service affected */
  service: string;
  /** Component affected */
  component?: string;
  /** Alert tags */
  tags?: string[];
  /** Alert metadata */
  metadata?: Record<string, unknown>;
  /** Related incidents */
  relatedIncidents?: string[];
}

/**
 * Alert notification
 */
export interface AlertNotification {
  /** Alert ID */
  alertId: string;
  /** Notification channel (e.g., 'email', 'slack', 'pagerduty') */
  channel: string;
  /** Recipients */
  recipients: string[];
  /** Notification sent timestamp */
  sentAt: string;
  /** Notification status */
  status: 'sent' | 'failed' | 'pending';
  /** Error if failed */
  error?: ErrorContext;
}

// ============================================================================
// Cost Tracking Types
// ============================================================================

/**
 * Monitoring cost breakdown
 */
export interface MonitoringCost {
  /** Cost period start */
  periodStart: string;
  /** Cost period end */
  periodEnd: string;
  /** Total cost in USD */
  totalCost: number;
  /** Cost by service */
  byService: Record<string, number>;
  /** Cost by metric type */
  byMetricType?: {
    logs: number;
    metrics: number;
    traces: number;
    events: number;
  };
  /** Data ingestion volume in bytes */
  dataIngested: number;
  /** Data retention cost */
  retentionCost?: number;
  /** Alert notification cost */
  notificationCost?: number;
  /** API call cost */
  apiCallCost?: number;
}

/**
 * Datadog-specific cost tracking
 */
export interface DatadogCost {
  /** Billing period */
  period: string;
  /** Hosts monitored */
  hostsMonitored: number;
  /** Custom metrics count */
  customMetrics: number;
  /** Logs indexed (GB) */
  logsIndexed: number;
  /** APM hosts */
  apmHosts: number;
  /** Total monthly cost */
  monthlyCost: number;
  /** Cost breakdown */
  breakdown: {
    infrastructure: number;
    logs: number;
    apm: number;
    customMetrics: number;
    incidents: number;
  };
}

// ============================================================================
// Telemetry Configuration
// ============================================================================

/**
 * Telemetry sampling strategy
 */
export type SamplingStrategy = 'always' | 'never' | 'probability' | 'rate_limit' | 'adaptive';

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Service name */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Environment */
  environment: string;
  /** Sampling configuration */
  sampling: {
    /** Sampling strategy */
    strategy: SamplingStrategy;
    /** Sample rate (0-1) for probability sampling */
    rate?: number;
    /** Maximum samples per second for rate limiting */
    maxPerSecond?: number;
  };
  /** Log configuration */
  logs: {
    /** Minimum log level to send */
    minLevel: LogLevel;
    /** Whether to include stack traces */
    includeStackTraces: boolean;
  };
  /** Metric configuration */
  metrics: {
    /** Metric flush interval in seconds */
    flushInterval: number;
    /** Maximum metrics to buffer */
    bufferSize: number;
  };
  /** Trace configuration */
  traces: {
    /** Whether to enable distributed tracing */
    enabled: boolean;
    /** Sample rate for traces (0-1) */
    sampleRate: number;
  };
  /** Export configuration */
  exporter: {
    /** Exporter type (e.g., 'datadog', 'otlp', 'console') */
    type: string;
    /** Export endpoint URL */
    endpoint?: string;
    /** API key for authentication */
    apiKey?: string;
    /** Additional headers */
    headers?: Record<string, string>;
  };
}

// ============================================================================
// Batch Export Types
// ============================================================================

/**
 * Batch of telemetry data for export
 */
export interface TelemetryBatch {
  /** Batch ID */
  id: string;
  /** Batch creation timestamp */
  timestamp: string;
  /** Service name */
  service: string;
  /** Log entries in batch */
  logs?: LogEntry[];
  /** Metrics in batch */
  metrics?: MetricDataPoint[];
  /** Spans in batch */
  spans?: Span[];
  /** Events in batch */
  events?: MonitoringEvent[];
  /** Batch size in bytes */
  sizeBytes: number;
  /** Number of items in batch */
  itemCount: number;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Whether export succeeded */
  success: boolean;
  /** Number of items exported */
  itemsExported: number;
  /** Export duration in milliseconds */
  duration: number;
  /** Export timestamp */
  timestamp: string;
  /** Error if export failed */
  error?: ErrorContext;
  /** Retry attempt number */
  retryAttempt?: number;
}
