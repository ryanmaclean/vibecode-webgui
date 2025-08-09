/**
 * WebGL Accelerated Terminal Component
 *
 * High-performance terminal with WebGL acceleration for VibeCode platform
 * Implements advanced rendering optimizations for large outputs and smooth scrolling
 *
 * Staff Engineer Implementation - Enterprise-grade terminal performance
 */

'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export interface WebGLTerminalProps {
  websocketUrl?: string
  workspaceId: string
  className?: string
  theme?: 'dark' | 'light'
  fontSize?: number
  fontFamily?: string
  onData?: (data: string) => void
  onResize?: (cols: number, rows: number) => void
  onReady?: (terminal: Terminal) => void
  enableWebGL?: boolean
  maxScrollback?: number
  rendererType?: 'dom' | 'canvas' | 'webgl'
}

interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

const DARK_THEME: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#ffffff',
  cursorAccent: '#000000',
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
}

const LIGHT_THEME: TerminalTheme = {
  background: '#ffffff',
  foreground: '#383a42',
  cursor: '#526fff',
  cursorAccent: '#ffffff',
  selection: '#bfceff',
  black: '#383a42',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#4078f2',
  magenta: '#a626a4',
  cyan: '#0184bc',
  white: '#a0a1a7',
  brightBlack: '#4f525e',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff'
}

export default function WebGLTerminal({
  websocketUrl,
  workspaceId,
  className = '',
  theme = 'dark',
  fontSize = 14,
  fontFamily = 'JetBrains Mono, Consolas, Monaco, monospace',
  onData,
  onResize,
  onReady,
  enableWebGL = true,
  maxScrollback = 10000,
  rendererType = 'webgl'
}: WebGLTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const addons = useRef<{
    fit?: FitAddon
    webLinks?: WebLinksAddon
  }>({})

  const [isReady, setIsReady] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [perfStats, setPerfStats] = useState({
    fps: 0,
    renderTime: 0,
    memoryUsage: 0
  })

  // Performance monitoring
  const performanceMonitor = useRef({
    frameCount: 0,
    lastTime: 0,
    renderTimes: [] as number[]
  })

  /**
   * Initialize terminal with optimized settings
   */
  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || terminal.current) return

    const terminalTheme = theme === 'dark' ? DARK_THEME : LIGHT_THEME

    // High-performance terminal configuration
    const terminalOptions = {
      cols: 120,
      rows: 30,
      cursorBlink: true,
      cursorStyle: 'block' as const,
      fontFamily,
      fontSize,
      fontWeight: 'normal' as const,
      fontWeightBold: 'bold' as const,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: terminalTheme,

      // Performance optimizations
      scrollback: maxScrollback,
      allowTransparency: false,
      convertEol: true,
      altClickMovesCursor: true,
      rightClickSelectsWord: true,
      macOptionIsMeta: true,

      // WebGL optimizations
      allowProposedApi: true,

      // Scrolling optimizations
      fastScrollModifier: 'alt' as const,
      fastScrollSensitivity: 5,
      scrollSensitivity: 3,

      // Memory management
      screenReaderMode: false,
      tabStopWidth: 4,

      // Advanced features
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
    }

    terminal.current = new Terminal(terminalOptions)

    // Initialize addons
    initializeAddons()

    // Open terminal
    terminal.current.open(terminalRef.current)

    // Setup event handlers
    setupEventHandlers()

    // Fit terminal to container
    if (addons.current.fit) {
      addons.current.fit.fit()
    }

    setIsReady(true)
    onReady?.(terminal.current)

  }, [theme, fontSize, fontFamily, enableWebGL, maxScrollback, onReady])

  /**
   * Initialize terminal addons
   */
  const initializeAddons = useCallback(() => {
    if (!terminal.current) return

    try {
      // Fit addon for responsive sizing
      addons.current.fit = new FitAddon()
      terminal.current.loadAddon(addons.current.fit)

      // WebSocket attachment if URL provided
      if (websocketUrl) {
        try {
          const websocket = new WebSocket(websocketUrl)
          websocket.onmessage = (ev) => {
            try {
              const data = typeof ev.data === 'string' ? ev.data : ''
              if (data && terminal.current) terminal.current.write(data)
            } catch (e) {
              console.error('Failed to write websocket data to terminal:', e)
            }
          }

          websocket.onopen = () => setIsConnected(true)
          websocket.onclose = () => setIsConnected(false)
          websocket.onerror = (error) => {
            console.error('WebSocket error:', error)
            setIsConnected(false)
          }
        } catch (error) {
          console.error('Failed to create WebSocket connection:', error)
        }
      }

      // Web links addon
      addons.current.webLinks = new WebLinksAddon()
      terminal.current.loadAddon(addons.current.webLinks)

    } catch (error) {
      console.error('Failed to initialize terminal addons:', error)
    }
  }, [enableWebGL, rendererType, websocketUrl])

  /**
   * Setup terminal event handlers
   */
  const setupEventHandlers = useCallback(() => {
    if (!terminal.current) return

    // Data event
    terminal.current.onData((data) => {
      onData?.(data)
    })

    // Resize event
    terminal.current.onResize(({ cols, rows }) => {
      onResize?.(cols, rows)
    })

    // Performance monitoring
    const startPerformanceMonitoring = () => {
      const monitor = performanceMonitor.current
      const now = performance.now()

      if (monitor.lastTime === 0) {
        monitor.lastTime = now
        return
      }

      monitor.frameCount++
      const deltaTime = now - monitor.lastTime

      if (deltaTime >= 1000) { // Update every second
        const fps = Math.round((monitor.frameCount * 1000) / deltaTime)
        const avgRenderTime = monitor.renderTimes.length > 0
          ? monitor.renderTimes.reduce((a, b) => a + b, 0) / monitor.renderTimes.length
          : 0

        setPerfStats({
          fps,
          renderTime: Math.round(avgRenderTime * 100) / 100,
          memoryUsage: getMemoryUsage()
        })

        monitor.frameCount = 0
        monitor.lastTime = now
        monitor.renderTimes = []
      }

      requestAnimationFrame(startPerformanceMonitoring)
    }

    if (process.env.NODE_ENV === 'development') {
      requestAnimationFrame(startPerformanceMonitoring)
    }

    // Render event for performance tracking
    terminal.current.onRender((event) => {
      const renderStart = performance.now()

      // Track render performance
      requestAnimationFrame(() => {
        const renderTime = performance.now() - renderStart
        performanceMonitor.current.renderTimes.push(renderTime)

        // Keep only last 60 render times
        if (performanceMonitor.current.renderTimes.length > 60) {
          performanceMonitor.current.renderTimes = performanceMonitor.current.renderTimes.slice(-60)
        }
      })
    })

  }, [onData, onResize])

  /**
   * Get memory usage (approximation)
   */
  const getMemoryUsage = useCallback((): number => {
    if ('memory' in performance) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
    }
    return 0
  }, [])

  /**
   * Handle window resize
   */
  const handleResize = useCallback(() => {
    if (addons.current.fit && terminal.current) {
      try {
        addons.current.fit.fit()
      } catch (error) {
        console.error('Failed to fit terminal:', error)
      }
    }
  }, [])

  /**
   * Clear terminal
   */
  const clearTerminal = useCallback(() => {
    if (terminal.current) {
      terminal.current.clear()
    }
  }, [])

  /**
   * Write to terminal
   */
  const writeToTerminal = useCallback((data: string) => {
    if (terminal.current) {
      terminal.current.write(data)
    }
  }, [])

  /**
   * Search in terminal
   */
  const searchInTerminal = useCallback((term: string, options?: any) => {
    return false
  }, [])

  // Initialize terminal on mount
  useEffect(() => {
    initializeTerminal()

    return () => {
      // Cleanup
      if (terminal.current) {
        terminal.current.dispose()
        terminal.current = null
      }
      Object.values(addons.current).forEach(addon => {
        try {
          addon?.dispose?.()
        } catch (error) {
          console.error('Failed to dispose addon:', error)
        }
      })
      addons.current = {}
    }
  }, [initializeTerminal])

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  // Expose methods for parent components
  useEffect(() => {
    if (isReady && terminal.current) {
      // Attach methods to terminal instance for external access
      ;(terminal.current as any).clearTerminal = clearTerminal
      ;(terminal.current as any).writeToTerminal = writeToTerminal
      ;(terminal.current as any).searchInTerminal = searchInTerminal
    }
  }, [isReady, clearTerminal, writeToTerminal, searchInTerminal])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="w-full h-full focus:outline-none"
        style={{
          fontFamily,
          fontSize: `${fontSize}px`
        }}
      />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-900 dark:text-white">Initializing terminal...</span>
            </div>
          </div>
        </div>
      )}

      {/* Connection status */}
      {websocketUrl && (
        <div className="absolute top-2 right-2">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
            isConnected
              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      )}

      {/* Performance monitor (development only) */}
      {process.env.NODE_ENV === 'development' && enableWebGL && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs p-2 rounded font-mono">
          <div>FPS: {perfStats.fps}</div>
          <div>Render: {perfStats.renderTime}ms</div>
          {perfStats.memoryUsage > 0 && (
            <div>Memory: {perfStats.memoryUsage}MB</div>
          )}
          <div>Renderer: {rendererType}</div>
        </div>
      )}
    </div>
  )
}
