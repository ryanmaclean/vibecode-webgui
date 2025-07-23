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

    // Send metrics with string array tags
    const sessionTags = [
      `workspace:${workspaceId}`,
      'terminal_type:enhanced-ai'
    ];
    
    statsd.increment('terminal.sessions.created', 1, sessionTags);
    statsd.gauge('terminal.sessions.active', this.terminalSessionMetrics.size, sessionTags);

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

    // Send metrics with string array tags
    const commandType = this.categorizeCommand(command);
    const commandTags = [
      `command_type:${commandType}`,
      `session:${sessionId}`
    ];
    
    statsd.increment('terminal.commands.executed', 1, commandTags);
    statsd.histogram('terminal.command.execution_time', executionTime, commandTags);

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

    // Create common tags for all metrics
    const aiTags = [
      `type:${type}`,
      `provider:${provider}`,
      `model:${model}`,
      'context:terminal'
    ];

    // Send metrics with string array tags
    statsd.increment('ai.requests', 1, aiTags);
    statsd.histogram('ai.response_time', responseTime, aiTags);

    if (tokenUsage) {
      statsd.histogram('ai.tokens_used', tokenUsage, aiTags);
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

    // Create common tags for all metrics
    const cliTags = [
      `command:${command}`,
      `success:${success ? 'true' : 'false'}`,
      `error_type:${errorType || 'none'}`
    ];
    
    // Send metrics with string array tags
    statsd.increment('claude.cli.commands', 1, cliTags);
    statsd.histogram('claude.cli.response_time', responseTime, cliTags);

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

    // Convert model to string array tag format
    const modelTag = `model:${model}`;
    
    // Send metrics with string array tags
    statsd.increment('openrouter.requests', 1, [modelTag]);
    statsd.histogram('openrouter.response_time', responseTime, [modelTag]);
    statsd.histogram('openrouter.prompt_tokens', promptTokens, [modelTag]);
    statsd.histogram('openrouter.completion_tokens', completionTokens, [modelTag]);

    if (cost) {
      statsd.histogram('openrouter.cost', cost, [modelTag]);
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

    // Create common tags for all metrics
    const sessionEndTags = [`end_reason:${reason}`];
    
    const session = this.terminalSessionMetrics.get(sessionId)
    if (session) {
      const sessionDuration = Date.now() - session.startTime
      const inactiveTime = Date.now() - session.lastActivity

      span.setTag('session.duration', sessionDuration)
      span.setTag('session.commands', session.commandCount)
      span.setTag('session.ai_usage', session.aiUsageCount)
      span.setTag('session.inactive_time', inactiveTime)

      // Add more tags if needed
      sessionEndTags.push(
        `session_duration:${sessionDuration}`,
        `commands:${session.commandCount}`,
        `ai_usage:${session.aiUsageCount}`
      );

      // Send metrics with string array tags
      statsd.histogram('terminal.session.duration', sessionDuration, sessionEndTags);
      statsd.histogram('terminal.session.commands', session.commandCount, sessionEndTags);
      statsd.histogram('terminal.session.ai_usage', session.aiUsageCount, sessionEndTags);

      this.terminalSessionMetrics.delete(sessionId)
    }

    // Update active sessions gauge with the same end_reason tag
    statsd.gauge('terminal.sessions.active', this.terminalSessionMetrics.size, sessionEndTags)

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

    // Create tags for workspace activity
    const workspaceTags = [
      `workspace:${workspaceId}`,
      `activity:${activity}`
    ];
    
    // Send metrics with string array tags
    statsd.increment('workspace.activities', 1, workspaceTags)

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

    // Create common tags for suggestion metrics
    const suggestionTags = [
      `trigger:${trigger}`,
      `accepted:${accepted ? 'true' : 'false'}`
    ];
    
    // Send metrics with string array tags
    statsd.increment('ai.suggestions', 1, suggestionTags);

    if (helpfulness !== undefined) {
      statsd.histogram('ai.suggestion.helpfulness', helpfulness, [
        `trigger:${trigger}`
      ]);
    }

    span.finish()
  }

  /**
   * Track system performance
   */
  trackSystemPerformance() {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    // Common tags for system metrics
    const systemTags = ['source:node_process'];

    // Memory metrics
    statsd.gauge('system.memory.used', memUsage.heapUsed, systemTags)
    statsd.gauge('system.memory.total', memUsage.heapTotal, systemTags)
    statsd.gauge('system.memory.external', memUsage.external, systemTags)

    // CPU metrics
    statsd.gauge('system.cpu.user', cpuUsage.user, systemTags)
    statsd.gauge('system.cpu.system', cpuUsage.system, systemTags)

    // Active sessions
    const sessionTags = [...systemTags, 'metric_type:session'];
    statsd.gauge('terminal.sessions.active', this.terminalSessionMetrics.size, sessionTags)

    // Terminal session health
    let healthySessions = 0
    const currentTime = Date.now()
    
    for (const session of this.terminalSessionMetrics.values()) {
      if (currentTime - session.lastActivity < 30000) { // Active in last 30 seconds
        healthySessions++
      }
    }

    statsd.gauge('terminal.sessions.healthy', healthySessions, sessionTags)
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