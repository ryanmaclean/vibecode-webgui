/**
 * Mock WebSocket Streaming Client for Tests
 *
 * Provides a comprehensive mock implementation of WebSocketStreamingClient
 * that satisfies all test requirements for Monaco Agent API integration.
 *
 * Features:
 * - Full connection lifecycle (connect, disconnect)
 * - Realistic streaming behavior with configurable latency
 * - Event handling (onChunk, onComplete, onError, onStart)
 * - Concurrent request support
 * - State management (isConnected, connection state)
 *
 * @module tests/__mocks__/websocket-streaming-client
 */

import type {
  StreamChunk,
  StreamError,
  StreamHandlers,
} from '@/lib/streaming/websocket-streaming-client'

// ============================================================================
// Mock WebSocket Streaming Client Interface
// ============================================================================

export interface MockWebSocketStreamingClient {
  // Connection methods
  connect: jest.Mock<Promise<void>, []>
  disconnect: jest.Mock<void, []>

  // Communication methods
  stream: jest.Mock<Promise<string>, [payload: unknown, handlers: StreamHandlers]>
  cancelStream: jest.Mock<Promise<void>, [requestId: string]>
  pauseStream: jest.Mock<Promise<void>, [requestId: string]>
  resumeStream: jest.Mock<Promise<void>, [requestId: string]>

  // Query methods
  isConnected: jest.Mock<boolean, []>
  getActiveStreamCount: jest.Mock<number, []>
  getStreamStats: jest.Mock<any, [requestId: string]>

  // Internal state (for test control)
  _connected: boolean
  _activeStreams: Map<string, { handlers: StreamHandlers; timeout?: NodeJS.Timeout }>
  _defaultLatency: number
  _autoComplete: boolean

  // Test utilities
  _emit: (requestId: string, event: 'chunk' | 'complete' | 'error', data?: any) => void
  _reset: () => void
}

// ============================================================================
// Mock Factory Function
// ============================================================================

export function createMockWebSocketStreamingClient(
  options?: {
    defaultLatency?: number
    autoConnect?: boolean
    autoComplete?: boolean
  }
): MockWebSocketStreamingClient {
  const opts = {
    defaultLatency: options?.defaultLatency ?? 50,
    autoConnect: options?.autoConnect ?? false,
    autoComplete: options?.autoComplete ?? true,
  }

  // Internal state
  let connected = opts.autoConnect
  const activeStreams = new Map<string, { handlers: StreamHandlers; timeout?: NodeJS.Timeout }>()
  let requestCounter = 0

  // Generate unique request ID
  const generateRequestId = (): string => {
    requestCounter++
    return `request_${Date.now()}_${requestCounter}`
  }

  // Emit event to a specific stream
  const emit = (requestId: string, event: 'chunk' | 'complete' | 'error', data?: any): void => {
    const stream = activeStreams.get(requestId)
    if (!stream) {
      console.warn(`[MockWSClient] No stream found for request: ${requestId}`)
      return
    }

    switch (event) {
      case 'chunk':
        stream.handlers.onChunk?.(data as StreamChunk)
        break
      case 'complete':
        stream.handlers.onComplete?.()
        activeStreams.delete(requestId)
        break
      case 'error':
        stream.handlers.onError?.(data as StreamError)
        activeStreams.delete(requestId)
        break
    }
  }

  // Reset mock to initial state
  const reset = (): void => {
    connected = opts.autoConnect
    activeStreams.clear()
    requestCounter = 0
  }

  // Create mock object
  const mock: MockWebSocketStreamingClient = {
    // ========================================================================
    // Connection Methods
    // ========================================================================

    connect: jest.fn().mockImplementation(async () => {
      if (connected) {
        return
      }
      // Simulate connection latency
      await new Promise(resolve => setTimeout(resolve, 10))
      connected = true
    }),

    disconnect: jest.fn().mockImplementation(() => {
      if (!connected) {
        return
      }
      // Cancel all active streams
      for (const [requestId, stream] of activeStreams.entries()) {
        if (stream.timeout) {
          clearTimeout(stream.timeout)
        }
        stream.handlers.onError?.({
          type: 'stream-error',
          requestId,
          error: {
            code: 'DISCONNECTED',
            message: 'WebSocket connection closed',
            recoverable: false,
          },
        })
      }
      activeStreams.clear()
      connected = false
    }),

    // ========================================================================
    // Communication Methods
    // ========================================================================

    stream: jest.fn().mockImplementation(async (payload: unknown, handlers: StreamHandlers) => {
      if (!connected) {
        throw new Error('Not connected to WebSocket server')
      }

      const requestId = generateRequestId()

      // Store stream
      activeStreams.set(requestId, { handlers })

      // Call onStart handler
      handlers.onStart?.()

      // Simulate streaming behavior with configurable latency
      if (opts.autoComplete) {
        setTimeout(() => {
          if (!activeStreams.has(requestId)) {
            return // Stream was cancelled
          }

          // Auto-generate response based on payload type
          const payloadAny = payload as any
          let responseData: any = { success: true }

          if (payloadAny?.type === 'completion' || payloadAny?.action === 'requestCompletions') {
            responseData = {
              completions: [
                {
                  label: 'console.log',
                  kind: 1,
                  insertText: 'console.log()',
                  detail: 'Log to console',
                },
              ],
            }
          } else if (payloadAny?.type === 'hover' || payloadAny?.action === 'requestHover') {
            responseData = {
              hover: {
                contents: [{ value: 'Variable information' }],
              },
            }
          } else if (payloadAny?.type === 'codeAction' || payloadAny?.action === 'requestCodeActions') {
            responseData = {
              actions: [
                {
                  title: 'Quick fix',
                  kind: { value: 'quickfix' },
                },
              ],
            }
          }

          // Send chunk
          const chunk: StreamChunk = {
            type: 'stream-chunk',
            requestId,
            sequence: 1,
            data: responseData,
            timestamp: Date.now(),
          }
          emit(requestId, 'chunk', chunk)

          // Complete stream
          emit(requestId, 'complete')
        }, opts.defaultLatency)
      }

      return requestId
    }),

    cancelStream: jest.fn().mockImplementation(async (requestId: string) => {
      const stream = activeStreams.get(requestId)
      if (stream) {
        if (stream.timeout) {
          clearTimeout(stream.timeout)
        }
        activeStreams.delete(requestId)
      }
    }),

    pauseStream: jest.fn().mockImplementation(async (requestId: string) => {
      // Mock implementation - just verify stream exists
      if (!activeStreams.has(requestId)) {
        throw new Error(`Stream ${requestId} not found`)
      }
    }),

    resumeStream: jest.fn().mockImplementation(async (requestId: string) => {
      // Mock implementation - just verify stream exists
      if (!activeStreams.has(requestId)) {
        throw new Error(`Stream ${requestId} not found`)
      }
    }),

    // ========================================================================
    // Query Methods
    // ========================================================================

    isConnected: jest.fn().mockImplementation(() => connected),

    getActiveStreamCount: jest.fn().mockImplementation(() => activeStreams.size),

    getStreamStats: jest.fn().mockImplementation((requestId: string) => {
      if (!activeStreams.has(requestId)) {
        return null
      }
      return {
        duration: 100,
        chunkCount: 1,
        totalBytes: 1024,
        avgChunkSize: 1024,
        lastChunkAge: 10,
      }
    }),

    // ========================================================================
    // Internal State (for test control)
    // ========================================================================

    _connected: connected,
    _activeStreams: activeStreams,
    _defaultLatency: opts.defaultLatency,
    _autoComplete: opts.autoComplete,

    // ========================================================================
    // Test Utilities
    // ========================================================================

    _emit: emit,
    _reset: reset,
  }

  // Update _connected property when connect/disconnect is called
  Object.defineProperty(mock, '_connected', {
    get: () => connected,
    set: (value: boolean) => {
      connected = value
    },
  })

  return mock
}

// ============================================================================
// Default Export for Jest Auto-Mocking
// ============================================================================

export default {
  createMockWebSocketStreamingClient,
}
