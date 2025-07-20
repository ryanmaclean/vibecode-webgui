/**
 * Enhanced Datadog Integration for VibeCode Platform
 * Monitors AI terminal features, Claude Code CLI usage, and OpenRouter API calls
 * Provides comprehensive observability for the enhanced platform
 */

import { StatsD } from 'node-statsd'
import tracer from 'dd-trace'

// Initialize Datadog tracer
tracer.init({
  service: 'vibecode-enhanced-platform',
  version: process.env.DD_VERSION || '2.0.0',
  env: process.env.DD_ENV || 'development',
  profiling: true,
  runtimeMetrics: true,
  plugins: false // We'll enable specific plugins
})

// Enable specific plugins for our stack
tracer.use('express', {
  hooks: {
    request: (span, req) => {
      span.setTag('user.workspace', req.headers['x-workspace-id'])
      span.setTag('user.session', req.headers['x-session-id'])
    }
  }
})

tracer.use('ws', {
  service: 'vibecode-websocket',
  hooks: {
    request: (span, info) => {
      span.setTag('websocket.type', info.type)
      span.setTag('workspace.id', info.workspaceId)
    }
  }
})

tracer.use('anthropic', {
  service: 'vibecode-claude',
  hooks: {
    request: (span, params) => {
      span.setTag('ai.provider', 'anthropic')
      span.setTag('ai.model', params.model)
      span.setTag('ai.max_tokens', params.max_tokens)
    }
  }
})

// StatsD client for custom metrics
const statsd = new StatsD({
  host: process.env.DD_STATSD_HOST || 'localhost',
  port: parseInt(process.env.DD_STATSD_PORT || '8125'),
  prefix: 'vibecode.',
  globalTags: [
    `env:${process.env.DD_ENV || 'development'}`,
    `service:${process.env.DD_SERVICE || 'vibecode-enhanced'}`,
    `version:${process.env.DD_VERSION || '2.0.0'}`
  ]
})

export class EnhancedDatadogMonitoring {
  private static instance: EnhancedDatadogMonitoring
  private terminalSessionMetrics = new Map<string, {
    startTime: number
    commandCount: number
    aiUsageCount: number
    lastActivity: number
  }>()

  static getInstance(): EnhancedDatadogMonitoring {
    if (!EnhancedDatadogMonitoring.instance) {
      EnhancedDatadogMonitoring.instance = new EnhancedDatadogMonitoring()
    }
    return EnhancedDatadogMonitoring.instance
  }

  /**
   * Track terminal session creation
   */
  trackTerminalSessionCreated(sessionId: string, workspaceId: string, userId: string) {
    const span = tracer.startSpan('terminal.session.create')
    span.setTag('session.id', sessionId)
    span.setTag('workspace.id', workspaceId)
    span.setTag('user.id', userId)
    span.setTag('terminal.type', 'enhanced-ai')
    
    // Store session metrics
    this.terminalSessionMetrics.set(sessionId, {
      startTime: Date.now(),
      commandCount: 0,
      aiUsageCount: 0,
      lastActivity: Date.now()
    })

    // Send metrics
    statsd.increment('terminal.sessions.created', 1, {
      workspace: workspaceId,
      terminal_type: 'enhanced-ai'
    })
    
    statsd.gauge('terminal.sessions.active', this.terminalSessionMetrics.size)

    span.finish()
  }

  /**
   * Track terminal command execution
   */
  trackTerminalCommand(sessionId: string, command: string, executionTime: number) {
    const span = tracer.startSpan('terminal.command.execute')
    span.setTag('session.id', sessionId)
    span.setTag('command.type', this.categorizeCommand(command))
    span.setTag('execution.time', executionTime)

    const session = this.terminalSessionMetrics.get(sessionId)
    if (session) {
      session.commandCount++
      session.lastActivity = Date.now()
    }

    // Send metrics
    statsd.increment('terminal.commands.executed', 1, {
      command_type: this.categorizeCommand(command),
      session: sessionId
    })

    statsd.histogram('terminal.command.execution_time', executionTime, {
      command_type: this.categorizeCommand(command)
    })

    span.finish()
  }

  /**
   * Track AI usage in terminal
   */
  trackAIUsage(sessionId: string, type: 'chat' | 'explain' | 'generate' | 'analyze', 
               provider: string, model: string, responseTime: number, tokenUsage?: number) {
    const span = tracer.startSpan('ai.usage')
    span.setTag('session.id', sessionId)
    span.setTag('ai.type', type)
    span.setTag('ai.provider', provider)
    span.setTag('ai.model', model)
    span.setTag('ai.response_time', responseTime)
    
    if (tokenUsage) {
      span.setTag('ai.tokens', tokenUsage)
    }

    const session = this.terminalSessionMetrics.get(sessionId)
    if (session) {
      session.aiUsageCount++
      session.lastActivity = Date.now()
    }

    // Send metrics
    statsd.increment('ai.requests', 1, {
      type,
      provider,
      model,
      context: 'terminal'
    })

    statsd.histogram('ai.response_time', responseTime, {
      type,
      provider,
      model
    })

    if (tokenUsage) {
      statsd.histogram('ai.tokens_used', tokenUsage, {
        type,
        provider,
        model
      })
    }

    span.finish()
  }

  /**
   * Track Claude Code CLI specific metrics
   */
  trackClaudeCodeCLI(sessionId: string, command: string, success: boolean, 
                     responseTime: number, errorType?: string) {
    const span = tracer.startSpan('claude.cli.command')
    span.setTag('session.id', sessionId)
    span.setTag('claude.command', command)
    span.setTag('claude.success', success)
    span.setTag('claude.response_time', responseTime)
    
    if (errorType) {
      span.setTag('claude.error_type', errorType)
    }

    // Send metrics
    statsd.increment('claude.cli.commands', 1, {
      command,
      success: success ? 'true' : 'false',
      error_type: errorType || 'none'
    })

    statsd.histogram('claude.cli.response_time', responseTime, {
      command,
      success: success ? 'true' : 'false'
    })

    span.finish()
  }

  /**
   * Track OpenRouter API usage
   */
  trackOpenRouterUsage(model: string, promptTokens: number, completionTokens: number,
                       responseTime: number, cost?: number) {
    const span = tracer.startSpan('openrouter.api.call')
    span.setTag('openrouter.model', model)
    span.setTag('openrouter.prompt_tokens', promptTokens)
    span.setTag('openrouter.completion_tokens', completionTokens)
    span.setTag('openrouter.response_time', responseTime)
    
    if (cost) {
      span.setTag('openrouter.cost', cost)
    }

    // Send metrics
    statsd.increment('openrouter.requests', 1, {
      model
    })

    statsd.histogram('openrouter.response_time', responseTime, {
      model
    })

    statsd.histogram('openrouter.prompt_tokens', promptTokens, {
      model
    })

    statsd.histogram('openrouter.completion_tokens', completionTokens, {
      model
    })

    if (cost) {
      statsd.histogram('openrouter.cost', cost, {
        model
      })
    }

    span.finish()
  }

  /**
   * Track terminal session ending
   */
  trackTerminalSessionEnded(sessionId: string, reason: 'user_close' | 'timeout' | 'error') {
    const span = tracer.startSpan('terminal.session.end')
    span.setTag('session.id', sessionId)
    span.setTag('session.end_reason', reason)

    const session = this.terminalSessionMetrics.get(sessionId)
    if (session) {
      const sessionDuration = Date.now() - session.startTime
      const inactiveTime = Date.now() - session.lastActivity

      span.setTag('session.duration', sessionDuration)
      span.setTag('session.commands', session.commandCount)
      span.setTag('session.ai_usage', session.aiUsageCount)
      span.setTag('session.inactive_time', inactiveTime)

      // Send metrics
      statsd.histogram('terminal.session.duration', sessionDuration, {
        end_reason: reason
      })

      statsd.histogram('terminal.session.commands', session.commandCount, {
        end_reason: reason
      })

      statsd.histogram('terminal.session.ai_usage', session.aiUsageCount, {
        end_reason: reason
      })

      this.terminalSessionMetrics.delete(sessionId)
    }

    statsd.gauge('terminal.sessions.active', this.terminalSessionMetrics.size)

    span.finish()
  }

  /**
   * Track workspace activity
   */
  trackWorkspaceActivity(workspaceId: string, activity: string, metadata?: Record<string, any>) {
    const span = tracer.startSpan('workspace.activity')
    span.setTag('workspace.id', workspaceId)
    span.setTag('workspace.activity', activity)
    
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        span.setTag(`workspace.${key}`, value)
      })
    }

    statsd.increment('workspace.activities', 1, {
      workspace: workspaceId,
      activity
    })

    span.finish()
  }

  /**
   * Track AI suggestions and their effectiveness
   */
  trackAISuggestion(sessionId: string, trigger: string, suggestion: string, 
                    accepted?: boolean, helpfulness?: number) {
    const span = tracer.startSpan('ai.suggestion')
    span.setTag('session.id', sessionId)
    span.setTag('suggestion.trigger', trigger)
    span.setTag('suggestion.length', suggestion.length)
    
    if (accepted !== undefined) {
      span.setTag('suggestion.accepted', accepted)
    }
    
    if (helpfulness !== undefined) {
      span.setTag('suggestion.helpfulness', helpfulness)
    }

    statsd.increment('ai.suggestions', 1, {
      trigger,
      accepted: accepted ? 'true' : 'false'
    })

    if (helpfulness !== undefined) {
      statsd.histogram('ai.suggestion.helpfulness', helpfulness, {
        trigger
      })
    }

    span.finish()
  }

  /**
   * Track system performance
   */
  trackSystemPerformance() {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    // Memory metrics
    statsd.gauge('system.memory.used', memUsage.heapUsed)
    statsd.gauge('system.memory.total', memUsage.heapTotal)
    statsd.gauge('system.memory.external', memUsage.external)

    // CPU metrics
    statsd.gauge('system.cpu.user', cpuUsage.user)
    statsd.gauge('system.cpu.system', cpuUsage.system)

    // Active sessions
    statsd.gauge('terminal.sessions.active', this.terminalSessionMetrics.size)

    // Terminal session health
    let healthySessions = 0
    const currentTime = Date.now()
    
    for (const session of this.terminalSessionMetrics.values()) {
      if (currentTime - session.lastActivity < 30000) { // Active in last 30 seconds
        healthySessions++
      }
    }

    statsd.gauge('terminal.sessions.healthy', healthySessions)
  }

  /**
   * Start periodic system monitoring
   */
  startSystemMonitoring(intervalMs: number = 60000) {
    setInterval(() => {
      this.trackSystemPerformance()
    }, intervalMs)
  }

  /**
   * Categorize command for better metrics
   */
  private categorizeCommand(command: string): string {
    const cmd = command.trim().toLowerCase()
    
    if (cmd.startsWith('git ')) return 'git'
    if (cmd.startsWith('npm ') || cmd.startsWith('yarn ') || cmd.startsWith('pnpm ')) return 'package_manager'
    if (cmd.startsWith('docker ')) return 'docker'
    if (cmd.startsWith('kubectl ')) return 'kubernetes'
    if (cmd.includes('claude') || cmd.includes('ai>')) return 'ai_command'
    if (['ls', 'dir', 'pwd', 'cd'].includes(cmd.split(' ')[0])) return 'navigation'
    if (['cat', 'less', 'more', 'head', 'tail'].includes(cmd.split(' ')[0])) return 'file_viewing'
    if (['nano', 'vim', 'code', 'emacs'].includes(cmd.split(' ')[0])) return 'editor'
    if (['mkdir', 'rmdir', 'rm', 'cp', 'mv'].includes(cmd.split(' ')[0])) return 'file_operations'
    
    return 'other'
  }

  /**
   * Create custom dashboard data
   */
  getDashboardData() {
    const activeSessions = Array.from(this.terminalSessionMetrics.entries()).map(([id, data]) => ({
      sessionId: id,
      duration: Date.now() - data.startTime,
      commandCount: data.commandCount,
      aiUsageCount: data.aiUsageCount,
      lastActivity: Date.now() - data.lastActivity
    }))

    return {
      activeSessions,
      totalActiveSessions: this.terminalSessionMetrics.size,
      systemHealth: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    }
  }
}

// Initialize and export singleton
export const datadogMonitoring = EnhancedDatadogMonitoring.getInstance()

// Start system monitoring
datadogMonitoring.startSystemMonitoring()

// Export tracer for manual instrumentation
export { tracer }

// Log startup
console.log('🐕 Enhanced Datadog monitoring initialized for VibeCode Platform')
console.log(`📊 Service: ${process.env.DD_SERVICE || 'vibecode-enhanced'}`)
console.log(`🌍 Environment: ${process.env.DD_ENV || 'development'}`)
console.log(`📈 Version: ${process.env.DD_VERSION || '2.0.0'}`)