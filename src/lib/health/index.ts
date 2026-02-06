/**
 * Health Module Exports
 *
 * Provides health monitoring and real-time status push functionality
 * for the VibeCode platform.
 *
 * PAPA Agent Implementation - Desktop Client Integration
 * NOVEMBER Agent Implementation - Unified Health Service
 */

// WebSocket Status Service
export {
  WebSocketStatusService,
  getStatusWebSocketService,
  destroyStatusWebSocketService,
} from './status-websocket';

// Unified Health Service - Health checks for all 5 stack services
export {
  unifiedHealthService,
  checkSSHHealth,
  checkPostgreSQLHealth,
  checkValkeyHealth,
  checkOpenVSCodeHealth,
  checkDockerHealth,
  runAllHealthChecks,
  getCachedHealthChecks,
  invalidateHealthCache,
  getServiceHealth,
} from './unified-health-service';

// Re-export types from status-events for convenience
export type {
  HealthStatus,
  ServiceHealth,
  StatusMessageType,
  StatusMessage,
  ClientMessage,
  ConnectionState,
  StatusWebSocketConfig,
  ConnectionMetrics,
  HealthCheckResult,
  HealthUpdateMessage,
  HeartbeatMessage,
  InitialStatusMessage,
  ConnectionEstablishedMessage,
  ErrorMessage,
} from '@/types/status-events';

export {
  DEFAULT_STATUS_WEBSOCKET_CONFIG,
  STATUS_WEBSOCKET_PROTOCOL_VERSION,
  STATUS_WEBSOCKET_CAPABILITIES,
} from '@/types/status-events';

// Re-export types from unified health service
export type {
  ServiceHealthStatus,
  AggregatedHealthStatus,
  ServiceName,
  ServiceHealthResult,
  HealthCheckConfig,
  SSHHealthCheckConfig,
  PostgreSQLHealthCheckConfig,
  ValkeyHealthCheckConfig,
  OpenVSCodeHealthCheckConfig,
  DockerHealthCheckConfig,
  AggregatedHealthResponse,
  CachedHealthResponse,
  HealthCheckExecutor,
  HealthCheckRegistryEntry,
  HealthCheckSpanTags,
} from '@/types/health';
