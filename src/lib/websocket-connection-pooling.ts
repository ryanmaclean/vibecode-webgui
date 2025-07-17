/**
 * WebSocket Connection Pooling
 *
 * High-performance WebSocket connection management with pooling and load balancing
 * Implements connection reuse, health monitoring, and automatic failover
 *
 * Staff Engineer Implementation - Enterprise-grade WebSocket infrastructure
 */

import { EventEmitter } from 'events'
import WebSocket from 'ws'

interface ConnectionPoolConfig {
  maxConnections: number
  maxConnectionsPerHost: number
  connectionTimeout: number
  heartbeatInterval: number
  reconnectDelay: number
  maxReconnectAttempts: number
  enableCompression: boolean
  protocolVersion: number
}

interface ConnectionMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  failedConnections: number
  totalMessages: number
  totalBytes: number
  averageLatency: number
  uptime: number
}

interface PooledConnection {
  id: string
  socket: WebSocket
  url: string
  state: 'connecting' | 'connected' | 'idle' | 'busy' | 'reconnecting' | 'failed'
  lastUsed: number
  messageCount: number
  bytesSent: number
  bytesReceived: number
  latency: number
  reconnectAttempts: number
  healthScore: number
  subscribers: Set<string>
}

interface ConnectionRequest {
  id: string
  url: string
  priority: 'low' | 'normal' | 'high'
  timeout: number
  resolve: (connection: PooledConnection) => void
  reject: (error: Error) => void
}

export class WebSocketConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig
  private connections = new Map<string, PooledConnection>()
  private connectionsByHost = new Map<string, Set<string>>()
  private pendingRequests: ConnectionRequest[] = []
  private metrics: ConnectionMetrics
  private heartbeatTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null
  private startTime = Date.now()

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super()

    this.config = {
      maxConnections: config.maxConnections || 100,
      maxConnectionsPerHost: config.maxConnectionsPerHost || 10,
      connectionTimeout: config.connectionTimeout || 30000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      enableCompression: config.enableCompression || true,
      protocolVersion: config.protocolVersion || 13
    }

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      totalBytes: 0,
      averageLatency: 0,
      uptime: 0
    }

    this.startHeartbeat()
    this.startCleanup()
  }

  /**
   * Get or create a connection from the pool
   */
  async getConnection(url: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const request: ConnectionRequest = {
        id: this.generateRequestId(),
        url,
        priority,
        timeout: this.config.connectionTimeout,
        resolve,
        reject
      }

      // Try to get existing connection first
      const existingConnection = this.findAvailableConnection(url)
      if (existingConnection) {
        this.assignConnection(existingConnection, request.id)
        resolve(existingConnection)
        return
      }

      // Check pool limits
      if (!this.canCreateConnection(url)) {
        this.pendingRequests.push(request)
        this.processPendingRequests()
        return
      }

      // Create new connection
      this.createConnection(url, request.id)
        .then(resolve)
        .catch(reject)
    })
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string, subscriberId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    connection.subscribers.delete(subscriberId)
    connection.lastUsed = Date.now()

    if (connection.subscribers.size === 0) {
      connection.state = 'idle'
      this.updateMetrics()
    }

    // Process pending requests
    this.processPendingRequests()
  }

  /**
   * Send message through connection
   */
  async sendMessage(connectionId: string, data: string | Buffer): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error('Connection not found')
    }

    if (connection.state !== 'connected' && connection.state !== 'busy') {
      throw new Error('Connection not available')
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      try {
        connection.socket.send(data, (error) => {
          if (error) {
            this.handleConnectionError(connection, error)
            reject(error)
            return
          }

          // Update metrics
          const messageSize = typeof data === 'string' ? Buffer.byteLength(data) : data.length
          connection.messageCount++
          connection.bytesSent += messageSize
          connection.latency = Date.now() - startTime

          this.metrics.totalMessages++
          this.metrics.totalBytes += messageSize
          this.updateAverageLatency(connection.latency)

          resolve()
        })
      } catch (error) {
        this.handleConnectionError(connection, error as Error)
        reject(error)
      }
    })
  }

  /**
   * Subscribe to connection events
   */
  subscribeToConnection(connectionId: string, subscriberId: string, handlers: {
    onMessage?: (data: any) => void
    onClose?: () => void
    onError?: (error: Error) => void
  }): void {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error('Connection not found')
    }

    connection.subscribers.add(subscriberId)

    if (handlers.onMessage) {
      connection.socket.on('message', handlers.onMessage)
    }

    if (handlers.onClose) {
      connection.socket.on('close', handlers.onClose)
    }

    if (handlers.onError) {
      connection.socket.on('error', handlers.onError)
    }
  }

  /**
   * Find available connection for URL
   */
  private findAvailableConnection(url: string): PooledConnection | null {
    const host = this.extractHost(url)
    const hostConnections = this.connectionsByHost.get(host)

    if (!hostConnections) return null

    // Find best available connection
    let bestConnection: PooledConnection | null = null
    let bestScore = -1

    for (const connectionId of hostConnections) {
      const connection = this.connections.get(connectionId)
      if (!connection) continue

      if (connection.url === url &&
          (connection.state === 'idle' || connection.state === 'connected') &&
          connection.healthScore > bestScore) {
        bestConnection = connection
        bestScore = connection.healthScore
      }
    }

    return bestConnection
  }

  /**
   * Create new connection
   */
  private async createConnection(url: string, subscriberId: string): Promise<PooledConnection> {
    const connectionId = this.generateConnectionId()
    const host = this.extractHost(url)

    const connection: PooledConnection = {
      id: connectionId,
      socket: null as any, // Will be set below
      url,
      state: 'connecting',
      lastUsed: Date.now(),
      messageCount: 0,
      bytesSent: 0,
      bytesReceived: 0,
      latency: 0,
      reconnectAttempts: 0,
      healthScore: 100,
      subscribers: new Set([subscriberId])
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.state = 'failed'
        this.handleConnectionError(connection, new Error('Connection timeout'))
        reject(new Error('Connection timeout'))
      }, this.config.connectionTimeout)

      try {
        const socket = new WebSocket(url, {
          protocolVersion: this.config.protocolVersion,
          perMessageDeflate: this.config.enableCompression,
          maxPayload: 100 * 1024 * 1024, // 100MB
          handshakeTimeout: this.config.connectionTimeout / 2
        })

        connection.socket = socket

        socket.on('open', () => {
          clearTimeout(timeout)
          connection.state = 'connected'
          connection.reconnectAttempts = 0

          // Add to tracking
          this.connections.set(connectionId, connection)
          this.addToHostTracking(host, connectionId)

          this.metrics.totalConnections++
          this.updateMetrics()

          this.emit('connection-created', connection)
          resolve(connection)
        })

        socket.on('close', (code, reason) => {
          this.handleConnectionClose(connection, code, reason?.toString())
        })

        socket.on('error', (error) => {
          clearTimeout(timeout)
          this.handleConnectionError(connection, error)
          if (connection.state === 'connecting') {
            reject(error)
          }
        })

        socket.on('message', (data) => {
          connection.bytesReceived += data.length
          this.metrics.totalBytes += data.length
        })

        // Setup ping/pong for health monitoring
        socket.on('pong', () => {
          connection.healthScore = Math.min(connection.healthScore + 1, 100)
        })

      } catch (error) {
        clearTimeout(timeout)
        connection.state = 'failed'
        reject(error)
      }
    })
  }

  /**
   * Check if new connection can be created
   */
  private canCreateConnection(url: string): boolean {
    if (this.connections.size >= this.config.maxConnections) {
      return false
    }

    const host = this.extractHost(url)
    const hostConnections = this.connectionsByHost.get(host)

    if (hostConnections && hostConnections.size >= this.config.maxConnectionsPerHost) {
      return false
    }

    return true
  }

  /**
   * Assign connection to subscriber
   */
  private assignConnection(connection: PooledConnection, subscriberId: string): void {
    connection.subscribers.add(subscriberId)
    connection.state = 'busy'
    connection.lastUsed = Date.now()
    this.updateMetrics()
  }

  /**
   * Process pending connection requests
   */
  private processPendingRequests(): void {
    if (this.pendingRequests.length === 0) return

    // Sort by priority
    this.pendingRequests.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    const processedRequests: number[] = []

    for (let i = 0; i < this.pendingRequests.length; i++) {
      const request = this.pendingRequests[i]

      // Check for timeout
      if (Date.now() - request.timeout > this.config.connectionTimeout) {
        request.reject(new Error('Request timeout'))
        processedRequests.push(i)
        continue
      }

      // Try to find available connection
      const connection = this.findAvailableConnection(request.url)
      if (connection) {
        this.assignConnection(connection, request.id)
        request.resolve(connection)
        processedRequests.push(i)
        continue
      }

      // Try to create new connection
      if (this.canCreateConnection(request.url)) {
        this.createConnection(request.url, request.id)
          .then(request.resolve)
          .catch(request.reject)
        processedRequests.push(i)
      }
    }

    // Remove processed requests
    processedRequests.reverse().forEach(index => {
      this.pendingRequests.splice(index, 1)
    })
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connection: PooledConnection, error: Error): void {
    connection.state = 'failed'
    connection.healthScore = Math.max(connection.healthScore - 10, 0)

    this.metrics.failedConnections++
    this.emit('connection-error', { connection, error })

    // Attempt reconnection if configured
    if (connection.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect(connection)
    } else {
      this.removeConnection(connection.id)
    }
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(connection: PooledConnection, code: number, reason?: string): void {
    this.emit('connection-closed', { connection, code, reason })

    if (connection.subscribers.size > 0) {
      // Attempt reconnection for active connections
      this.scheduleReconnect(connection)
    } else {
      // Remove idle connections
      this.removeConnection(connection.id)
    }
  }

  /**
   * Schedule connection reconnect
   */
  private scheduleReconnect(connection: PooledConnection): void {
    if (connection.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.removeConnection(connection.id)
      return
    }

    connection.state = 'reconnecting'
    connection.reconnectAttempts++

    const delay = this.config.reconnectDelay * Math.pow(2, connection.reconnectAttempts - 1)

    setTimeout(async () => {
      try {
        const newConnection = await this.createConnection(connection.url, 'reconnect')

        // Transfer subscribers
        connection.subscribers.forEach(subscriberId => {
          newConnection.subscribers.add(subscriberId)
        })

        // Remove old connection
        this.removeConnection(connection.id)

        this.emit('connection-reconnected', newConnection)
      } catch (error) {
        this.handleConnectionError(connection, error as Error)
      }
    }, delay)
  }

  /**
   * Remove connection from pool
   */
  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    // Close socket if still open
    if (connection.socket && connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close()
    }

    // Remove from tracking
    this.connections.delete(connectionId)

    const host = this.extractHost(connection.url)
    const hostConnections = this.connectionsByHost.get(host)
    if (hostConnections) {
      hostConnections.delete(connectionId)
      if (hostConnections.size === 0) {
        this.connectionsByHost.delete(host)
      }
    }

    this.updateMetrics()
    this.emit('connection-removed', connection)
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.connections.forEach(connection => {
        if (connection.socket && connection.socket.readyState === WebSocket.OPEN) {
          try {
            connection.socket.ping()
          } catch (error) {
            this.handleConnectionError(connection, error as Error)
          }
        }
      })
    }, this.config.heartbeatInterval)
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const idleTimeout = this.config.heartbeatInterval * 2

      this.connections.forEach(connection => {
        // Remove idle connections that haven't been used
        if (connection.state === 'idle' &&
            connection.subscribers.size === 0 &&
            now - connection.lastUsed > idleTimeout) {
          this.removeConnection(connection.id)
        }
      })
    }, this.config.heartbeatInterval)
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.activeConnections = 0
    this.metrics.idleConnections = 0

    this.connections.forEach(connection => {
      if (connection.state === 'connected' || connection.state === 'busy') {
        if (connection.subscribers.size > 0) {
          this.metrics.activeConnections++
        } else {
          this.metrics.idleConnections++
        }
      }
    })

    this.metrics.uptime = Date.now() - this.startTime
  }

  /**
   * Update average latency
   */
  private updateAverageLatency(newLatency: number): void {
    const alpha = 0.1 // Exponential moving average factor
    this.metrics.averageLatency = this.metrics.averageLatency * (1 - alpha) + newLatency * alpha
  }

  /**
   * Extract host from URL
   */
  private extractHost(url: string): string {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      return url
    }
  }

  /**
   * Add connection to host tracking
   */
  private addToHostTracking(host: string, connectionId: string): void {
    if (!this.connectionsByHost.has(host)) {
      this.connectionsByHost.set(host, new Set())
    }
    this.connectionsByHost.get(host)!.add(connectionId)
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get pool status
   */
  getStatus() {
    return {
      totalConnections: this.connections.size,
      connectionsByHost: Object.fromEntries(
        Array.from(this.connectionsByHost.entries()).map(([host, connections]) => [
          host,
          connections.size
        ])
      ),
      pendingRequests: this.pendingRequests.length,
      config: this.config
    }
  }

  /**
   * Cleanup and close all connections
   */
  async destroy(): Promise<void> {
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // Reject pending requests
    this.pendingRequests.forEach(request => {
      request.reject(new Error('Pool destroyed'))
    })
    this.pendingRequests = []

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(connection => {
      return new Promise<void>((resolve) => {
        if (connection.socket && connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.once('close', () => resolve())
          connection.socket.close()
        } else {
          resolve()
        }
      })
    })

    await Promise.all(closePromises)

    // Clear data structures
    this.connections.clear()
    this.connectionsByHost.clear()
    this.removeAllListeners()
  }
}

// Global connection pool instance
export const globalWebSocketPool = new WebSocketConnectionPool({
  maxConnections: 200,
  maxConnectionsPerHost: 20,
  connectionTimeout: 30000,
  heartbeatInterval: 30000,
  enableCompression: true
})

/**
 * Utility function to get pooled connection
 */
export async function getPooledWebSocket(
  url: string,
  priority: 'low' | 'normal' | 'high' = 'normal'
): Promise<PooledConnection> {
  return globalWebSocketPool.getConnection(url, priority)
}

/**
 * Utility function to release pooled connection
 */
export function releasePooledWebSocket(connectionId: string, subscriberId: string): void {
  globalWebSocketPool.releaseConnection(connectionId, subscriberId)
}
