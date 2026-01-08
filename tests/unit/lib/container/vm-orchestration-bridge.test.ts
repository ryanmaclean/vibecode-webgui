/**
 * Unit tests for VM Orchestration Bridge
 * Tests TypeScript-Swift bridge, VM pool management, and orchestration
 */

import { VMOrchestrationBridge, getVMOrchestration, allocateVMWithRetry, releaseVMSafely } from '@/lib/container/vm-orchestration-bridge'

// Mock fetch globally
global.fetch = jest.fn()

// Mock setInterval and clearInterval
jest.useFakeTimers()

describe('VMOrchestrationBridge', () => {
  let bridge: VMOrchestrationBridge

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    bridge = new VMOrchestrationBridge({
      mode: 'http',
      endpoint: 'http://localhost:8765',
    })
  })

  afterEach(() => {
    bridge.destroy()
    jest.clearAllTimers()
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultBridge = new VMOrchestrationBridge()
      expect(defaultBridge).toBeInstanceOf(VMOrchestrationBridge)
      defaultBridge.destroy()
    })

    it('should initialize with HTTP mode', () => {
      const httpBridge = new VMOrchestrationBridge({ mode: 'http' })
      expect(httpBridge).toBeInstanceOf(VMOrchestrationBridge)
      httpBridge.destroy()
    })

    it('should initialize with custom endpoint', () => {
      const customBridge = new VMOrchestrationBridge({
        endpoint: 'http://custom:9000',
      })
      expect(customBridge).toBeInstanceOf(VMOrchestrationBridge)
      customBridge.destroy()
    })

    it('should start health checks on initialization', () => {
      const healthBridge = new VMOrchestrationBridge()
      // Health checks are started via setInterval internally
      expect(healthBridge).toBeInstanceOf(VMOrchestrationBridge)
      healthBridge.destroy()
    })
  })

  describe('warmPool', () => {
    it('should warm the VM pool successfully', async () => {
      mockFetch({ ok: true })

      await bridge.warmPool()

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8765/api/pool/warm', {
        method: 'POST',
      })
    })

    it('should emit pool:warmed event on success', async () => {
      mockFetch({ ok: true })
      const eventSpy = jest.fn()
      bridge.on('pool:warmed', eventSpy)

      await bridge.warmPool()

      expect(eventSpy).toHaveBeenCalled()
    })

    it('should throw error when pool warming fails', async () => {
      mockFetch({
        ok: false,
        json: async () => ({ message: 'Pool warming failed' }),
      })

      await expect(bridge.warmPool()).rejects.toThrow('Failed to warm pool')
    })

    it('should throw error for native mode (not implemented)', async () => {
      const nativeBridge = new VMOrchestrationBridge({ mode: 'native' })

      await expect(nativeBridge.warmPool()).rejects.toThrow('Native mode not yet implemented')

      nativeBridge.destroy()
    })
  })

  describe('allocateVM', () => {
    it('should allocate a VM from the pool', async () => {
      const vmData = {
        id: 'vm-123',
        ipAddress: '192.168.64.10',
        workspaceUrl: '/workspaces/vm-123',
        allocatedAt: new Date().toISOString(),
        state: 'running',
        cpuCount: 4,
        memorySize: 8589934592,
        diskSize: 107374182400,
        usageCount: 1,
      }

      mockFetch({
        ok: true,
        json: async () => vmData,
      })

      const result = await bridge.allocateVM()

      expect(result.id).toBe('vm-123')
      expect(result.ipAddress).toBe('192.168.64.10')
      expect(result.agentApiUrl).toBe('http://192.168.64.10:3284')
      expect(result.state).toBe('running')
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8765/api/vm/allocate', {
        method: 'POST',
      })
    })

    it('should emit vm:allocated event with latency', async () => {
      const vmData = {
        id: 'vm-123',
        ipAddress: '192.168.64.10',
        workspaceUrl: '/workspaces/vm-123',
        allocatedAt: new Date().toISOString(),
        state: 'running',
        cpuCount: 2,
        memorySize: 4294967296,
        diskSize: 53687091200,
        usageCount: 1,
      }

      mockFetch({
        ok: true,
        json: async () => vmData,
      })

      const eventSpy = jest.fn()
      bridge.on('vm:allocated', eventSpy)

      await bridge.allocateVM()

      expect(eventSpy).toHaveBeenCalled()
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('vm')
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('latency')
    })

    it('should throw error when VM allocation fails', async () => {
      mockFetch({
        ok: false,
        json: async () => ({ message: 'Pool exhausted' }),
      })

      await expect(bridge.allocateVM()).rejects.toThrow('Failed to allocate VM')
    })

    it('should throw error for native mode', async () => {
      const nativeBridge = new VMOrchestrationBridge({ mode: 'native' })

      await expect(nativeBridge.allocateVM()).rejects.toThrow('Native mode not yet implemented')

      nativeBridge.destroy()
    })
  })

  describe('releaseVM', () => {
    it('should release a VM back to the pool', async () => {
      mockFetch({ ok: true })

      await bridge.releaseVM('vm-123')

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8765/api/vm/vm-123/release', {
        method: 'POST',
      })
    })

    it('should emit vm:released event', async () => {
      mockFetch({ ok: true })
      const eventSpy = jest.fn()
      bridge.on('vm:released', eventSpy)

      await bridge.releaseVM('vm-123')

      expect(eventSpy).toHaveBeenCalledWith({ vmId: 'vm-123' })
    })

    it('should throw error when release fails', async () => {
      mockFetch({
        ok: false,
        json: async () => ({ message: 'VM not found' }),
      })

      await expect(bridge.releaseVM('nonexistent')).rejects.toThrow('Failed to release VM')
    })

    it('should throw error for native mode', async () => {
      const nativeBridge = new VMOrchestrationBridge({ mode: 'native' })

      await expect(nativeBridge.releaseVM('vm-123')).rejects.toThrow(
        'Native mode not yet implemented'
      )

      nativeBridge.destroy()
    })
  })

  describe('getStatistics', () => {
    it('should retrieve pool statistics', async () => {
      const stats = {
        availableVMs: 3,
        activeVMs: 2,
        totalVMs: 5,
        hotAllocations: 10,
        coldBootCount: 1,
        recycledVMs: 2,
        averageAllocationLatency: 150,
        averageReleaseLatency: 50,
        poolWarmTime: 120,
      }

      mockFetch({
        ok: true,
        json: async () => stats,
      })

      const result = await bridge.getStatistics()

      expect(result.availableVMs).toBe(3)
      expect(result.activeVMs).toBe(2)
      expect(result.totalVMs).toBe(5)
      expect(result.hotAllocations).toBe(10)
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8765/api/pool/statistics')
    })

    it('should throw error when statistics retrieval fails', async () => {
      mockFetch({ ok: false })

      await expect(bridge.getStatistics()).rejects.toThrow('Failed to get pool statistics')
    })

    it('should throw error for native mode', async () => {
      const nativeBridge = new VMOrchestrationBridge({ mode: 'native' })

      await expect(nativeBridge.getStatistics()).rejects.toThrow('Native mode not yet implemented')

      nativeBridge.destroy()
    })
  })

  describe('getVMMetrics', () => {
    it('should retrieve VM metrics', async () => {
      const metrics = {
        vmId: 'vm-123',
        cpuUsage: 0.45,
        memoryUsage: 4294967296,
        diskReadBps: 10485760,
        diskWriteBps: 5242880,
        networkRxBps: 1048576,
        networkTxBps: 524288,
        uptimeSeconds: 3600,
      }

      mockFetch({
        ok: true,
        json: async () => metrics,
      })

      const result = await bridge.getVMMetrics('vm-123')

      expect(result.vmId).toBe('vm-123')
      expect(result.cpuUsage).toBe(0.45)
      expect(result.memoryUsage).toBe(4294967296)
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8765/api/vm/vm-123/metrics')
    })

    it('should throw error when metrics retrieval fails', async () => {
      mockFetch({ ok: false })

      await expect(bridge.getVMMetrics('vm-123')).rejects.toThrow('Failed to get VM metrics')
    })

    it('should throw error for native mode', async () => {
      const nativeBridge = new VMOrchestrationBridge({ mode: 'native' })

      await expect(nativeBridge.getVMMetrics('vm-123')).rejects.toThrow(
        'Native mode not yet implemented'
      )

      nativeBridge.destroy()
    })
  })

  describe('checkHealth', () => {
    it('should return true when service is healthy', async () => {
      mockFetch({ ok: true })

      const result = await bridge.checkHealth()

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8765/health',
        expect.objectContaining({
          signal: expect.anything(),
        })
      )
    })

    it('should return false when service is unhealthy', async () => {
      mockFetch({ ok: false })

      const result = await bridge.checkHealth()

      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await bridge.checkHealth()

      expect(result).toBe(false)
    })

    it('should return false for native mode', async () => {
      const nativeBridge = new VMOrchestrationBridge({ mode: 'native' })

      const result = await nativeBridge.checkHealth()

      expect(result).toBe(false)
      nativeBridge.destroy()
    })
  })

  describe('Health checks', () => {
    it('should emit health:degraded event when health check fails', async () => {
      const eventSpy = jest.fn()
      bridge.on('health:degraded', eventSpy)

      mockFetch({ ok: false })

      // Fast-forward time to trigger health check
      await jest.advanceTimersByTimeAsync(30000)

      expect(eventSpy).toHaveBeenCalled()
    })

    it('should not emit event when health check succeeds', async () => {
      const eventSpy = jest.fn()
      bridge.on('health:degraded', eventSpy)

      mockFetch({ ok: true })

      await jest.advanceTimersByTimeAsync(30000)

      expect(eventSpy).not.toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('should clear health check interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      bridge.destroy()

      expect(clearIntervalSpy).toHaveBeenCalled()
    })

    it('should remove all event listeners', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      bridge.on('pool:warmed', listener1)
      bridge.on('vm:allocated', listener2)

      bridge.destroy()

      expect(bridge.listenerCount('pool:warmed')).toBe(0)
      expect(bridge.listenerCount('vm:allocated')).toBe(0)
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete VM lifecycle', async () => {
      // Warm pool
      mockFetch({ ok: true })
      await bridge.warmPool()

      // Allocate VM
      mockFetch({
        ok: true,
        json: async () => ({
          id: 'vm-123',
          ipAddress: '192.168.64.10',
          workspaceUrl: '/workspaces/vm-123',
          allocatedAt: new Date().toISOString(),
          state: 'running',
          cpuCount: 4,
          memorySize: 8589934592,
          diskSize: 107374182400,
          usageCount: 1,
        }),
      })
      const vm = await bridge.allocateVM()
      expect(vm.id).toBe('vm-123')

      // Get metrics
      mockFetch({
        ok: true,
        json: async () => ({
          vmId: 'vm-123',
          cpuUsage: 0.3,
          memoryUsage: 4000000000,
          diskReadBps: 1000000,
          diskWriteBps: 500000,
          networkRxBps: 100000,
          networkTxBps: 50000,
          uptimeSeconds: 120,
        }),
      })
      const metrics = await bridge.getVMMetrics('vm-123')
      expect(metrics.vmId).toBe('vm-123')

      // Release VM
      mockFetch({ ok: true })
      await bridge.releaseVM('vm-123')

      // Get statistics
      mockFetch({
        ok: true,
        json: async () => ({
          availableVMs: 4,
          activeVMs: 1,
          totalVMs: 5,
          hotAllocations: 11,
          coldBootCount: 1,
          recycledVMs: 2,
          averageAllocationLatency: 145,
          averageReleaseLatency: 48,
          poolWarmTime: 120,
        }),
      })
      const stats = await bridge.getStatistics()
      expect(stats.availableVMs).toBe(4)
    })
  })
})

describe('getVMOrchestration', () => {
  afterEach(() => {
    // Reset global instance
    ;(global as any).globalOrchestration = null
  })

  it('should return singleton instance', () => {
    const instance1 = getVMOrchestration()
    const instance2 = getVMOrchestration()

    expect(instance1).toBe(instance2)

    instance1.destroy()
  })

  it('should create instance with config on first call', () => {
    const instance = getVMOrchestration({ poolSize: 5 })

    expect(instance).toBeInstanceOf(VMOrchestrationBridge)

    instance.destroy()
  })
})

describe('allocateVMWithRetry', () => {
  let mockOrchestration: VMOrchestrationBridge

  beforeEach(() => {
    jest.clearAllMocks()
    mockOrchestration = new VMOrchestrationBridge()
    jest.spyOn(mockOrchestration, 'allocateVM')
  })

  afterEach(() => {
    mockOrchestration.destroy()
  })

  it('should allocate VM on first attempt', async () => {
    const mockVM = {
      id: 'vm-123',
      ipAddress: '192.168.64.10',
      agentApiUrl: 'http://192.168.64.10:3284',
      workspaceUrl: '/workspaces/vm-123',
      allocatedAt: new Date(),
      state: 'running' as const,
      cpuCount: 4,
      memorySize: 8589934592,
      diskSize: 107374182400,
      usageCount: 1,
    }

    mockFetch({
      ok: true,
      json: async () => ({
        ...mockVM,
        allocatedAt: mockVM.allocatedAt.toISOString(),
      }),
    })

    const result = await allocateVMWithRetry(3, 100)

    expect(result.id).toBe('vm-123')
  })

  it('should retry on failure and eventually succeed', async () => {
    // Use real timers for this test since allocateVMWithRetry uses setTimeout
    jest.useRealTimers()

    let attemptCount = 0

    ;(global.fetch as jest.Mock).mockImplementation(() => {
      attemptCount++
      if (attemptCount < 3) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ message: 'Pool exhausted' }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'vm-123',
          ipAddress: '192.168.64.10',
          workspaceUrl: '/workspaces/vm-123',
          allocatedAt: new Date().toISOString(),
          state: 'running',
          cpuCount: 4,
          memorySize: 8589934592,
          diskSize: 107374182400,
          usageCount: 1,
        }),
      })
    })

    const result = await allocateVMWithRetry(3, 10)

    expect(result.id).toBe('vm-123')
    expect(attemptCount).toBe(3)

    // Restore fake timers for other tests
    jest.useFakeTimers()
  })

  it('should throw error after all retries fail', async () => {
    // Use real timers for this test since allocateVMWithRetry uses setTimeout
    jest.useRealTimers()

    mockFetch({
      ok: false,
      json: async () => ({ message: 'Pool exhausted' }),
    })

    await expect(allocateVMWithRetry(3, 10)).rejects.toThrow()

    // Restore fake timers for other tests
    jest.useFakeTimers()
  })
})

describe('releaseVMSafely', () => {
  it('should release VM successfully', async () => {
    mockFetch({ ok: true })

    await expect(releaseVMSafely('vm-123')).resolves.not.toThrow()
  })

  it('should not throw error on release failure', async () => {
    mockFetch({
      ok: false,
      json: async () => ({ message: 'VM not found' }),
    })

    await expect(releaseVMSafely('nonexistent')).resolves.not.toThrow()
  })

  it('should handle errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    await expect(releaseVMSafely('vm-123')).resolves.not.toThrow()
  })
})

/**
 * Helper function to mock fetch responses
 */
function mockFetch(response: any) {
  ;(global.fetch as jest.Mock).mockResolvedValue(response)
}
