/**
 * WebSocket Streaming Client for Bidirectional Agent Communication
 *
 * Alternative to SSE for scenarios requiring:
 * - Bidirectional communication (client → server commands)
 * - Binary data streaming
 * - Real-time interactive debugging
 *
 * Built on top of existing WebSocketConnectionPool for production reliability.
 *
 * @module streaming/websocket-streaming-client
 */

import {
WebSocketConnectionPool,
  getPooledWebSocket,
  releasePooledWebSocket
} from '@/lib/websocket-connection-pooling'
// import { logger } from '@/lib/logger';

// ============================================================================
// Message Protocol Types
// ============================================================================

export interface StreamRequest {
  type: 'stream-request'
  id: string
  payload: unknown
  priority?: 'low' | 'normal' | 'high'
}

export interface StreamChunk {
  type: 'stream-chunk'
  requestId: string
  sequence: number
  data: unknown
  timestamp: number
}

export interface StreamComplete {
  type: 'stream-complete'
  requestId: string
  timestamp: number
}

export interface StreamError {
  type: 'stream-error'
  requestId: string
  error: {
    code: string
    message: string
    recoverable: boolean
    retryAfter?: number
  }
}

export interface StreamControl {
  type: 'stream-control'
  requestId: string
  action: 'pause' | 'resume' | 'cancel'
}

export type WebSocketMessage =
  | StreamRequest
  | StreamChunk
  | StreamComplete
  | StreamError
  | StreamControl

// ============================================================================
// Configuration Types
// ============================================================================

export interface WebSocketStreamConfig {
  /** WebSocket server URL */
  url: string
  /** Connection priority */
  priority?: 'low' | 'normal' | 'high'
  /** Enable automatic reconnection (inherited from pool) */
  autoReconnect?: boolean
  /** Enable debug logging */
  debug?: boolean
  /** Request timeout (ms) */
  timeout?: number
  /** Base delay for reconnection in ms (default: 1000) */
  reconnectBaseDelay?: number
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number
  /** Heartbeat interval in ms (default: 30000). Set to 0 to disable. */
  heartbeatInterval?: number
}

export interface StreamHandlers {
  /** Called when a data chunk is received */
  onChunk: (chunk: StreamChunk) => void
  /** Called when stream completes successfully */
  onComplete?: () => void
  /** Called when an error occurs */
  onError?: (error: StreamError) => void
  /** Called when stream starts */
  onStart?: () => void
}

// ============================================================================
// Stream State
// ============================================================================

interface ActiveStream {
  requestId: string
  handlers: StreamHandlers
  startTime: number
  lastChunkTime: number
  chunkCount: number
  totalBytes: number
  timeout?: NodeJS.Timeout
}

// ============================================================================
// WebSocket Streaming Client
// ============================================================================

export class WebSocketStreamingClient {
  private config: Required<WebSocketStreamConfig>
  private connectionId: string | null = null
  private subscriberId: string
  private activeStreams = new Map<string, ActiveStream>()
  private connected = false
  private reconnectAttempts = 0
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongTime: number = 0

  constructor(
    config: WebSocketStreamConfig,
    private pool?: WebSocketConnectionPool
  ) {
    this.config = {
      url: config.url,
      priority: config.priority || 'normal',
      autoReconnect: config.autoReconnect ?? true,
      debug: config.debug ?? false,
      timeout: config.timeout || 60000,
      reconnectBaseDelay: config.reconnectBaseDelay || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      heartbeatInterval: config.heartbeatInterval ?? 30000
    }

    this.subscriberId = this.generateId('subscriber')
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      this.log('Already connected')
      return
    }

    try {
      const connection = await getPooledWebSocket(this.config.url, this.config.priority)

      this.connectionId = connection.id
      this.connected = true
      this.reconnectAttempts = 0 // Reset on successful connection

      // Subscribe to connection events
      if (this.pool) {
        this.pool.subscribeToConnection(connection.id, this.subscriberId, {
          onMessage: (data: unknown) => this.handleMessage(typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer)),
          onClose: () => this.handleDisconnect(),
          onError: (error) => this.handleConnectionError(error)
        })
      }

      // Start heartbeat monitoring
      this.startHeartbeat()

      this.log('Connected:', connection.id)
    } catch (error) {
      this.log('Connection failed:', error)
      throw error
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (!this.connected || !this.connectionId) {
      return
    }

    // Stop heartbeat monitoring
    this.stopHeartbeat()

    // Cancel all active streams
    for (const [requestId, stream] of this.activeStreams) {
      this.cancelStream(requestId)
    }

    // Release connection back to pool
    releasePooledWebSocket(this.connectionId, this.subscriberId)

    this.connectionId = null
    this.connected = false
    this.reconnectAttempts = 0 // Reset on intentional disconnect
    this.log('Disconnected')
  }

  /**
   * Start a streaming request
   */
  async stream(payload: unknown, handlers: StreamHandlers): Promise<string> {
    if (!this.connected || !this.connectionId) {
      throw new Error('Not connected to WebSocket server')
    }

    const requestId = this.generateId('request')

    // Register stream
    const stream: ActiveStream = {
      requestId,
      handlers,
      startTime: Date.now(),
      lastChunkTime: Date.now(),
      chunkCount: 0,
      totalBytes: 0
    }

    // Set timeout
    if (this.config.timeout > 0) {
      stream.timeout = setTimeout(() => {
        this.handleStreamTimeout(requestId)
      }, this.config.timeout)
    }

    this.activeStreams.set(requestId, stream)

    // Send request
    const request: StreamRequest = {
      type: 'stream-request',
      id: requestId,
      payload,
      priority: this.config.priority
    }

    await this.sendMessage(request)

    this.log('Stream started:', requestId)
    handlers.onStart?.()

    return requestId
  }

  /**
   * Cancel an active stream
   */
  async cancelStream(requestId: string): Promise<void> {
    const stream = this.activeStreams.get(requestId)
    if (!stream) {
      return
    }

    // Clear timeout
    if (stream.timeout) {
      clearTimeout(stream.timeout)
    }

    // Send cancel control message if connected
    if (this.connected && this.connectionId) {
      const control: StreamControl = {
        type: 'stream-control',
        requestId,
        action: 'cancel'
      }

      try {
        await this.sendMessage(control)
      } catch (error) {
        this.log('Failed to send cancel message:', error)
      }
    }

    // Remove from active streams
    this.activeStreams.delete(requestId)

    this.log('Stream cancelled:', requestId)
  }

  /**
   * Pause a stream (backpressure signal)
   */
  async pauseStream(requestId: string): Promise<void> {
    const stream = this.activeStreams.get(requestId)
    if (!stream) {
      return
    }

    const control: StreamControl = {
      type: 'stream-control',
      requestId,
      action: 'pause'
    }

    await this.sendMessage(control)
    this.log('Stream paused:', requestId)
  }

  /**
   * Resume a paused stream
   */
  async resumeStream(requestId: string): Promise<void> {
    const stream = this.activeStreams.get(requestId)
    if (!stream) {
      return
    }

    const control: StreamControl = {
      type: 'stream-control',
      requestId,
      action: 'resume'
    }

    await this.sendMessage(control)
    this.log('Stream resumed:', requestId)
  }

  /**
   * Get statistics for an active stream
   */
  getStreamStats(requestId: string): {
    duration: number
    chunkCount: number
    totalBytes: number
    avgChunkSize: number
    lastChunkAge: number
  } | null {
    const stream = this.activeStreams.get(requestId)
    if (!stream) {
      return null
    }

    const now = Date.now()
    return {
      duration: now - stream.startTime,
      chunkCount: stream.chunkCount,
      totalBytes: stream.totalBytes,
      avgChunkSize: stream.chunkCount > 0 ? stream.totalBytes / stream.chunkCount : 0,
      lastChunkAge: now - stream.lastChunkTime
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get number of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  private handleMessage(data: string | Buffer): void {
    try {
      // Parse message
      const messageStr = typeof data === 'string' ? data : data.toString('utf-8')
      const message = JSON.parse(messageStr) as WebSocketMessage | { type: 'ping' | 'pong'; timestamp?: number }

      switch (message.type) {
        case 'stream-chunk':
          this.handleStreamChunk(message as StreamChunk)
          break
        case 'stream-complete':
          this.handleStreamComplete(message as StreamComplete)
          break
        case 'stream-error':
          this.handleStreamError(message as StreamError)
          break
        case 'pong':
          this.handlePong()
          break
        case 'ping':
          // Respond to server ping with pong
          this.sendPong()
          break
        default:
          this.log('Unknown message type:', message)
      }
    } catch (error) {
      this.log('Message parse error:', error)
    }
  }

  /**
   * Send pong response to server ping
   */
  private async sendPong(): Promise<void> {
    if (!this.connected || !this.connectionId || !this.pool) {
      return
    }

    try {
      const pongMessage = {
        type: 'pong' as const,
        timestamp: Date.now()
      }
      await this.pool.sendMessage(this.connectionId, JSON.stringify(pongMessage))
      this.log('Pong sent in response to server ping')
    } catch (error) {
      this.log('Failed to send pong:', error)
    }
  }

  private handleStreamChunk(chunk: StreamChunk): void {
    const stream = this.activeStreams.get(chunk.requestId)
    if (!stream) {
      this.log('Received chunk for unknown stream:', chunk.requestId)
      return
    }

    // Update stream statistics
    stream.lastChunkTime = Date.now()
    stream.chunkCount++
    stream.totalBytes += JSON.stringify(chunk.data).length

    // Reset timeout
    if (stream.timeout) {
      clearTimeout(stream.timeout)
      stream.timeout = setTimeout(() => {
        this.handleStreamTimeout(chunk.requestId)
      }, this.config.timeout)
    }

    // Deliver to handler
    try {
      stream.handlers.onChunk(chunk)
    } catch (error) {
      this.log('Chunk handler error:', error)
    }
  }

  private handleStreamComplete(message: StreamComplete): void {
    const stream = this.activeStreams.get(message.requestId)
    if (!stream) {
      return
    }

    // Clear timeout
    if (stream.timeout) {
      clearTimeout(stream.timeout)
    }

    // Call completion handler
    stream.handlers.onComplete?.()

    // Remove from active streams
    this.activeStreams.delete(message.requestId)

    this.log('Stream completed:', message.requestId, {
      duration: Date.now() - stream.startTime,
      chunks: stream.chunkCount,
      bytes: stream.totalBytes
    })
  }

  private handleStreamError(message: StreamError): void {
    const stream = this.activeStreams.get(message.requestId)
    if (!stream) {
      return
    }

    // Clear timeout
    if (stream.timeout) {
      clearTimeout(stream.timeout)
    }

    // Call error handler
    stream.handlers.onError?.(message)

    // Remove from active streams if not recoverable
    if (!message.error.recoverable) {
      this.activeStreams.delete(message.requestId)
    }

    this.log('Stream error:', message.requestId, message.error)
  }

  private handleStreamTimeout(requestId: string): void {
    const stream = this.activeStreams.get(requestId)
    if (!stream) {
      return
    }

    const error: StreamError = {
      type: 'stream-error',
      requestId,
      error: {
        code: 'TIMEOUT',
        message: 'Stream timeout - no data received',
        recoverable: false
      }
    }

    this.handleStreamError(error)
  }

  private handleDisconnect(): void {
    this.log('Connection closed')

    // Stop heartbeat monitoring
    this.stopHeartbeat()

    // Check if we've exhausted reconnection attempts
    const canReconnect = this.config.autoReconnect &&
      this.reconnectAttempts < this.config.maxReconnectAttempts

    // Notify all active streams
    Array.from(this.activeStreams.entries()).forEach(([requestId, stream]) => {
      const error: StreamError = {
        type: 'stream-error',
        requestId,
        error: {
          code: 'DISCONNECTED',
          message: 'WebSocket connection closed',
          recoverable: canReconnect
        }
      }

      stream.handlers.onError?.(error)
    })

    // Clear active streams
    this.activeStreams.clear()
    this.connected = false
    this.connectionId = null

    // Attempt reconnection with exponential backoff if enabled
    if (canReconnect) {
      this.reconnectAttempts++
      // Exponential backoff: delay = baseDelay * 2^(attempt-1)
      // With jitter to prevent thundering herd
      const baseDelay = this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1)
      const jitter = Math.random() * 0.3 * baseDelay // 0-30% jitter
      const delay = Math.min(baseDelay + jitter, 30000) // Cap at 30 seconds

      this.log(`Auto-reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`)

      setTimeout(() => {
        this.connect().catch(error => {
          this.log('Reconnection failed:', error)
          // handleDisconnect will be called again via onError/onClose handlers
        })
      }, delay)
    } else if (this.config.autoReconnect) {
      this.log(`Max reconnection attempts (${this.config.maxReconnectAttempts}) exhausted`)
    }
  }

  private handleConnectionError(error: Error): void {
    this.log('Connection error:', error)

    // Notify all active streams
    Array.from(this.activeStreams.entries()).forEach(([requestId, stream]) => {
      const errorMessage: StreamError = {
        type: 'stream-error',
        requestId,
        error: {
          code: 'CONNECTION_ERROR',
          message: error.message,
          recoverable: true
        }
      }

      stream.handlers.onError?.(errorMessage)
    })
  }

  // ==========================================================================
  // Message Sending
  // ==========================================================================

  private async sendMessage(message: WebSocketMessage): Promise<void> {
    if (!this.connectionId || !this.pool) {
      throw new Error('Not connected')
    }

    const data = JSON.stringify(message)
    await this.pool.sendMessage(this.connectionId, data)
  }

  // ==========================================================================
  // Heartbeat Management
  // ==========================================================================

  /**
   * Start heartbeat monitoring to detect stale connections
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) {
      return
    }

    this.lastPongTime = Date.now()
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeatInterval)

    this.log('Heartbeat started with interval:', this.config.heartbeatInterval, 'ms')
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
      this.log('Heartbeat stopped')
    }
  }

  /**
   * Send a heartbeat ping message
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.connected || !this.connectionId) {
      return
    }

    // Check if we missed too many pongs (connection may be stale)
    const timeSinceLastPong = Date.now() - this.lastPongTime
    const missedHeartbeats = Math.floor(timeSinceLastPong / this.config.heartbeatInterval)

    if (missedHeartbeats >= 2) {
      this.log('Connection appears stale - missed', missedHeartbeats, 'heartbeats')
      // Force reconnection by treating as disconnect
      this.handleDisconnect()
      return
    }

    try {
      // Send ping message through the stream protocol
      const pingMessage = {
        type: 'ping' as const,
        timestamp: Date.now()
      }

      if (this.pool && this.connectionId) {
        await this.pool.sendMessage(this.connectionId, JSON.stringify(pingMessage))
        this.log('Heartbeat ping sent')
      }
    } catch (error) {
      this.log('Heartbeat ping failed:', error)
      // Connection may be broken, trigger reconnect
      this.handleDisconnect()
    }
  }

  /**
   * Handle pong response from server
   */
  private handlePong(): void {
    this.lastPongTime = Date.now()
    this.log('Heartbeat pong received')
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.info('[WebSocketStreamingClient]', ...args)
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new WebSocket streaming client
 */
export function createWebSocketStreamingClient(
  config: WebSocketStreamConfig,
  pool?: WebSocketConnectionPool
): WebSocketStreamingClient {
  return new WebSocketStreamingClient(config, pool)
}

// ============================================================================
// Use Case Comparison Guide
// ============================================================================

/**
 * When to use WebSocket over SSE:
 *
 * ✅ Use WebSocket when you need:
 * - Bidirectional communication (client → server commands)
 * - Real-time control flow (pause/resume/cancel streams)
 * - Binary data streaming (large files, images)
 * - Multiple simultaneous streams with correlation
 * - Interactive debugging sessions
 * - Live collaboration features
 *
 * ✅ Use SSE when you need:
 * - Simple unidirectional streaming (server → client)
 * - Better firewall/proxy compatibility
 * - Lower connection overhead
 * - Native browser reconnection
 * - Text-based AI responses
 * - Event-driven updates
 *
 * Example: AI Chat Streaming
 * - Use SSE for: Simple text generation, status updates
 * - Use WebSocket for: Interactive debugging, code execution with control
 */
