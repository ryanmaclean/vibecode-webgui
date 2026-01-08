/**
 * Unit tests for Apple Container Runtime V2
 * Tests production Swift bridge, image pulling, and advanced features
 */

import { AppleContainerRuntimeV2 } from '@/lib/container/apple-container-v2'
import { spawn } from 'child_process'
import type { EventEmitter } from 'events'

// Mock child_process
jest.mock('child_process')

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

describe('AppleContainerRuntimeV2', () => {
  let runtime: AppleContainerRuntimeV2

  beforeEach(() => {
    jest.clearAllMocks()
    runtime = new AppleContainerRuntimeV2({
      runtimePath: '/test/path/apple-container-runtime',
      debug: false,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultRuntime = new AppleContainerRuntimeV2()
      expect(defaultRuntime).toBeInstanceOf(AppleContainerRuntimeV2)
    })

    it('should initialize with custom runtime path', () => {
      const customRuntime = new AppleContainerRuntimeV2({
        runtimePath: '/custom/path/runtime',
      })
      expect(customRuntime).toBeInstanceOf(AppleContainerRuntimeV2)
    })

    it('should initialize with debug mode', () => {
      const debugRuntime = new AppleContainerRuntimeV2({ debug: true })
      expect(debugRuntime).toBeInstanceOf(AppleContainerRuntimeV2)
    })
  })

  describe('isAvailable', () => {
    it('should return true when runtime is available', async () => {
      mockChildProcess({ stdout: 'apple-container-runtime version 2.0.0', exitCode: 0 })

      const result = await runtime.isAvailable()

      expect(result).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', ['--version'])
    })

    it('should return false when runtime is not available', async () => {
      mockChildProcess({ error: new Error('Runtime not found') })

      const result = await runtime.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false when version command fails', async () => {
      mockChildProcess({ stdout: 'invalid output', exitCode: 1 })

      const result = await runtime.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('getVersion', () => {
    it('should return runtime version', async () => {
      mockChildProcess({ stdout: 'apple-container-runtime version 2.1.0', exitCode: 0 })

      const version = await runtime.getVersion()

      expect(version).toBe('apple-container-runtime version 2.1.0')
    })

    it('should throw error when version retrieval fails', async () => {
      mockChildProcess({ stderr: 'Version error', exitCode: 1 })

      await expect(runtime.getVersion()).rejects.toThrow('Failed to get runtime version')
    })
  })

  describe('start', () => {
    it('should start a container with basic configuration', async () => {
      const containerId = 'v2-container-123'
      mockChildProcess({ stdout: containerId, exitCode: 0 })

      const result = await runtime.start('test-image', {
        name: 'test-container-v2',
      })

      expect(result.success).toBe(true)
      expect(result.id).toBe(containerId)
      expect(result.name).toBe('test-container-v2')
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'test-image',
        '--name',
        'test-container-v2',
        '--detach',
      ])
    })

    it('should start a container with port mappings', async () => {
      mockChildProcess({ stdout: 'container-id', exitCode: 0 })

      const result = await runtime.start('web-app', {
        ports: { 8080: 80, 8443: 443 },
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'web-app',
        '--port',
        '8080:80',
        '--port',
        '8443:443',
        '--detach',
      ])
    })

    it('should start a container with environment variables', async () => {
      mockChildProcess({ stdout: 'container-id', exitCode: 0 })

      const result = await runtime.start('app', {
        env: {
          DATABASE_URL: 'postgres://localhost:5432',
          NODE_ENV: 'production',
        },
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'app',
        '--env',
        'DATABASE_URL=postgres://localhost:5432',
        '--env',
        'NODE_ENV=production',
        '--detach',
      ])
    })

    it('should start a container with volume mounts', async () => {
      mockChildProcess({ stdout: 'container-id', exitCode: 0 })

      const result = await runtime.start('storage', {
        volumes: {
          '/host/data': '/data',
          '/host/config': '/etc/config',
        },
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'storage',
        '--volume',
        '/host/data:/data',
        '--volume',
        '/host/config:/etc/config',
        '--detach',
      ])
    })

    it('should start a container with resource limits', async () => {
      mockChildProcess({ stdout: 'container-id', exitCode: 0 })

      const result = await runtime.start('compute', {
        cpus: 4,
        memory: 8192,
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'compute',
        '--cpus',
        '4',
        '--memory',
        '8192',
        '--detach',
      ])
    })

    it('should start a container in attached mode', async () => {
      mockChildProcess({ stdout: 'container-id', exitCode: 0 })

      const result = await runtime.start('interactive', {
        detached: false,
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'interactive',
      ])
    })

    it('should start a container with rm flag', async () => {
      mockChildProcess({ stdout: 'container-id', exitCode: 0 })

      const result = await runtime.start('one-off-task', {
        rm: true,
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'run',
        'one-off-task',
        '--detach',
        '--rm',
      ])
    })

    it('should return error when start fails', async () => {
      mockChildProcess({ stderr: 'Image not available', exitCode: 1 })

      const result = await runtime.start('missing-image')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Image not available')
    })

    it('should handle start errors gracefully', async () => {
      mockChildProcess({ error: new Error('Start failed') })

      const result = await runtime.start('test-image')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('stop', () => {
    it('should stop a container with default timeout', async () => {
      mockChildProcess({ stdout: '', exitCode: 0 })

      const result = await runtime.stop('container123')

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'stop',
        'container123',
        '--timeout',
        '10',
      ])
    })

    it('should stop a container with custom timeout', async () => {
      mockChildProcess({ stdout: '', exitCode: 0 })

      const result = await runtime.stop('container123', 30)

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'stop',
        'container123',
        '--timeout',
        '30',
      ])
    })

    it('should return error when stop fails', async () => {
      mockChildProcess({ stderr: 'Container not running', exitCode: 1 })

      const result = await runtime.stop('not-running')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Container not running')
    })
  })

  describe('remove', () => {
    it('should remove a container without force', async () => {
      mockChildProcess({ stdout: '', exitCode: 0 })

      const result = await runtime.remove('container123')

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'remove',
        'container123',
      ])
    })

    it('should force remove a running container', async () => {
      mockChildProcess({ stdout: '', exitCode: 0 })

      const result = await runtime.remove('running-container', true)

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'remove',
        'running-container',
        '--force',
      ])
    })

    it('should return error when remove fails', async () => {
      mockChildProcess({ stderr: 'Container in use', exitCode: 1 })

      const result = await runtime.remove('in-use')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Container in use')
    })
  })

  describe('list', () => {
    it('should list running containers', async () => {
      const containers = [
        {
          id: 'abc123',
          name: 'web-server',
          image: 'nginx:latest',
          state: 'running',
          ipAddress: '192.168.64.2',
          created: '2024-01-01T00:00:00Z',
        },
      ]
      mockChildProcess({ stdout: JSON.stringify(containers), exitCode: 0 })

      const result = await runtime.list()

      expect(result.success).toBe(true)
      expect(result.containers).toHaveLength(1)
      expect(result.containers[0].name).toBe('web-server')
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'list',
        '--json',
      ])
    })

    it('should list all containers including stopped', async () => {
      const containers = [
        {
          id: 'abc123',
          name: 'running',
          image: 'nginx',
          state: 'running',
          created: '2024-01-01T00:00:00Z',
        },
        {
          id: 'def456',
          name: 'stopped',
          image: 'postgres',
          state: 'stopped',
          created: '2024-01-01T00:00:00Z',
        },
      ]
      mockChildProcess({ stdout: JSON.stringify(containers), exitCode: 0 })

      const result = await runtime.list(true)

      expect(result.success).toBe(true)
      expect(result.containers).toHaveLength(2)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'list',
        '--json',
        '--all',
      ])
    })

    it('should return error when list fails', async () => {
      mockChildProcess({ stderr: 'List failed', exitCode: 1 })

      const result = await runtime.list()

      expect(result.success).toBe(false)
      expect(result.error).toContain('List failed')
    })

    it('should handle invalid JSON response', async () => {
      mockChildProcess({ stdout: 'invalid json', exitCode: 0 })

      const result = await runtime.list()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('logs', () => {
    it('should retrieve container logs', async () => {
      const logs = 'Application started\nListening on port 3000'
      mockChildProcess({ stdout: logs, exitCode: 0 })

      const result = await runtime.logs('container123')

      expect(result.success).toBe(true)
      expect(result.logs).toBe(logs)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'logs',
        'container123',
      ])
    })

    it('should follow container logs', async () => {
      mockChildProcess({ stdout: 'Log entry 1\nLog entry 2', exitCode: 0 })

      const result = await runtime.logs('container123', { follow: true })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'logs',
        'container123',
        '--follow',
      ])
    })

    it('should retrieve last N log lines', async () => {
      mockChildProcess({ stdout: 'Last 10 lines', exitCode: 0 })

      const result = await runtime.logs('container123', { tail: 10 })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('/test/path/apple-container-runtime', [
        'logs',
        'container123',
        '--tail',
        '10',
      ])
    })

    it('should return error when logs retrieval fails', async () => {
      mockChildProcess({ stderr: 'Container not found', exitCode: 1 })

      const result = await runtime.logs('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Container not found')
    })
  })

  describe('streamLogs', () => {
    it('should stream container logs with callback', async () => {
      const logLines: string[] = []
      const callback = (line: string) => logLines.push(line)

      mockStreamingChildProcess(['Line 1', 'Line 2', 'Line 3'], 0)

      const result = await runtime.streamLogs('container123', callback)

      expect(result.success).toBe(true)
      expect(logLines).toHaveLength(3)
      expect(logLines).toContain('Line 1')
    })

    it('should handle streaming errors', async () => {
      const callback = jest.fn()

      mockStreamingChildProcess([], 1)

      const result = await runtime.streamLogs('container123', callback)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Process exited with code 1')
    })

    it('should handle stream process errors', async () => {
      const callback = jest.fn()

      mockChildProcess({ error: new Error('Stream failed') })

      const result = await runtime.streamLogs('container123', callback)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('inspect', () => {
    it('should inspect a container and return full details', async () => {
      const detail = {
        id: 'abc123',
        name: 'my-container',
        image: 'nginx:latest',
        state: 'running',
        ipAddress: '192.168.64.5',
        created: '2024-01-01T00:00:00Z',
        config: {
          portMappings: [
            { containerPort: 80, hostPort: 8080 },
            { containerPort: 443, hostPort: 8443 },
          ],
        },
      }
      mockChildProcess({ stdout: JSON.stringify(detail), exitCode: 0 })

      const result = await runtime.inspect('abc123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('abc123')
      expect(result?.name).toBe('my-container')
      expect(result?.ports).toEqual({ '80': 8080, '443': 8443 })
    })

    it('should return null when inspect fails', async () => {
      mockChildProcess({ stderr: 'Not found', exitCode: 1 })

      const result = await runtime.inspect('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle invalid JSON in inspect', async () => {
      mockChildProcess({ stdout: 'invalid', exitCode: 0 })

      const result = await runtime.inspect('container123')

      expect(result).toBeNull()
    })
  })

  describe('pull', () => {
    it('should pull an image without progress callback', async () => {
      mockStreamingChildProcess(['Downloading: 50%', 'Downloading: 100%'], 0)

      const result = await runtime.pull('nginx:latest')

      expect(result.success).toBe(true)
    })

    it('should pull an image with progress callback', async () => {
      const progressUpdates: number[] = []
      const onProgress = (progress: { percentComplete: number }) => {
        progressUpdates.push(progress.percentComplete)
      }

      mockStreamingChildProcess(['Downloading: 25%', 'Downloading: 75%', 'Complete'], 0)

      const result = await runtime.pull('redis:alpine', onProgress)

      expect(result.success).toBe(true)
      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    it('should return error when pull fails', async () => {
      mockStreamingChildProcess([], 1)

      const result = await runtime.pull('invalid/image')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Pull failed with code 1')
    })

    it('should handle pull errors gracefully', async () => {
      mockChildProcess({ error: new Error('Network error') })

      const result = await runtime.pull('test:latest')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Static build method', () => {
    it('should build Swift runtime in release mode', async () => {
      mockChildProcess({ stdout: 'Build succeeded', exitCode: 0 })

      const result = await AppleContainerRuntimeV2.build(false)

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith(
        'swift',
        ['build', '-c', 'release'],
        expect.objectContaining({ cwd: expect.stringContaining('AppleContainerRuntime') })
      )
    })

    it('should build Swift runtime in debug mode', async () => {
      mockChildProcess({ stdout: 'Build succeeded', exitCode: 0 })

      const result = await AppleContainerRuntimeV2.build(true)

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith(
        'swift',
        ['build', '-c', 'debug'],
        expect.objectContaining({ cwd: expect.stringContaining('AppleContainerRuntime') })
      )
    })

    it('should return error when build fails', async () => {
      mockChildProcess({ stderr: 'Compilation error', exitCode: 1 })

      const result = await AppleContainerRuntimeV2.build()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Build failed with code 1')
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
