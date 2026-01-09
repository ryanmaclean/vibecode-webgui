/**
 * Jest Mock Module for WebSocket Streaming Client
 *
 * This module is automatically loaded by Jest when the real
 * websocket-streaming-client module is imported in tests.
 *
 * It provides a mock implementation that can be controlled
 * from tests for comprehensive testing.
 *
 * @module tests/__mocks__/@/lib/streaming/websocket-streaming-client
 */

import { createMockWebSocketStreamingClient } from '../../../websocket-streaming-client'

// Store the current mock instance
let currentMock = createMockWebSocketStreamingClient()

/**
 * Mock WebSocketStreamingClient class
 */
export class WebSocketStreamingClient {
  constructor(config: any, pool?: any) {
    // Return the current mock instance
    return currentMock as any
  }
}

/**
 * Mock factory function
 */
export function createWebSocketStreamingClient(config: any, pool?: any) {
  return currentMock
}

/**
 * Test utility to get current mock (for test setup)
 */
export function __getMockInstance() {
  return currentMock
}

/**
 * Test utility to set mock instance (for custom test scenarios)
 */
export function __setMockInstance(mock: ReturnType<typeof createMockWebSocketStreamingClient>) {
  currentMock = mock
}

/**
 * Test utility to reset mock to default state
 */
export function __resetMock() {
  currentMock._reset()
}

/**
 * Test utility to create a fresh mock instance
 */
export function __createFreshMock(options?: Parameters<typeof createMockWebSocketStreamingClient>[0]) {
  currentMock = createMockWebSocketStreamingClient(options)
  return currentMock
}

// Re-export types
export type {
  StreamRequest,
  StreamChunk,
  StreamComplete,
  StreamError,
  StreamControl,
  WebSocketMessage,
  WebSocketStreamConfig,
  StreamHandlers,
} from '@/lib/streaming/websocket-streaming-client'
