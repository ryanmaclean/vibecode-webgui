/**
 * WebSocket endpoint for terminal sessions
 * Handles real-time terminal communication
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebSocketServer } from 'ws'
import type { IPty } from 'node-pty'
import { ClaudeCliIntegration } from '@/lib/claude-cli-integration'
import { datadogMonitoring } from '@/lib/monitoring/enhanced-datadog-integration'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

// Dynamic import for node-pty to avoid build-time loading
let nodePty: typeof import('node-pty') | null = null;
const getNodePty = async () => {
  if (!nodePty) {
    nodePty = await import('node-pty');
  }
  return nodePty;
};

// Terminal session management
const terminalSessions = new Map<string, {
  pty: IPty
  workspaceId: string
  userId: string
  claude?: ClaudeCliIntegration
  aiContext: string[]
  lastActivity: Date
}>()

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
  
  for (const [sessionId, session] of terminalSessions.entries()) {
    if (session.lastActivity < thirtyMinutesAgo) {
      // Debug log removed
      session.pty.kill()
      terminalSessions.delete(sessionId)
    }
  }
}, 30 * 60 * 1000)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  
  if (!workspaceId) {
    return new Response('Workspace ID required', { status: 400 })
  }

  // Upgrade to WebSocket
  const upgrade = request.headers.get('upgrade')
  if (upgrade !== 'websocket') {
    return new Response('Expected websocket', { status: 400 })
  }

  return new Response(null, {
    status: 101,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade'
    }
  })
}

// WebSocket handler (this would be handled by your WebSocket server)
const webSocketHandler = (ws: any, request: any) => {
  const url = new URL(request.url, 'http://localhost')
  const workspaceId = url.searchParams.get('workspaceId')
  const userId = url.searchParams.get('userId') || 'anonymous'
  
  let currentSession: string | null = null

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'create-terminal':
          await handleCreateTerminal(ws, message, workspaceId, userId)
          break
          
        case 'terminal-input':
          await handleTerminalInput(ws, message, currentSession)
          break
          
        case 'terminal-resize':
          await handleTerminalResize(ws, message, currentSession)
          break
          
        case 'ai-command':
          await handleAICommand(ws, message, currentSession)
          break
          
        case 'close-terminal':
          await handleCloseTerminal(ws, message, currentSession)
          break
          
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }))
      }
    } catch (error) {
      // Server error logged
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }))
    }
  })

  ws.on('close', () => {
    if (currentSession) {
      const session = terminalSessions.get(currentSession)
      if (session) {
        // Track unexpected session ending in Datadog
        datadogMonitoring.trackTerminalSessionEnded(currentSession, 'timeout')
        
        session.pty.kill()
        terminalSessions.delete(currentSession)
      }
    }
  })

  // Handle create terminal
  async function handleCreateTerminal(ws: any, message: any, workspaceId: string | null, userId: string) {
    try {
      if (!workspaceId) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Workspace ID is required'
        }))
        return
      }

      // SECURITY: Validate workspace ID format
      if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || workspaceId.length > 50) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid workspace ID format'
        }))
        return
      }

      // SECURITY: Validate terminal dimensions
      const cols = Math.min(Math.max(message.cols || 120, 10), 500)
      const rows = Math.min(Math.max(message.rows || 30, 10), 100)

      const sessionId = generateSessionId()

      // SECURITY: Construct safe workspace path using path.join
      const workspaceDir = require('path').join('/workspaces', workspaceId)

      // SECURITY: Validate workspace path is within allowed directory
      if (!workspaceDir.startsWith('/workspaces/')) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid workspace path'
        }))
        return
      }

      // Create PTY process using dynamic import
      const pty = await getNodePty();
      const ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: workspaceDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          WORKSPACE_ID: workspaceId,
          USER_ID: userId
        }
      })

      // Set up Claude integration
      const claude = new ClaudeCliIntegration({
        apiKey: process.env.ANTHROPIC_API_KEY,
        workingDirectory: workspaceDir,
        timeout: 30000
      })

      // Store session
      terminalSessions.set(sessionId, {
        pty: ptyProcess,
        workspaceId,
        userId,
        claude,
        aiContext: [],
        lastActivity: new Date()
      })

      currentSession = sessionId

      // Handle PTY data
      ptyProcess.onData((data) => {
        const session = terminalSessions.get(sessionId)
        if (session) {
          session.lastActivity = new Date()
          
          ws.send(JSON.stringify({
            type: 'terminal-output',
            sessionId,
            data
          }))

          // Check for command completion and offer AI suggestions
          if (data.includes('$ ') || data.includes('# ')) {
            offerAISuggestion(ws, sessionId, data)
          }
        }
      })

      // Handle PTY exit
      ptyProcess.onExit((exitCode) => {
        terminalSessions.delete(sessionId)
        ws.send(JSON.stringify({
          type: 'terminal-exit',
          sessionId,
          exitCode
        }))
      })

      ws.send(JSON.stringify({
        type: 'terminal-created',
        sessionId,
        workspaceId
      }))

      // Track terminal session creation in Datadog
      datadogMonitoring.trackTerminalSessionCreated(sessionId, workspaceId, userId)

      // Send welcome message with AI features
      setTimeout(() => {
        ptyProcess.write('\r\n')
        ptyProcess.write('\x1b[32m🚀 VibeCode Enhanced Terminal Ready!\x1b[0m\r\n')
        ptyProcess.write('\x1b[36m💡 Press Ctrl+Shift+A for AI mode, Ctrl+Shift+C to explain commands\x1b[0m\r\n')
        ptyProcess.write('\r\n')
      }, 500)

    } catch (error) {
      // Server error logged
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to create terminal session'
      }))
    }
  }

  // Handle terminal input
  async function handleTerminalInput(ws: any, message: any, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (session) {
      // SECURITY: Validate input size to prevent DoS
      if (!message.data || typeof message.data !== 'string') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid terminal input'
        }))
        return
      }

      if (message.data.length > 10_000) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Terminal input too large (max 10KB)'
        }))
        return
      }

      session.lastActivity = new Date()
      session.pty.write(message.data)

      // Track command execution if it's a complete command
      if (message.data.includes('\n') || message.data.includes('\r')) {
        const startTime = Date.now()
        // Simple command execution time tracking (will be improved with actual timing)
        setTimeout(() => {
          const executionTime = Date.now() - startTime
          datadogMonitoring.trackTerminalCommand(sessionId, message.data.trim(), executionTime)
        }, 100)
      }
    }
  }

  // Handle terminal resize
  async function handleTerminalResize(ws: any, message: any, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (session) {
      session.lastActivity = new Date()
      session.pty.resize(message.cols, message.rows)
    }
  }

  // Handle AI command
  async function handleAICommand(ws: any, message: any, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (!session || !session.claude) return

    try {
      session.lastActivity = new Date()
      
      const { command, type = 'chat' } = message
      const startTime = Date.now()

      let response
      switch (type) {
        case 'explain':
          response = await session.claude.explainCode(command, 'bash')
          break
        case 'generate':
          response = await session.claude.generateCode(command)
          break
        case 'analyze':
          response = await session.claude.executeCommand({
            command: 'analyze',
            input: command
          })
          break
        default:
          response = await session.claude.chatWithClaude(command, session.aiContext)
      }

      const responseTime = Date.now() - startTime

      // Track AI usage in Datadog
      datadogMonitoring.trackAIUsage(
        sessionId,
        type,
        'anthropic',
        'claude-3-5-sonnet', // Could be made configurable
        responseTime,
        response.metadata?.tokensUsed
      )

      // Track Claude CLI specific metrics
      datadogMonitoring.trackClaudeCodeCLI(
        sessionId,
        type,
        response.success,
        responseTime,
        response.success ? undefined : 'api_error'
      )

      if (response.success) {
        // Add to AI context
        session.aiContext.push(command, response.output)
        if (session.aiContext.length > 20) {
          session.aiContext = session.aiContext.slice(-20) // Keep last 20 entries
        }

        ws.send(JSON.stringify({
          type: 'ai-response',
          sessionId,
          command,
          response: response.output,
          metadata: response.metadata
        }))
      } else {
        ws.send(JSON.stringify({
          type: 'ai-error',
          sessionId,
          command,
          error: response.error
        }))
      }
    } catch (error) {
      // Server error logged
      ws.send(JSON.stringify({
        type: 'ai-error',
        sessionId,
        command: message.command,
        error: 'AI service unavailable'
      }))
    }
  }

  // Handle close terminal
  async function handleCloseTerminal(ws: any, message: any, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (session) {
      // Track session ending in Datadog
      datadogMonitoring.trackTerminalSessionEnded(sessionId, 'user_close')
      
      session.pty.kill()
      terminalSessions.delete(sessionId)
      
      ws.send(JSON.stringify({
        type: 'terminal-closed',
        sessionId
      }))
    }
  }

  // Offer AI suggestion based on command output
  async function offerAISuggestion(ws: any, sessionId: string, output: string) {
    const session = terminalSessions.get(sessionId)
    if (!session || !session.claude) return

    // Only offer suggestions occasionally to avoid spam
    if (Math.random() > 0.3) return

    try {
      // Extract last command from output
      const lines = output.split('\n')
      const lastLine = lines[lines.length - 1] || lines[lines.length - 2]
      
      if (lastLine && (lastLine.includes('command not found') || lastLine.includes('error'))) {
        const suggestion = await session.claude.chatWithClaude(
          `The user got this error: "${lastLine}". Suggest a helpful fix in one line.`,
          []
        )

        if (suggestion.success) {
          // Track AI suggestion in Datadog
          datadogMonitoring.trackAISuggestion(sessionId, 'error', suggestion.output)
          
          ws.send(JSON.stringify({
            type: 'ai-suggestion',
            sessionId,
            suggestion: suggestion.output,
            trigger: 'error'
          }))
        }
      }
    } catch (error) {
      // Silently fail for suggestions
      // AI suggestion error logged
    }
  }
}

// Generate unique session ID
function generateSessionId(): string {
  return `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// terminalSessions available for internal use only in this module