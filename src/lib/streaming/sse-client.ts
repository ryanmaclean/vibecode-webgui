/**
 * SSE Client Library with Automatic Reconnection and Backpressure Handling
 *
 * Production-grade Server-Sent Events client for AI agent streaming.
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Type-safe event dispatch
 * - Circular buffer for slow consumers
 * - Performance metrics tracking
 * - Browser-compatible EventSource wrapper
 *
 * @module streaming/sse-client
 */

import {
createSSEDecoder,
  SSEDecoderHandlers,
  StreamContentChunk,
  StreamMetadataChunk,
  StreamChunk
} from '@/lib/ai/utils/sse-decoder'
import { logger } from '@/lib/logger';

// ============================================================================
// Configuration Types
// ============================================================================

export interface ReconnectionConfig {
  /** Initial delay before first reconnection attempt (ms) */
  initialDelay: number
  /** Maximum delay between reconnection attempts (ms) */
  maxDelay: number
  /** Maximum number of reconnection attempts (Infinity = unlimited) */
  maxAttempts: number
  /** Multiplier for exponential backoff */
  backoffMultiplier: number
  /** Add random jitter to prevent thundering herd (±25%) */
  jitter: boolean
}

export interface BufferConfig {
  /** Maximum number of messages to buffer */
  maxSize: number
  /** Buffer overflow strategy */
  strategy: 'drop-oldest' | 'drop-newest' | 'block'
  /** Warning threshold (0-1) */
  warningThreshold: number
  /** Callback when buffer usage exceeds warning threshold */
  onBufferWarning?: (usage: number) => void
  /** Callback when buffer overflows */
  onBufferOverflow?: (dropped: number) => void
}

export interface SSEClientConfig {
  /** SSE endpoint URL */
  url: string
  /** Reconnection configuration */
  reconnection?: Partial<ReconnectionConfig>
  /** Buffer configuration */
  buffer?: Partial<BufferConfig>
  /** Request body for POST requests */
  body?: unknown
  /** Request headers */
  headers?: Record<string, string>
  /** Request method (GET or POST) */
  method?: 'GET' | 'POST'
  /** Enable performance metrics tracking */
  enableMetrics?: boolean
  /** Heartbeat timeout (ms) - reconnect if no data received */
  heartbeatTimeout?: number
  /** Enable debug logging */
  debug?: boolean
}

// ============================================================================
// Event Types
// ============================================================================

export type SSEConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'

export interface SSEClientHandlers {
  /** Called when a content chunk is received */
  onMessage: (chunk: StreamContentChunk | StreamMetadataChunk) => void
  /** Called when connection is opened */
  onOpen?: () => void
  /** Called when connection is closed */
  onClose?: () => void
  /** Called when an error occurs */
  onError?: (error: Error) => void
  /** Called when reconnection is attempted */
  onReconnecting?: (attempt: number, delay: number) => void
  /** Called when connection state changes */
  onStateChange?: (state: SSEConnectionState) => void
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface SSEMetrics {
  /** Total connection attempts */
  connectionAttempts: number
  /** Successful connections */
  successfulConnections: number
  /** Failed connections */
  failedConnections: number
  /** Total messages received */
  totalMessages: number
  /** Total bytes received */
  totalBytes: number
  /** Average time to first byte (ms) */
  averageLatency: number
  /** Timestamp of last message */
  lastMessageTimestamp: number
  /** Current connection uptime (ms) */
  connectionUptime: number
  /** Number of reconnections */
  reconnectionCount: number
  /** Current buffer usage (0-1) */
  bufferUsage: number
  /** Messages dropped due to buffer overflow */
  messagesDropped: number
}

// ============================================================================
// Circular Buffer Implementation
// ============================================================================

class CircularMessageBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private tail = 0
  private size = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  enqueue(item: T): boolean {
    if (this.size === this.capacity) {
      return false // Buffer full
    }
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    this.size++
    return true
  }

  dequeue(): T | undefined {
    if (this.size === 0) return undefined
    const item = this.buffer[this.head]
    this.buffer[this.head] = undefined // Clear reference
    this.head = (this.head + 1) % this.capacity
    this.size--
    return item
  }

  getUsage(): number {
    return this.capacity === 0 ? 0 : this.size / this.capacity
  }

  getSize(): number {
    return this.size
  }

  clear(): void {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this.tail = 0
    this.size = 0
  }
}

// ============================================================================
// SSE Client Implementation
// ============================================================================

export class SSEClient {
  private config: Required<SSEClientConfig>
  private reconnectionConfig: ReconnectionConfig
  private bufferConfig: BufferConfig
  private handlers: SSEClientHandlers

  private eventSource: EventSource | null = null
  private state: SSEConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  private messageBuffer: CircularMessageBuffer<StreamChunk>
  private decoder = createSSEDecoder({
    onContentChunk: (chunk) => this.handleMessage(chunk),
    onMetadataChunk: (chunk) => this.handleMessage(chunk),
    onMalformedChunk: (error) => this.handleError(
      error instanceof Error ? error : new Error(String(error))
    )
  })

  private metrics: SSEMetrics = {
    connectionAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    totalMessages: 0,
    totalBytes: 0,
    averageLatency: 0,
    lastMessageTimestamp: 0,
    connectionUptime: 0,
    reconnectionCount: 0,
    bufferUsage: 0,
    messagesDropped: 0
  }

  private connectionStartTime = 0
  private firstMessageReceived = false

  constructor(config: SSEClientConfig, handlers: SSEClientHandlers) {
    this.handlers = handlers

    // Merge with defaults
    this.config = {
      url: config.url,
      method: config.method || 'POST',
      headers: config.headers || {},
      body: config.body,
      enableMetrics: config.enableMetrics ?? true,
      heartbeatTimeout: config.heartbeatTimeout || 60000,
      debug: config.debug ?? false,
      reconnection: {},
      buffer: {}
    }

    this.reconnectionConfig = {
      initialDelay: config.reconnection?.initialDelay ?? 1000,
      maxDelay: config.reconnection?.maxDelay ?? 30000,
      maxAttempts: config.reconnection?.maxAttempts ?? Infinity,
      backoffMultiplier: config.reconnection?.backoffMultiplier ?? 2.0,
      jitter: config.reconnection?.jitter ?? true
    }

    this.bufferConfig = {
      maxSize: config.buffer?.maxSize ?? 1000,
      strategy: config.buffer?.strategy ?? 'drop-oldest',
      warningThreshold: config.buffer?.warningThreshold ?? 0.8,
      onBufferWarning: config.buffer?.onBufferWarning,
      onBufferOverflow: config.buffer?.onBufferOverflow
    }

    this.messageBuffer = new CircularMessageBuffer(this.bufferConfig.maxSize)
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the SSE connection
   */
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      this.log('Already connected or connecting')
      return
    }

    this.setState('connecting')
    this.metrics.connectionAttempts++
    this.connectionStartTime = Date.now()
    this.firstMessageReceived = false

    try {
      // For POST requests, we need to use fetch + ReadableStream
      // For GET requests, use native EventSource
      if (this.config.method === 'POST') {
        this.connectWithFetch()
      } else {
        this.connectWithEventSource()
      }

      this.startHeartbeatMonitor()
    } catch (error) {
      this.handleConnectionError(
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Manually disconnect
   */
  disconnect(): void {
    this.clearReconnectTimer()
    this.clearHeartbeatTimer()

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.setState('disconnected')
    this.handlers.onClose?.()
  }

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState {
    return this.state
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SSEMetrics {
    return {
      ...this.metrics,
      connectionUptime: this.state === 'connected'
        ? Date.now() - this.connectionStartTime
        : 0,
      bufferUsage: this.messageBuffer.getUsage()
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /**
   * Clear message buffer
   */
  clearBuffer(): void {
    this.messageBuffer.clear()
  }

  // ==========================================================================
  // Connection Methods
  // ==========================================================================

  private connectWithEventSource(): void {
    const url = new URL(this.config.url, window.location.origin)

    this.eventSource = new EventSource(url.toString())

    this.eventSource.onopen = () => {
      this.handleConnectionOpen()
    }

    this.eventSource.onmessage = (event) => {
      this.resetHeartbeatTimer()
      this.decoder.push(event.data)
      this.metrics.totalBytes += event.data.length
    }

    this.eventSource.onerror = () => {
      this.handleConnectionError(new Error('EventSource connection error'))
    }
  }

  private async connectWithFetch(): Promise<void> {
    try {
      const response = await fetch(this.config.url, {
        method: this.config.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...this.config.headers
        },
        body: this.config.body ? JSON.stringify(this.config.body) : undefined
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      this.handleConnectionOpen()

      // Process stream
      const reader = response.body.getReader()
      const textDecoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          this.log('Stream completed')
          this.disconnect()
          break
        }

        const chunk = textDecoder.decode(value, { stream: true })
        this.resetHeartbeatTimer()
        this.decoder.push(chunk)
        this.metrics.totalBytes += chunk.length
      }
    } catch (error) {
      this.handleConnectionError(
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  private handleConnectionOpen(): void {
    this.setState('connected')
    this.metrics.successfulConnections++
    this.reconnectAttempts = 0
    this.handlers.onOpen?.()
    this.log('Connection opened')
  }

  private handleConnectionError(error: Error): void {
    this.log('Connection error:', error.message)
    this.metrics.failedConnections++
    this.handlers.onError?.(error)

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    // Attempt reconnection
    if (this.reconnectAttempts < this.reconnectionConfig.maxAttempts) {
      this.scheduleReconnect()
    } else {
      this.setState('failed')
      this.log('Max reconnection attempts reached')
    }
  }

  // ==========================================================================
  // Reconnection Logic
  // ==========================================================================

  private scheduleReconnect(): void {
    this.setState('reconnecting')
    this.reconnectAttempts++
    this.metrics.reconnectionCount++

    // Calculate delay with exponential backoff
    let delay = Math.min(
      this.reconnectionConfig.initialDelay *
        Math.pow(this.reconnectionConfig.backoffMultiplier, this.reconnectAttempts - 1),
      this.reconnectionConfig.maxDelay
    )

    // Add jitter (±25%)
    if (this.reconnectionConfig.jitter) {
      const jitterRange = delay * 0.25
      delay += (Math.random() * jitterRange * 2) - jitterRange
    }

    this.log(`Reconnecting in ${delay.toFixed(0)}ms (attempt ${this.reconnectAttempts})`)
    this.handlers.onReconnecting?.(this.reconnectAttempts, delay)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  private handleMessage(chunk: StreamChunk): void {
    if (!this.firstMessageReceived) {
      const latency = Date.now() - this.connectionStartTime
      this.updateAverageLatency(latency)
      this.firstMessageReceived = true
      this.log(`First message received in ${latency}ms`)
    }

    this.metrics.totalMessages++
    this.metrics.lastMessageTimestamp = Date.now()

    // Try to enqueue message
    const enqueued = this.messageBuffer.enqueue(chunk)

    if (!enqueued) {
      // Buffer full - apply strategy
      this.handleBufferOverflow(chunk)
    }

    // Check buffer usage
    const usage = this.messageBuffer.getUsage()
    if (usage >= this.bufferConfig.warningThreshold) {
      this.bufferConfig.onBufferWarning?.(usage)
    }

    // Process buffer
    this.processBuffer()
  }

  private handleBufferOverflow(chunk: StreamChunk): void {
    this.metrics.messagesDropped++

    switch (this.bufferConfig.strategy) {
      case 'drop-oldest':
        // Remove oldest message and add new one
        this.messageBuffer.dequeue()
        this.messageBuffer.enqueue(chunk)
        break

      case 'drop-newest':
        // Drop the new message
        break

      case 'block':
        // Try to process buffer first, then retry
        this.processBuffer()
        this.messageBuffer.enqueue(chunk)
        break
    }

    this.bufferConfig.onBufferOverflow?.(this.metrics.messagesDropped)
  }

  private processBuffer(): void {
    // Drain buffer and deliver messages
    let message = this.messageBuffer.dequeue()
    while (message) {
      try {
        this.handlers.onMessage(message)
      } catch (error) {
        this.log('Error in message handler:', error)
      }
      message = this.messageBuffer.dequeue()
    }
  }

  private handleError(error: Error): void {
    this.log('Decoder error:', error.message)
    this.handlers.onError?.(error)
  }

  // ==========================================================================
  // Heartbeat Monitoring
  // ==========================================================================

  private startHeartbeatMonitor(): void {
    this.resetHeartbeatTimer()
  }

  private resetHeartbeatTimer(): void {
    this.clearHeartbeatTimer()

    this.heartbeatTimer = setTimeout(() => {
      this.log('Heartbeat timeout - no data received')
      this.handleConnectionError(new Error('Heartbeat timeout'))
    }, this.config.heartbeatTimeout)
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  private setState(newState: SSEConnectionState): void {
    if (this.state !== newState) {
      const oldState = this.state
      this.state = newState
      this.log(`State changed: ${oldState} → ${newState}`)
      this.handlers.onStateChange?.(newState)
    }
  }

  // ==========================================================================
  // Metrics
  // ==========================================================================

  private updateAverageLatency(newLatency: number): void {
    const alpha = 0.1 // Exponential moving average factor
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = newLatency
    } else {
      this.metrics.averageLatency =
        this.metrics.averageLatency * (1 - alpha) + newLatency * alpha
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      logger.info('[SSEClient]', ...args)
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SSE client instance
 */
export function createSSEClient(
  config: SSEClientConfig,
  handlers: SSEClientHandlers
): SSEClient {
  return new SSEClient(config, handlers)
}
