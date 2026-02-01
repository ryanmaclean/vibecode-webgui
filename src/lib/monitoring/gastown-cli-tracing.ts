/**
 * Gas Town CLI Tracing for gt and bd commands
 *
 * Provides distributed tracing for Gas Town CLI tools (gt, bd).
 * Since gt/bd are external Go binaries, this module wraps subprocess
 * execution with tracing spans and injects trace context via environment variables.
 *
 * @see https://github.com/steveyegge/gastown - gt source
 * @see https://github.com/steveyegge/beads - bd source
 */

import { spawn, SpawnOptions } from 'child_process'
import StatsD from 'node-statsd'
import { logger } from '@/lib/logger'

/**
 * Trace context for CLI command execution
 */
export interface CLITraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  operation: string
  service: string
  startTime: number
  tags: Record<string, string>
}

/**
 * Result of a CLI command execution
 */
export interface CLICommandResult {
  exitCode: number
  stdout: string
  stderr: string
  duration: number
  traceContext: CLITraceContext
}

const metricsEnabled = (process.env.GASTOWN_METRICS_ENABLED || 'true').toLowerCase() !== 'false'
const statsdClient = metricsEnabled
  ? new StatsD({
      host: process.env.DD_AGENT_HOST || '127.0.0.1',
      port: Number.parseInt(process.env.DD_DOGSTATSD_PORT || '8125', 10),
      prefix: process.env.GASTOWN_STATSD_PREFIX || 'gastown.',
      globalTags: [
        `env:${process.env.DD_ENV || 'development'}`,
        `service:${process.env.DD_SERVICE || 'gastown-cli'}`,
        `version:${process.env.DD_VERSION || '0.1.0'}`,
      ],
    })
  : null

function emitMetric(name: string, value: number, type: 'count' | 'histogram' | 'gauge', tags: string[]) {
  if (!statsdClient) return
  if (type === 'count') {
    statsdClient.increment(name, value, 1, tags)
  } else if (type === 'histogram') {
    statsdClient.histogram(name, value, 1, tags)
  } else {
    statsdClient.gauge(name, value, 1, tags)
  }
}

function emitEvent(title: string, text: string, tags: string[], alertType: 'info' | 'success' | 'warning' | 'error' = 'info') {
  if (!statsdClient) return
  statsdClient.event(title, text, { alert_type: alertType, tags })
}

/**
 * Options for CLI command execution
 */
export interface CLICommandOptions {
  /** Working directory for the command */
  cwd?: string
  /** Additional environment variables */
  env?: Record<string, string>
  /** Timeout in milliseconds */
  timeout?: number
  /** Parent trace context for distributed tracing */
  parentContext?: Partial<CLITraceContext>
  /** Additional tags to add to the span */
  tags?: Record<string, string>
}

/**
 * gt command categories for organized tracing
 */
export type GTCommandCategory =
  | 'lifecycle' // up, down, start, shutdown
  | 'status' // status
  | 'work' // sling, convoy, ready, done, release
  | 'agent' // polecat, refinery, mayor, witness, deacon
  | 'workspace' // init, install, crew, rig
  | 'mail' // mail inbox, send, etc.
  | 'other'

/**
 * bd command categories for organized tracing
 */
export type BDCommandCategory =
  | 'create' // create
  | 'read' // list, show, search
  | 'update' // edit, set-state, label
  | 'delete' // close, delete
  | 'other'

/**
 * Generate a unique trace ID
 */
function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 32)
}

/**
 * Generate a unique span ID
 */
function generateSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16)
}

/**
 * Create a trace context for CLI command execution
 */
export function createCLITraceContext(
  command: string,
  args: string[],
  options: CLICommandOptions = {}
): CLITraceContext {
  const operation = `${command} ${args[0] || ''}`.trim()

  return {
    traceId: options.parentContext?.traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: options.parentContext?.spanId,
    operation,
    service: command === 'gt' ? 'gastown-cli' : 'beads-cli',
    startTime: Date.now(),
    tags: {
      'cli.command': command,
      'cli.subcommand': args[0] || '',
      'cli.args': args.slice(1).join(' '),
      'cli.full_command': `${command} ${args.join(' ')}`,
      ...options.tags,
    },
  }
}

/**
 * Get Datadog environment variables for trace context injection
 */
export function getDatadogEnvVars(context: CLITraceContext): Record<string, string> {
  return {
    DD_TRACE_ID: context.traceId,
    DD_SPAN_ID: context.spanId,
    DD_PARENT_ID: context.parentSpanId || '',
    DD_SERVICE: context.service,
    DD_ENV: process.env.DD_ENV || 'development',
    DD_VERSION: process.env.DD_VERSION || '0.1.0',
    // Enable trace propagation in child processes
    DD_TRACE_PROPAGATION_STYLE: 'datadog',
  }
}

/**
 * Categorize a gt command for better trace organization
 */
export function categorizeGTCommand(subcommand: string): GTCommandCategory {
  const categories: Record<GTCommandCategory, string[]> = {
    lifecycle: ['up', 'down', 'start', 'shutdown', 'daemon'],
    status: ['status'],
    work: ['sling', 'convoy', 'ready', 'done', 'release', 'hook', 'bead'],
    agent: ['polecat', 'refinery', 'mayor', 'witness', 'deacon', 'dog'],
    workspace: ['init', 'install', 'crew', 'rig', 'git-init', 'worktree'],
    mail: ['mail'],
    other: [],
  }

  for (const [category, commands] of Object.entries(categories)) {
    if (commands.includes(subcommand)) {
      return category as GTCommandCategory
    }
  }
  return 'other'
}

/**
 * Categorize a bd command for better trace organization
 */
export function categorizeBDCommand(subcommand: string): BDCommandCategory {
  const categories: Record<BDCommandCategory, string[]> = {
    create: ['create', 'new'],
    read: ['list', 'show', 'search', 'find'],
    update: ['edit', 'set-state', 'label', 'comment', 'gate'],
    delete: ['close', 'delete', 'complete'],
    other: [],
  }

  for (const [category, commands] of Object.entries(categories)) {
    if (commands.includes(subcommand)) {
      return category as BDCommandCategory
    }
  }
  return 'other'
}

/**
 * Execute a CLI command with tracing
 */
export async function executeWithTracing(
  command: string,
  args: string[],
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  const context = createCLITraceContext(command, args, options)
  const ddEnvVars = getDatadogEnvVars(context)

  // Add command category tag
  if (command === 'gt') {
    context.tags['gt.category'] = categorizeGTCommand(args[0] || '')
  } else if (command === 'bd') {
    context.tags['bd.category'] = categorizeBDCommand(args[0] || '')
  }

  // Log span start
  logger.info(`Starting CLI trace: ${context.operation}`, {
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: context.parentSpanId,
    service: context.service,
    operation: context.operation,
    ...context.tags,
  })

  const spawnOptions: SpawnOptions = {
    cwd: options.cwd || process.cwd(),
    env: {
      ...process.env,
      ...ddEnvVars,
      ...options.env,
    },
    shell: false,
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, spawnOptions)
    let stdout = ''
    let stderr = ''
    let timedOut = false

    // Set up timeout if specified
    let timeoutId: NodeJS.Timeout | undefined
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
      }, options.timeout)
    }

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const duration = Date.now() - context.startTime
      const exitCode = code ?? -1

      // Add result tags
      context.tags['cli.exit_code'] = String(exitCode)
      context.tags['cli.duration_ms'] = String(duration)
      context.tags['cli.success'] = String(exitCode === 0)

      if (timedOut) {
        context.tags['cli.timeout'] = 'true'
        context.tags['error.type'] = 'timeout'
        context.tags['error.message'] = `Command timed out after ${options.timeout}ms`
      }

      // Log span completion
      if (exitCode === 0) {
        logger.info(`CLI trace completed: ${context.operation}`, {
          traceId: context.traceId,
          spanId: context.spanId,
          service: context.service,
          duration,
          exitCode,
          success: true,
        })
      } else {
        logger.error(`CLI trace failed: ${context.operation}`, {
          traceId: context.traceId,
          spanId: context.spanId,
          service: context.service,
          duration,
          exitCode,
          success: false,
          stderr: stderr.substring(0, 1000), // Limit stderr in logs
          timedOut,
        })
      }

      // Record metrics
      logger.info('gastown.cli.command', {
        command,
        subcommand: args[0] || '',
        duration,
        exitCode,
        success: exitCode === 0,
        service: context.service,
      })

      resolve({
        exitCode,
        stdout,
        stderr,
        duration,
        traceContext: context,
      })
    })

    proc.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const duration = Date.now() - context.startTime

      context.tags['cli.exit_code'] = '-1'
      context.tags['cli.duration_ms'] = String(duration)
      context.tags['cli.success'] = 'false'
      context.tags['error.type'] = error.name
      context.tags['error.message'] = error.message

      logger.error(`CLI trace error: ${context.operation}`, {
        traceId: context.traceId,
        spanId: context.spanId,
        service: context.service,
        duration,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      })

      reject(error)
    })
  })
}

// ============================================================
// gt Command Wrappers
// ============================================================

/**
 * Execute a gt command with tracing
 */
export async function gt(
  args: string[],
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return executeWithTracing('gt', args, {
    ...options,
    tags: {
      ...options.tags,
      'span.kind': 'client',
      'component': 'gastown',
    },
  })
}

/**
 * gt up - Start Gas Town services
 */
export async function gtUp(options: CLICommandOptions = {}): Promise<CLICommandResult> {
  return gt(['up'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'up' },
  })
}

/**
 * gt down - Stop Gas Town services
 */
export async function gtDown(options: CLICommandOptions = {}): Promise<CLICommandResult> {
  return gt(['down'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'down' },
  })
}

/**
 * gt status - Get Gas Town status
 */
export async function gtStatus(options: CLICommandOptions = {}): Promise<CLICommandResult> {
  return gt(['status'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'status' },
  })
}

/**
 * gt sling - Sling work to a polecat
 */
export async function gtSling(
  beadId: string,
  target?: string,
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  const args = ['sling', beadId]
  if (target) {
    args.push(target)
  }
  return gt(args, {
    ...options,
    tags: {
      ...options.tags,
      'gt.operation': 'sling',
      'gt.bead_id': beadId,
      'bead.id': beadId,
      'gt.target': target || '',
    },
  })
}

/**
 * gt refinery start - Start the refinery
 */
export async function gtRefineryStart(
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return gt(['refinery', 'start'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'refinery.start' },
  })
}

/**
 * gt refinery stop - Stop the refinery
 */
export async function gtRefineryStop(
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return gt(['refinery', 'stop'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'refinery.stop' },
  })
}

/**
 * gt polecat status - Get polecat status
 */
export async function gtPolecatStatus(
  polecat: string,
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return gt(['polecat', 'status', polecat], {
    ...options,
    tags: {
      ...options.tags,
      'gt.operation': 'polecat.status',
      'gt.polecat': polecat,
    },
  })
}

/**
 * gt hook - Check the hook
 */
export async function gtHook(options: CLICommandOptions = {}): Promise<CLICommandResult> {
  return gt(['hook'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'hook' },
  })
}

/**
 * gt mail inbox - Check inbox
 */
export async function gtMailInbox(options: CLICommandOptions = {}): Promise<CLICommandResult> {
  return gt(['mail', 'inbox'], {
    ...options,
    tags: { ...options.tags, 'gt.operation': 'mail.inbox' },
  })
}

// ============================================================
// bd Command Wrappers
// ============================================================

/**
 * Execute a bd command with tracing
 */
export async function bd(
  args: string[],
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return executeWithTracing('bd', args, {
    ...options,
    tags: {
      ...options.tags,
      'span.kind': 'client',
      'component': 'beads',
    },
  })
}

/**
 * bd create - Create a new bead/issue
 */
export async function bdCreate(
  title: string,
  createOptions: {
    type?: string
    priority?: string
    labels?: string[]
    body?: string
  } = {},
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  const args = ['create', title]

  if (createOptions.type) {
    args.push('--type', createOptions.type)
  }
  if (createOptions.priority) {
    args.push('--priority', createOptions.priority)
  }
  if (createOptions.labels?.length) {
    args.push('--labels', createOptions.labels.join(','))
  }
  if (createOptions.body) {
    args.push('--body', createOptions.body)
  }

  return bd(args, {
    ...options,
    tags: {
      ...options.tags,
      'bd.operation': 'create',
      'bd.type': createOptions.type || '',
      'bd.priority': createOptions.priority || '',
    },
  })
}

/**
 * bd list - List beads/issues
 */
export async function bdList(
  listOptions: {
    state?: string
    type?: string
    labels?: string[]
    limit?: number
  } = {},
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  const args = ['list']

  if (listOptions.state) {
    args.push('--state', listOptions.state)
  }
  if (listOptions.type) {
    args.push('--type', listOptions.type)
  }
  if (listOptions.labels?.length) {
    args.push('--labels', listOptions.labels.join(','))
  }
  if (listOptions.limit) {
    args.push('--limit', String(listOptions.limit))
  }

  return bd(args, {
    ...options,
    tags: {
      ...options.tags,
      'bd.operation': 'list',
      'bd.state': listOptions.state || '',
      'bd.type': listOptions.type || '',
    },
  })
}

/**
 * bd show - Show bead/issue details
 */
export async function bdShow(
  beadId: string,
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return bd(['show', beadId], {
    ...options,
    tags: {
      ...options.tags,
      'bd.operation': 'show',
      'bd.bead_id': beadId,
      'bead.id': beadId,
    },
  })
}

/**
 * bd complete - Complete/close a bead
 */
export async function bdComplete(
  beadId: string,
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return bd(['complete', beadId], {
    ...options,
    tags: {
      ...options.tags,
      'bd.operation': 'complete',
      'bd.bead_id': beadId,
      'bead.id': beadId,
    },
  })
}

/**
 * bd search - Search beads
 */
export async function bdSearch(
  query: string,
  options: CLICommandOptions = {}
): Promise<CLICommandResult> {
  return bd(['search', query], {
    ...options,
    tags: {
      ...options.tags,
      'bd.operation': 'search',
      'bd.query': query,
    },
  })
}

// ============================================================
// Batch Operations with Tracing
// ============================================================

/**
 * Execute multiple CLI commands in sequence with linked traces
 */
export async function executeCommandSequence(
  commands: Array<{ command: string; args: string[] }>,
  options: CLICommandOptions = {}
): Promise<CLICommandResult[]> {
  const parentContext: Partial<CLITraceContext> = {
    traceId: options.parentContext?.traceId || generateTraceId(),
    spanId: generateSpanId(),
  }

  const results: CLICommandResult[] = []

  for (const cmd of commands) {
    const result = await executeWithTracing(cmd.command, cmd.args, {
      ...options,
      parentContext: {
        traceId: parentContext.traceId,
        spanId: results.length > 0 ? results[results.length - 1].traceContext.spanId : parentContext.spanId,
      },
    })
    results.push(result)

    // Stop if command failed
    if (result.exitCode !== 0) {
      break
    }
  }

  return results
}

/**
 * Execute multiple CLI commands in parallel with the same parent trace
 */
export async function executeCommandsParallel(
  commands: Array<{ command: string; args: string[] }>,
  options: CLICommandOptions = {}
): Promise<CLICommandResult[]> {
  const parentContext: Partial<CLITraceContext> = {
    traceId: options.parentContext?.traceId || generateTraceId(),
    spanId: generateSpanId(),
  }

  return Promise.all(
    commands.map((cmd) =>
      executeWithTracing(cmd.command, cmd.args, {
        ...options,
        parentContext,
      })
    )
  )
}

// ============================================================
// Metrics and Monitoring Helpers
// ============================================================

/**
 * Record CLI command metrics to Datadog
 */
export function recordCLIMetrics(result: CLICommandResult): void {
  const { traceContext, duration, exitCode } = result
  const command = traceContext.tags['cli.command']
  const subcommand = traceContext.tags['cli.subcommand']
  const success = exitCode === 0
  const category =
    command === 'gt'
      ? categorizeGTCommand(subcommand || '')
      : command === 'bd'
      ? categorizeBDCommand(subcommand || '')
      : 'other'

  // Latency histogram
  logger.info('gastown.cli.latency', {
    metric_type: 'histogram',
    value: duration,
    tags: {
      command,
      subcommand,
      service: traceContext.service,
      success: String(success),
    },
  })

  // Success/failure counter
  logger.info(success ? 'gastown.cli.success' : 'gastown.cli.failure', {
    metric_type: 'counter',
    value: 1,
    tags: {
      command,
      subcommand,
      service: traceContext.service,
      exit_code: String(exitCode),
    },
  })

  const tags = [
    `command:${command}`,
    `subcommand:${subcommand || 'none'}`,
    `category:${category}`,
    `service:${traceContext.service}`,
    `success:${String(success)}`,
    `exit_code:${exitCode}`,
  ]

  emitMetric('cli.command.count', 1, 'count', tags)
  emitMetric('cli.command.duration_ms', duration, 'histogram', tags)

  if (command === 'gt') {
    const roleCommands = new Set(['mayor', 'deacon', 'witness', 'refinery', 'polecat', 'dog'])
    if (roleCommands.has(subcommand)) {
      emitMetric('role.command.count', 1, 'count', [...tags, `role:${subcommand}`])
    }

    const stageMap: Record<string, string> = {
      sling: 'created',
      bead: 'created',
      hook: 'hooked',
      ready: 'assigned',
      convoy: 'working',
      done: 'completed',
      release: 'completed',
    }
    const stage = stageMap[subcommand || '']
    if (stage) {
      emitMetric(`bead.stage.${stage}`, 1, 'count', tags)
      emitEvent(
        'Bead stage',
        `stage=${stage} command=${command} ${subcommand}`,
        [...tags, `stage:${stage}`],
        success ? 'success' : 'warning'
      )
    }
  }
}

/**
 * Create a traced execution function for a specific command
 */
export function createTracedCommand(
  command: string,
  defaultArgs: string[] = [],
  defaultOptions: CLICommandOptions = {}
): (args?: string[], options?: CLICommandOptions) => Promise<CLICommandResult> {
  return async (args: string[] = [], options: CLICommandOptions = {}) => {
    const result = await executeWithTracing(command, [...defaultArgs, ...args], {
      ...defaultOptions,
      ...options,
      tags: {
        ...defaultOptions.tags,
        ...options.tags,
      },
    })
    recordCLIMetrics(result)
    return result
  }
}
