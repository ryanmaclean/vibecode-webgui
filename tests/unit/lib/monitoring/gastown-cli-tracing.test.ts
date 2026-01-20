/**
 * Unit Tests for Gas Town CLI Tracing Module
 * Tests tracing for gt and bd CLI command execution
 */

import { jest } from '@jest/globals'
import type { ChildProcess, SpawnOptions } from 'child_process'
import { EventEmitter } from 'events'

// Mock logger module
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Create mock spawn implementation
const mockSpawn = jest.fn()
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}))

import {
  createCLITraceContext,
  getDatadogEnvVars,
  categorizeGTCommand,
  categorizeBDCommand,
  executeWithTracing,
  gt,
  gtUp,
  gtDown,
  gtStatus,
  gtSling,
  gtRefineryStart,
  gtRefineryStop,
  gtPolecatStatus,
  gtHook,
  gtMailInbox,
  bd,
  bdCreate,
  bdList,
  bdShow,
  bdComplete,
  bdSearch,
  executeCommandSequence,
  executeCommandsParallel,
  recordCLIMetrics,
  createTracedCommand,
  type CLITraceContext,
  type CLICommandResult,
  type CLICommandOptions,
} from '@/lib/monitoring/gastown-cli-tracing'
import { logger } from '@/lib/logger'

const mockLogger = logger as jest.Mocked<typeof logger>

/**
 * Helper to create a mock child process
 */
function createMockProcess(
  exitCode: number = 0,
  stdout: string = '',
  stderr: string = ''
): ChildProcess {
  const proc = new EventEmitter() as ChildProcess
  proc.stdout = new EventEmitter() as NodeJS.ReadableStream
  proc.stderr = new EventEmitter() as NodeJS.ReadableStream
  proc.kill = jest.fn()

  // Emit data and close events asynchronously
  setImmediate(() => {
    if (stdout) {
      proc.stdout!.emit('data', Buffer.from(stdout))
    }
    if (stderr) {
      proc.stderr!.emit('data', Buffer.from(stderr))
    }
    proc.emit('close', exitCode)
  })

  return proc
}

/**
 * Helper to create a mock process that emits an error
 */
function createErrorProcess(error: Error): ChildProcess {
  const proc = new EventEmitter() as ChildProcess
  proc.stdout = new EventEmitter() as NodeJS.ReadableStream
  proc.stderr = new EventEmitter() as NodeJS.ReadableStream
  proc.kill = jest.fn()

  setImmediate(() => {
    proc.emit('error', error)
  })

  return proc
}

describe('Gas Town CLI Tracing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSpawn.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('createCLITraceContext', () => {
    it('should create trace context for gt command', () => {
      const context = createCLITraceContext('gt', ['status'])

      expect(context).toHaveProperty('traceId')
      expect(context).toHaveProperty('spanId')
      expect(context.operation).toBe('gt status')
      expect(context.service).toBe('gastown-cli')
      expect(context.tags['cli.command']).toBe('gt')
      expect(context.tags['cli.subcommand']).toBe('status')
    })

    it('should create trace context for bd command', () => {
      const context = createCLITraceContext('bd', ['list'])

      expect(context.service).toBe('beads-cli')
      expect(context.tags['cli.command']).toBe('bd')
    })

    it('should use parent trace ID if provided', () => {
      const options: CLICommandOptions = {
        parentContext: {
          traceId: 'parent-trace-id',
          spanId: 'parent-span-id',
        },
      }

      const context = createCLITraceContext('gt', ['up'], options)

      expect(context.traceId).toBe('parent-trace-id')
      expect(context.parentSpanId).toBe('parent-span-id')
    })

    it('should generate new trace ID if no parent provided', () => {
      const context = createCLITraceContext('gt', ['down'])

      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/)
      expect(context.spanId).toMatch(/^[0-9a-f]{16}$/)
    })

    it('should include custom tags', () => {
      const options: CLICommandOptions = {
        tags: {
          'custom.tag': 'custom-value',
        },
      }

      const context = createCLITraceContext('gt', ['sling', 'bead-123'], options)

      expect(context.tags['custom.tag']).toBe('custom-value')
    })

    it('should include full command in tags', () => {
      const context = createCLITraceContext('gt', ['sling', 'bead-123', 'target'])

      expect(context.tags['cli.full_command']).toBe('gt sling bead-123 target')
      expect(context.tags['cli.args']).toBe('bead-123 target')
    })

    it('should handle empty args', () => {
      const context = createCLITraceContext('gt', [])

      expect(context.operation).toBe('gt')
      expect(context.tags['cli.subcommand']).toBe('')
    })
  })

  describe('getDatadogEnvVars', () => {
    it('should return Datadog environment variables', () => {
      const context: CLITraceContext = {
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        parentSpanId: 'parent-span-id',
        operation: 'gt status',
        service: 'gastown-cli',
        startTime: Date.now(),
        tags: {},
      }

      const envVars = getDatadogEnvVars(context)

      expect(envVars.DD_TRACE_ID).toBe('test-trace-id')
      expect(envVars.DD_SPAN_ID).toBe('test-span-id')
      expect(envVars.DD_PARENT_ID).toBe('parent-span-id')
      expect(envVars.DD_SERVICE).toBe('gastown-cli')
      expect(envVars.DD_TRACE_PROPAGATION_STYLE).toBe('datadog')
    })

    it('should use empty string for missing parent span', () => {
      const context: CLITraceContext = {
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        operation: 'gt status',
        service: 'gastown-cli',
        startTime: Date.now(),
        tags: {},
      }

      const envVars = getDatadogEnvVars(context)

      expect(envVars.DD_PARENT_ID).toBe('')
    })
  })

  describe('categorizeGTCommand', () => {
    it('should categorize lifecycle commands', () => {
      expect(categorizeGTCommand('up')).toBe('lifecycle')
      expect(categorizeGTCommand('down')).toBe('lifecycle')
      expect(categorizeGTCommand('start')).toBe('lifecycle')
      expect(categorizeGTCommand('shutdown')).toBe('lifecycle')
    })

    it('should categorize status command', () => {
      expect(categorizeGTCommand('status')).toBe('status')
    })

    it('should categorize work commands', () => {
      expect(categorizeGTCommand('sling')).toBe('work')
      expect(categorizeGTCommand('convoy')).toBe('work')
      expect(categorizeGTCommand('ready')).toBe('work')
      expect(categorizeGTCommand('done')).toBe('work')
    })

    it('should categorize agent commands', () => {
      expect(categorizeGTCommand('polecat')).toBe('agent')
      expect(categorizeGTCommand('refinery')).toBe('agent')
      expect(categorizeGTCommand('mayor')).toBe('agent')
    })

    it('should categorize workspace commands', () => {
      expect(categorizeGTCommand('init')).toBe('workspace')
      expect(categorizeGTCommand('crew')).toBe('workspace')
      expect(categorizeGTCommand('rig')).toBe('workspace')
    })

    it('should categorize mail commands', () => {
      expect(categorizeGTCommand('mail')).toBe('mail')
    })

    it('should return other for unknown commands', () => {
      expect(categorizeGTCommand('unknown')).toBe('other')
      expect(categorizeGTCommand('custom')).toBe('other')
    })
  })

  describe('categorizeBDCommand', () => {
    it('should categorize create commands', () => {
      expect(categorizeBDCommand('create')).toBe('create')
      expect(categorizeBDCommand('new')).toBe('create')
    })

    it('should categorize read commands', () => {
      expect(categorizeBDCommand('list')).toBe('read')
      expect(categorizeBDCommand('show')).toBe('read')
      expect(categorizeBDCommand('search')).toBe('read')
    })

    it('should categorize update commands', () => {
      expect(categorizeBDCommand('edit')).toBe('update')
      expect(categorizeBDCommand('set-state')).toBe('update')
      expect(categorizeBDCommand('label')).toBe('update')
    })

    it('should categorize delete commands', () => {
      expect(categorizeBDCommand('close')).toBe('delete')
      expect(categorizeBDCommand('delete')).toBe('delete')
      expect(categorizeBDCommand('complete')).toBe('delete')
    })

    it('should return other for unknown commands', () => {
      expect(categorizeBDCommand('unknown')).toBe('other')
    })
  })

  describe('executeWithTracing', () => {
    it('should execute command and return result', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, 'output', ''))

      const result = await executeWithTracing('gt', ['status'])

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['status'],
        expect.objectContaining({
          shell: false,
        })
      )
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('output')
      expect(result.traceContext.operation).toBe('gt status')
    })

    it('should inject Datadog environment variables', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      await executeWithTracing('gt', ['up'])

      const spawnCall = mockSpawn.mock.calls[0] as [string, string[], SpawnOptions]
      const env = spawnCall[2].env as Record<string, string>

      expect(env.DD_TRACE_ID).toBeDefined()
      expect(env.DD_SPAN_ID).toBeDefined()
      expect(env.DD_SERVICE).toBe('gastown-cli')
    })

    it('should log trace start', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      await executeWithTracing('gt', ['status'])

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting CLI trace'),
        expect.objectContaining({
          operation: 'gt status',
          service: 'gastown-cli',
        })
      )
    })

    it('should log successful completion', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, 'success'))

      await executeWithTracing('gt', ['status'])

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('CLI trace completed'),
        expect.objectContaining({
          exitCode: 0,
          success: true,
        })
      )
    })

    it('should log failed completion', async () => {
      mockSpawn.mockReturnValue(createMockProcess(1, '', 'error message'))

      await executeWithTracing('gt', ['invalid'])

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CLI trace failed'),
        expect.objectContaining({
          exitCode: 1,
          success: false,
        })
      )
    })

    it('should handle process errors', async () => {
      const error = new Error('spawn failed')
      mockSpawn.mockReturnValue(createErrorProcess(error))

      await expect(executeWithTracing('gt', ['status'])).rejects.toThrow('spawn failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CLI trace error'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'spawn failed',
          }),
        })
      )
    })

    it('should handle timeout', async () => {
      jest.useFakeTimers()

      const proc = new EventEmitter() as ChildProcess
      proc.stdout = new EventEmitter() as NodeJS.ReadableStream
      proc.stderr = new EventEmitter() as NodeJS.ReadableStream
      proc.kill = jest.fn().mockImplementation(() => {
        setImmediate(() => proc.emit('close', null))
      })

      mockSpawn.mockReturnValue(proc)

      const resultPromise = executeWithTracing('gt', ['slow'], { timeout: 1000 })

      jest.advanceTimersByTime(1001)

      const result = await resultPromise

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
      expect(result.traceContext.tags['cli.timeout']).toBe('true')

      jest.useRealTimers()
    })

    it('should use custom working directory', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      await executeWithTracing('gt', ['status'], { cwd: '/custom/path' })

      const spawnCall = mockSpawn.mock.calls[0] as [string, string[], SpawnOptions]
      expect(spawnCall[2].cwd).toBe('/custom/path')
    })

    it('should merge custom environment variables', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      await executeWithTracing('gt', ['status'], { env: { CUSTOM_VAR: 'value' } })

      const spawnCall = mockSpawn.mock.calls[0] as [string, string[], SpawnOptions]
      const env = spawnCall[2].env as Record<string, string>

      expect(env.CUSTOM_VAR).toBe('value')
      expect(env.DD_TRACE_ID).toBeDefined()
    })

    it('should add command category tag for gt commands', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      const result = await executeWithTracing('gt', ['sling', 'bead-123'])

      expect(result.traceContext.tags['gt.category']).toBe('work')
    })

    it('should add command category tag for bd commands', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      const result = await executeWithTracing('bd', ['create', 'title'])

      expect(result.traceContext.tags['bd.category']).toBe('create')
    })

    it('should record metrics on completion', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      await executeWithTracing('gt', ['status'])

      expect(mockLogger.info).toHaveBeenCalledWith(
        'gastown.cli.command',
        expect.objectContaining({
          command: 'gt',
          subcommand: 'status',
          success: true,
        })
      )
    })
  })

  describe('gt command wrappers', () => {
    beforeEach(() => {
      mockSpawn.mockReturnValue(createMockProcess(0))
    })

    it('gtUp should call gt up', async () => {
      await gtUp()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['up'],
        expect.any(Object)
      )
    })

    it('gtDown should call gt down', async () => {
      await gtDown()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['down'],
        expect.any(Object)
      )
    })

    it('gtStatus should call gt status', async () => {
      await gtStatus()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['status'],
        expect.any(Object)
      )
    })

    it('gtSling should call gt sling with bead ID', async () => {
      await gtSling('bead-123')

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['sling', 'bead-123'],
        expect.any(Object)
      )
    })

    it('gtSling should include target if provided', async () => {
      await gtSling('bead-123', 'vibecode/polecats/mica')

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['sling', 'bead-123', 'vibecode/polecats/mica'],
        expect.any(Object)
      )
    })

    it('gtRefineryStart should call gt refinery start', async () => {
      await gtRefineryStart()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['refinery', 'start'],
        expect.any(Object)
      )
    })

    it('gtRefineryStop should call gt refinery stop', async () => {
      await gtRefineryStop()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['refinery', 'stop'],
        expect.any(Object)
      )
    })

    it('gtPolecatStatus should call gt polecat status', async () => {
      await gtPolecatStatus('vibecode/mica')

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['polecat', 'status', 'vibecode/mica'],
        expect.any(Object)
      )
    })

    it('gtHook should call gt hook', async () => {
      await gtHook()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['hook'],
        expect.any(Object)
      )
    })

    it('gtMailInbox should call gt mail inbox', async () => {
      await gtMailInbox()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['mail', 'inbox'],
        expect.any(Object)
      )
    })
  })

  describe('bd command wrappers', () => {
    beforeEach(() => {
      mockSpawn.mockReturnValue(createMockProcess(0))
    })

    it('bdCreate should call bd create with title', async () => {
      await bdCreate('Test issue')

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        ['create', 'Test issue'],
        expect.any(Object)
      )
    })

    it('bdCreate should include options', async () => {
      await bdCreate('Test issue', {
        type: 'bug',
        priority: 'P1',
        labels: ['urgent', 'frontend'],
        body: 'Description',
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        [
          'create',
          'Test issue',
          '--type',
          'bug',
          '--priority',
          'P1',
          '--labels',
          'urgent,frontend',
          '--body',
          'Description',
        ],
        expect.any(Object)
      )
    })

    it('bdList should call bd list', async () => {
      await bdList()

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        ['list'],
        expect.any(Object)
      )
    })

    it('bdList should include options', async () => {
      await bdList({
        state: 'open',
        type: 'task',
        labels: ['gastown'],
        limit: 10,
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        [
          'list',
          '--state',
          'open',
          '--type',
          'task',
          '--labels',
          'gastown',
          '--limit',
          '10',
        ],
        expect.any(Object)
      )
    })

    it('bdShow should call bd show with bead ID', async () => {
      await bdShow('st-e29')

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        ['show', 'st-e29'],
        expect.any(Object)
      )
    })

    it('bdComplete should call bd complete with bead ID', async () => {
      await bdComplete('st-e29')

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        ['complete', 'st-e29'],
        expect.any(Object)
      )
    })

    it('bdSearch should call bd search with query', async () => {
      await bdSearch('datadog tracing')

      expect(mockSpawn).toHaveBeenCalledWith(
        'bd',
        ['search', 'datadog tracing'],
        expect.any(Object)
      )
    })
  })

  describe('executeCommandSequence', () => {
    it('should execute commands in sequence', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(0, 'first'))
        .mockReturnValueOnce(createMockProcess(0, 'second'))

      const results = await executeCommandSequence([
        { command: 'gt', args: ['status'] },
        { command: 'gt', args: ['up'] },
      ])

      expect(results).toHaveLength(2)
      expect(results[0].stdout).toBe('first')
      expect(results[1].stdout).toBe('second')
    })

    it('should stop on command failure', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(1, '', 'error'))
        .mockReturnValueOnce(createMockProcess(0, 'second'))

      const results = await executeCommandSequence([
        { command: 'gt', args: ['invalid'] },
        { command: 'gt', args: ['up'] },
      ])

      expect(results).toHaveLength(1)
      expect(results[0].exitCode).toBe(1)
    })

    it('should link traces in sequence', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(0))
        .mockReturnValueOnce(createMockProcess(0))

      const results = await executeCommandSequence([
        { command: 'gt', args: ['status'] },
        { command: 'gt', args: ['up'] },
      ])

      // All commands should share the same trace ID
      expect(results[0].traceContext.traceId).toBe(results[1].traceContext.traceId)
    })
  })

  describe('executeCommandsParallel', () => {
    it('should execute commands in parallel', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(0, 'first'))
        .mockReturnValueOnce(createMockProcess(0, 'second'))

      const results = await executeCommandsParallel([
        { command: 'gt', args: ['status'] },
        { command: 'bd', args: ['list'] },
      ])

      expect(results).toHaveLength(2)
      expect(mockSpawn).toHaveBeenCalledTimes(2)
    })

    it('should share parent trace ID', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(0))
        .mockReturnValueOnce(createMockProcess(0))

      const results = await executeCommandsParallel([
        { command: 'gt', args: ['status'] },
        { command: 'bd', args: ['list'] },
      ])

      expect(results[0].traceContext.traceId).toBe(results[1].traceContext.traceId)
    })
  })

  describe('recordCLIMetrics', () => {
    it('should record latency metric', () => {
      const result: CLICommandResult = {
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 150,
        traceContext: {
          traceId: 'trace-id',
          spanId: 'span-id',
          operation: 'gt status',
          service: 'gastown-cli',
          startTime: Date.now() - 150,
          tags: {
            'cli.command': 'gt',
            'cli.subcommand': 'status',
          },
        },
      }

      recordCLIMetrics(result)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'gastown.cli.latency',
        expect.objectContaining({
          metric_type: 'histogram',
          value: 150,
          tags: expect.objectContaining({
            command: 'gt',
            subcommand: 'status',
          }),
        })
      )
    })

    it('should record success counter', () => {
      const result: CLICommandResult = {
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 100,
        traceContext: {
          traceId: 'trace-id',
          spanId: 'span-id',
          operation: 'gt status',
          service: 'gastown-cli',
          startTime: Date.now(),
          tags: {
            'cli.command': 'gt',
            'cli.subcommand': 'status',
          },
        },
      }

      recordCLIMetrics(result)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'gastown.cli.success',
        expect.objectContaining({
          metric_type: 'counter',
          value: 1,
        })
      )
    })

    it('should record failure counter', () => {
      const result: CLICommandResult = {
        exitCode: 1,
        stdout: '',
        stderr: 'error',
        duration: 100,
        traceContext: {
          traceId: 'trace-id',
          spanId: 'span-id',
          operation: 'gt invalid',
          service: 'gastown-cli',
          startTime: Date.now(),
          tags: {
            'cli.command': 'gt',
            'cli.subcommand': 'invalid',
          },
        },
      }

      recordCLIMetrics(result)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'gastown.cli.failure',
        expect.objectContaining({
          metric_type: 'counter',
          value: 1,
          tags: expect.objectContaining({
            exit_code: '1',
          }),
        })
      )
    })
  })

  describe('createTracedCommand', () => {
    it('should create a traced command function', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, 'output'))

      const tracedGtStatus = createTracedCommand('gt', ['status'])
      const result = await tracedGtStatus()

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['status'],
        expect.any(Object)
      )
      expect(result.stdout).toBe('output')
    })

    it('should allow additional args', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      const tracedGtPolecat = createTracedCommand('gt', ['polecat'])
      await tracedGtPolecat(['status', 'vibecode/mica'])

      expect(mockSpawn).toHaveBeenCalledWith(
        'gt',
        ['polecat', 'status', 'vibecode/mica'],
        expect.any(Object)
      )
    })

    it('should record metrics', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      const tracedCommand = createTracedCommand('gt', ['status'])
      await tracedCommand()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'gastown.cli.latency',
        expect.any(Object)
      )
    })
  })

  describe('Integration Tests', () => {
    it('should trace complete gt workflow', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(0, 'Gas Town running'))
        .mockReturnValueOnce(createMockProcess(0, 'Bead slung'))
        .mockReturnValueOnce(createMockProcess(0, 'Hook: st-e29'))

      // Simulate a typical workflow
      const statusResult = await gtStatus()
      expect(statusResult.exitCode).toBe(0)

      const slingResult = await gtSling('st-e29', 'vibecode/polecats/mica')
      expect(slingResult.exitCode).toBe(0)

      const hookResult = await gtHook()
      expect(hookResult.exitCode).toBe(0)

      // Verify all commands were traced
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting CLI trace'),
        expect.objectContaining({ operation: 'gt status' })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting CLI trace'),
        expect.objectContaining({ operation: 'gt sling' })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting CLI trace'),
        expect.objectContaining({ operation: 'gt hook' })
      )
    })

    it('should trace bd issue lifecycle', async () => {
      mockSpawn
        .mockReturnValueOnce(createMockProcess(0, 'Created: st-e30'))
        .mockReturnValueOnce(createMockProcess(0, 'st-e30: Test issue'))
        .mockReturnValueOnce(createMockProcess(0, 'Completed: st-e30'))

      // Create issue
      const createResult = await bdCreate('Test issue', { type: 'task', priority: 'P2' })
      expect(createResult.exitCode).toBe(0)

      // Show issue
      const showResult = await bdShow('st-e30')
      expect(showResult.exitCode).toBe(0)

      // Complete issue
      const completeResult = await bdComplete('st-e30')
      expect(completeResult.exitCode).toBe(0)

      // Verify tracing for bd commands
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting CLI trace'),
        expect.objectContaining({ service: 'beads-cli' })
      )
    })

    it('should propagate trace context across services', async () => {
      mockSpawn.mockReturnValue(createMockProcess(0))

      const parentContext = {
        traceId: 'parent-trace-123',
        spanId: 'parent-span-456',
      }

      const result = await gt(['status'], { parentContext })

      expect(result.traceContext.traceId).toBe('parent-trace-123')
      expect(result.traceContext.parentSpanId).toBe('parent-span-456')

      // Verify env vars were set for child process
      const spawnCall = mockSpawn.mock.calls[0] as [string, string[], SpawnOptions]
      const env = spawnCall[2].env as Record<string, string>
      expect(env.DD_TRACE_ID).toBe('parent-trace-123')
      expect(env.DD_PARENT_ID).toBe('parent-span-456')
    })
  })
})
