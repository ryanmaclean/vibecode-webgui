/**
 * Status Event Types for WebSocket Real-time Status Push
 *
 * Defines event types for health status broadcasting to desktop clients
 * via WebSocket connections.
 *
 * PAPA Agent Implementation - Desktop Client Integration
 */

/**
 * Service health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Individual service health information
 */
export interface ServiceHealth {
  /** Service identifier */
  name: string;
  /** Current health status */
  status: HealthStatus;
  /** Optional status message or error */
  message?: string;
  /** Last check timestamp (ISO 8601) */
  lastCheck: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Additional service-specific details */
  details?: Record<string, unknown>;
}

/**
 * Status message types for WebSocket communication
 */
export type StatusMessageType =
  | 'health_update'
  | 'heartbeat'
  | 'initial_status'
  | 'connection_established'
  | 'error';

/**
 * Base status message structure
 */
export interface BaseStatusMessage {
  /** Message type identifier */
  type: StatusMessageType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Server message sequence number */
  sequence?: number;
}

/**
 * Health update event - sent when service health changes
 */
export interface HealthUpdateMessage extends BaseStatusMessage {
  type: 'health_update';
  payload: {
    /** Changed services */
    services: ServiceHealth[];
    /** Overall system status */
    overallStatus: HealthStatus;
    /** List of service names that changed */
    changedServices: string[];
  };
}

/**
 * Heartbeat event - sent at regular intervals to maintain connection
 */
export interface HeartbeatMessage extends BaseStatusMessage {
  type: 'heartbeat';
  payload: {
    /** Server uptime in seconds */
    uptime: number;
    /** Current active connection count */
    connectionCount: number;
    /** Server timestamp for latency calculation */
    serverTime: string;
  };
}

/**
 * Initial status event - sent on connection establishment
 */
export interface InitialStatusMessage extends BaseStatusMessage {
  type: 'initial_status';
  payload: {
    /** All service health statuses */
    services: ServiceHealth[];
    /** Overall system status */
    overallStatus: HealthStatus;
    /** Server version */
    version: string;
    /** Environment (development/staging/production) */
    environment: string;
    /** Heartbeat interval in milliseconds */
    heartbeatInterval: number;
  };
}

/**
 * Connection established event - acknowledgment of successful connection
 */
export interface ConnectionEstablishedMessage extends BaseStatusMessage {
  type: 'connection_established';
  payload: {
    /** Unique client connection ID */
    connectionId: string;
    /** Server protocol version */
    protocolVersion: string;
    /** Connection capabilities */
    capabilities: string[];
  };
}

/**
 * Error event - sent when an error occurs
 */
export interface ErrorMessage extends BaseStatusMessage {
  type: 'error';
  payload: {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Whether client should retry */
    retryable: boolean;
  };
}

/**
 * Union type of all status messages
 */
export type StatusMessage =
  | HealthUpdateMessage
  | HeartbeatMessage
  | InitialStatusMessage
  | ConnectionEstablishedMessage
  | ErrorMessage;

/**
 * Client-to-server message types
 */
export type ClientMessageType = 'ping' | 'subscribe' | 'unsubscribe' | 'request_status';

/**
 * Base client message structure
 */
export interface BaseClientMessage {
  type: ClientMessageType;
  timestamp: string;
}

/**
 * Ping message - client heartbeat
 */
export interface PingMessage extends BaseClientMessage {
  type: 'ping';
}

/**
 * Subscribe message - request to receive updates for specific services
 */
export interface SubscribeMessage extends BaseClientMessage {
  type: 'subscribe';
  services?: string[];
}

/**
 * Unsubscribe message - stop receiving updates for specific services
 */
export interface UnsubscribeMessage extends BaseClientMessage {
  type: 'unsubscribe';
  services?: string[];
}

/**
 * Request status message - request immediate status update
 */
export interface RequestStatusMessage extends BaseClientMessage {
  type: 'request_status';
}

/**
 * Union type of all client messages
 */
export type ClientMessage =
  | PingMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | RequestStatusMessage;

/**
 * WebSocket connection state
 */
export interface ConnectionState {
  /** Unique connection identifier */
  id: string;
  /** Connection establishment time */
  connectedAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Subscribed services (empty = all) */
  subscribedServices: Set<string>;
  /** Client user agent if available */
  userAgent?: string;
  /** Client IP address */
  clientIp?: string;
  /** Is connection authenticated */
  authenticated: boolean;
  /** User ID if authenticated */
  userId?: string;
  /** Missed heartbeat count */
  missedHeartbeats: number;
}

/**
 * Status update throttle configuration
 */
export interface ThrottleConfig {
  /** Minimum interval between updates in milliseconds */
  minInterval: number;
  /** Maximum queued updates before force flush */
  maxQueueSize: number;
}

/**
 * WebSocket status service configuration
 */
export interface StatusWebSocketConfig {
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval: number;
  /** Ping timeout in milliseconds (default: 10000) */
  pingTimeout: number;
  /** Maximum missed heartbeats before disconnect (default: 3) */
  maxMissedHeartbeats: number;
  /** Minimum interval between status updates per client (default: 1000) */
  updateThrottleInterval: number;
  /** Maximum connections per IP (default: 10) */
  maxConnectionsPerIp: number;
  /** Total maximum connections (default: 1000) */
  maxTotalConnections: number;
  /** Enable authentication requirement (default: false) */
  requireAuth: boolean;
}

/**
 * Connection metrics for monitoring
 */
export interface ConnectionMetrics {
  /** Total active connections */
  totalConnections: number;
  /** Connections by IP address */
  connectionsByIp: Map<string, number>;
  /** Total messages sent */
  totalMessagesSent: number;
  /** Total messages received */
  totalMessagesReceived: number;
  /** Average message latency in ms */
  averageLatency: number;
  /** Connection errors count */
  errorCount: number;
  /** Service uptime in seconds */
  uptime: number;
}

/**
 * Service health check result
 */
export interface HealthCheckResult {
  services: ServiceHealth[];
  overallStatus: HealthStatus;
  timestamp: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_STATUS_WEBSOCKET_CONFIG: StatusWebSocketConfig = {
  heartbeatInterval: 30000,
  pingTimeout: 10000,
  maxMissedHeartbeats: 3,
  updateThrottleInterval: 1000,
  maxConnectionsPerIp: 10,
  maxTotalConnections: 1000,
  requireAuth: false,
};

/**
 * Protocol version for compatibility checking
 */
export const STATUS_WEBSOCKET_PROTOCOL_VERSION = '1.0.0';

/**
 * Supported capabilities
 */
export const STATUS_WEBSOCKET_CAPABILITIES = [
  'health_updates',
  'heartbeat',
  'service_filtering',
  'on_demand_status',
] as const;

export type StatusWebSocketCapability = typeof STATUS_WEBSOCKET_CAPABILITIES[number];
