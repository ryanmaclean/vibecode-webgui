import type { VectorConnectionPool } from '@/lib/db/vector-connection-pool'

describe('ConnectionPoolAlertService dynamic loading', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    jest.useFakeTimers()
    ;(globalThis as any).window = undefined
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    if (originalWindow !== undefined) {
      ;(globalThis as any).window = originalWindow
    } else {
      delete (globalThis as any).window
    }
  })

  test('warms vector connection pool on the server', async () => {
    const getPool = jest.fn<() => VectorConnectionPool | null, []>()
    const createPool = jest.fn()
    const getMetrics = jest.fn(() => ({
      poolSize: 10,
      activeConnections: 2,
      availableConnections: 8,
      avgAcquireTime: 50,
      totalTimeouts: 0,
      waitingClients: 0,
    }))

    const mockPool: Partial<VectorConnectionPool> = {
      getMetrics,
    }

    getPool.mockReturnValue(mockPool as VectorConnectionPool)

    await jest.isolateModulesAsync(async () => {
      const module = await import('@/lib/db/connection-pool-alerts')
      module.__setVectorConnectionPoolModule({
        VectorConnectionPoolFactory: {
          getPool,
          createPool,
        },
      } as unknown as typeof import('@/lib/db/vector-connection-pool'))

      const service = module.default.getInstance()
      service.startMonitoring(10)

      expect(getPool).toHaveBeenCalledTimes(1)
      expect(createPool).not.toHaveBeenCalled()
      expect(getMetrics).toHaveBeenCalledTimes(1)

      service.stopMonitoring()
      module.__resetVectorConnectionPoolModule()
    })
  })

  test('gracefully handles missing vector pool module', async () => {
    await jest.isolateModulesAsync(async () => {
      const module = await import('@/lib/db/connection-pool-alerts')
      module.__resetVectorConnectionPoolModule()

      const service = module.default.getInstance()
      expect(() => service.startMonitoring(10)).not.toThrow()

      jest.advanceTimersByTime(50)
      expect(service.getActiveAlerts()).toHaveLength(0)

      service.stopMonitoring()
    })
  })
})
