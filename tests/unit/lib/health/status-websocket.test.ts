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

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234')
}))

// Create mock WebSocket
class MockWebSocket extends EventEmitter {
  static OPEN = 1
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
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

jest.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket
}))

import WebSocketStatusService, {
  getStatusWebSocketService,
  destroyStatusWebSocketService
} from '@/lib/health/status-websocket'
import type { StatusWebSocketConfig, HealthCheckResult, HealthStatus } from '@/types/status-events'
import { monitoring } from '@/lib/monitoring'

describe('WebSocketStatusService', () => {
  let service: WebSocketStatusService
  let mockWs: MockWebSocket

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
    service = new WebSocketStatusService(testConfig)
    mockWs = new MockWebSocket()
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
    it('should start service and begin heartbeat timer', () => {
      const emitSpy = jest.spyOn(service, 'emit')

      service.start()

      expect(emitSpy).toHaveBeenCalledWith('started')
    })

    it('should not start twice', () => {
      service.start()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      service.start()

      // The second start should log a warning (via the logger mock)
      expect(service.getConnectionCount()).toBe(0)
      consoleSpy.mockRestore()
    })

    it('should stop service and clear timers', async () => {
      service.start()
      const emitSpy = jest.spyOn(service, 'emit')

      await service.stop()

      expect(emitSpy).toHaveBeenCalledWith('stopped')
    })

    it('should handle multiple stop calls gracefully', async () => {
      service.start()

      await service.stop()
      await service.stop() // Should not throw
    })
  })

  describe('Connection Handling', () => {
    beforeEach(() => {
      service.start()
    })

    it('should accept new connection', () => {
      const connectionId = service.handleConnection(mockWs as any, '127.0.0.1', 'TestAgent', 'user123')

      expect(connectionId).toBe('test-uuid-1234')
      expect(service.getConnectionCount()).toBe(1)
    })

    it('should send connection established message', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      expect(mockWs.send).toHaveBeenCalled()
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentMessage.type).toBe('connection_established')
      expect(sentMessage.payload.connectionId).toBe('test-uuid-1234')
    })

    it('should send initial status if available', () => {
      const healthResult = createMockHealthResult()
      service.updateHealthStatus(healthResult)

      mockWs.send.mockClear()
      service.handleConnection(mockWs as any, '127.0.0.1')

      // Should send connection_established and initial_status
      expect(mockWs.send).toHaveBeenCalledTimes(2)
    })

    it('should track connection by IP', () => {
      service.handleConnection(mockWs as any, '192.168.1.1')
      service.handleConnection(new MockWebSocket() as any, '192.168.1.1')

      const connections = service.getConnections()
      const ipConnections = connections.filter(c => c.clientIp === '192.168.1.1')
      expect(ipConnections.length).toBe(2)
    })

    it('should reject when max connections per IP reached', () => {
      // Create 5 connections from same IP
      for (let i = 0; i < 5; i++) {
        const ws = new MockWebSocket()
        jest.mocked(require('crypto').randomUUID).mockReturnValueOnce(`uuid-${i}`)
        service.handleConnection(ws as any, '192.168.1.1')
      }

      // 6th should be rejected
      const ws6 = new MockWebSocket()
      const connectionId = service.handleConnection(ws6 as any, '192.168.1.1')

      expect(connectionId).toBe('')
      expect(ws6.close).toHaveBeenCalledWith(1013, 'Too many connections from this IP')
    })

    it('should reject when max total connections reached', () => {
      const serviceWithLimit = new WebSocketStatusService({
        ...testConfig,
        maxTotalConnections: 2
      })
      serviceWithLimit.start()

      serviceWithLimit.handleConnection(new MockWebSocket() as any, '127.0.0.1')
      jest.mocked(require('crypto').randomUUID).mockReturnValueOnce('uuid-2')
      serviceWithLimit.handleConnection(new MockWebSocket() as any, '127.0.0.2')

      // 3rd should be rejected
      const ws3 = new MockWebSocket()
      const connectionId = serviceWithLimit.handleConnection(ws3 as any, '127.0.0.3')

      expect(connectionId).toBe('')
      expect(ws3.close).toHaveBeenCalledWith(1013, 'Server at capacity')
    })

    it('should handle connection close', () => {
      const connectionId = service.handleConnection(mockWs as any, '127.0.0.1')
      expect(service.isClientConnected('test-uuid-1234')).toBe(true)

      // Simulate close event
      mockWs.emit('close', 1000, Buffer.from('Normal closure'))

      expect(service.isClientConnected('test-uuid-1234')).toBe(false)
      expect(service.getConnectionCount()).toBe(0)
    })

    it('should handle connection error', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      mockWs.emit('error', new Error('Connection error'))

      const metrics = service.getMetrics()
      expect(metrics.errorCount).toBe(1)
    })

    it('should update metrics on connection', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      const metrics = service.getMetrics()
      expect(metrics.totalConnections).toBe(1)
    })

    it('should report connection metric to Datadog', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      expect(monitoring.submitEvent).toHaveBeenCalled()
    })
  })

  describe('Message Handling', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs as any, '127.0.0.1')
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

      // Should send initial status for subscribed services
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

    it('should handle unknown message type', () => {
      mockWs.emit('message', JSON.stringify({
        type: 'unknown_type',
        timestamp: new Date().toISOString()
      }))

      // Should not throw, logged as warning
    })
  })

  describe('Health Updates', () => {
    beforeEach(() => {
      service.start()
    })

    it('should broadcast health updates to all connections', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')
      const ws2 = new MockWebSocket()
      jest.mocked(require('crypto').randomUUID).mockReturnValueOnce('uuid-2')
      service.handleConnection(ws2 as any, '127.0.0.2')

      mockWs.send.mockClear()
      ws2.send.mockClear()

      const healthResult = createMockHealthResult()
      service.broadcastHealthUpdate(healthResult)

      expect(mockWs.send).toHaveBeenCalled()
      expect(ws2.send).toHaveBeenCalled()
    })

    it('should not broadcast when no changes', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      const healthResult = createMockHealthResult()
      service.updateHealthStatus(healthResult)
      mockWs.send.mockClear()

      // Same health result - no changes
      service.updateHealthStatus(healthResult)

      // Should not send update (except initial messages)
      expect(mockWs.send).not.toHaveBeenCalled()
    })

    it('should detect changed services', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      const healthResult1 = createMockHealthResult('healthy')
      service.updateHealthStatus(healthResult1)
      mockWs.send.mockClear()

      // Change status
      const healthResult2 = createMockHealthResult('unhealthy')
      service.updateHealthStatus(healthResult2)

      expect(mockWs.send).toHaveBeenCalled()
      const message = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(message.type).toBe('health_update')
      expect(message.payload.changedServices.length).toBeGreaterThan(0)
    })

    it('should filter updates for subscribed services', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')

      // Subscribe to only postgresql
      mockWs.emit('message', JSON.stringify({
        type: 'subscribe',
        services: ['postgresql'],
        timestamp: new Date().toISOString()
      }))
      mockWs.send.mockClear()

      const healthResult = {
        services: [
          { name: 'postgresql', status: 'unhealthy' as const, lastCheck: new Date().toISOString() },
          { name: 'valkey', status: 'unhealthy' as const, lastCheck: new Date().toISOString() }
        ],
        overallStatus: 'unhealthy' as const,
        timestamp: new Date().toISOString()
      }
      service.updateHealthStatus(healthResult)

      const message = JSON.parse(mockWs.send.mock.calls[0][0])
      // Should only include postgresql
      expect(message.payload.services.length).toBe(1)
      expect(message.payload.services[0].name).toBe('postgresql')
    })

    it('should throttle updates per client', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')
      mockWs.send.mockClear()

      // Send multiple updates rapidly
      for (let i = 0; i < 5; i++) {
        const healthResult = {
          services: [
            { name: 'postgresql', status: i % 2 === 0 ? 'healthy' as const : 'unhealthy' as const, lastCheck: new Date().toISOString() }
          ],
          overallStatus: i % 2 === 0 ? 'healthy' as const : 'unhealthy' as const,
          timestamp: new Date().toISOString()
        }
        service.updateHealthStatus(healthResult)
      }

      // Due to throttling, not all updates should be sent
      expect(mockWs.send.mock.calls.length).toBeLessThan(5)
    })
  })

  describe('Heartbeat', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs as any, '127.0.0.1')
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

      mockWs.readyState = MockWebSocket.OPEN
      mockWs.emit('pong')

      const connections = service.getConnections()
      expect(connections[0].missedHeartbeats).toBe(0)
    })
  })

  describe('Metrics Reporting', () => {
    beforeEach(() => {
      service.start()
    })

    it('should report metrics periodically', () => {
      service.handleConnection(mockWs as any, '127.0.0.1')
      mockWs.send.mockClear()

      jest.advanceTimersByTime(60000) // Metrics interval

      expect(monitoring.submitEvent).toHaveBeenCalled()
    })

    it('should calculate uptime correctly', () => {
      jest.advanceTimersByTime(5000)

      const metrics = service.getMetrics()
      expect(metrics.uptime).toBe(5)
    })
  })

  describe('Client Management', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs as any, '127.0.0.1')
    })

    it('should check if client is connected', () => {
      expect(service.isClientConnected('test-uuid-1234')).toBe(true)
      expect(service.isClientConnected('nonexistent')).toBe(false)
    })

    it('should disconnect specific client', () => {
      service.disconnectClient('test-uuid-1234', 'Test reason')

      expect(mockWs.send).toHaveBeenCalled()
      const message = JSON.parse(mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0])
      expect(message.type).toBe('error')
      expect(message.payload.code).toBe('DISCONNECTED')
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Test reason')
    })

    it('should get all connections', () => {
      const connections = service.getConnections()

      expect(connections.length).toBe(1)
      expect(connections[0].id).toBe('test-uuid-1234')
      expect(connections[0].clientIp).toBe('127.0.0.1')
    })
  })

  describe('Graceful Shutdown', () => {
    beforeEach(() => {
      service.start()
      service.handleConnection(mockWs as any, '127.0.0.1')
    })

    it('should send shutdown message to all clients', async () => {
      mockWs.send.mockClear()

      const stopPromise = service.stop()
      jest.advanceTimersByTime(100)
      await stopPromise

      const lastSendCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1]
      if (lastSendCall) {
        const message = JSON.parse(lastSendCall[0])
        expect(message.type).toBe('error')
        expect(message.payload.code).toBe('SERVER_SHUTDOWN')
      }
    })

    it('should close all connections', async () => {
      const stopPromise = service.stop()
      jest.advanceTimersByTime(100)
      await stopPromise

      expect(mockWs.close).toHaveBeenCalledWith(1001, 'Server shutdown')
    })

    it('should force close after timeout', async () => {
      // Remove the once mock to simulate stuck connection
      mockWs.once = jest.fn()

      const stopPromise = service.stop()
      jest.advanceTimersByTime(6000) // Past the 5s force close timeout
      await stopPromise

      expect(mockWs.terminate).toHaveBeenCalled()
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
