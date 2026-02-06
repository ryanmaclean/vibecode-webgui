/**
 * Health Check Type Definitions
 *
 * Unified types for health monitoring across all services:
 * - SSH (Dropbear)
 * - PostgreSQL
 * - Valkey/Redis
 * - OpenVSCode
 * - Docker
 */

/**
 * Individual service health status
 */
export type ServiceHealthStatus = 'healthy' | 'unhealthy' | 'unknown';

/**
 * Aggregated service health status (includes degraded for partial failures)
 */
export type AggregatedHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Service names in the stack
 */
export type ServiceName = 'ssh' | 'postgresql' | 'valkey' | 'openvscode' | 'docker';

/**
 * Health check result for a single service
 */
export interface ServiceHealthResult {
  /** Service name identifier */
  name: ServiceName;
  /** Health status */
  status: ServiceHealthStatus;
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Optional error message if unhealthy */
  error?: string;
  /** Optional additional details */
  details?: Record<string, unknown>;
}

/**
 * Configuration for a health check
 */
export interface HealthCheckConfig {
  /** Timeout in milliseconds for the health check */
  timeout: number;
  /** Host to connect to */
  host: string;
  /** Port to connect to */
  port: number;
}

/**
 * SSH health check configuration
 */
export interface SSHHealthCheckConfig extends HealthCheckConfig {
  /** Default SSH port for Dropbear */
  port: 2222;
}

/**
 * PostgreSQL health check configuration
 */
export interface PostgreSQLHealthCheckConfig extends HealthCheckConfig {
  /** Use existing Prisma connection pool */
  useExistingPool: boolean;
}

/**
 * Valkey/Redis health check configuration
 */
export interface ValkeyHealthCheckConfig extends HealthCheckConfig {
  /** Use existing ioredis client */
  useExistingClient: boolean;
}

/**
 * OpenVSCode health check configuration
 */
export interface OpenVSCodeHealthCheckConfig extends HealthCheckConfig {
  /** HTTP healthz endpoint path */
  healthzPath: string;
  /** Whether to use HTTP or TCP check */
  useHttpCheck: boolean;
}

/**
 * Docker health check configuration
 */
export interface DockerHealthCheckConfig extends HealthCheckConfig {
  /** Docker socket path for Unix socket connection */
  socketPath?: string;
  /** Whether to use Unix socket instead of TCP */
  useSocket: boolean;
}

/**
 * Aggregated health check response
 */
export interface AggregatedHealthResponse {
  /** Overall health status */
  status: AggregatedHealthStatus;
  /** ISO timestamp of the response */
  timestamp: string;
  /** Total time to complete all checks */
  totalCheckTimeMs: number;
  /** Individual service results */
  services: ServiceHealthResult[];
  /** Summary counts */
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
  };
}

/**
 * Cached health check response
 */
export interface CachedHealthResponse {
  /** The cached response */
  response: AggregatedHealthResponse;
  /** ISO timestamp when the cache was created */
  cachedAt: string;
  /** Cache TTL in milliseconds */
  ttlMs: number;
  /** Whether this response is from cache */
  fromCache: boolean;
}

/**
 * Health check executor function type
 */
export type HealthCheckExecutor = () => Promise<ServiceHealthResult>;

/**
 * Health check registry entry
 */
export interface HealthCheckRegistryEntry {
  /** Service name */
  name: ServiceName;
  /** Health check executor function */
  executor: HealthCheckExecutor;
  /** Whether this check is enabled */
  enabled: boolean;
  /** Optional configuration */
  config?: HealthCheckConfig;
}

/**
 * Datadog span tags for health check tracing
 */
export interface HealthCheckSpanTags {
  'health.service': ServiceName;
  'health.status': ServiceHealthStatus;
  'health.latency_ms': number;
  'health.check_type': 'tcp' | 'http' | 'query' | 'command';
  'error'?: boolean;
  'error.msg'?: string;
}
