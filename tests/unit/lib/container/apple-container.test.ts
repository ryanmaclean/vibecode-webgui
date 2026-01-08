/**
 * Unit tests for Apple Container Runtime
 * Tests container lifecycle, operations, and error handling
 */

import { AppleContainerRuntime } from '@/lib/container/apple-container'
import { spawn } from 'child_process'
import type { EventEmitter } from 'events'

// Mock child_process
jest.mock('child_process')

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

describe('AppleContainerRuntime', () => {
  let runtime: AppleContainerRuntime

  beforeEach(() => {
    jest.clearAllMocks()
    runtime = new AppleContainerRuntime()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('isAvailable', () => {
    it('should return true when container CLI is available', async () => {
      mockChildProcess({ stdout: 'container version 1.0.0', exitCode: 0 })

      const result = await runtime.isAvailable()

      expect(result).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', ['--version'])
    })

    it('should return false when container CLI is not available', async () => {
      mockChildProcess({ error: new Error('Command not found') })

      const result = await runtime.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false when container CLI exits with error', async () => {
      mockChildProcess({ stderr: 'Command not found', exitCode: 1 })

      const result = await runtime.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('start', () => {
    it('should start a container with basic options', async () => {
      const containerId = 'abc123def456'
      mockChildProcess({ stdout: containerId, exitCode: 0 })

      const result = await runtime.start('test-image', {
        name: 'test-container',
      })

      expect(result.success).toBe(true)
      expect(result.id).toBe(containerId)
      expect(result.name).toBe('test-container')
      expect(mockSpawn).toHaveBeenCalledWith('container', [
        'run',
        '-d',
        '--name',
        'test-container',
        'test-image',
      ])
    })

    it('should start a container with port mappings', async () => {
      const containerId = 'container123'
      mockChildProcess({ stdout: containerId, exitCode: 0 })

      const result = await runtime.start('nginx', {
        ports: { 8080: 80, 8443: 443 },
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', [
        'run',
        '-d',
        '-p',
        '8080:80',
        '-p',
        '8443:443',
        'nginx',
      ])
    })

    it('should start a container with environment variables', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.start('app-image', {
        env: {
          NODE_ENV: 'production',
          API_KEY: 'secret-key',
        },
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', [
        'run',
        '-d',
        '-e',
        'NODE_ENV=production',
        '-e',
        'API_KEY=secret-key',
        'app-image',
      ])
    })

    it('should start a container with volume mounts', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.start('database', {
        volumes: {
          '/host/data': '/container/data',
          '/host/logs': '/container/logs',
        },
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', [
        'run',
        '-d',
        '-v',
        '/host/data:/container/data',
        '-v',
        '/host/logs:/container/logs',
        'database',
      ])
    })

    it('should start a container with rm flag', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.start('temp-task', {
        rm: true,
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', [
        'run',
        '-d',
        '--rm',
        'temp-task',
      ])
    })

    it('should start a container in attached mode', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.start('interactive', {
        detached: false,
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', ['run', 'interactive'])
    })

    it('should start a container with additional args', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.start('command-runner', {
        args: ['--verbose', '--debug'],
      })

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', [
        'run',
        '-d',
        '--verbose',
        '--debug',
        'command-runner',
      ])
    })

    it('should return error when container start fails', async () => {
      mockChildProcess({ stderr: 'Image not found', exitCode: 1 })

      const result = await runtime.start('nonexistent-image')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Image not found')
    })

    it('should handle spawn errors', async () => {
      mockChildProcess({ error: new Error('Spawn failed') })

      const result = await runtime.start('test-image')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('stop', () => {
    it('should stop a running container', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.stop('container123')

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', ['stop', 'container123'])
    })

    it('should return error when stop fails', async () => {
      mockChildProcess({ stderr: 'Container not found', exitCode: 1 })

      const result = await runtime.stop('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Container not found')
    })

    it('should handle stop errors gracefully', async () => {
      mockChildProcess({ error: new Error('Stop failed') })

      const result = await runtime.stop('container123')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('remove', () => {
    it('should remove a stopped container', async () => {
      mockChildProcess({ stdout: 'container123', exitCode: 0 })

      const result = await runtime.remove('container123')

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('container', ['rm', 'container123'])
    })

    it('should return error when remove fails', async () => {
      mockChildProcess({ stderr: 'Container is still running', exitCode: 1 })

      const result = await runtime.remove('running-container')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Container is still running')
    })

    it('should handle remove errors gracefully', async () => {
      mockChildProcess({ error: new Error('Remove failed') })

      const result = await runtime.remove('container123')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('list', () => {
    it('should list containers with JSON format', async () => {
      const jsonOutput = JSON.stringify([
        { ID: 'abc123', IMAGE: 'nginx', STATE: 'running', ADDR: '192.168.1.1' },
        { ID: 'def456', IMAGE: 'postgres', STATE: 'running', ADDR: '192.168.1.2' },
      ])
      mockChildProcess({ stdout: jsonOutput, exitCode: 0 })

      const result = await runtime.list()

      expect(result.success).toBe(true)
      expect(result.containers).toHaveLength(2)
      expect(result.containers[0]).toEqual({
        id: 'abc123',
        name: 'abc123',
        image: 'nginx',
        state: 'running',
        ipAddress: '192.168.1.1',
      })
      expect(mockSpawn).toHaveBeenCalledWith('container', ['list', '--format', 'json'])
    })

    it('should parse table format when JSON parsing fails', async () => {
      const tableOutput = `ID       IMAGE      STATE     ADDR
abc123   nginx      running   192.168.1.1
def456   postgres   running   192.168.1.2`
      mockChildProcess({ stdout: tableOutput, exitCode: 0 })

      const result = await runtime.list()

      expect(result.success).toBe(true)
      expect(result.containers).toHaveLength(2)
      expect(result.containers[0].id).toBe('abc123')
      expect(result.containers[0].image).toBe('nginx')
    })

    it('should return empty array when no containers exist', async () => {
      mockChildProcess({ stdout: 'ID       IMAGE      STATE     ADDR\n', exitCode: 0 })

      const result = await runtime.list()

      expect(result.success).toBe(true)
      expect(result.containers).toHaveLength(0)
    })

    it('should return error when list command fails', async () => {
      mockChildProcess({ stderr: 'Failed to list containers', exitCode: 1 })

      const result = await runtime.list()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to list containers')
    })

    it('should handle list errors gracefully', async () => {
      mockChildProcess({ error: new Error('List failed') })

      const result = await runtime.list()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('logs', () => {
    it('should retrieve container logs', async () => {
      const logOutput = 'Container started successfully\nListening on port 3000'
      mockChildProcess({ stdout: logOutput, exitCode: 0 })

      const result = await runtime.logs('container123')

      expect(result.success).toBe(true)
      expect(result.logs).toBe(logOutput)
      expect(mockSpawn).toHaveBeenCalledWith('container', ['logs', 'container123'])
    })

    it('should return error when logs command fails', async () => {
      mockChildProcess({ stderr: 'Container not found', exitCode: 1 })

      const result = await runtime.logs('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Container not found')
    })

    it('should handle logs errors gracefully', async () => {
      mockChildProcess({ error: new Error('Logs failed') })

      const result = await runtime.logs('container123')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('inspect', () => {
    it('should inspect a container and return details', async () => {
      const inspectData = [
        {
          id: 'abc123',
          configuration: {
            id: 'test-container',
            image: { reference: 'nginx:latest' },
          },
          state: 'running',
          network: { ipAddress: '192.168.1.1' },
          created: '2024-01-01T00:00:00Z',
        },
      ]
      mockChildProcess({ stdout: JSON.stringify(inspectData), exitCode: 0 })

      const result = await runtime.inspect('abc123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('abc123')
      expect(result?.name).toBe('test-container')
      expect(result?.image).toBe('nginx:latest')
      expect(result?.state).toBe('running')
      expect(result?.ipAddress).toBe('192.168.1.1')
      expect(mockSpawn).toHaveBeenCalledWith('container', ['inspect', 'abc123'])
    })

    it('should return null when inspect fails', async () => {
      mockChildProcess({ stderr: 'Container not found', exitCode: 1 })

      const result = await runtime.inspect('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle invalid JSON gracefully', async () => {
      mockChildProcess({ stdout: 'invalid json', exitCode: 0 })

      const result = await runtime.inspect('container123')

      expect(result).toBeNull()
    })

    it('should handle inspect errors gracefully', async () => {
      mockChildProcess({ error: new Error('Inspect failed') })

      const result = await runtime.inspect('container123')

      expect(result).toBeNull()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete container lifecycle', async () => {
      // Start container
      mockChildProcess({ stdout: 'container123', exitCode: 0 })
      const startResult = await runtime.start('test-image', { name: 'test' })
      expect(startResult.success).toBe(true)

      // List containers
      mockChildProcess({
        stdout: JSON.stringify([{ ID: 'container123', IMAGE: 'test-image', STATE: 'running' }]),
        exitCode: 0,
      })
      const listResult = await runtime.list()
      expect(listResult.success).toBe(true)
      expect(listResult.containers).toHaveLength(1)

      // Get logs
      mockChildProcess({ stdout: 'Application started', exitCode: 0 })
      const logsResult = await runtime.logs('container123')
      expect(logsResult.success).toBe(true)

      // Stop container
      mockChildProcess({ stdout: '', exitCode: 0 })
      const stopResult = await runtime.stop('container123')
      expect(stopResult.success).toBe(true)

      // Remove container
      mockChildProcess({ stdout: '', exitCode: 0 })
      const removeResult = await runtime.remove('container123')
      expect(removeResult.success).toBe(true)
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
