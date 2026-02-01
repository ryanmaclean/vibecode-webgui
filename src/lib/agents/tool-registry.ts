/**
 * Tool Registry for OpenAI Agents
 * Manages registration, execution, and lifecycle of agent tools
 *
 * Features:
 * - Dynamic tool registration
 * - Type-safe tool handlers
 * - Rate limiting per tool
 * - Tool categorization and tagging
 * - Execution metrics and monitoring
 * - Error handling and validation
 */

import {
  FunctionTool,
  ToolCall,
  ToolOutput,
  RegisteredTool,
  ToolHandler,
} from '@/types/openai-agents'
// import { createLogger } from '@/lib/logger'

const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log
}

interface RateLimitState {
  calls: number[]
  windowMs: number
  maxCalls: number
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map()
  private rateLimits: Map<string, RateLimitState> = new Map()
  private executionMetrics: Map<
    string,
    {
      totalCalls: number
      successfulCalls: number
      failedCalls: number
      totalDuration: number
      lastError?: string
    }
  > = new Map()

  /**
   * Register a new tool
   */
  register(
    name: string,
    definition: Omit<FunctionTool['function'], 'name'>,
    handler: ToolHandler,
    metadata?: RegisteredTool['metadata']
  ): void {
    if (this.tools.has(name)) {
      console.warn('Tool already registered, overwriting', { name })
    }

    const tool: RegisteredTool = {
      definition: {
        type: 'function',
        function: {
          name,
          ...definition,
        },
      },
      handler,
      metadata,
    }

    this.tools.set(name, tool)

    // Initialize rate limit state if configured
    if (metadata?.rateLimit) {
      this.rateLimits.set(name, {
        calls: [],
        windowMs: metadata.rateLimit.windowMs,
        maxCalls: metadata.rateLimit.maxCalls,
      })
    }

    // Initialize metrics
    this.executionMetrics.set(name, {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
    })

    console.info('Tool registered', {
      name,
      category: metadata?.category,
      tags: metadata?.tags,
      rateLimit: metadata?.rateLimit,
    })
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const existed = this.tools.delete(name)
    this.rateLimits.delete(name)
    this.executionMetrics.delete(name)

    if (existed) {
      console.info('Tool unregistered', { name })
    }

    return existed
  }

  /**
   * Get a registered tool
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Get all registered tool definitions
   */
  getDefinitions(filter?: {
    category?: string
    tags?: string[]
  }): FunctionTool[] {
    let tools = Array.from(this.tools.values())

    if (filter?.category) {
      tools = tools.filter((t) => t.metadata?.category === filter.category)
    }

    if (filter?.tags && filter.tags.length > 0) {
      tools = tools.filter((t) =>
        filter.tags!.some((tag) => t.metadata?.tags?.includes(tag))
      )
    }

    return tools.map((t) => t.definition)
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall: ToolCall): Promise<ToolOutput> {
    const toolName = toolCall.function.name
    const tool = this.tools.get(toolName)

    if (!tool) {
      console.error('Tool not found', { toolName })
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: `Tool '${toolName}' not found`,
        }),
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(toolName)) {
      console.warn('Tool rate limit exceeded', { toolName })
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: 'Rate limit exceeded',
        }),
      }
    }

    // Parse arguments
    let args: Record<string, unknown>
    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch (error) {
      console.error('Failed to parse tool arguments', {
        toolName,
        arguments: toolCall.function.arguments,
        error,
      })
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: 'Invalid arguments format',
        }),
      }
    }

    // Execute tool
    const startTime = Date.now()
    const metrics = this.executionMetrics.get(toolName)!
    metrics.totalCalls++

    try {
      console.info('Executing tool', { toolName, args })

      const result = await tool.handler(args)

      const duration = Date.now() - startTime
      metrics.successfulCalls++
      metrics.totalDuration += duration

      console.info('Tool executed successfully', {
        toolName,
        duration,
      })

      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify(result),
      }
    } catch (error) {
      const duration = Date.now() - startTime
      metrics.failedCalls++
      metrics.totalDuration += duration
      metrics.lastError =
        error instanceof Error ? error.message : String(error)

      console.error('Tool execution failed', {
        toolName,
        error: metrics.lastError,
        duration,
      })

      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: metrics.lastError,
        }),
      }
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeBatch(toolCalls: ToolCall[]): Promise<ToolOutput[]> {
    console.info('Executing tool batch', { count: toolCalls.length })

    const results = await Promise.all(
      toolCalls.map((call) => this.execute(call))
    )

    return results
  }

  /**
   * Get execution metrics for a tool
   */
  getMetrics(name: string) {
    const metrics = this.executionMetrics.get(name)
    if (!metrics) {
      return null
    }

    return {
      ...metrics,
      averageDuration:
        metrics.totalCalls > 0
          ? metrics.totalDuration / metrics.totalCalls
          : 0,
      successRate:
        metrics.totalCalls > 0
          ? metrics.successfulCalls / metrics.totalCalls
          : 0,
    }
  }

  /**
   * Get metrics for all tools
   */
  getAllMetrics() {
    const allMetrics: Record<string, ReturnType<typeof this.getMetrics>> = {}

    for (const [name] of this.tools) {
      allMetrics[name] = this.getMetrics(name)
    }

    return allMetrics
  }

  /**
   * Reset metrics for a tool
   */
  resetMetrics(name: string): void {
    if (this.executionMetrics.has(name)) {
      this.executionMetrics.set(name, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalDuration: 0,
      })
      console.info('Tool metrics reset', { name })
    }
  }

  /**
   * List all registered tools with metadata
   */
  list(): Array<{
    name: string
    description: string
    category?: string
    tags?: string[]
    metrics: ReturnType<ToolRegistry['getMetrics']>
  }> {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.definition.function.description,
      category: tool.metadata?.category,
      tags: tool.metadata?.tags,
      metrics: this.getMetrics(name),
    }))
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    const count = this.tools.size
    this.tools.clear()
    this.rateLimits.clear()
    this.executionMetrics.clear()

    console.info('All tools cleared', { count })
  }

  // Private Helper Methods

  /**
   * Check if a tool call is within rate limit
   */
  private checkRateLimit(toolName: string): boolean {
    const limitState = this.rateLimits.get(toolName)
    if (!limitState) {
      return true // No rate limit configured
    }

    const now = Date.now()
    const windowStart = now - limitState.windowMs

    // Remove old calls outside the window
    limitState.calls = limitState.calls.filter((time) => time > windowStart)

    // Check if we're within the limit
    if (limitState.calls.length >= limitState.maxCalls) {
      return false
    }

    // Record this call
    limitState.calls.push(now)
    return true
  }
}

// Global singleton instance
let globalRegistry: ToolRegistry | null = null

/**
 * Get the global tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry()
    console.info('Global tool registry created')
  }
  return globalRegistry
}

/**
 * Register built-in tools
 */
export function registerBuiltInTools(registry: ToolRegistry): void {
  // File operations tool
  registry.register(
    'read_file',
    {
      description: 'Read the contents of a file from the workspace',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path relative to workspace root',
          },
        },
        required: ['path'],
      },
    },
    async (args) => {
      const path = args.path as string
      // Implementation would integrate with file system
      return { content: `Contents of ${path}`, path }
    },
    {
      category: 'filesystem',
      tags: ['read', 'file'],
      rateLimit: { maxCalls: 100, windowMs: 60000 },
    }
  )

  // Code execution tool
  registry.register(
    'execute_code',
    {
      description: 'Execute code in a sandboxed environment',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The code to execute',
          },
          language: {
            type: 'string',
            enum: ['javascript', 'python', 'typescript'],
            description: 'Programming language',
          },
        },
        required: ['code', 'language'],
      },
    },
    async (args) => {
      const { code, language } = args as {
        code: string
        language: string
      }
      // Implementation would use code interpreter
      return { output: `Executed ${language} code`, code }
    },
    {
      category: 'execution',
      tags: ['code', 'run'],
      rateLimit: { maxCalls: 50, windowMs: 60000 },
    }
  )

  // Search tool
  registry.register(
    'search_workspace',
    {
      description: 'Search for files and code in the workspace',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          fileTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'File extensions to search',
          },
        },
        required: ['query'],
      },
    },
    async (args) => {
      const { query, fileTypes } = args as {
        query: string
        fileTypes?: string[]
      }
      // Implementation would use vector search
      return {
        results: [],
        query,
        fileTypes,
      }
    },
    {
      category: 'search',
      tags: ['find', 'search', 'query'],
      rateLimit: { maxCalls: 200, windowMs: 60000 },
    }
  )

  // Terminal command tool
  registry.register(
    'run_terminal_command',
    {
      description: 'Execute a terminal command in the workspace',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute',
          },
          workingDirectory: {
            type: 'string',
            description: 'Working directory for command execution',
          },
        },
        required: ['command'],
      },
    },
    async (args) => {
      const { command, workingDirectory } = args as {
        command: string
        workingDirectory?: string
      }
      // Implementation would use terminal integration
      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
        command,
        workingDirectory,
      }
    },
    {
      category: 'terminal',
      tags: ['shell', 'command', 'exec'],
      rateLimit: { maxCalls: 30, windowMs: 60000 },
    }
  )

  console.info('Built-in tools registered', {
    count: 4,
  })
}
