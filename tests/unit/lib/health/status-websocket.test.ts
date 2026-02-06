/**
 * Unit Tests for Status WebSocket Service
 *
 * Tests the WebSocket-based health status broadcasting service
 * including connection management, heartbeats, and message handling.
 *
 * Target coverage: 70%+
 */

import { jest } from '@jest/globals'
import { EventEmitter } from 'events'

// Mock dependencies before imports
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    submitEvent: jest.fn()
  }
}))

jest.mock('@/lib/logging', () => ({
  createServiceLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}))

// Use a mock counter that will be managed in beforeEach
jest.mock('crypto', () => {
  let mockCounter = 0
  return {
    randomUUID: jest.fn(() => `test-uuid-${++mockCounter}`),
    _resetCounter: () => { mockCounter = 0 }
  }
})

// Create MockWebSocket class inside the mock factory
jest.mock('ws', () => {
  const EventEmitter = require('events')

  class MockWebSocket extends EventEmitter {
    static OPEN = 1
    static CLOSED = 3

    // Instance properties for readyState comparison (ws library pattern)
    OPEN = 1
    CLOSED = 3
    readyState = 1 // OPEN
    send = jest.fn()
    close = jest.fn()
    terminate = jest.fn()
    ping = jest.fn()
    once = jest.fn((event: string, cb: () => void) => {
      if (event === 'close') {
        setTimeout(cb, 10)
      }
    })
  }

  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket
  }
})

import WebSocketStatusService, {
  getStatusWebSocketService,
  destroyStatusWebSocketService
} from '@/lib/health/status-websocket'
import type { StatusWebSocketConfig, HealthCheckResult, HealthStatus } from '@/types/status-events'
import { monitoring } from '@/lib/monitoring'

// Get the crypto mock to reset counter
const cryptoMock = require('crypto')

// Helper to create mock WebSocket instances
function createMockWs() {
  const EventEmitter = require('events')

  class MockWsInstance extends EventEmitter {
    static OPEN = 1
    static CLOSED = 3

    // Instance properties for readyState comparison (ws library pattern)
    OPEN = 1
    CLOSED = 3
    readyState = 1 // OPEN
    send = jest.fn()
    close = jest.fn()
    terminate = jest.fn()
    ping = jest.fn()
    once = jest.fn((event: string, cb: () => void) => {
      if (event === 'close') {
        setTimeout(cb, 10)
      }
    })
  }

  return new MockWsInstance()
}

describe('WebSocketStatusService', () => {
  let service: WebSocketStatusService
  let mockWs: any

  const testConfig: Partial<StatusWebSocketConfig> = {
    heartbeatInterval: 1000,
    pingTimeout: 500,
    maxMissedHeartbeats: 2,
    updateThrottleInterval: 100,
    maxConnectionsPerIp: 5,
    maxTotalConnections: 100
  }

  const createMockHealthResult = (status: HealthStatus = 'healthy'): HealthCheckResult => ({
    services: [
      { name: 'postgresql', status, lastCheck: new Date().toISOString() },
      { name: 'valkey', status, lastCheck: new Date().toISOString() }
    ],
    overallStatus: status,
    timestamp: new Date().toISOString()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    if (cryptoMock._resetCounter) {
      cryptoMock._resetCounter()
    }
    service = new WebSocketStatusService(testConfig)
    mockWs = createMockWs()
  })

  afterEach(async () => {
    jest.useRealTimers()
    if (service) {
      await service.stop()
    }
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new WebSocketStatusService()
      expect(defaultService).toBeInstanceOf(WebSocketStatusService)
      expect(defaultService.getConnectionCount()).toBe(0)
    })

    it('should initialize with custom configuration', () => {
      expect(service).toBeInstanceOf(WebSocketStatusService)
    })

    it('should initialize metrics correctly', () => {
      const metrics = service.getMetrics()
      expect(metrics.totalConnections).toBe(0)
      expect(metrics.totalMessagesSent).toBe(0)
      expect(metrics.errorCount).toBe(0)
    })
  })

  describe('Service Lifecycle', () => {
    it('should start service and emit started event', () => {
      const emitSpy = jest.spyOn(service, 'emit')

      service.start()

      expect(emitSpy).toHaveBeenCalledWith('started')
    })

    it('should stop service and emit stopped event', async () => {
      service.start()
      const emitSpy = jest.spyOn(service, 'emit')

      const stopPromise = service.stop()
      jest.advanceTimersByTime(100)
      await stopPromise

      expect(emitSpy).toHaveBeenCalledWith('stopped')
    })
  })

  describe('Connection Handling', () => {
    beforeEach(() => {
      service.start()
    })

    it('should accept new connection', () => {
      const connectionId = service.handleConnection(mockWs, '127.0.0.1', 'TestAgent', 'user123')

      expect(connectionId).toMatch(/^test-uuid-\d+$/)
      expect(service.getConnectionCount()).toBe(1)
    })

    it('should send connection established message', () => {
      service.handleConnection(mockWs, '127.0.0.1')

      expect(mockWs.send).toHaveBeenCalled()
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentMessage.type).toBe('connection_established')
    })

    it('should track connection by IP', () => {
      service.handleConnection(mockWs, '192.168.1.1')
      const ws2 = createMockWs()
      service.handleConnection(ws2, '192.168.1.1')

      const connections = service.getConnections()
      const ipConnections = connections.filter(c => c.clientIp === '192.168.1.1')
      expect(ipConnections.length).toBe(2)
    })

    it('should reject when max connections per IP reached', () => {
      // Create 5 connections from same IP
      for (let i = 0; i < 5; i++) {
        const ws = createMockWs()
        service.handleConnection(ws, '192.168.1.1')
      }

      // 6th should be rejected
      const ws6 = createMockWs()
      const connectionId = service.handleConnection(ws6, '192.168.1.1')

      expect(connectionId).toBe('')
      expect(ws6.close).toHaveBeenCalledWith(1013, 'Too many connections from this IP')
    })

    it('should handle connection close', () => {
      const connectionId = service.handleConnection(mockWs, '127.0.0.1')
      expect(service.isClientConnected(connectionId)).toBe(true)

      // Simulate close event
      mockWs.emit('close', 1000, Buffer.from('Normal closure'))

      expect(service.isClientConnected(connectionId)).toBe(false)
      expect(service.getConnectionCount()).toBe(0)
    })

    it('should handle connection error', () => {
      // Add error listener to prevent unhandled error
      const errorHandler = jest.fn()
      service.on('error', errorHandler)

      service.handleConnection(mockWs, '127.0.0.1')

      mockWs.emit('error', new Error('Connection error'))

      const metrics = service.getMetrics()
      expect(metrics.errorCount).toBe(1)
      expect(errorHandler).toHaveBeenCalled()
    })

    it('should update metrics on connection', () => {
      service.handleConnection(mockWs, '127.0.0.1')

      const metrics = service.getMetrics()
      expect(metrics.totalConnections).toBe(1)
    })
  })

  describe('Message Handling', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs, '127.0.0.1')
    })

    it('should handle ping message', () => {
      mockWs.send.mockClear()
      mockWs.emit('message', JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }))

      expect(mockWs.send).toHaveBeenCalled()
      const response = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(response.type).toBe('heartbeat')
    })

    it('should handle subscribe message', () => {
      const healthResult = createMockHealthResult()
      service.updateHealthStatus(healthResult)
      mockWs.send.mockClear()

      mockWs.emit('message', JSON.stringify({
        type: 'subscribe',
        services: ['postgresql'],
        timestamp: new Date().toISOString()
      }))

      expect(mockWs.send).toHaveBeenCalled()
    })

    it('should handle unsubscribe message', () => {
      mockWs.emit('message', JSON.stringify({
        type: 'subscribe',
        services: ['postgresql', 'valkey'],
        timestamp: new Date().toISOString()
      }))

      mockWs.emit('message', JSON.stringify({
        type: 'unsubscribe',
        services: ['postgresql'],
        timestamp: new Date().toISOString()
      }))

      const connections = service.getConnections()
      expect(connections[0].subscribedServices.has('postgresql')).toBe(false)
      expect(connections[0].subscribedServices.has('valkey')).toBe(true)
    })

    it('should handle request_status message', () => {
      const healthResult = createMockHealthResult()
      service.updateHealthStatus(healthResult)
      mockWs.send.mockClear()

      mockWs.emit('message', JSON.stringify({
        type: 'request_status',
        timestamp: new Date().toISOString()
      }))

      expect(mockWs.send).toHaveBeenCalled()
      const response = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(response.type).toBe('initial_status')
    })

    it('should handle invalid JSON gracefully', () => {
      mockWs.emit('message', 'not valid json')

      const metrics = service.getMetrics()
      expect(metrics.errorCount).toBe(1)
    })
  })

  describe('Health Updates', () => {
    beforeEach(() => {
      service.start()
    })

    it('should broadcast health updates to all connections', () => {
      service.handleConnection(mockWs, '127.0.0.1')
      const ws2 = createMockWs()
      service.handleConnection(ws2, '127.0.0.2')

      mockWs.send.mockClear()
      ws2.send.mockClear()

      const healthResult = createMockHealthResult()
      service.broadcastHealthUpdate(healthResult)

      expect(mockWs.send).toHaveBeenCalled()
      expect(ws2.send).toHaveBeenCalled()
    })

    it('should detect changed services', () => {
      // Set explicit system time for consistent behavior across test runs
      const baseTime = new Date('2026-02-06T12:00:00Z').getTime()
      jest.setSystemTime(baseTime)

      service.handleConnection(mockWs, '127.0.0.1')

      const healthResult1 = createMockHealthResult('healthy')
      service.updateHealthStatus(healthResult1)
      mockWs.send.mockClear()

      // Advance time past throttle interval (100ms in test config)
      jest.setSystemTime(baseTime + 200)
      jest.advanceTimersByTime(200)

      // Change status
      const healthResult2 = createMockHealthResult('unhealthy')
      service.updateHealthStatus(healthResult2)

      expect(mockWs.send).toHaveBeenCalled()
      const message = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(message.type).toBe('health_update')
      expect(message.payload.changedServices.length).toBeGreaterThan(0)
    })
  })

  describe('Heartbeat', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs, '127.0.0.1')
      mockWs.send.mockClear()
    })

    it('should send heartbeat at configured interval', () => {
      jest.advanceTimersByTime(1000) // heartbeatInterval

      expect(mockWs.send).toHaveBeenCalled()
      const message = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(message.type).toBe('heartbeat')
    })

    it('should send ping with heartbeat', () => {
      jest.advanceTimersByTime(1000)

      expect(mockWs.ping).toHaveBeenCalled()
    })

    it('should track missed heartbeats', () => {
      mockWs.readyState = 0 // Not OPEN

      jest.advanceTimersByTime(1000)

      const connections = service.getConnections()
      expect(connections[0].missedHeartbeats).toBe(1)
    })

    it('should disconnect after max missed heartbeats', () => {
      mockWs.readyState = 0 // Not OPEN

      // Miss 3 heartbeats
      jest.advanceTimersByTime(3000)

      expect(mockWs.terminate).toHaveBeenCalled()
    })

    it('should reset missed heartbeats on pong', () => {
      mockWs.readyState = 0
      jest.advanceTimersByTime(1000)

      mockWs.readyState = 1 // OPEN
      mockWs.emit('pong')

      const connections = service.getConnections()
      expect(connections[0].missedHeartbeats).toBe(0)
    })
  })

  describe('Client Management', () => {
    let connectionId: string

    beforeEach(() => {
      service.start()
      connectionId = service.handleConnection(mockWs, '127.0.0.1')
    })

    it('should check if client is connected', () => {
      expect(service.isClientConnected(connectionId)).toBe(true)
      expect(service.isClientConnected('nonexistent')).toBe(false)
    })

    it('should disconnect specific client', () => {
      service.disconnectClient(connectionId, 'Test reason')

      expect(mockWs.send).toHaveBeenCalled()
      const calls = mockWs.send.mock.calls
      const lastCall = calls[calls.length - 1]
      const message = JSON.parse(lastCall[0])
      expect(message.type).toBe('error')
      expect(message.payload.code).toBe('DISCONNECTED')
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Test reason')
    })

    it('should get all connections', () => {
      const connections = service.getConnections()

      expect(connections.length).toBe(1)
      expect(connections[0].id).toBe(connectionId)
      expect(connections[0].clientIp).toBe('127.0.0.1')
    })
  })

  describe('Graceful Shutdown', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs, '127.0.0.1')
    })

    it('should close all connections on stop', async () => {
      const stopPromise = service.stop()
      jest.advanceTimersByTime(100)
      await stopPromise

      expect(mockWs.close).toHaveBeenCalledWith(1001, 'Server shutdown')
    })
  })

  describe('Singleton Functions', () => {
    afterEach(async () => {
      await destroyStatusWebSocketService()
    })

    it('should get or create singleton instance', () => {
      const instance1 = getStatusWebSocketService()
      const instance2 = getStatusWebSocketService()

      expect(instance1).toBe(instance2)
    })

    it('should destroy singleton instance', async () => {
      const instance = getStatusWebSocketService()
      await destroyStatusWebSocketService()

      // Getting again should create new instance
      const newInstance = getStatusWebSocketService()
      expect(newInstance).not.toBe(instance)
      await destroyStatusWebSocketService()
    })
  })
})
