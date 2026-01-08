/**
 * Unit Tests for Datadog Integration
 * Tests the DatadogIntegration class and its methods
 */

import { jest } from '@jest/globals'

// Mock dgram module before any imports
const mockSocket = {
  send: jest.fn(),
  close: jest.fn()
}

const mockCreateSocket = jest.fn(() => mockSocket)

jest.mock('dgram', () => ({
  default: {
    createSocket: mockCreateSocket
  },
  createSocket: mockCreateSocket
}))

describe('DatadogIntegration', () => {
  let DatadogIntegration: any
  let datadogIntegration: any
  let DatadogIntegration: any

  beforeEach(async () => {
    jest.clearAllMocks()
<<<<<<< HEAD
    jest.resetModules() // Clear module cache

    // Create mock socket
    mockSocket = {
      send: jest.fn((buffer, port, host, callback) => {
        // Call the callback immediately to simulate successful send
        if (callback) callback(null)
      }),
      close: jest.fn()
    }

    // Re-mock dgram module after resetModules
    jest.doMock('dgram', () => ({
      createSocket: jest.fn(() => mockSocket)
    }))

    // Import the class after mocking
    const module = await import('@/lib/monitoring/datadog-integration')
=======
    mockSocket.send.mockClear()
    mockSocket.close.mockClear()
    mockCreateSocket.mockClear()
    mockCreateSocket.mockReturnValue(mockSocket)

    // Import the class after resetting mocks
    const module = require('@/lib/monitoring/datadog-integration')
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    DatadogIntegration = module.DatadogIntegration
    datadogIntegration = new DatadogIntegration()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(datadogIntegration).toBeDefined()
      expect(datadogIntegration.environment).toBe('test') // Jest sets NODE_ENV to test
      expect(datadogIntegration.service).toBe('vibecode-webgui')
    })

    it('should initialize with custom configuration', () => {
      const customConfig = {
        host: 'custom-host',
        port: 9999,
        prefix: 'custom.',
        globalTags: ['custom:tag']
      }

      const customIntegration = new DatadogIntegration(customConfig)

      expect(customIntegration).toBeDefined()
    })
  })

  describe('recordEmbeddingMetrics', () => {
    it('should send embedding metrics successfully', () => {
      const metrics = {
        operation: 'generate' as const,
        duration: 150,
        tokens: 1000,
        cost: 0.001,
        success: true,
        model: 'text-embedding-ada-002',
        inputLength: 500
      }

      datadogIntegration.recordEmbeddingMetrics(metrics)

      // Verify that send was called multiple times for different metrics
      expect(mockSocket.send).toHaveBeenCalledTimes(8) // duration, timing, tokens, cost, input_length, total, success, operation rate
    })

    it('should include error type in tags when provided', () => {
      const metrics = {
        operation: 'generate' as const,
        duration: 150,
        tokens: 1000,
        cost: 0.001,
        success: false,
        errorType: 'rate_limit',
        model: 'text-embedding-ada-002',
        inputLength: 500
      }

      datadogIntegration.recordEmbeddingMetrics(metrics)

      expect(mockSocket.send).toHaveBeenCalled()
      
      // Check that error metrics were sent
      const calls = mockSocket.send.mock.calls
      const errorCall = calls.find(call => 
        call[0].toString().includes('embedding.requests.errors')
      )
      expect(errorCall).toBeDefined()
    })
  })

  describe('recordPoolMetrics', () => {
    it('should send pool metrics successfully', () => {
      const metrics = {
        poolName: 'test-pool',
        activeConnections: 5,
        idleConnections: 10,
        totalConnections: 15,
        waitingRequests: 2,
        utilization: 0.33
      }

      datadogIntegration.recordPoolMetrics(metrics)

      // Verify that send was called for each metric
      expect(mockSocket.send).toHaveBeenCalledTimes(5) // active, idle, total, waiting, utilization
    })

    it('should send alert event when utilization is high', () => {
      const metrics = {
        poolName: 'test-pool',
        activeConnections: 8,
        idleConnections: 2,
        totalConnections: 10,
        waitingRequests: 5,
        utilization: 0.85 // Above 0.8 threshold
      }

      datadogIntegration.recordPoolMetrics(metrics)

      // Should send 5 gauge metrics + 1 event
      expect(mockSocket.send).toHaveBeenCalledTimes(6)
      
      // Check that event was sent
      const calls = mockSocket.send.mock.calls
      const eventCall = calls.find(call => 
        call[0].toString().includes('_e{')
      )
      expect(eventCall).toBeDefined()
    })
  })

  describe('recordDatabaseMetrics', () => {
    it('should send database metrics successfully', () => {
      const metrics = {
        operation: 'query' as const,
        duration: 25,
        table: 'users',
        success: true
      }

      datadogIntegration.recordDatabaseMetrics(metrics)

      // Should send 3 metrics: duration histogram, timing, total counter, success counter
      expect(mockSocket.send).toHaveBeenCalledTimes(4)
    })

    it('should include error type in tags when provided', () => {
      const metrics = {
        operation: 'insert' as const,
        duration: 50,
        table: 'orders',
        success: false,
        errorType: 'constraint_violation'
      }

      datadogIntegration.recordDatabaseMetrics(metrics)

      expect(mockSocket.send).toHaveBeenCalled()
      
      // Check that error metrics were sent
      const calls = mockSocket.send.mock.calls
      const errorCall = calls.find(call => 
        call[0].toString().includes('db.query.errors')
      )
      expect(errorCall).toBeDefined()
    })
  })

  describe('sendEvent', () => {
    it('should send event successfully', () => {
      const event = {
        title: 'Test Event',
        text: 'This is a test event',
        alertType: 'info' as const,
        tags: ['test:true']
      }

      datadogIntegration.sendEvent(event)

      expect(mockSocket.send).toHaveBeenCalledTimes(1)
      
      const call = mockSocket.send.mock.calls[0]
      const message = call[0].toString()
      expect(message).toContain('_e{')
      expect(message).toContain('Test Event')
      expect(message).toContain('This is a test event')
    })

    it('should use default values when not provided', () => {
      const event = {
        title: 'Simple Event',
        text: 'Simple text'
      }

      datadogIntegration.sendEvent(event)

      expect(mockSocket.send).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendUsageAlert', () => {
    it('should send usage alert successfully', () => {
      const alert = {
        type: 'token_limit' as const,
        threshold: 10000,
        current: 9500,
        message: 'Approaching token limit'
      }

      datadogIntegration.sendUsageAlert(alert)

      // Should send 1 event + 3 metrics (alerts counter, current gauge, threshold gauge)
      expect(mockSocket.send).toHaveBeenCalledTimes(4)
    })

    it('should use error alert type for error_rate and latency_high', () => {
      const alert = {
        type: 'error_rate' as const,
        threshold: 0.05,
        current: 0.08,
        message: 'High error rate detected'
      }

      datadogIntegration.sendUsageAlert(alert)

      expect(mockSocket.send).toHaveBeenCalledTimes(4)
      
      // Check that event was sent with error alert type
      const calls = mockSocket.send.mock.calls
      const eventCall = calls.find(call => 
        call[0].toString().includes('_e{')
      )
      expect(eventCall).toBeDefined()
    })
  })

  describe('sendHealthCheck', () => {
    it('should send healthy health check', () => {
      datadogIntegration.sendHealthCheck('test-service', true, 'Service is healthy')

      // Should send 2 metrics: gauge and counter
      expect(mockSocket.send).toHaveBeenCalledTimes(2)
    })

    it('should send unhealthy health check with event', () => {
      datadogIntegration.sendHealthCheck('test-service', false, 'Service is down')

      // Should send 2 metrics + 1 event
      expect(mockSocket.send).toHaveBeenCalledTimes(3)
      
      // Check that event was sent
      const calls = mockSocket.send.mock.calls
      const eventCall = calls.find(call => 
        call[0].toString().includes('_e{')
      )
      expect(eventCall).toBeDefined()
    })
  })

  describe('recordPoolAlert', () => {
    it('should record pool alert metrics', () => {
      const alert = {
        poolKey: 'test-pool',
        severity: 'warning' as const,
        utilizationPercent: 85,
        availableConnections: 2,
        activeConnections: 8,
        totalConnections: 10
      }

      datadogIntegration.recordPoolAlert(alert)

      // Should send 5 gauge metrics + 1 counter + 1 severity counter
      expect(mockSocket.send).toHaveBeenCalledTimes(6)
    })

    it('should send event for critical alerts', () => {
      const alert = {
        poolKey: 'test-pool',
        severity: 'critical' as const,
        utilizationPercent: 95,
        availableConnections: 1,
        activeConnections: 9,
        totalConnections: 10
      }

      datadogIntegration.recordPoolAlert(alert)

      // Should send 6 metrics + 1 event
      expect(mockSocket.send).toHaveBeenCalledTimes(7)
      
      // Check that event was sent
      const calls = mockSocket.send.mock.calls
      const eventCall = calls.find(call => 
        call[0].toString().includes('_e{')
      )
      expect(eventCall).toBeDefined()
    })
  })

  describe('recordPoolStatus', () => {
    it('should record pool status metrics', () => {
      const poolStatus = {
        pools: [
          {
            key: 'pool1',
            activeConnections: 3,
            totalConnections: 10,
            availableConnections: 7,
            pendingConnections: 0,
            statistics: {
              totalQueries: 1000,
              averageQueryTime: 25,
              errors: 5
            }
          }
        ],
        totalPools: 1,
        healthStatus: 'healthy'
      }

      datadogIntegration.recordPoolStatus(poolStatus)

      // Should send: 2 overall metrics + 6 per-pool metrics + 3 statistics metrics = 10 total
      expect(mockSocket.send).toHaveBeenCalledTimes(10)
    })
  })

  describe('close', () => {
    it('should close the StatsD connection', () => {
      datadogIntegration.close()

      expect(mockSocket.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('getDashboardConfig', () => {
    it('should return dashboard configuration', () => {
      const config = datadogIntegration.getDashboardConfig()

      expect(config).toBeDefined()
      expect(config.title).toBe('Vector Database & Embedding Operations')
      expect(config.description).toContain('Comprehensive monitoring')
      expect(config.template_variables).toHaveLength(2)
      expect(config.widgets).toHaveLength(7)
    })

    it('should include environment and service in template variables', () => {
      const config = datadogIntegration.getDashboardConfig()

      const envVar = config.template_variables.find((v: any) => v.name === 'env')
      const serviceVar = config.template_variables.find((v: any) => v.name === 'service')

      expect(envVar).toBeDefined()
      expect(envVar.default).toBe('test') // Jest sets NODE_ENV to test
      expect(serviceVar).toBeDefined()
      expect(serviceVar.default).toBe('vibecode-webgui')
    })
  })
})
