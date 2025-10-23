/**
 * Agent-Powered Monaco Editor Component
 *
 * React component wrapping Monaco Editor with Agent API integration
 * Provides real-time AI assistance, completions, and diagnostics
 *
 * @module components/editor/AgentMonacoEditor
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import type * as monaco from 'monaco-editor'
import { MonacoAgentAPI, registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'
import { cn } from '@/lib/utils'
// import { logger } from '@/lib/logger';
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
}

export interface EditorStatus {
  agentConnected: boolean
  completionsEnabled: boolean
  diagnosticsEnabled: boolean
  latency: number
  lastError?: string
}

// ============================================================================
// Agent Monaco Editor Component
// ============================================================================

export function AgentMonacoEditor({
  value = '',
  language = 'typescript',
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
}: AgentMonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const agentAPIRef = useRef<MonacoAgentAPI | null>(null)
  const providersRef = useRef<monaco.IDisposable[]>([])

  const [status, setStatus] = useState<EditorStatus>({
    agentConnected: false,
    completionsEnabled: false,
    diagnosticsEnabled: false,
    latency: 0,
  })

  // ==========================================================================
  // Editor Initialization
  // ==========================================================================

  const handleEditorDidMount = async (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor
    monacoRef.current = monaco

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

    console.info('Monaco Editor mounted with Agent API integration')
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
        model: agentConfig?.model || 'claude-3-5-sonnet-20241022',
        debug: process.env.NODE_ENV === 'development',
        enableInlineSuggestions: agentConfig?.enableInlineSuggestions ?? true,
        enableDiagnostics: agentConfig?.enableDiagnostics ?? true,
      })

      // Initialize the API
      await agentAPI.initialize()

      // Register Monaco providers
      const providers = registerMonacoAgentProviders(
        monaco as any,
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
      // Dispose agent API
      if (agentAPIRef.current) {
        agentAPIRef.current.dispose()
        agentAPIRef.current = null
      }

      // Dispose providers
      providersRef.current.forEach((provider) => provider.dispose())
      providersRef.current = []

      console.info('Monaco Editor cleanup complete')
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
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
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
            enabled: true,
          },
          ...options,
        }}
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
