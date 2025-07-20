/**
 * Enhanced Terminal with AI Integration
 * Combines WebGL performance with Claude Code CLI integration
 * Replaces code-server terminal for better AI-powered development
 */

'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { AttachAddon } from '@xterm/addon-attach'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { ClaudeCliIntegration } from '@/lib/claude-cli-integration'
import '@xterm/xterm/css/xterm.css'

export interface EnhancedTerminalProps {
  workspaceId: string
  className?: string
  theme?: 'dark' | 'light'
  enableAI?: boolean
  enableWebGL?: boolean
  onReady?: (terminal: Terminal) => void
}

export default function EnhancedTerminal({
  workspaceId,
  className = '',
  theme = 'dark',
  enableAI = true,
  enableWebGL = true,
  onReady
}: EnhancedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const claudeRef = useRef<ClaudeCliIntegration | null>(null)
  const addons = useRef<any>({})
  
  const [isReady, setIsReady] = useState(false)
  const [isAIMode, setIsAIMode] = useState(false)
  const [aiContext, setAiContext] = useState<string[]>([])

  // Terminal themes
  const themes = {
    dark: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff'
    },
    light: {
      background: '#ffffff',
      foreground: '#383a42',
      cursor: '#383a42',
      selection: '#e5e5e6',
      black: '#383a42',
      red: '#e45649',
      green: '#50a14f',
      yellow: '#c18401',
      blue: '#4078f2',
      magenta: '#a626a4',
      cyan: '#0184bc',
      white: '#fafafa',
      brightBlack: '#4f525d',
      brightRed: '#e06c75',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff'
    }
  }

  // Initialize terminal
  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || terminal.current) return

    const terminalTheme = themes[theme]

    terminal.current = new Terminal({
      cols: 120,
      rows: 30,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: terminalTheme,
      scrollback: 10000,
      allowTransparency: false,
      convertEol: true,
      rendererType: enableWebGL ? 'webgl' : 'canvas'
    })

    // Initialize addons
    addons.current.fit = new FitAddon()
    terminal.current.loadAddon(addons.current.fit)

    if (enableWebGL) {
      addons.current.webgl = new WebglAddon()
      terminal.current.loadAddon(addons.current.webgl)
    }

    addons.current.search = new SearchAddon()
    terminal.current.loadAddon(addons.current.search)

    addons.current.webLinks = new WebLinksAddon()
    terminal.current.loadAddon(addons.current.webLinks)

    addons.current.unicode11 = new Unicode11Addon()
    terminal.current.loadAddon(addons.current.unicode11)

    terminal.current.open(terminalRef.current)
    addons.current.fit.fit()

    // Set up WebSocket connection
    setupWebSocketConnection()

    // Set up AI integration
    if (enableAI) {
      setupAIIntegration()
    }

    // Set up keyboard shortcuts
    setupKeyboardShortcuts()

    setIsReady(true)
    onReady?.(terminal.current)
  }, [theme, enableWebGL, enableAI, onReady, workspaceId])

  // Set up WebSocket connection to backend terminal
  const setupWebSocketConnection = useCallback(() => {
    if (!terminal.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws?workspaceId=${workspaceId}`

    const websocket = new WebSocket(wsUrl)
    
    websocket.onopen = () => {
      console.log('Terminal WebSocket connected')
      terminal.current?.write('\r\n\x1b[32m✓ Terminal connected\x1b[0m\r\n')
      
      // Request new terminal session
      websocket.send(JSON.stringify({
        type: 'create-terminal',
        workspaceId,
        cols: terminal.current?.cols,
        rows: terminal.current?.rows
      }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'terminal-output') {
        terminal.current?.write(data.data)
      } else if (data.type === 'ai-suggestion') {
        handleAISuggestion(data)
      }
    }

    websocket.onerror = (error) => {
      console.error('Terminal WebSocket error:', error)
      terminal.current?.write('\r\n\x1b[31m✗ Terminal connection error\x1b[0m\r\n')
    }

    websocket.onclose = () => {
      console.log('Terminal WebSocket disconnected')
      terminal.current?.write('\r\n\x1b[33m⚠ Terminal disconnected\x1b[0m\r\n')
    }

    // Send terminal input to backend
    terminal.current.onData((data) => {
      if (websocket.readyState === WebSocket.OPEN) {
        if (isAIMode && data === '\r') {
          // AI mode: send to Claude
          handleAICommand()
        } else {
          websocket.send(JSON.stringify({
            type: 'terminal-input',
            data
          }))
        }
      }
    })

    // Handle terminal resize
    terminal.current.onResize(({ cols, rows }) => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'terminal-resize',
          cols,
          rows
        }))
      }
    })
  }, [workspaceId, isAIMode])

  // Set up AI integration
  const setupAIIntegration = useCallback(() => {
    claudeRef.current = new ClaudeCliIntegration({
      apiKey: process.env.NEXT_PUBLIC_CLAUDE_API_KEY,
      workingDirectory: `/workspaces/${workspaceId}`,
      timeout: 30000
    })
  }, [workspaceId])

  // Set up keyboard shortcuts
  const setupKeyboardShortcuts = useCallback(() => {
    if (!terminal.current) return

    terminal.current.attachCustomKeyEventHandler((event) => {
      // Ctrl+Shift+A: Toggle AI mode
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault()
        toggleAIMode()
        return false
      }

      // Ctrl+Shift+C: Ask Claude about current command
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault()
        askClaudeAboutCommand()
        return false
      }

      // Ctrl+Shift+F: Search in terminal
      if (event.ctrlKey && event.shiftKey && event.key === 'F') {
        event.preventDefault()
        openSearch()
        return false
      }

      return true
    })
  }, [])

  // Toggle AI mode
  const toggleAIMode = useCallback(() => {
    setIsAIMode(prev => {
      const newMode = !prev
      if (terminal.current) {
        if (newMode) {
          terminal.current.write('\r\n\x1b[32m🤖 AI Mode ON - Type commands and press Enter for AI assistance\x1b[0m\r\n')
          terminal.current.write('\x1b[36mai> \x1b[0m')
        } else {
          terminal.current.write('\r\n\x1b[33m🔧 AI Mode OFF - Back to normal terminal\x1b[0m\r\n')
        }
      }
      return newMode
    })
  }, [])

  // Handle AI command
  const handleAICommand = useCallback(async () => {
    if (!terminal.current || !claudeRef.current) return

    // Get current line content
    const buffer = terminal.current.buffer.active
    const currentLine = buffer.getLine(buffer.cursorY)
    const command = currentLine?.translateToString(true).replace(/^ai>\s*/, '') || ''

    if (!command.trim()) return

    terminal.current.write('\r\n\x1b[36m🤔 Thinking...\x1b[0m\r\n')

    try {
      // Send to Claude for processing
      const response = await claudeRef.current.chatWithClaude(
        `Help me with this terminal command or question: ${command}`,
        aiContext
      )

      if (response.success) {
        terminal.current.write('\r\n\x1b[32m🤖 Claude:\x1b[0m\r\n')
        terminal.current.write(response.output + '\r\n')
        
        // Add to context for future AI interactions
        setAiContext(prev => [...prev.slice(-10), command, response.output])
      } else {
        terminal.current.write('\r\n\x1b[31m❌ AI Error: ' + (response.error || 'Unknown error') + '\x1b[0m\r\n')
      }
    } catch (error) {
      terminal.current.write('\r\n\x1b[31m❌ AI Connection Error\x1b[0m\r\n')
      console.error('Claude integration error:', error)
    }

    terminal.current.write('\x1b[36mai> \x1b[0m')
  }, [aiContext])

  // Ask Claude about current command
  const askClaudeAboutCommand = useCallback(async () => {
    if (!terminal.current || !claudeRef.current) return

    const buffer = terminal.current.buffer.active
    const currentLine = buffer.getLine(buffer.cursorY)
    const command = currentLine?.translateToString(true) || ''

    if (!command.trim()) {
      terminal.current.write('\r\n\x1b[33m⚠ No command found on current line\x1b[0m\r\n')
      return
    }

    terminal.current.write('\r\n\x1b[36m🤖 Analyzing command...\x1b[0m\r\n')

    try {
      const response = await claudeRef.current.explainCode(command, 'bash')
      
      if (response.success) {
        terminal.current.write('\r\n\x1b[32m💡 Command Explanation:\x1b[0m\r\n')
        terminal.current.write(response.output + '\r\n')
      } else {
        terminal.current.write('\r\n\x1b[31m❌ Could not analyze command\x1b[0m\r\n')
      }
    } catch (error) {
      terminal.current.write('\r\n\x1b[31m❌ Analysis failed\x1b[0m\r\n')
      console.error('Command analysis error:', error)
    }
  }, [])

  // Handle AI suggestions
  const handleAISuggestion = useCallback((data: any) => {
    if (!terminal.current) return

    terminal.current.write('\r\n\x1b[35m💡 AI Suggestion: ' + data.suggestion + '\x1b[0m\r\n')
  }, [])

  // Open search
  const openSearch = useCallback(() => {
    if (addons.current.search) {
      addons.current.search.findNext('') // Opens search box
    }
  }, [])

  // Handle resize
  const handleResize = useCallback(() => {
    if (addons.current.fit) {
      addons.current.fit.fit()
    }
  }, [])

  // Initialize terminal on mount
  useEffect(() => {
    initializeTerminal()

    // Handle window resize
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      // Cleanup WebSocket connections and terminal
      if (terminal.current) {
        terminal.current.dispose()
      }
    }
  }, [initializeTerminal, handleResize])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="w-full h-full focus:outline-none"
        style={{
          fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
          fontSize: '14px'
        }}
      />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-900 dark:text-white">Initializing enhanced terminal...</span>
            </div>
          </div>
        </div>
      )}

      {/* AI Mode indicator */}
      {isAIMode && (
        <div className="absolute top-2 left-2">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>AI Mode</span>
          </div>
        </div>
      )}

      {/* Shortcuts help */}
      <div className="absolute top-2 right-2">
        <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
          <div>Ctrl+Shift+A: AI Mode</div>
          <div>Ctrl+Shift+C: Explain Command</div>
          <div>Ctrl+Shift+F: Search</div>
        </div>
      </div>
    </div>
  )
}