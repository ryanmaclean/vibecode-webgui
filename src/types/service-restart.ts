/**
 * Service Restart Type Definitions
 *
 * Types for managing service restart operations across the 5-service stack:
 * - SSH (Dropbear)
 * - PostgreSQL
 * - Valkey/Redis
 * - OpenVSCode
 * - Docker
 */

import type { ServiceName, ServiceHealthStatus } from './health';

/**
 * Restart status for tracking restart operation progress
 */
export type RestartStatus =
  | 'pending'
  | 'restarting'
  | 'verifying'
  | 'completed'
  | 'failed';

/**
 * Request to restart a service
 */
export interface RestartRequest {
  /** Service name to restart */
  serviceName: ServiceName;
  /** Whether to force restart (skip graceful shutdown) */
  force?: boolean;
  /** Timeout in milliseconds for the restart operation */
  timeoutMs?: number;
  /** Whether to verify health after restart */
  verifyHealth?: boolean;
  /** Maximum retries for health verification */
  maxHealthRetries?: number;
  /** Delay between health check retries in milliseconds */
  healthRetryDelayMs?: number;
  /** Requester identifier for audit logging */
  requestedBy?: string;
}

/**
 * Result of a service restart operation
 */
export interface RestartResult {
  /** Service that was restarted */
  serviceName: ServiceName;
  /** Whether the restart was successful */
  success: boolean;
  /** Current restart status */
  status: RestartStatus;
  /** ISO timestamp when restart was initiated */
  startedAt: string;
  /** ISO timestamp when restart completed */
  completedAt?: string;
  /** Duration of the restart operation in milliseconds */
  durationMs?: number;
  /** Health status after restart (if verification was requested) */
  healthStatus?: ServiceHealthStatus;
  /** Error message if restart failed */
  error?: string;
  /** Standard output from restart command */
  stdout?: string;
  /** Standard error from restart command */
  stderr?: string;
  /** Exit code from restart command */
  exitCode?: number;
}

/**
 * Entry in restart history
 */
export interface RestartHistoryEntry {
  /** Unique identifier for this restart operation */
  id: string;
  /** Service that was restarted */
  serviceName: ServiceName;
  /** Result of the restart operation */
  result: RestartResult;
  /** Who/what initiated the restart */
  requestedBy?: string;
  /** ISO timestamp of the restart */
  timestamp: string;
  /** Request parameters used */
  request: RestartRequest;
}

/**
 * Restart history for a service or all services
 */
export type RestartHistory = RestartHistoryEntry[];

/**
 * Configuration for a service restart operation
 */
export interface ServiceRestartConfig {
  /** Service name */
  serviceName: ServiceName;
  /** Alpine rc-service command to restart the service */
  restartCommand: string;
  /** Time to wait after restart before health check (ms) */
  healthCheckDelayMs: number;
  /** Maximum time to wait for service to become healthy (ms) */
  healthCheckTimeoutMs: number;
  /** Whether this service can be safely restarted */
  canRestart: boolean;
  /** Dependencies that should be checked before restart */
  dependencies?: ServiceName[];
}

/**
 * Current status of a restart operation in progress
 */
export interface RestartOperationStatus {
  /** Whether a restart is currently in progress */
  inProgress: boolean;
  /** Service being restarted (if any) */
  serviceName?: ServiceName;
  /** Current status of the operation */
  status?: RestartStatus;
  /** ISO timestamp when the operation started */
  startedAt?: string;
  /** Estimated time remaining in milliseconds */
  estimatedRemainingMs?: number;
}

/**
 * Aggregated restart status for all services
 */
export interface AggregatedRestartStatus {
  /** Current operation in progress (if any) */
  currentOperation?: RestartOperationStatus;
  /** Status of each service's last restart */
  services: Record<ServiceName, RestartResult | null>;
  /** Timestamp of last status update */
  updatedAt: string;
}

/**
 * Event emitted during restart operations for WebSocket updates
 */
export interface RestartEvent {
  /** Event type */
  type: 'restart:started' | 'restart:progress' | 'restart:completed' | 'restart:failed';
  /** Service name */
  serviceName: ServiceName;
  /** Current status */
  status: RestartStatus;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Additional event data */
  data?: {
    message?: string;
    error?: string;
    healthStatus?: ServiceHealthStatus;
    durationMs?: number;
  };
  /** ISO timestamp of the event */
  timestamp: string;
}

/**
 * Datadog span tags for restart operation tracing
 */
export interface RestartSpanTags {
  'restart.service': ServiceName;
  'restart.status': RestartStatus;
  'restart.duration_ms'?: number;
  'restart.success': boolean;
  'restart.health_verified'?: boolean;
  'error'?: boolean;
  'error.msg'?: string;
}
