/**
 * Agent-Powered Monaco Editor Component
 *
 * React component wrapping Monaco Editor with Agent API integration
 * Provides real-time AI assistance, completions, and diagnostics
 *
 * Performance optimizations:
 * - Large file optimization with progressive feature disabling
 * - Memory monitoring and leak detection
 * - Performance tracking for editor operations
 * - Optimized editor options based on file size
 *
 * @module components/editor/AgentMonacoEditor
 */

'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Monaco } from '@monaco-editor/react'
import type * as monaco from 'monaco-editor'
import { MonacoAgentAPI, registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'
import { getOptimizedEditorOptions } from '@/lib/editor/large-file-optimizer'
import { MemoryMonitor } from '@/lib/performance/memory-monitor'
import { editorPerformanceTracker } from '@/lib/performance/editor-performance'
import { cn } from '@/lib/utils'
// import { logger } from '@/lib/logger';

// Dynamic import of Monaco Editor to reduce initial bundle size
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-muted-foreground/20 animate-bounce"></div>
        <span className="text-sm text-muted-foreground">Loading Monaco Editor...</span>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse"></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]"></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]"></div>
        </div>
      </div>
    </div>
  ),
})
// ============================================================================
// Types
// ============================================================================

export interface AgentMonacoEditorProps {
  /** Initial code content */
  value?: string
  /** Programming language */
  language?: string
  /** Editor theme */
  theme?: 'vs-dark' | 'vs-light' | 'hc-black'
  /** Height of the editor */
  height?: string | number
  /** Width of the editor */
  width?: string | number
  /** Agent API configuration */
  agentConfig?: {
    baseUrl?: string
    wsUrl?: string
    model?: string
    enableInlineSuggestions?: boolean
    enableDiagnostics?: boolean
  }
  /** Enable read-only mode */
  readOnly?: boolean
  /** Additional Monaco options */
  options?: monaco.editor.IStandaloneEditorConstructionOptions
  /** onChange handler */
  onChange?: (value: string | undefined) => void
  /** onMount handler */
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => void
  /** Custom className */
  className?: string
  /** Enable agent features */
  enableAgent?: boolean
  /** Enable large file optimizations (default: true) */
  enableOptimizations?: boolean
  /** Enable memory monitoring (default: true) */
  enableMemoryMonitoring?: boolean
  /** Enable performance tracking (default: true) */
  enablePerformanceTracking?: boolean
}

export const DEFAULT_EDITOR_LANGUAGE = 'typescript'

export interface EditorStatus {
  agentConnected: boolean
  completionsEnabled: boolean
  diagnosticsEnabled: boolean
  latency: number
  lastError?: string
  /** Current memory usage in MB (if monitoring enabled) */
  memoryUsageMB?: number
  /** Editor load time in ms */
  loadTimeMs?: number
  /** File size category */
  fileSizeCategory?: 'small' | 'medium' | 'large' | 'very-large' | 'extreme'
}

// ============================================================================
// Agent Monaco Editor Component
// ============================================================================

export function AgentMonacoEditor({
  value = '',
  language = DEFAULT_EDITOR_LANGUAGE,
  theme = 'vs-dark',
  height = '600px',
  width = '100%',
  agentConfig,
  readOnly = false,
  options = {},
  onChange,
  onMount,
  className,
  enableAgent = true,
  enableOptimizations = true,
  enableMemoryMonitoring = true,
  enablePerformanceTracking = true,
}: AgentMonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const agentAPIRef = useRef<MonacoAgentAPI | null>(null)
  const providersRef = useRef<monaco.IDisposable[]>([])
  const memoryMonitorRef = useRef<MemoryMonitor | null>(null)
  const loadStartTimeRef = useRef<number>(0)

  const [status, setStatus] = useState<EditorStatus>({
    agentConnected: false,
    completionsEnabled: false,
    diagnosticsEnabled: false,
    latency: 0,
  })

  // ==========================================================================
  // Performance Optimizations
  // ==========================================================================

  /**
   * Calculate optimized editor options based on file size
   * Uses memoization to avoid recalculating on every render
   */
  const editorOptions = useMemo(() => {
    // Apply large file optimizations if enabled
    if (enableOptimizations && value) {
      const optimizedOptions = getOptimizedEditorOptions(value, {
        overrides: {
          readOnly,
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on' as monaco.editor.LineNumbersType,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        },
        debug: process.env.NODE_ENV === 'development',
      })

      // Merge with user-provided options (user options take precedence)
      return {
        ...optimizedOptions,
        ...options,
      } as monaco.editor.IStandaloneEditorConstructionOptions
    }

    // No optimizations - use default options
    return {
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: 'on' as monaco.editor.LineNumbersType,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      readOnly,
      // Enable rich IntelliSense
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      quickSuggestionsDelay: 100,
      // Enable parameter hints
      parameterHints: {
        enabled: true,
      },
      // Enable code lens
      codeLens: true,
      // Enable hover
      hover: {
        enabled: true,
        delay: 300,
      },
      // Enable lightbulb for code actions
      lightbulb: {
        enabled: 'on' as monaco.editor.ShowLightbulbIconMode,
      },
      ...options,
    } as monaco.editor.IStandaloneEditorConstructionOptions
  }, [value, options, enableOptimizations, readOnly])

  // ==========================================================================
  // Editor Initialization
  // ==========================================================================

  const handleEditorDidMount = async (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    // Track mount start time
    const mountStartTime = performance.now()
    loadStartTimeRef.current = mountStartTime

    editorRef.current = editor
    monacoRef.current = monaco

    // Start memory monitoring if enabled
    if (enableMemoryMonitoring) {
      const monitor = new MemoryMonitor({
        label: 'agent-monaco-editor',
        warnThresholdMB: 512,
        criticalThresholdMB: 1024,
        monitoringIntervalMs: 10000, // Check every 10 seconds
        autoLog: process.env.NODE_ENV === 'development',
      })
      monitor.start()
      memoryMonitorRef.current = monitor
    }

    // Call custom onMount handler
    if (onMount) {
      onMount(editor, monaco)
    }

    // Initialize Agent API integration if enabled
    if (enableAgent) {
      await initializeAgentAPI(editor, monaco)
    }

    // Add custom keybindings for agent features
    if (enableAgent) {
      setupKeybindings(editor, monaco)
    }

    // Track editor load performance
    if (enablePerformanceTracking) {
      const loadTime = performance.now() - mountStartTime
      const lineCount = value.split('\n').length
      const byteSize = new Blob([value]).size

      editorPerformanceTracker.trackEditorLoad('agent-monaco-editor', loadTime, {
        fileSize: byteSize,
        lineCount,
        language,
      })

      // Update status with performance info
      setStatus((prev) => ({
        ...prev,
        loadTimeMs: loadTime,
        fileSizeCategory: getFileSizeCategory(lineCount),
      }))
    }

    // Check for memory snapshot if monitoring enabled
    if (enableMemoryMonitoring && memoryMonitorRef.current) {
      const samples = memoryMonitorRef.current.getSamples()
      if (samples.length > 0) {
        const latestSample = samples[samples.length - 1]
        setStatus((prev) => ({
          ...prev,
          memoryUsageMB: latestSample.usedJSHeapSizeMB,
        }))
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.info('Monaco Editor mounted with Agent API integration and performance optimizations')
    }
  }

  /**
   * Helper to determine file size category
   */
  const getFileSizeCategory = (
    lineCount: number
  ): 'small' | 'medium' | 'large' | 'very-large' | 'extreme' => {
    if (lineCount >= 50000) return 'extreme'
    if (lineCount >= 20000) return 'very-large'
    if (lineCount >= 10000) return 'large'
    if (lineCount >= 5000) return 'medium'
    return 'small'
  }

  // ==========================================================================
  // Agent API Initialization
  // ==========================================================================

  const initializeAgentAPI = async (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    try {
      // Create agent API instance
      const agentAPI = new MonacoAgentAPI(editor, {
        baseUrl: agentConfig?.baseUrl || '/api/agents',
        wsUrl: agentConfig?.wsUrl || '/api/agents/ws',
        model: (agentConfig?.model || 'claude-3-5-sonnet-20241022') as import('@/types/agent-api').ModelType,
        debug: process.env.NODE_ENV === 'development',
        enableInlineSuggestions: agentConfig?.enableInlineSuggestions ?? true,
        enableDiagnostics: agentConfig?.enableDiagnostics ?? true,
      })

      // Initialize the API
      await agentAPI.initialize()

      // Register Monaco providers
      // Monaco type from @monaco-editor/react is compatible with monaco-editor module
      const providers = registerMonacoAgentProviders(
        monaco as unknown as typeof import('monaco-editor'),
        language,
        agentAPI
      )

      agentAPIRef.current = agentAPI
      providersRef.current = providers

      setStatus({
        agentConnected: true,
        completionsEnabled: true,
        diagnosticsEnabled: agentConfig?.enableDiagnostics ?? true,
        latency: 0,
      })

      console.info('Agent API initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Agent API:', error)
      setStatus((prev) => ({
        ...prev,
        agentConnected: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }

  // ==========================================================================
  // Custom Keybindings
  // ==========================================================================

  const setupKeybindings = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    // Trigger agent completion with Ctrl+Space or Cmd+Space
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {})
    })

    // Trigger agent hover with Ctrl+K Ctrl+I or Cmd+K Cmd+I
    editor.addCommand(
      monaco.KeyMod.chord(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI
      ),
      () => {
        editor.trigger('keyboard', 'editor.action.showHover', {})
      }
    )

    // Trigger quick fix with Ctrl+. or Cmd+.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period, () => {
      editor.trigger('keyboard', 'editor.action.quickFix', {})
    })
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  useEffect(() => {
    return () => {
      // Stop memory monitoring and generate report
      if (memoryMonitorRef.current) {
        const report = memoryMonitorRef.current.stop()

        // Check for memory leaks
        const leakDetection = memoryMonitorRef.current.detectMemoryLeak()

        if (process.env.NODE_ENV === 'development') {
          console.info('Memory Monitor Report:', {
            peakMemoryMB: report.peakMemoryMB,
            avgMemoryMB: report.avgMemoryMB,
            memoryGrowthMB: report.memoryGrowthMB,
            sampleCount: report.sampleCount,
            durationMs: report.durationMs,
          })

          if (leakDetection.leakDetected) {
            console.warn('Potential memory leak detected:', {
              confidence: leakDetection.confidence,
              avgGrowthMB: leakDetection.avgGrowthMB,
              totalGrowthMB: leakDetection.totalGrowthMB,
            })
          }
        }

        memoryMonitorRef.current = null
      }

      // Dispose agent API
      if (agentAPIRef.current) {
        agentAPIRef.current.dispose()
        agentAPIRef.current = null
      }

      // Dispose providers
      providersRef.current.forEach((provider) => provider.dispose())
      providersRef.current = []

      if (process.env.NODE_ENV === 'development') {
        console.info('Monaco Editor cleanup complete')
      }
    }
  }, [])

  // ==========================================================================
  // Status Indicator
  // ==========================================================================

  const renderStatusBar = () => {
    if (!enableAgent) return null

    return (
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                status.agentConnected ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <span className="text-gray-400">
              {status.agentConnected ? 'Agent Connected' : 'Agent Disconnected'}
            </span>
          </div>

          {status.completionsEnabled && (
            <span className="text-gray-400">Completions: On</span>
          )}

          {status.diagnosticsEnabled && (
            <span className="text-gray-400">Diagnostics: On</span>
          )}

          {status.latency > 0 && (
            <span className="text-gray-400">Latency: {status.latency}ms</span>
          )}

          {/* Performance metrics */}
          {status.loadTimeMs && (
            <span className="text-gray-400">Load: {Math.round(status.loadTimeMs)}ms</span>
          )}

          {status.fileSizeCategory && status.fileSizeCategory !== 'small' && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                status.fileSizeCategory === 'extreme' && 'bg-red-900/50 text-red-300',
                status.fileSizeCategory === 'very-large' && 'bg-orange-900/50 text-orange-300',
                status.fileSizeCategory === 'large' && 'bg-yellow-900/50 text-yellow-300',
                status.fileSizeCategory === 'medium' && 'bg-blue-900/50 text-blue-300'
              )}
            >
              {status.fileSizeCategory}
            </span>
          )}

          {enableMemoryMonitoring && status.memoryUsageMB && (
            <span
              className={cn(
                'text-gray-400',
                status.memoryUsageMB >= 1024 && 'text-red-400',
                status.memoryUsageMB >= 512 && status.memoryUsageMB < 1024 && 'text-yellow-400'
              )}
            >
              Mem: {Math.round(status.memoryUsageMB)}MB
            </span>
          )}
        </div>

        {status.lastError && (
          <div className="text-red-400 text-xs">{status.lastError}</div>
        )}
      </div>
    )
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className={cn('flex flex-col', className)}>
      <Editor
        height={height}
        width={width}
        language={language}
        theme={theme}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={editorOptions}
      />
      {renderStatusBar()}
    </div>
  )
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get editor instance
 */
export function useMonacoEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const setEditor = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
  }

  const getEditor = () => editorRef.current

  return { editor: editorRef.current, setEditor, getEditor }
}

/**
 * Hook to interact with Agent API
 */
export function useAgentAPI(editor: monaco.editor.IStandaloneCodeEditor | null) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCompletion = async () => {
    if (!editor) return

    setIsProcessing(true)
    setError(null)

    try {
      const position = editor.getPosition()
      if (!position) return

      // Trigger completion manually
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }

  const requestHover = async () => {
    if (!editor) return

    try {
      editor.trigger('keyboard', 'editor.action.showHover', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const requestCodeActions = async () => {
    if (!editor) return

    try {
      editor.trigger('keyboard', 'editor.action.quickFix', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return {
    requestCompletion,
    requestHover,
    requestCodeActions,
    isProcessing,
    error,
  }
}
