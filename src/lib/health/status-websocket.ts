/**
 * WebSocket Status Service for Real-time Health Updates
 *
 * Provides real-time health status push to desktop clients via WebSocket.
 * Features:
 * - Broadcast health status changes to connected clients
 * - Heartbeat mechanism (30 second interval)
 * - Client connection tracking with metrics
 * - Graceful reconnection handling
 * - Rate limiting (max 1 update per second per client)
 * - Datadog metrics integration
 *
 * PAPA Agent Implementation - Desktop Client Integration
 */

import { EventEmitter } from 'events';
import type { WebSocket as WSType, RawData } from 'ws';
import * as ws from 'ws';
import { randomUUID } from 'crypto';

// WebSocket constructor
const WebSocket = ws.default || ws;
import { monitoring } from '@/lib/monitoring';
import { createServiceLogger } from '@/lib/logging';
import {
  StatusMessage,
  ClientMessage,
  ConnectionState,
  ServiceHealth,
  HealthStatus,
  StatusWebSocketConfig,
  ConnectionMetrics,
  HealthCheckResult,
  HealthUpdateMessage,
  HeartbeatMessage,
  InitialStatusMessage,
  ConnectionEstablishedMessage,
  ErrorMessage,
  DEFAULT_STATUS_WEBSOCKET_CONFIG,
  STATUS_WEBSOCKET_PROTOCOL_VERSION,
  STATUS_WEBSOCKET_CAPABILITIES,
} from '@/types/status-events';

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'status-websocket',
});

/**
 * WebSocket Status Service
 * Manages WebSocket connections and broadcasts health status updates
 */
export class WebSocketStatusService extends EventEmitter {
  private config: StatusWebSocketConfig;
  private connections: Map<string, ConnectionState> = new Map();
  private clientSockets: Map<string, WSType> = new Map();
  private connectionsByIp: Map<string, Set<string>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private lastHealthStatus: HealthCheckResult | null = null;
  private lastUpdateByClient: Map<string, number> = new Map();
  private messageSequence: number = 0;
  private startTime: Date;
  private metrics: ConnectionMetrics;
  private isShuttingDown: boolean = false;

  constructor(config: Partial<StatusWebSocketConfig> = {}) {
    super();

    this.config = {
      ...DEFAULT_STATUS_WEBSOCKET_CONFIG,
      ...config,
    };

    this.startTime = new Date();
    this.metrics = {
      totalConnections: 0,
      connectionsByIp: new Map(),
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      averageLatency: 0,
      errorCount: 0,
      uptime: 0,
    };

    log.info('WebSocket Status Service initialized', {
      config: this.config,
      protocolVersion: STATUS_WEBSOCKET_PROTOCOL_VERSION,
    });
  }

  /**
   * Start the service (heartbeat and metrics timers)
   */
  start(): void {
    if (this.heartbeatTimer) {
      log.warn('Service already started');
      return;
    }

    log.info('Starting WebSocket Status Service');

    // Start heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Start metrics reporting timer (every 60 seconds)
    this.metricsTimer = setInterval(() => {
      this.reportMetrics();
    }, 60000);

    this.emit('started');
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    log.info('Stopping WebSocket Status Service');

    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // Close all connections gracefully
    const closePromises: Promise<void>[] = [];
    for (const [connectionId, ws] of this.clientSockets) {
      closePromises.push(
        new Promise((resolve) => {
          try {
            this.sendMessage(ws, {
              type: 'error',
              timestamp: new Date().toISOString(),
              payload: {
                code: 'SERVER_SHUTDOWN',
                message: 'Server is shutting down',
                retryable: true,
              },
            });
            ws.close(1001, 'Server shutdown');
            ws.once('close', () => resolve());
            // Force close after 5 seconds
            setTimeout(() => {
              ws.terminate();
              resolve();
            }, 5000);
          } catch {
            resolve();
          }
        })
      );
    }

    await Promise.all(closePromises);

    this.connections.clear();
    this.clientSockets.clear();
    this.connectionsByIp.clear();
    this.lastUpdateByClient.clear();

    this.emit('stopped');
    log.info('WebSocket Status Service stopped');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(
    ws: WSType,
    clientIp: string,
    userAgent?: string,
    userId?: string
  ): string {
    // Check connection limits
    if (this.connections.size >= this.config.maxTotalConnections) {
      log.warn('Max total connections reached', {
        current: this.connections.size,
        max: this.config.maxTotalConnections,
      });
      this.sendMessage(ws, this.createErrorMessage('MAX_CONNECTIONS', 'Server at capacity', false));
      ws.close(1013, 'Server at capacity');
      return '';
    }

    // Check per-IP limit
    const ipConnections = this.connectionsByIp.get(clientIp) || new Set();
    if (ipConnections.size >= this.config.maxConnectionsPerIp) {
      log.warn('Max connections per IP reached', {
        clientIp,
        current: ipConnections.size,
        max: this.config.maxConnectionsPerIp,
      });
      this.sendMessage(ws, this.createErrorMessage('MAX_CONNECTIONS_PER_IP', 'Too many connections from this IP', false));
      ws.close(1013, 'Too many connections from this IP');
      return '';
    }

    const connectionId = randomUUID();
    const now = new Date();

    // Create connection state
    const connection: ConnectionState = {
      id: connectionId,
      connectedAt: now,
      lastActivity: now,
      subscribedServices: new Set(),
      userAgent,
      clientIp,
      authenticated: !!userId,
      userId,
      missedHeartbeats: 0,
    };

    // Store connection
    this.connections.set(connectionId, connection);
    this.clientSockets.set(connectionId, ws);

    // Track by IP
    if (!this.connectionsByIp.has(clientIp)) {
      this.connectionsByIp.set(clientIp, new Set());
    }
    this.connectionsByIp.get(clientIp)!.add(connectionId);

    // Update metrics
    this.metrics.totalConnections++;
    this.metrics.connectionsByIp = new Map(this.connectionsByIp);

    log.info('Client connected', {
      connectionId,
      clientIp,
      userAgent,
      authenticated: connection.authenticated,
      totalConnections: this.connections.size,
    });

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers(ws, connectionId);

    // Send connection established message
    this.sendMessage(ws, this.createConnectionEstablishedMessage(connectionId));

    // Send initial status if available
    if (this.lastHealthStatus) {
      this.sendMessage(ws, this.createInitialStatusMessage());
    }

    // Report connection metric to Datadog
    this.reportConnectionMetric('connect', connectionId);

    this.emit('connection', { connectionId, connection });

    return connectionId;
  }

  /**
   * Set up WebSocket event handlers for a connection
   */
  private setupWebSocketHandlers(ws: WSType, connectionId: string): void {
    ws.on('message', (data: RawData) => {
      this.handleClientMessage(connectionId, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(connectionId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      log.error('WebSocket error', {
        connectionId,
        error: error.message,
      });
      this.metrics.errorCount++;
      this.emit('error', { connectionId, error });
    });

    ws.on('pong', () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivity = new Date();
        connection.missedHeartbeats = 0;
      }
    });
  }

  /**
   * Handle client message
   */
  private handleClientMessage(connectionId: string, data: RawData): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.lastActivity = new Date();
    this.metrics.totalMessagesReceived++;

    try {
      const message: ClientMessage = JSON.parse(data.toString());

      log.debug('Received client message', {
        connectionId,
        type: message.type,
      });

      switch (message.type) {
        case 'ping':
          this.handlePing(connectionId);
          break;

        case 'subscribe':
          this.handleSubscribe(connectionId, message.services);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, message.services);
          break;

        case 'request_status':
          this.handleRequestStatus(connectionId);
          break;

        default:
          log.warn('Unknown client message type', {
            connectionId,
            type: (message as any).type,
          });
      }
    } catch (error) {
      log.warn('Failed to parse client message', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.metrics.errorCount++;
    }
  }

  /**
   * Handle ping message from client
   */
  private handlePing(connectionId: string): void {
    const ws = this.clientSockets.get(connectionId);
    if (ws && ws.readyState === ws.OPEN) {
      // Respond with heartbeat
      this.sendMessage(ws, this.createHeartbeatMessage());
    }
  }

  /**
   * Handle subscribe message
   */
  private handleSubscribe(connectionId: string, services?: string[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    if (services && services.length > 0) {
      services.forEach((service) => connection.subscribedServices.add(service));
      log.debug('Client subscribed to services', {
        connectionId,
        services,
      });
    } else {
      // Empty services means subscribe to all
      connection.subscribedServices.clear();
    }

    // Send current status for subscribed services
    this.handleRequestStatus(connectionId);
  }

  /**
   * Handle unsubscribe message
   */
  private handleUnsubscribe(connectionId: string, services?: string[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    if (services && services.length > 0) {
      services.forEach((service) => connection.subscribedServices.delete(service));
      log.debug('Client unsubscribed from services', {
        connectionId,
        services,
      });
    }
  }

  /**
   * Handle request status message
   */
  private handleRequestStatus(connectionId: string): void {
    if (!this.lastHealthStatus) {
      return;
    }

    const ws = this.clientSockets.get(connectionId);
    const connection = this.connections.get(connectionId);
    if (!ws || !connection) {
      return;
    }

    // Filter services if client has specific subscriptions
    let services = this.lastHealthStatus.services;
    if (connection.subscribedServices.size > 0) {
      services = services.filter((s) => connection.subscribedServices.has(s.name));
    }

    this.sendMessage(ws, {
      type: 'initial_status',
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence(),
      payload: {
        services,
        overallStatus: this.lastHealthStatus.overallStatus,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        heartbeatInterval: this.config.heartbeatInterval,
      },
    } as InitialStatusMessage);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    log.info('Client disconnected', {
      connectionId,
      code,
      reason,
      duration: Date.now() - connection.connectedAt.getTime(),
    });

    // Remove from IP tracking
    const ipConnections = this.connectionsByIp.get(connection.clientIp || '');
    if (ipConnections) {
      ipConnections.delete(connectionId);
      if (ipConnections.size === 0) {
        this.connectionsByIp.delete(connection.clientIp || '');
      }
    }

    // Clean up
    this.connections.delete(connectionId);
    this.clientSockets.delete(connectionId);
    this.lastUpdateByClient.delete(connectionId);

    // Update metrics
    this.metrics.connectionsByIp = new Map(this.connectionsByIp);

    // Report disconnection metric to Datadog
    this.reportConnectionMetric('disconnect', connectionId);

    this.emit('disconnection', { connectionId, code, reason });
  }

  /**
   * Broadcast health status change to all connected clients
   */
  broadcastHealthUpdate(healthResult: HealthCheckResult): void {
    if (this.isShuttingDown) {
      return;
    }

    // Detect what changed
    const changedServices = this.detectChangedServices(healthResult);

    if (changedServices.length === 0 && this.lastHealthStatus) {
      // No changes, skip broadcast
      return;
    }

    this.lastHealthStatus = healthResult;

    const message: HealthUpdateMessage = {
      type: 'health_update',
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence(),
      payload: {
        services: healthResult.services,
        overallStatus: healthResult.overallStatus,
        changedServices,
      },
    };

    log.info('Broadcasting health update', {
      overallStatus: healthResult.overallStatus,
      changedServices,
      totalConnections: this.connections.size,
    });

    // Broadcast to all connections with throttling
    for (const [connectionId, connection] of this.connections) {
      // Check throttle
      if (!this.shouldSendUpdate(connectionId)) {
        continue;
      }

      const ws = this.clientSockets.get(connectionId);
      if (!ws || ws.readyState !== ws.OPEN) {
        continue;
      }

      // Filter services if client has specific subscriptions
      let filteredMessage = message;
      if (connection.subscribedServices.size > 0) {
        const filteredServices = message.payload.services.filter((s) =>
          connection.subscribedServices.has(s.name)
        );
        const filteredChanged = message.payload.changedServices.filter((name) =>
          connection.subscribedServices.has(name)
        );

        if (filteredServices.length === 0) {
          continue;
        }

        filteredMessage = {
          ...message,
          payload: {
            ...message.payload,
            services: filteredServices,
            changedServices: filteredChanged,
          },
        };
      }

      this.sendMessage(ws, filteredMessage);
      this.lastUpdateByClient.set(connectionId, Date.now());
    }

    this.emit('broadcast', { message, recipientCount: this.connections.size });
  }

  /**
   * Update health status (called by health check system)
   */
  updateHealthStatus(healthResult: HealthCheckResult): void {
    this.broadcastHealthUpdate(healthResult);
  }

  /**
   * Send heartbeat to all connected clients
   */
  private sendHeartbeat(): void {
    if (this.isShuttingDown) {
      return;
    }

    const message = this.createHeartbeatMessage();

    for (const [connectionId, connection] of this.connections) {
      const ws = this.clientSockets.get(connectionId);
      if (!ws) {
        continue;
      }

      if (ws.readyState !== ws.OPEN) {
        // Connection is not open, mark for potential cleanup
        connection.missedHeartbeats++;

        if (connection.missedHeartbeats >= this.config.maxMissedHeartbeats) {
          log.warn('Client missed too many heartbeats, disconnecting', {
            connectionId,
            missedHeartbeats: connection.missedHeartbeats,
          });
          ws.terminate();
        }
        continue;
      }

      // Send ping and track response
      try {
        ws.ping();
        this.sendMessage(ws, message);
      } catch (error) {
        log.warn('Failed to send heartbeat', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        connection.missedHeartbeats++;
      }
    }

    log.debug('Heartbeat sent', {
      connectionCount: this.connections.size,
    });
  }

  /**
   * Detect which services changed since last update
   */
  private detectChangedServices(newResult: HealthCheckResult): string[] {
    if (!this.lastHealthStatus) {
      return newResult.services.map((s) => s.name);
    }

    const changed: string[] = [];
    const oldServiceMap = new Map(
      this.lastHealthStatus.services.map((s) => [s.name, s])
    );

    for (const service of newResult.services) {
      const oldService = oldServiceMap.get(service.name);
      if (!oldService || oldService.status !== service.status) {
        changed.push(service.name);
      }
    }

    return changed;
  }

  /**
   * Check if update should be sent (throttle check)
   */
  private shouldSendUpdate(connectionId: string): boolean {
    const lastUpdate = this.lastUpdateByClient.get(connectionId);
    if (!lastUpdate) {
      return true;
    }

    return Date.now() - lastUpdate >= this.config.updateThrottleInterval;
  }

  /**
   * Send message to a WebSocket
   */
  private sendMessage(ws: WSType, message: StatusMessage): void {
    if (ws.readyState !== ws.OPEN) {
      return;
    }

    try {
      ws.send(JSON.stringify(message));
      this.metrics.totalMessagesSent++;
    } catch (error) {
      log.warn('Failed to send message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.metrics.errorCount++;
    }
  }

  /**
   * Create connection established message
   */
  private createConnectionEstablishedMessage(connectionId: string): ConnectionEstablishedMessage {
    return {
      type: 'connection_established',
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence(),
      payload: {
        connectionId,
        protocolVersion: STATUS_WEBSOCKET_PROTOCOL_VERSION,
        capabilities: [...STATUS_WEBSOCKET_CAPABILITIES],
      },
    };
  }

  /**
   * Create initial status message
   */
  private createInitialStatusMessage(): InitialStatusMessage {
    return {
      type: 'initial_status',
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence(),
      payload: {
        services: this.lastHealthStatus?.services || [],
        overallStatus: this.lastHealthStatus?.overallStatus || 'unknown',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        heartbeatInterval: this.config.heartbeatInterval,
      },
    };
  }

  /**
   * Create heartbeat message
   */
  private createHeartbeatMessage(): HeartbeatMessage {
    return {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence(),
      payload: {
        uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        connectionCount: this.connections.size,
        serverTime: new Date().toISOString(),
      },
    };
  }

  /**
   * Create error message
   */
  private createErrorMessage(code: string, message: string, retryable: boolean): ErrorMessage {
    return {
      type: 'error',
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence(),
      payload: {
        code,
        message,
        retryable,
      },
    };
  }

  /**
   * Get next message sequence number
   */
  private nextSequence(): number {
    return ++this.messageSequence;
  }

  /**
   * Report connection metrics to Datadog
   */
  private reportConnectionMetric(event: 'connect' | 'disconnect', connectionId: string): void {
    try {
      const tags = [
        `event:${event}`,
        `env:${process.env.NODE_ENV || 'development'}`,
      ];

      monitoring.submitEvent(
        `WebSocket Status ${event === 'connect' ? 'Connection' : 'Disconnection'}`,
        `Client ${event}ed: ${connectionId}`,
        tags
      );
    } catch (error) {
      log.warn('Failed to report connection metric', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Report metrics to Datadog
   */
  private reportMetrics(): void {
    try {
      this.metrics.uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

      const tags = [`env:${process.env.NODE_ENV || 'development'}`];

      // Report via monitoring module
      monitoring.submitEvent(
        'WebSocket Status Metrics',
        `Connections: ${this.connections.size}, Messages Sent: ${this.metrics.totalMessagesSent}, Errors: ${this.metrics.errorCount}`,
        tags
      );

      log.info('Metrics reported', {
        totalConnections: this.connections.size,
        totalMessagesSent: this.metrics.totalMessagesSent,
        totalMessagesReceived: this.metrics.totalMessagesReceived,
        errorCount: this.metrics.errorCount,
        uptime: this.metrics.uptime,
      });
    } catch (error) {
      log.warn('Failed to report metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get current connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    this.metrics.uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    return { ...this.metrics };
  }

  /**
   * Get connection information
   */
  getConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if a client is connected
   */
  isClientConnected(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Disconnect a specific client
   */
  disconnectClient(connectionId: string, reason: string = 'Disconnected by server'): void {
    const ws = this.clientSockets.get(connectionId);
    if (ws) {
      this.sendMessage(ws, this.createErrorMessage('DISCONNECTED', reason, true));
      ws.close(1000, reason);
    }
  }
}

// Singleton instance
let statusWebSocketService: WebSocketStatusService | null = null;

/**
 * Get or create the WebSocket status service instance
 */
export function getStatusWebSocketService(
  config?: Partial<StatusWebSocketConfig>
): WebSocketStatusService {
  if (!statusWebSocketService) {
    statusWebSocketService = new WebSocketStatusService(config);
    statusWebSocketService.start();
  }
  return statusWebSocketService;
}

/**
 * Destroy the WebSocket status service instance
 */
export async function destroyStatusWebSocketService(): Promise<void> {
  if (statusWebSocketService) {
    await statusWebSocketService.stop();
    statusWebSocketService = null;
  }
}

export default WebSocketStatusService;
