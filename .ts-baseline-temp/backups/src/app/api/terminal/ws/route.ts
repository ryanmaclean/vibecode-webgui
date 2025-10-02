/**
 * WebSocket endpoint for terminal sessions
 * Handles real-time terminal communication
 */

import { NextRequest } from 'next/server'
import { ClaudeCliIntegration } from '@/lib/claude-cli-integration'
import { datadogMonitoring } from '@/lib/monitoring/enhanced-datadog-integration'
import { terminalSessions, generateSessionId } from '@/lib/terminal/session-manager'
import { spawn } from 'node-pty'

// WebSocket types
interface WebSocketLike {
  send(data: string): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

type TerminalMessageType =
  | 'create-terminal'
  | 'terminal-input'
  | 'terminal-resize'
  | 'ai-command'
  | 'close-terminal'

type TerminalAICommand = 'chat' | 'analyze' | 'explain' | 'generate'

interface TerminalMessage {
  type: TerminalMessageType;
  cols?: number;
  rows?: number;
  data?: string;
  command?: string;
  commandType?: TerminalAICommand;
  mode?: TerminalAICommand;
}

const TERMINAL_AI_COMMANDS: ReadonlySet<TerminalAICommand> = new Set([
  'chat',
  'analyze',
  'explain',
  'generate',
])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function resolveAICommand(value: unknown): TerminalAICommand {
  if (typeof value === 'string' && TERMINAL_AI_COMMANDS.has(value as TerminalAICommand)) {
    return value as TerminalAICommand
  }
  return 'chat'
}

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

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
const _webSocketHandler = (ws: WebSocketLike, request: { url: string }) => {
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
      console.error('WebSocket message error:', error)
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
  async function handleCreateTerminal(ws: WebSocketLike, message: TerminalMessage, workspaceId: string | null, userId: string) {
    try {
      if (!workspaceId) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Workspace ID is required'
        }))
        return
      }
      
      const sessionId = generateSessionId()
      const workspaceDir = `/workspaces/${workspaceId}`

      const cols = isFiniteNumber(message.cols) ? message.cols : 120
      const rows = isFiniteNumber(message.rows) ? message.rows : 30

      /**
       * SECURITY FIX: Whitelist environment variables (fixes #439)
       * Only pass safe, necessary variables to terminal - no secrets
       */
      const allowedEnv = {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        HOME: '/home/workspace',
        USER: 'workspace',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        WORKSPACE_ID: workspaceId,
        USER_ID: userId,
      }

      // Create PTY process
      const ptyProcess = spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: workspaceDir,
        env: allowedEnv
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
      console.error('Error creating terminal:', error)
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to create terminal session'
      }))
    }
  }

  // Handle terminal input
  async function handleTerminalInput(ws: WebSocketLike, message: TerminalMessage, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (!session) {
      return
    }

    if (!isNonEmptyString(message.data)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Terminal input payload missing'
      }))
      return
    }

    const payload = message.data
    session.lastActivity = new Date()
    session.pty.write(payload)

    // Track command execution if it's a complete command
    if (payload.includes('\n') || payload.includes('\r')) {
      const startTime = Date.now()
      setTimeout(() => {
        const executionTime = Date.now() - startTime
        datadogMonitoring.trackTerminalCommand(sessionId, payload.trim(), executionTime)
      }, 100)
    }
  }

  // Handle terminal resize
  async function handleTerminalResize(ws: WebSocketLike, message: TerminalMessage, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (!session) {
      return
    }

    const cols = isFiniteNumber(message.cols) ? message.cols : null
    const rows = isFiniteNumber(message.rows) ? message.rows : null

    if (cols === null || rows === null) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Resize event missing dimensions'
      }))
      return
    }

    session.lastActivity = new Date()
    session.pty.resize(cols, rows)
  }

  // Handle AI command
  async function handleAICommand(ws: WebSocketLike, message: TerminalMessage, sessionId: string | null) {
    if (!sessionId) return

    const session = terminalSessions.get(sessionId)
    if (!session || !session.claude) return

    try {
      session.lastActivity = new Date()

      const commandText = isNonEmptyString(message.command) ? message.command : ''
      if (!commandText.trim()) {
        ws.send(JSON.stringify({
          type: 'ai-error',
          sessionId,
          error: 'AI command payload missing',
        }))
        return
      }

      const requestedType = message.commandType ?? message.mode
      const commandType = resolveAICommand(requestedType)
      const startTime = Date.now()

      let response
      switch (commandType) {
        case 'explain':
          response = await session.claude.explainCode(commandText, 'bash')
          break
        case 'generate':
          response = await session.claude.generateCode(commandText)
          break
        case 'analyze':
          response = await session.claude.executeCommand({
            command: 'analyze',
            input: commandText
          })
          break
        case 'chat':
        default:
          response = await session.claude.chatWithClaude(commandText, session.aiContext)
      }

      const responseTime = Date.now() - startTime

      datadogMonitoring.trackAIUsage(
        sessionId,
        commandType,
        'anthropic',
        'claude-3-5-sonnet',
        responseTime,
        response.metadata?.tokens
      )

      datadogMonitoring.trackClaudeCodeCLI(
        sessionId,
        commandType,
        response.success,
        responseTime,
        response.success ? undefined : 'api_error'
      )

      if (response.success) {
        session.aiContext.push(commandText, response.output)
        if (session.aiContext.length > 20) {
          session.aiContext = session.aiContext.slice(-20)
        }

        ws.send(JSON.stringify({
          type: 'ai-response',
          sessionId,
          command: commandText,
          response: response.output,
          metadata: response.metadata
        }))
      } else {
        ws.send(JSON.stringify({
          type: 'ai-error',
          sessionId,
          command: commandText,
          error: response.error
        }))
      }
    } catch (error) {
      console.error('AI command error:', error)
      ws.send(JSON.stringify({
        type: 'ai-error',
        sessionId,
        command: isNonEmptyString(message.command) ? message.command : undefined,
        error: 'AI service unavailable'
      }))
    }
  }

  // Handle close terminal
  async function handleCloseTerminal(ws: WebSocketLike, message: TerminalMessage, sessionId: string | null) {
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
  async function offerAISuggestion(ws: WebSocketLike, sessionId: string, output: string) {
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
      console.debug('AI suggestion error:', error)
    }
  }
}
