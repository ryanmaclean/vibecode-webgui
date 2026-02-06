/**
 * Unit Tests for Unified Health Service
 *
 * Tests health check functionality for all 5 services:
 * - SSH (Dropbear)
 * - PostgreSQL
 * - Valkey/Redis
 * - OpenVSCode
 * - Docker
 *
 * Target coverage: 80%+
 */

import { jest } from '@jest/globals'
import * as net from 'net'
import * as http from 'http'

// Mock dependencies before imports
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn()
  }
}))

jest.mock('@/lib/cache/valkey-client', () => ({
  cache: {
    healthCheck: jest.fn()
  }
}))

jest.mock('@/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn()
  }
}))

jest.mock('dd-trace', () => ({
  default: {
    startSpan: jest.fn(() => ({
      setTag: jest.fn(),
      finish: jest.fn()
    }))
  }
}))

// Mock net module
const mockSocket = {
  connect: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
  write: jest.fn()
}

jest.mock('net', () => ({
  Socket: jest.fn(() => mockSocket)
}))

// Mock http module
const mockRequest = {
  on: jest.fn(),
  end: jest.fn(),
  destroy: jest.fn()
}

jest.mock('http', () => ({
  request: jest.fn(() => mockRequest)
}))

import {
  checkSSHHealth,
  checkPostgreSQLHealth,
  checkValkeyHealth,
  checkOpenVSCodeHealth,
  checkDockerHealth,
  runAllHealthChecks,
  getCachedHealthChecks,
  invalidateHealthCache,
  getServiceHealth,
  unifiedHealthService
} from '@/lib/health/unified-health-service'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache/valkey-client'
import { metrics } from '@/lib/server-monitoring'

describe('Unified Health Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    invalidateHealthCache()

    // Reset mock socket
    mockSocket.connect.mockReset()
    mockSocket.on.mockReset()
    mockSocket.destroy.mockReset()
    mockSocket.write.mockReset()

    // Reset mock request
    mockRequest.on.mockReset()
    mockRequest.end.mockReset()
    mockRequest.destroy.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('checkSSHHealth', () => {
    it('should return healthy status when TCP connection succeeds', async () => {
      // Simulate successful connection
      mockSocket.connect.mockImplementation((port: number, host: string, cb: () => void) => {
        setTimeout(() => cb(), 10)
      })
      mockSocket.on.mockImplementation((event: string, cb: (err?: Error) => void) => {
        // No error event fired
        return mockSocket
      })

      const resultPromise = checkSSHHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('ssh')
      expect(result.status).toBe('healthy')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(result.lastChecked).toBeDefined()
      expect(metrics.increment).toHaveBeenCalledWith('health.check.ssh', expect.any(Object))
    })

    it('should return unhealthy status when TCP connection fails', async () => {
      const connectionError = new Error('Connection refused')

      mockSocket.connect.mockImplementation(() => {})
      mockSocket.on.mockImplementation((event: string, cb: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => cb(connectionError), 10)
        }
        return mockSocket
      })

      const resultPromise = checkSSHHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('ssh')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('Connection refused')
    })

    it('should return unhealthy status on timeout', async () => {
      mockSocket.connect.mockImplementation(() => {})
      mockSocket.on.mockImplementation(() => mockSocket)

      const resultPromise = checkSSHHealth()
      jest.advanceTimersByTime(4000) // Exceed 3s timeout
      const result = await resultPromise

      expect(result.name).toBe('ssh')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toContain('timeout')
    })
  })

  describe('checkPostgreSQLHealth', () => {
    it('should return healthy status when query succeeds', async () => {
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])

      const result = await checkPostgreSQLHealth()

      expect(result.name).toBe('postgresql')
      expect(result.status).toBe('healthy')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(result.details?.query).toBe('SELECT 1')
      expect(metrics.increment).toHaveBeenCalledWith('health.check.postgresql', expect.objectContaining({
        status: 'healthy'
      }))
    })

    it('should return unhealthy status when query fails', async () => {
      const dbError = new Error('Connection lost')
      ;(prisma.$queryRaw as jest.Mock).mockRejectedValue(dbError)

      const result = await checkPostgreSQLHealth()

      expect(result.name).toBe('postgresql')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('Connection lost')
      expect(metrics.increment).toHaveBeenCalledWith('health.check.postgresql', expect.objectContaining({
        status: 'unhealthy'
      }))
    })
  })

  describe('checkValkeyHealth', () => {
    it('should return healthy status when PING succeeds', async () => {
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(true)

      const result = await checkValkeyHealth()

      expect(result.name).toBe('valkey')
      expect(result.status).toBe('healthy')
      expect(result.details?.command).toBe('PING')
      expect(metrics.increment).toHaveBeenCalledWith('health.check.valkey', expect.objectContaining({
        status: 'healthy'
      }))
    })

    it('should return unhealthy status when PING returns false', async () => {
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(false)

      const result = await checkValkeyHealth()

      expect(result.name).toBe('valkey')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('PING failed')
    })

    it('should return unhealthy status when health check throws', async () => {
      ;(cache.healthCheck as jest.Mock).mockRejectedValue(new Error('Redis connection error'))

      const result = await checkValkeyHealth()

      expect(result.name).toBe('valkey')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('Redis connection error')
    })
  })

  describe('checkOpenVSCodeHealth', () => {
    it('should return healthy status when HTTP health check succeeds', async () => {
      const mockResponse = {
        statusCode: 200,
        resume: jest.fn()
      }

      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 10)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)

      const resultPromise = checkOpenVSCodeHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('openvscode')
      expect(result.status).toBe('healthy')
      expect(result.details?.checkType).toBeDefined()
    })

    it('should return unhealthy status on HTTP error', async () => {
      ;(http.request as jest.Mock).mockImplementation(() => {
        return mockRequest
      })
      mockRequest.on.mockImplementation((event: string, cb: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('ECONNREFUSED')), 10)
        }
        return mockRequest
      })

      const resultPromise = checkOpenVSCodeHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('openvscode')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('ECONNREFUSED')
    })

    it('should return unhealthy status on non-2xx response', async () => {
      const mockResponse = {
        statusCode: 500,
        resume: jest.fn()
      }

      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 10)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)

      const resultPromise = checkOpenVSCodeHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('openvscode')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toContain('HTTP 500')
    })
  })

  describe('checkDockerHealth', () => {
    it('should return healthy status when Docker API responds', async () => {
      const mockResponse = {
        statusCode: 200,
        resume: jest.fn()
      }

      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 10)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)

      const resultPromise = checkDockerHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('docker')
      expect(result.status).toBe('healthy')
      expect(result.details?.endpoint).toBe('/info')
    })

    it('should return unhealthy status when Docker API fails', async () => {
      ;(http.request as jest.Mock).mockImplementation(() => mockRequest)
      mockRequest.on.mockImplementation((event: string, cb: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('Docker daemon not running')), 10)
        }
        return mockRequest
      })

      const resultPromise = checkDockerHealth()
      jest.advanceTimersByTime(50)
      const result = await resultPromise

      expect(result.name).toBe('docker')
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('Docker daemon not running')
    })
  })

  describe('runAllHealthChecks', () => {
    beforeEach(() => {
      // Setup all mocks for successful checks
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(true)

      // Mock TCP connections (SSH)
      mockSocket.connect.mockImplementation((port: number, host: string, cb: () => void) => {
        setTimeout(() => cb(), 5)
      })
      mockSocket.on.mockReturnValue(mockSocket)

      // Mock HTTP requests (OpenVSCode, Docker)
      const mockResponse = { statusCode: 200, resume: jest.fn() }
      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 5)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)
    })

    it('should run all health checks in parallel', async () => {
      const resultPromise = runAllHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.services).toHaveLength(5)
      expect(result.services.map(s => s.name)).toEqual(
        expect.arrayContaining(['ssh', 'postgresql', 'valkey', 'openvscode', 'docker'])
      )
    })

    it('should calculate aggregated status as healthy when all pass', async () => {
      const resultPromise = runAllHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.status).toBe('healthy')
      expect(result.summary.healthy).toBe(5)
      expect(result.summary.unhealthy).toBe(0)
    })

    it('should calculate aggregated status as degraded when some fail', async () => {
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(false)

      const resultPromise = runAllHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.status).toBe('degraded')
      expect(result.summary.unhealthy).toBeGreaterThan(0)
      expect(result.summary.healthy).toBeGreaterThan(0)
    })

    it('should calculate aggregated status as unhealthy when all fail', async () => {
      ;(prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB down'))
      ;(cache.healthCheck as jest.Mock).mockRejectedValue(new Error('Redis down'))

      // Mock TCP connections (SSH) to fail
      mockSocket.connect.mockImplementation(() => {})
      mockSocket.on.mockImplementation((event: string, cb: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('Connection failed')), 5)
        }
        return mockSocket
      })

      // Mock HTTP requests (OpenVSCode, Docker) to fail
      ;(http.request as jest.Mock).mockImplementation(() => mockRequest)
      mockRequest.on.mockImplementation((event: string, cb: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('Service down')), 5)
        }
        return mockRequest
      })

      const resultPromise = runAllHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.status).toBe('unhealthy')
      expect(result.summary.unhealthy).toBe(5)
    })

    it('should track total check time', async () => {
      const resultPromise = runAllHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.totalCheckTimeMs).toBeGreaterThanOrEqual(0)
      expect(result.timestamp).toBeDefined()
    })

    it('should report metrics for each service', async () => {
      const resultPromise = runAllHealthChecks()
      jest.advanceTimersByTime(100)
      await resultPromise

      expect(metrics.histogram).toHaveBeenCalledWith(
        'health.check.total_duration',
        expect.any(Number),
        expect.any(Object)
      )
      expect(metrics.gauge).toHaveBeenCalledWith(
        'health.services.healthy',
        expect.any(Number),
        expect.any(Object)
      )
    })
  })

  describe('getCachedHealthChecks', () => {
    beforeEach(() => {
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(true)
      mockSocket.connect.mockImplementation((port: number, host: string, cb: () => void) => {
        setTimeout(() => cb(), 5)
      })
      mockSocket.on.mockReturnValue(mockSocket)
      const mockResponse = { statusCode: 200, resume: jest.fn() }
      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 5)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)
    })

    it('should return fresh results on first call', async () => {
      const resultPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.fromCache).toBe(false)
      expect(result.response).toBeDefined()
      expect(result.ttlMs).toBe(5000)
    })

    it('should return cached results on subsequent calls within TTL', async () => {
      // First call
      const firstPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(100)
      await firstPromise

      // Clear mocks to verify no new calls
      jest.clearAllMocks()

      // Second call within TTL
      jest.advanceTimersByTime(1000) // 1 second later, still within 5s TTL
      const secondPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(10)
      const result = await secondPromise

      expect(result.fromCache).toBe(true)
      // Should not have made new health check calls
      expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })

    it('should refresh cache after TTL expires', async () => {
      // First call
      const firstPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(100)
      await firstPromise

      // Clear mocks
      jest.clearAllMocks()

      // Wait for TTL to expire (5 seconds)
      jest.advanceTimersByTime(6000)

      // Second call after TTL
      const secondPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await secondPromise

      expect(result.fromCache).toBe(false)
      expect(prisma.$queryRaw).toHaveBeenCalled()
    })
  })

  describe('invalidateHealthCache', () => {
    beforeEach(() => {
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(true)
      mockSocket.connect.mockImplementation((port: number, host: string, cb: () => void) => {
        setTimeout(() => cb(), 5)
      })
      mockSocket.on.mockReturnValue(mockSocket)
      const mockResponse = { statusCode: 200, resume: jest.fn() }
      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 5)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)
    })

    it('should force fresh check after invalidation', async () => {
      // First call
      const firstPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(100)
      await firstPromise

      // Invalidate cache
      invalidateHealthCache()

      // Clear mocks
      jest.clearAllMocks()

      // Second call should be fresh
      const secondPromise = getCachedHealthChecks()
      jest.advanceTimersByTime(100)
      const result = await secondPromise

      expect(result.fromCache).toBe(false)
      expect(prisma.$queryRaw).toHaveBeenCalled()
    })
  })

  describe('getServiceHealth', () => {
    beforeEach(() => {
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])
      ;(cache.healthCheck as jest.Mock).mockResolvedValue(true)
      mockSocket.connect.mockImplementation((port: number, host: string, cb: () => void) => {
        setTimeout(() => cb(), 5)
      })
      mockSocket.on.mockReturnValue(mockSocket)
      const mockResponse = { statusCode: 200, resume: jest.fn() }
      ;(http.request as jest.Mock).mockImplementation((options: any, callback: (res: any) => void) => {
        setTimeout(() => callback(mockResponse), 5)
        return mockRequest
      })
      mockRequest.on.mockReturnValue(mockRequest)
    })

    it('should return health for ssh service', async () => {
      const resultPromise = getServiceHealth('ssh')
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.name).toBe('ssh')
      expect(result.status).toBeDefined()
    })

    it('should return health for postgresql service', async () => {
      const result = await getServiceHealth('postgresql')
      expect(result.name).toBe('postgresql')
      expect(result.status).toBe('healthy')
    })

    it('should return health for valkey service', async () => {
      const result = await getServiceHealth('valkey')
      expect(result.name).toBe('valkey')
      expect(result.status).toBe('healthy')
    })

    it('should return health for openvscode service', async () => {
      const resultPromise = getServiceHealth('openvscode')
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.name).toBe('openvscode')
      expect(result.status).toBeDefined()
    })

    it('should return health for docker service', async () => {
      const resultPromise = getServiceHealth('docker')
      jest.advanceTimersByTime(100)
      const result = await resultPromise

      expect(result.name).toBe('docker')
      expect(result.status).toBeDefined()
    })

    it('should throw error for unknown service', async () => {
      await expect(getServiceHealth('unknown' as any)).rejects.toThrow('Unknown service: unknown')
    })
  })

  describe('unifiedHealthService singleton', () => {
    it('should export all health check functions', () => {
      expect(unifiedHealthService.checkSSHHealth).toBeDefined()
      expect(unifiedHealthService.checkPostgreSQLHealth).toBeDefined()
      expect(unifiedHealthService.checkValkeyHealth).toBeDefined()
      expect(unifiedHealthService.checkOpenVSCodeHealth).toBeDefined()
      expect(unifiedHealthService.checkDockerHealth).toBeDefined()
      expect(unifiedHealthService.runAllHealthChecks).toBeDefined()
      expect(unifiedHealthService.getCachedHealthChecks).toBeDefined()
      expect(unifiedHealthService.invalidateHealthCache).toBeDefined()
      expect(unifiedHealthService.getServiceHealth).toBeDefined()
    })
  })
})
