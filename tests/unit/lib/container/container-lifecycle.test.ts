/**
 * Unit tests for Container Lifecycle Management
 * Tests end-to-end container lifecycle scenarios and edge cases
 */

import { AppleContainerRuntime } from '@/lib/container/apple-container'
import { AppleContainerRuntimeV2 } from '@/lib/container/apple-container-v2'
import { spawn } from 'child_process'

// Mock child_process
jest.mock('child_process')

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

describe('Container Lifecycle Management', () => {
  describe('Basic Lifecycle - AppleContainerRuntime', () => {
    let runtime: AppleContainerRuntime

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntime()
    })

    it('should complete create-start-stop-remove lifecycle', async () => {
      // Check availability
      mockChildProcess({ stdout: 'container version 1.0', exitCode: 0 })
      const isAvailable = await runtime.isAvailable()
      expect(isAvailable).toBe(true)

      // Start container
      mockChildProcess({ stdout: 'container-123', exitCode: 0 })
      const startResult = await runtime.start('nginx', { name: 'web-server' })
      expect(startResult.success).toBe(true)
      expect(startResult.id).toBe('container-123')

      // Verify container is running
      mockChildProcess({
        stdout: JSON.stringify([
          { ID: 'container-123', IMAGE: 'nginx', STATE: 'running', ADDR: '192.168.1.1' },
        ]),
        exitCode: 0,
      })
      const listResult = await runtime.list()
      expect(listResult.containers[0].state).toBe('running')

      // Stop container
      mockChildProcess({ stdout: '', exitCode: 0 })
      const stopResult = await runtime.stop('container-123')
      expect(stopResult.success).toBe(true)

      // Remove container
      mockChildProcess({ stdout: '', exitCode: 0 })
      const removeResult = await runtime.remove('container-123')
      expect(removeResult.success).toBe(true)
    })

    it('should handle rapid start-stop cycles', async () => {
      const cycles = 3

      for (let i = 0; i < cycles; i++) {
        // Start
        mockChildProcess({ stdout: `container-${i}`, exitCode: 0 })
        const startResult = await runtime.start('test-image', { name: `test-${i}` })
        expect(startResult.success).toBe(true)

        // Stop
        mockChildProcess({ stdout: '', exitCode: 0 })
        const stopResult = await runtime.stop(`container-${i}`)
        expect(stopResult.success).toBe(true)

        // Remove
        mockChildProcess({ stdout: '', exitCode: 0 })
        const removeResult = await runtime.remove(`container-${i}`)
        expect(removeResult.success).toBe(true)
      }
    })

    it('should handle container restart scenario', async () => {
      const containerId = 'restart-test-123'

      // Start container
      mockChildProcess({ stdout: containerId, exitCode: 0 })
      let startResult = await runtime.start('app', { name: 'restart-app' })
      expect(startResult.success).toBe(true)

      // Stop container
      mockChildProcess({ stdout: '', exitCode: 0 })
      const stopResult = await runtime.stop(containerId)
      expect(stopResult.success).toBe(true)

      // Start again (restart)
      mockChildProcess({ stdout: containerId, exitCode: 0 })
      startResult = await runtime.start('app', { name: 'restart-app' })
      expect(startResult.success).toBe(true)

      // Clean up
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop(containerId)
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove(containerId)
    })

    it('should handle stop failure gracefully', async () => {
      // Start container
      mockChildProcess({ stdout: 'container-123', exitCode: 0 })
      const startResult = await runtime.start('test')
      expect(startResult.success).toBe(true)

      // Attempt to stop but it fails
      mockChildProcess({ stderr: 'Stop timeout', exitCode: 1 })
      const stopResult = await runtime.stop('container-123')
      expect(stopResult.success).toBe(false)

      // Force remove should still work
      mockChildProcess({ stdout: '', exitCode: 0 })
      const removeResult = await runtime.remove('container-123')
      expect(removeResult.success).toBe(true)
    })

    it('should handle remove of running container', async () => {
      // Start container
      mockChildProcess({ stdout: 'container-123', exitCode: 0 })
      await runtime.start('test')

      // Try to remove without stopping (should fail)
      mockChildProcess({ stderr: 'Container is running', exitCode: 1 })
      const removeResult = await runtime.remove('container-123')
      expect(removeResult.success).toBe(false)
      expect(removeResult.error).toContain('Container is running')
    })
  })

  describe('Advanced Lifecycle - AppleContainerRuntimeV2', () => {
    let runtime: AppleContainerRuntimeV2

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntimeV2({
        runtimePath: '/test/runtime',
        debug: false,
      })
    })

    it('should handle complete lifecycle with resource constraints', async () => {
      // Start with resource limits
      mockChildProcess({ stdout: 'vm-container-123', exitCode: 0 })
      const startResult = await runtime.start('resource-app', {
        name: 'limited-app',
        cpus: 2,
        memory: 4096,
      })
      expect(startResult.success).toBe(true)

      // Inspect to verify resources
      mockChildProcess({
        stdout: JSON.stringify({
          id: 'vm-container-123',
          name: 'limited-app',
          image: 'resource-app',
          state: 'running',
          ipAddress: '192.168.64.5',
          created: new Date().toISOString(),
        }),
        exitCode: 0,
      })
      const inspectResult = await runtime.inspect('vm-container-123')
      expect(inspectResult).not.toBeNull()
      expect(inspectResult?.state).toBe('running')

      // Stop with timeout
      mockChildProcess({ stdout: '', exitCode: 0 })
      const stopResult = await runtime.stop('vm-container-123', 30)
      expect(stopResult.success).toBe(true)

      // Remove
      mockChildProcess({ stdout: '', exitCode: 0 })
      const removeResult = await runtime.remove('vm-container-123')
      expect(removeResult.success).toBe(true)
    })

    it('should handle image pull before container start', async () => {
      // Pull image
      mockStreamingChildProcess(['Downloading: 50%', 'Downloading: 100%'], 0)
      const pullResult = await runtime.pull('alpine:latest')
      expect(pullResult.success).toBe(true)

      // Start container with pulled image
      mockChildProcess({ stdout: 'alpine-container', exitCode: 0 })
      const startResult = await runtime.start('alpine:latest', { name: 'alpine-test' })
      expect(startResult.success).toBe(true)

      // Clean up
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('alpine-container')
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('alpine-container')
    })

    it('should handle force remove of running container', async () => {
      // Start container
      mockChildProcess({ stdout: 'container-123', exitCode: 0 })
      await runtime.start('test')

      // Force remove
      mockChildProcess({ stdout: '', exitCode: 0 })
      const removeResult = await runtime.remove('container-123', true)
      expect(removeResult.success).toBe(true)
    })

    it('should handle container with auto-remove flag', async () => {
      // Start with rm flag
      mockChildProcess({ stdout: 'temp-container', exitCode: 0 })
      const startResult = await runtime.start('one-off-task', {
        name: 'temp-task',
        rm: true,
      })
      expect(startResult.success).toBe(true)

      // Container should be auto-removed after stop
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('temp-container')

      // Verify removal (container should not exist)
      mockChildProcess({ stderr: 'Container not found', exitCode: 1 })
      const inspectResult = await runtime.inspect('temp-container')
      expect(inspectResult).toBeNull()
    })

    it('should handle log streaming lifecycle', async () => {
      // Start container
      mockChildProcess({ stdout: 'log-container', exitCode: 0 })
      await runtime.start('app-with-logs')

      // Stream logs
      const logLines: string[] = []
      mockStreamingChildProcess(['Starting application', 'Listening on port 3000'], 0)
      const streamResult = await runtime.streamLogs('log-container', (line) => {
        logLines.push(line)
      })
      expect(streamResult.success).toBe(true)
      expect(logLines.length).toBeGreaterThan(0)

      // Get static logs
      mockChildProcess({ stdout: 'Application logs\nMore logs', exitCode: 0 })
      const logsResult = await runtime.logs('log-container', { tail: 10 })
      expect(logsResult.success).toBe(true)

      // Clean up
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('log-container')
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('log-container')
    })
  })

  describe('Multi-container Scenarios', () => {
    let runtime: AppleContainerRuntimeV2

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntimeV2({ runtimePath: '/test/runtime' })
    })

    it('should handle multiple containers simultaneously', async () => {
      const containers = ['web', 'db', 'cache']
      const containerIds: string[] = []

      // Start all containers
      for (const name of containers) {
        mockChildProcess({ stdout: `${name}-123`, exitCode: 0 })
        const result = await runtime.start(`${name}-image`, { name })
        expect(result.success).toBe(true)
        containerIds.push(result.id)
      }

      // List all containers
      mockChildProcess({
        stdout: JSON.stringify(
          containerIds.map((id, i) => ({
            id,
            name: containers[i],
            image: `${containers[i]}-image`,
            state: 'running',
            ipAddress: `192.168.64.${10 + i}`,
            created: new Date().toISOString(),
          }))
        ),
        exitCode: 0,
      })
      const listResult = await runtime.list()
      expect(listResult.containers).toHaveLength(3)

      // Stop all containers
      for (const id of containerIds) {
        mockChildProcess({ stdout: '', exitCode: 0 })
        const stopResult = await runtime.stop(id)
        expect(stopResult.success).toBe(true)
      }

      // Remove all containers
      for (const id of containerIds) {
        mockChildProcess({ stdout: '', exitCode: 0 })
        const removeResult = await runtime.remove(id)
        expect(removeResult.success).toBe(true)
      }
    })

    it('should handle container interdependencies', async () => {
      // Start database first
      mockChildProcess({ stdout: 'db-123', exitCode: 0 })
      const dbResult = await runtime.start('postgres', {
        name: 'database',
        env: { POSTGRES_PASSWORD: 'secret' },
      })
      expect(dbResult.success).toBe(true)

      // Wait for database to be ready (simulated)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Start application that depends on database
      mockChildProcess({ stdout: 'app-123', exitCode: 0 })
      const appResult = await runtime.start('app', {
        name: 'application',
        env: { DATABASE_URL: 'postgres://database:5432' },
      })
      expect(appResult.success).toBe(true)

      // Clean up in reverse order
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('app-123')
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('app-123')

      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('db-123')
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('db-123')
    })
  })

  describe('Error Recovery Scenarios', () => {
    let runtime: AppleContainerRuntimeV2

    beforeEach(() => {
      jest.clearAllMocks()
      runtime = new AppleContainerRuntimeV2({ runtimePath: '/test/runtime' })
    })

    it('should recover from failed start attempts', async () => {
      // First attempt fails
      mockChildProcess({ stderr: 'Port already in use', exitCode: 1 })
      let result = await runtime.start('web-app', { ports: { 8080: 80 } })
      expect(result.success).toBe(false)

      // Retry with different port
      mockChildProcess({ stdout: 'container-123', exitCode: 0 })
      result = await runtime.start('web-app', { ports: { 9090: 80 } })
      expect(result.success).toBe(true)

      // Clean up
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('container-123')
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('container-123')
    })

    it('should handle orphaned containers', async () => {
      // List shows running containers from previous session
      mockChildProcess({
        stdout: JSON.stringify([
          {
            id: 'orphan-123',
            name: 'old-container',
            image: 'test',
            state: 'running',
            created: new Date(Date.now() - 86400000).toISOString(), // 1 day old
          },
        ]),
        exitCode: 0,
      })
      const listResult = await runtime.list(true)
      expect(listResult.containers).toHaveLength(1)

      // Clean up orphaned container
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('orphan-123', 5)
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('orphan-123', true)
    })

    it('should handle concurrent lifecycle operations', async () => {
      // Start container
      mockChildProcess({ stdout: 'concurrent-123', exitCode: 0 })
      const startResult = await runtime.start('test')
      expect(startResult.success).toBe(true)

      // Attempt concurrent operations (should be handled gracefully)
      const operations = [
        (async () => {
          mockChildProcess({
            stdout: JSON.stringify({
              id: 'concurrent-123',
              name: 'test',
              image: 'test',
              state: 'running',
            }),
            exitCode: 0,
          })
          return runtime.inspect('concurrent-123')
        })(),
        (async () => {
          mockChildProcess({ stdout: 'Log line 1\nLog line 2', exitCode: 0 })
          return runtime.logs('concurrent-123')
        })(),
      ]

      const results = await Promise.all(operations)
      expect(results[0]).not.toBeNull() // inspect result
      expect(results[1].success).toBe(true) // logs result

      // Clean up
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.stop('concurrent-123')
      mockChildProcess({ stdout: '', exitCode: 0 })
      await runtime.remove('concurrent-123')
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
