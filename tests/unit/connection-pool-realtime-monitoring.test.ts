/**
 * Tests for Connection Pool Real-time Monitoring and Notifications
 */

import { renderHook, act } from '@testing-library/react'
import { useConnectionPoolWebSocket } from '@/hooks/useConnectionPoolWebSocket'
import { ConnectionPoolNotificationService } from '@/lib/monitoring/notification-service'
import ConnectionPoolAlertService from '@/lib/db/connection-pool-alerts'
import { AlertType, AlertSeverity } from '@/lib/db/connection-pool-alerts'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 10)
  }

  send(data: string) {
    // Echo back for heartbeat
    if (data.includes('heartbeat')) {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', { data }))
      }, 10)
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code: 1000 }))
  }
}

// Mock next-auth session
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', email: 'test@example.com' } },
    status: 'authenticated'
  })
}))

// Mock WebSocket globally
global.WebSocket = MockWebSocket as any

describe('Connection Pool Real-time Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useConnectionPoolWebSocket Hook', () => {
    it('should connect to WebSocket when enabled', async () => {
      const { result } = renderHook(() =>
        useConnectionPoolWebSocket({ enabled: true })
      )

      expect(result.current.connectionState).toBe('connecting')

      // Wait for connection to open
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })

      expect(result.current.connectionState).toBe('connected')
      expect(result.current.isConnected).toBe(true)
    })

    it('should not connect when disabled', () => {
      const { result } = renderHook(() =>
        useConnectionPoolWebSocket({ enabled: false })
      )

      expect(result.current.connectionState).toBe('disconnected')
      expect(result.current.isConnected).toBe(false)
    })

    it('should handle WebSocket messages', async () => {
      const { result } = renderHook(() =>
        useConnectionPoolWebSocket({ enabled: true })
      )

      // Wait for connection
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })

      // Simulate system overview message
      const mockMessage = {
        type: 'system_overview',
        data: {
          overview: { total_pools: 1, system_utilization_percent: 50 },
          capacityReports: []
        },
        timestamp: new Date().toISOString()
      }

      act(() => {
        result.current.sendMessage(mockMessage)
      })

      expect(result.current.lastMessage).toBeTruthy()
    })
  })

  describe('ConnectionPoolNotificationService', () => {
    let notificationService: ConnectionPoolNotificationService

    beforeEach(() => {
      notificationService = ConnectionPoolNotificationService.getInstance({
        email: {
          enabled: true,
          recipients: ['test@example.com']
        },
        datadog: {
          enabled: true
        },
        webhook: {
          enabled: true,
          urls: ['http://localhost:3000/webhook']
        }
      })
    })

    it('should send notifications for alerts', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const testAlert = {
        id: 'test-alert-1',
        type: AlertType.POOL_UTILIZATION,
        severity: AlertSeverity.CRITICAL,
        message: 'Test critical alert',
        timestamp: new Date(),
        acknowledged: false,
        details: {
          currentUtilization: 95,
          threshold: 90
        }
      }

      await notificationService.sendAlert(testAlert)

      // Verify that notification attempt was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Alert notification sent')
      )

      // Verify notification history
      const history = notificationService.getNotificationHistory()
      expect(history).toHaveLength(1)
      expect(history[0].alert.id).toBe('test-alert-1')

      consoleSpy.mockRestore()
    })

    it('should test notification channels', async () => {
      const testResults = await notificationService.testNotifications()

      expect(testResults).toHaveProperty('datadog')
      expect(testResults).toHaveProperty('email')
      expect(testResults).toHaveProperty('webhook')
    })

    it('should generate appropriate email templates', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const utilizationAlert = {
        id: 'utilization-test',
        type: AlertType.POOL_UTILIZATION,
        severity: AlertSeverity.WARNING,
        message: 'Pool utilization high',
        timestamp: new Date(),
        acknowledged: false
      }

      await notificationService.sendAlert(utilizationAlert)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection Pool Utilization Alert')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Alert Service Integration', () => {
    let alertService: ConnectionPoolAlertService

    beforeEach(() => {
      alertService = ConnectionPoolAlertService.getInstance()
    })

    it('should trigger notifications when alerts are added', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Add an alert (this should trigger notification)
      alertService.addAlert({
        type: AlertType.ACQUIRE_FAILURES,
        severity: AlertSeverity.CRITICAL,
        message: 'Connection acquisition failures detected'
      })

      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify notification was attempted (would be logged)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should respect alert suppression', () => {
      const initialCount = alertService.getActiveAlerts().length

      // Add same alert twice quickly
      alertService.addAlert({
        type: AlertType.POOL_UTILIZATION,
        severity: AlertSeverity.WARNING,
        message: 'Pool utilization warning'
      })

      alertService.addAlert({
        type: AlertType.POOL_UTILIZATION,
        severity: AlertSeverity.WARNING,
        message: 'Pool utilization warning'
      })

      // Should only have one alert due to suppression
      const alerts = alertService.getActiveAlerts()
      expect(alerts).toHaveLength(initialCount + 1)
    })

    it('should manage alert thresholds', () => {
      const newThresholds = {
        poolUtilization: { enabled: true, warning: 60, critical: 80 }
      }

      alertService.updateThresholds(newThresholds)

      // Verify thresholds are updated (this is internal, so we check behavior)
      const utilizationConfig = alertService.getPoolUtilizationConfig()
      expect(utilizationConfig.warningThreshold).toBe(60)
      expect(utilizationConfig.criticalThreshold).toBe(80)
    })
  })

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors gracefully', async () => {
      // Mock WebSocket that fails to connect
      class FailingWebSocket extends MockWebSocket {
        constructor(url: string) {
          super(url)
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED
            this.onerror?.(new Event('error'))
          }, 10)
        }
      }

      global.WebSocket = FailingWebSocket as any

      const { result } = renderHook(() =>
        useConnectionPoolWebSocket({ enabled: true })
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })

      expect(result.current.connectionState).toBe('error')
      expect(result.current.error).toBeTruthy()

      // Restore original mock
      global.WebSocket = MockWebSocket as any
    })

    it('should handle notification failures gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Create service with invalid webhook URL to trigger error
      const notificationService = ConnectionPoolNotificationService.getInstance({
        webhook: {
          enabled: true,
          urls: ['invalid-url']
        }
      })

      const testAlert = {
        id: 'error-test',
        type: AlertType.GENERAL,
        severity: AlertSeverity.INFO,
        message: 'Test error handling',
        timestamp: new Date(),
        acknowledged: false
      }

      await notificationService.sendAlert(testAlert)

      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})

describe('Integration Tests', () => {
  it('should integrate WebSocket monitoring with alert notifications', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    // Set up both services
    const alertService = ConnectionPoolAlertService.getInstance()
    
    // Start monitoring (which would normally trigger WebSocket updates)
    alertService.startMonitoring(100) // Short interval for testing

    // Wait for monitoring check
    await new Promise(resolve => setTimeout(resolve, 150))

    // Stop monitoring
    alertService.stopMonitoring()

    // Should have attempted to check pool metrics
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})