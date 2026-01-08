/**
 * Unit tests for Container Health Checks
 * Tests container health monitoring, status checks, and recovery
 */

import { AppleContainerRuntimeV2 } from '@/lib/container/apple-container-v2'
import { VMOrchestrationBridge } from '@/lib/container/vm-orchestration-bridge'
import { spawn } from 'child_process'
import type { ContainerInfo } from '@/lib/container/types'

// Mock child_process
jest.mock('child_process')

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

// Mock fetch globally
global.fetch = jest.fn()

// Use fake timers
jest.useFakeTimers()

describe('Container Health Checks', () => {
  describe('Container Status Monitoring', () => {
    let runtime: AppleContainerRuntimeV2

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntimeV2({ runtimePath: '/test/runtime' })
    })

    it('should detect healthy running container', async () => {
      mockChildProcess({
        stdout: JSON.stringify({
          id: 'healthy-123',
          name: 'web-server',
          image: 'nginx',
          state: 'running',
          ipAddress: '192.168.64.5',
          created: new Date().toISOString(),
        }),
        exitCode: 0,
      })

      const info = await runtime.inspect('healthy-123')

      expect(info).not.toBeNull()
      expect(info?.state).toBe('running')
    })

    it('should detect stopped container', async () => {
      mockChildProcess({
        stdout: JSON.stringify({
          id: 'stopped-123',
          name: 'stopped-app',
          image: 'app',
          state: 'stopped',
          ipAddress: undefined,
          created: new Date().toISOString(),
        }),
        exitCode: 0,
      })

      const info = await runtime.inspect('stopped-123')

      expect(info).not.toBeNull()
      expect(info?.state).toBe('stopped')
    })

    it('should detect error state container', async () => {
      mockChildProcess({
        stdout: JSON.stringify({
          id: 'error-123',
          name: 'crashed-app',
          image: 'app',
          state: 'error',
          created: new Date().toISOString(),
        }),
        exitCode: 0,
      })

      const info = await runtime.inspect('error-123')

      expect(info).not.toBeNull()
      expect(info?.state).toBe('error')
    })

    it('should handle non-existent container', async () => {
      mockChildProcess({ stderr: 'Container not found', exitCode: 1 })

      const info = await runtime.inspect('nonexistent-123')

      expect(info).toBeNull()
    })

    it('should check multiple containers health status', async () => {
      const containers = [
        { id: 'c1', state: 'running' },
        { id: 'c2', state: 'stopped' },
        { id: 'c3', state: 'running' },
      ]

      mockChildProcess({
        stdout: JSON.stringify(
          containers.map((c) => ({
            id: c.id,
            name: `container-${c.id}`,
            image: 'test',
            state: c.state,
            created: new Date().toISOString(),
          }))
        ),
        exitCode: 0,
      })

      const listResult = await runtime.list(true)

      expect(listResult.success).toBe(true)
      expect(listResult.containers).toHaveLength(3)

      const runningCount = listResult.containers.filter((c) => c.state === 'running').length
      expect(runningCount).toBe(2)
    })
  })

  describe('Container Log-based Health Checks', () => {
    let runtime: AppleContainerRuntimeV2

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntimeV2({ runtimePath: '/test/runtime' })
    })

    it('should detect healthy application from logs', async () => {
      const healthyLogs = `
        Application starting...
        Database connected successfully
        Server listening on port 3000
        Application ready to serve requests
      `

      mockChildProcess({ stdout: healthyLogs, exitCode: 0 })

      const logsResult = await runtime.logs('healthy-app')

      expect(logsResult.success).toBe(true)
      expect(logsResult.logs).toContain('Application ready')
      expect(logsResult.logs).toContain('Server listening')
    })

    it('should detect errors in container logs', async () => {
      const errorLogs = `
        Application starting...
        ERROR: Failed to connect to database
        ERROR: Connection refused
        Application crashed
      `

      mockChildProcess({ stdout: errorLogs, exitCode: 0 })

      const logsResult = await runtime.logs('error-app')

      expect(logsResult.success).toBe(true)
      expect(logsResult.logs).toContain('ERROR')
      expect(logsResult.logs).toContain('crashed')
    })

    it('should stream logs for real-time health monitoring', async () => {
      const logLines: string[] = []
      const errorDetected = { value: false }

      mockStreamingChildProcess(
        [
          'Starting application',
          'Loading configuration',
          'ERROR: Configuration invalid',
          'Application failed to start',
        ],
        0
      )

      await runtime.streamLogs('monitored-app', (line) => {
        logLines.push(line)
        if (line.includes('ERROR')) {
          errorDetected.value = true
        }
      })

      expect(logLines.length).toBeGreaterThan(0)
      expect(errorDetected.value).toBe(true)
    })

    it('should monitor logs with tail limit', async () => {
      const recentLogs = 'Recent log entry 1\nRecent log entry 2\nRecent log entry 3'

      mockChildProcess({ stdout: recentLogs, exitCode: 0 })

      const logsResult = await runtime.logs('app-123', { tail: 3 })

      expect(logsResult.success).toBe(true)
      expect(logsResult.logs.split('\n').length).toBeLessThanOrEqual(4) // 3 lines + possible empty
    })
  })

  describe('VM Orchestration Health Checks', () => {
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
    })

    it('should perform health check on orchestration service', async () => {
      mockFetch({ ok: true })

      const healthy = await bridge.checkHealth()

      expect(healthy).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8765/health', {
        signal: expect.any(AbortSignal),
      })
    })

    it('should detect unhealthy orchestration service', async () => {
      mockFetch({ ok: false, status: 503 })

      const healthy = await bridge.checkHealth()

      expect(healthy).toBe(false)
    })

    it('should handle health check timeout', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Timeout'))

      const healthy = await bridge.checkHealth()

      expect(healthy).toBe(false)
    }, 10000)

    it('should emit health:degraded event on failed check', async () => {
      const eventSpy = jest.fn()
      bridge.on('health:degraded', eventSpy)

      mockFetch({ ok: false })

      // Trigger health check interval
      await jest.advanceTimersByTimeAsync(30000)

      expect(eventSpy).toHaveBeenCalled()
    })

    it('should not emit event on successful check', async () => {
      const eventSpy = jest.fn()
      bridge.on('health:degraded', eventSpy)

      mockFetch({ ok: true })

      await jest.advanceTimersByTimeAsync(30000)

      expect(eventSpy).not.toHaveBeenCalled()
    })

    it('should retrieve VM metrics for health analysis', async () => {
      const healthyMetrics = {
        vmId: 'vm-123',
        cpuUsage: 0.35,
        memoryUsage: 2147483648, // 2GB
        diskReadBps: 1048576,
        diskWriteBps: 524288,
        networkRxBps: 102400,
        networkTxBps: 51200,
        uptimeSeconds: 3600,
      }

      mockFetch({
        ok: true,
        json: async () => healthyMetrics,
      })

      const metrics = await bridge.getVMMetrics('vm-123')

      expect(metrics.cpuUsage).toBeLessThan(0.8) // CPU healthy threshold
      expect(metrics.memoryUsage).toBeGreaterThan(0)
      expect(metrics.uptimeSeconds).toBeGreaterThan(0)
    })

    it('should detect VM with high resource usage', async () => {
      const stressedMetrics = {
        vmId: 'vm-456',
        cpuUsage: 0.95, // Very high CPU
        memoryUsage: 7516192768, // 7GB out of 8GB
        diskReadBps: 104857600, // 100 MB/s
        diskWriteBps: 52428800,
        networkRxBps: 10485760,
        networkTxBps: 5242880,
        uptimeSeconds: 7200,
      }

      mockFetch({
        ok: true,
        json: async () => stressedMetrics,
      })

      const metrics = await bridge.getVMMetrics('vm-456')

      expect(metrics.cpuUsage).toBeGreaterThan(0.9)
      expect(metrics.memoryUsage).toBeGreaterThan(7000000000)
    })
  })

  describe('Pool Health and Statistics', () => {
    let bridge: VMOrchestrationBridge

    beforeEach(() => {
      jest.clearAllMocks()
      bridge = new VMOrchestrationBridge({
        mode: 'http',
        endpoint: 'http://localhost:8765',
      })
    })

    afterEach(() => {
      bridge.destroy()
    })

    it('should verify pool has available VMs', async () => {
      const healthyPoolStats = {
        availableVMs: 5,
        activeVMs: 3,
        totalVMs: 8,
        hotAllocations: 20,
        coldBootCount: 2,
        recycledVMs: 5,
        averageAllocationLatency: 120,
        averageReleaseLatency: 45,
        poolWarmTime: 180,
      }

      mockFetch({
        ok: true,
        json: async () => healthyPoolStats,
      })

      const stats = await bridge.getStatistics()

      expect(stats.availableVMs).toBeGreaterThan(0)
      expect(stats.totalVMs).toBeGreaterThan(stats.activeVMs)
    })

    it('should detect pool exhaustion', async () => {
      const exhaustedPoolStats = {
        availableVMs: 0,
        activeVMs: 10,
        totalVMs: 10,
        hotAllocations: 50,
        coldBootCount: 25,
        recycledVMs: 10,
        averageAllocationLatency: 5000, // Very high latency
        averageReleaseLatency: 100,
        poolWarmTime: 180,
      }

      mockFetch({
        ok: true,
        json: async () => exhaustedPoolStats,
      })

      const stats = await bridge.getStatistics()

      expect(stats.availableVMs).toBe(0)
      expect(stats.activeVMs).toBe(stats.totalVMs)
      expect(stats.averageAllocationLatency).toBeGreaterThan(3000)
    })

    it('should monitor allocation performance', async () => {
      const performanceStats = {
        availableVMs: 3,
        activeVMs: 2,
        totalVMs: 5,
        hotAllocations: 95,
        coldBootCount: 5,
        recycledVMs: 10,
        averageAllocationLatency: 80,
        averageReleaseLatency: 30,
        poolWarmTime: 150,
      }

      mockFetch({
        ok: true,
        json: async () => performanceStats,
      })

      const stats = await bridge.getStatistics()

      // Good performance indicators
      expect(stats.hotAllocations).toBeGreaterThan(stats.coldBootCount * 10)
      expect(stats.averageAllocationLatency).toBeLessThan(200)
      expect(stats.averageReleaseLatency).toBeLessThan(100)
    })
  })

  describe('Health Check Recovery Scenarios', () => {
    let runtime: AppleContainerRuntimeV2

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntimeV2({ runtimePath: '/test/runtime' })
    })

    it('should restart unhealthy container', async () => {
      jest.useRealTimers()

      // Detect unhealthy container
      mockChildProcess({
        stdout: JSON.stringify({
          id: 'unhealthy-123',
          name: 'app',
          image: 'app:latest',
          state: 'error',
          created: new Date().toISOString(),
        }),
        exitCode: 0,
      })

      const beforeInfo = await runtime.inspect('unhealthy-123')
      expect(beforeInfo?.state).toBe('error')

      // Stop container
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('unhealthy-123', 5)

      // Restart container
      mockChildProcess({ stdout: 'unhealthy-123-new', exitCode: 0 })
      const startResult = await runtime.start('app:latest', { name: 'app' })
      expect(startResult.success).toBe(true)

      // Verify container is healthy
      mockChildProcess({
        stdout: JSON.stringify({
          id: 'unhealthy-123-new',
          name: 'app',
          image: 'app:latest',
          state: 'running',
          created: new Date().toISOString(),
        }),
        exitCode: 0,
      })

      const afterInfo = await runtime.inspect('unhealthy-123-new')
      expect(afterInfo?.state).toBe('running')

      jest.useFakeTimers()
    }, 10000)

    it('should handle container that fails health check repeatedly', async () => {
      jest.useRealTimers()

      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts) {
        // Start container
        mockChildProcess({ stdout: `attempt-${attempts}`, exitCode: 0 })
        const startResult = await runtime.start('flaky-app', { name: `app-${attempts}` })
        expect(startResult.success).toBe(true)

        // Check health (fails)
        mockChildProcess({ stdout: 'Error: Application not responding', exitCode: 0 })
        const logsResult = await runtime.logs(`attempt-${attempts}`)

        if (logsResult.logs.includes('Error')) {
          // Stop and remove
          mockChildProcess({ stdout: '', exitCode: 0 })
          await runtime.stop(`attempt-${attempts}`)
          mockChildProcess({ stdout: '', exitCode: 0 })
          await runtime.remove(`attempt-${attempts}`)

          attempts++
        } else {
          break
        }
      }

      expect(attempts).toBe(maxAttempts) // All attempts failed

      jest.useFakeTimers()
    }, 10000)

    it('should recover from temporary network issues', async () => {
      const bridge = new VMOrchestrationBridge({ endpoint: 'http://localhost:8765' })

      // First check fails
      mockFetch({ ok: false })
      let healthy = await bridge.checkHealth()
      expect(healthy).toBe(false)

      // Second check succeeds (network recovered)
      mockFetch({ ok: true })
      healthy = await bridge.checkHealth()
      expect(healthy).toBe(true)

      bridge.destroy()
    })
  })

  describe('Proactive Health Monitoring', () => {
    let bridge: VMOrchestrationBridge

    beforeEach(() => {
      jest.clearAllMocks()
      jest.clearAllTimers()
      bridge = new VMOrchestrationBridge({ endpoint: 'http://localhost:8765' })
    })

    afterEach(() => {
      bridge.destroy()
    })

    it('should run periodic health checks', async () => {
      mockFetch({ ok: true })

      // Fast-forward through multiple check intervals
      await jest.advanceTimersByTimeAsync(90000) // 3 checks at 30s intervals

      // Health check should have been called (at least once)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should detect degradation over time', async () => {
      const eventSpy = jest.fn()
      bridge.on('health:degraded', eventSpy)

      // First few checks are healthy
      mockFetch({ ok: true })
      await jest.advanceTimersByTimeAsync(60000)

      expect(eventSpy).not.toHaveBeenCalled()

      // Then service degrades
      mockFetch({ ok: false })
      await jest.advanceTimersByTimeAsync(30000)

      expect(eventSpy).toHaveBeenCalled()
    })
  })
})

/**
 * Helper function to mock child_process spawn
 */
function mockChildProcess(config: {
  stdout?: string
  stderr?: string
  exitCode?: number
  error?: Error
}) {
  const mockProcess = {
    stdout: {
      on: jest.fn((event: string, handler: (data: Buffer) => void) => {
        if (event === 'data' && config.stdout) {
          process.nextTick(() => handler(Buffer.from(config.stdout!)))
        }
      }),
    },
    stderr: {
      on: jest.fn((event: string, handler: (data: Buffer) => void) => {
        if (event === 'data' && config.stderr) {
          process.nextTick(() => handler(Buffer.from(config.stderr!)))
        }
      }),
    },
    on: jest.fn((event: string, handler: (code?: number | Error) => void) => {
      if (event === 'close') {
        process.nextTick(() => handler(config.exitCode))
      }
      if (event === 'error' && config.error) {
        process.nextTick(() => handler(config.error))
      }
    }),
  } as unknown as ReturnType<typeof spawn>

  mockSpawn.mockReturnValue(mockProcess)
}

/**
 * Helper function to mock streaming child process
 */
function mockStreamingChildProcess(lines: string[], exitCode: number) {
  const mockProcess = {
    stdout: {
      on: jest.fn((event: string, handler: (data: Buffer) => void) => {
        if (event === 'data') {
          lines.forEach((line) => {
            process.nextTick(() => handler(Buffer.from(line + '\n')))
          })
        }
      }),
    },
    stderr: {
      on: jest.fn(),
    },
    on: jest.fn((event: string, handler: (code?: number) => void) => {
      if (event === 'close') {
        process.nextTick(() => handler(exitCode))
      }
    }),
  } as unknown as ReturnType<typeof spawn>

  mockSpawn.mockReturnValue(mockProcess)
}

/**
 * Helper function to mock fetch responses
 */
function mockFetch(response: any) {
  ;(global.fetch as jest.Mock).mockResolvedValue(response)
}
