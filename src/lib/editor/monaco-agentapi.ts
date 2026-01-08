/**
 * Monaco Editor Integration with Agent API
 *
 * Provides bidirectional communication between agents and Monaco Editor:
 * - Completion provider (agent suggestions)
 * - Inline suggestions (agent-powered autocomplete)
 * - Code action provider (quick fixes from agents)
 * - Hover provider (agent explanations)
 * - Diagnostic provider (agent code analysis)
 *
 * Performance target: <300ms completion latency
 *
 * @module editor/monaco-agentapi
 */

import type * as monaco from 'monaco-editor'
import type {
AgentResponse,
  AgentStatusResponse,
  StartAgentRequest,
  SSEEvent,
  OutputEventData,
  ModelType,
} from '@/types/agent-api'
import { createWebSocketStreamingClient, type WebSocketStreamingClient } from '@/lib/streaming/websocket-streaming-client'
// import { logger } from '@/lib/logger';
// ============================================================================
// Types
// ============================================================================

export interface EditorContext {
  /** Current file content */
  content: string
  /** File language ID */
  languageId: string
  /** Cursor position */
  position: { line: number; column: number }
  /** Current selection */
  selection?: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
    text: string
  }
  /** Imported modules */
  imports: string[]
  /** Recent edits (last 10 changes) */
  recentEdits: EditorEdit[]
  /** Workspace structure */
  workspace: WorkspaceContext
}

export interface EditorEdit {
  timestamp: number
  range: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }
  text: string
  operation: 'insert' | 'delete' | 'replace'
}

export interface WorkspaceContext {
  rootPath: string
  files: string[]
  openFiles: string[]
  currentFile: string
}

export interface AgentCompletion {
  label: string
  kind: monaco.languages.CompletionItemKind
  detail?: string
  documentation?: string
  insertText: string
  range?: monaco.IRange
  sortText?: string
  filterText?: string
  command?: monaco.languages.Command
}

export interface AgentCodeAction {
  title: string
  kind: monaco.languages.CodeActionKind
  edit?: monaco.languages.WorkspaceEdit
  command?: monaco.languages.Command
  diagnostics?: monaco.editor.IMarkerData[]
  isPreferred?: boolean
}

export interface AgentHover {
  contents: monaco.IMarkdownString[]
  range?: monaco.IRange
}

export interface AgentDiagnostic {
  severity: monaco.MarkerSeverity
  message: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  source?: string
  code?: string | number
  relatedInformation?: {
    message: string
    file: string
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }[]
}

export interface AgentSuggestion {
  text: string
  range: monaco.IRange
  command?: monaco.languages.Command
}

export interface MonacoAgentAPIConfig {
  /** Base URL for agent API */
  baseUrl?: string
  /** WebSocket URL for streaming */
  wsUrl?: string
  /** Agent model to use */
  model?: ModelType
  /** Enable debug logging */
  debug?: boolean
  /** Completion timeout (ms) */
  completionTimeout?: number
  /** Enable inline suggestions */
  enableInlineSuggestions?: boolean
  /** Enable diagnostics */
  enableDiagnostics?: boolean
  /** Debounce delay for diagnostics (ms) */
  diagnosticsDebounce?: number
}

// ============================================================================
// Monaco Agent API Integration
// ============================================================================

export class MonacoAgentAPI {
  private editor: monaco.editor.IStandaloneCodeEditor
  private config: Required<MonacoAgentAPIConfig>
  private wsClient: WebSocketStreamingClient | null = null
  private currentAgentId: string | null = null
  private contextHistory: EditorContext[] = []
  private diagnosticsTimeout: NodeJS.Timeout | null = null
  private disposables: monaco.IDisposable[] = []
  private disposed = false

  constructor(
    editor: monaco.editor.IStandaloneCodeEditor,
    config: MonacoAgentAPIConfig = {},
    wsClient?: WebSocketStreamingClient
  ) {
    this.editor = editor
    this.config = {
      baseUrl: config.baseUrl || '/api/agents',
      wsUrl: config.wsUrl || '/api/agents/ws',
      model: config.model || 'claude-3-5-sonnet-20241022',
      debug: config.debug ?? false,
      completionTimeout: config.completionTimeout || 300,
      enableInlineSuggestions: config.enableInlineSuggestions ?? true,
      enableDiagnostics: config.enableDiagnostics ?? true,
      diagnosticsDebounce: config.diagnosticsDebounce || 1000,
    }

    // Use provided client for dependency injection (testing)
    if (wsClient) {
      this.wsClient = wsClient
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize agent API integration with Monaco Editor
   */
  async initialize(): Promise<void> {
    this.log('Initializing Monaco Agent API integration')

    // Initialize WebSocket client if not already provided (dependency injection)
    if (!this.wsClient && this.config.wsUrl) {
      try {
        this.wsClient = createWebSocketStreamingClient({
          url: this.config.wsUrl,
          priority: 'high',
          autoReconnect: true,
          debug: this.config.debug,
          timeout: this.config.completionTimeout * 2,
        })

        await this.wsClient.connect()
      } catch (error) {
        this.log('WebSocket connection failed:', error)
        // Re-throw error to match expected test behavior
        throw error
      }
    } else if (this.wsClient) {
      // Client was injected, connect it
      await this.wsClient.connect()
    }

    // Register editor event listeners
    this.setupEditorListeners()

    // Register diagnostics if enabled
    if (this.config.enableDiagnostics) {
      this.setupDiagnostics()
    }

    this.log('Initialization complete')
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Make disposal idempotent - only dispose once
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.log('Disposing Monaco Agent API integration')

    // Dispose all Monaco disposables
    this.disposables.forEach(d => d.dispose())
    this.disposables = []

    // Clear diagnostics timeout
    if (this.diagnosticsTimeout) {
      clearTimeout(this.diagnosticsTimeout)
      this.diagnosticsTimeout = null
    }

    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }

    this.log('Disposal complete')
  }

  // ==========================================================================
  // Editor Listeners
  // ==========================================================================

  private setupEditorListeners(): void {
    // Listen for content changes
    this.disposables.push(
      this.editor.onDidChangeModelContent((e) => {
        this.handleContentChange(e)
      })
    )

    // Listen for cursor position changes
    this.disposables.push(
      this.editor.onDidChangeCursorPosition((e) => {
        this.handleCursorChange(e)
      })
    )

    // Listen for selection changes
    this.disposables.push(
      this.editor.onDidChangeCursorSelection((e) => {
        this.handleSelectionChange(e)
      })
    )

    this.log('Editor listeners setup complete')
  }

  private handleContentChange(e: monaco.editor.IModelContentChangedEvent): void {
    // Track edit history
    const model = this.editor.getModel()
    if (!model) return

    for (const change of e.changes) {
      const edit: EditorEdit = {
        timestamp: Date.now(),
        range: {
          startLine: change.range.startLineNumber,
          startColumn: change.range.startColumn,
          endLine: change.range.endLineNumber,
          endColumn: change.range.endColumn,
        },
        text: change.text,
        operation: this.detectOperation(change),
      }

      this.contextHistory.push({
        ...this.extractEditorContext(),
        recentEdits: [...(this.contextHistory[this.contextHistory.length - 1]?.recentEdits || []), edit].slice(-10),
      })
    }

    // Trigger diagnostics (debounced)
    if (this.config.enableDiagnostics) {
      this.scheduleDiagnostics()
    }
  }

  private handleCursorChange(e: monaco.editor.ICursorPositionChangedEvent): void {
    this.log('Cursor position changed:', e.position)
  }

  private handleSelectionChange(e: monaco.editor.ICursorSelectionChangedEvent): void {
    this.log('Selection changed:', e.selection)
  }

  private detectOperation(change: monaco.editor.IModelContentChange): 'insert' | 'delete' | 'replace' {
    if (change.text === '' && change.rangeLength > 0) return 'delete'
    if (change.rangeLength === 0 && change.text !== '') return 'insert'
    return 'replace'
  }

  // ==========================================================================
  // Context Extraction
  // ==========================================================================

  /**
   * Extract current editor context
   */
  extractEditorContext(): EditorContext {
    const model = this.editor.getModel()
    if (!model) {
      throw new Error('No editor model available')
    }

    const position = this.editor.getPosition()
    const selection = this.editor.getSelection()

    return {
      content: model.getValue(),
      languageId: model.getLanguageId(),
      position: position
        ? { line: position.lineNumber, column: position.column }
        : { line: 1, column: 1 },
      selection: selection
        ? {
            startLine: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLine: selection.endLineNumber,
            endColumn: selection.endColumn,
            text: model.getValueInRange(selection),
          }
        : undefined,
      imports: this.extractImports(model.getValue()),
      recentEdits: this.contextHistory[this.contextHistory.length - 1]?.recentEdits || [],
      workspace: this.extractWorkspaceContext(),
    }
  }

  private extractImports(content: string): string[] {
    const imports: string[] = []

    // JavaScript/TypeScript imports
    const jsImportRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = jsImportRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

<<<<<<< HEAD
    // Python imports - match both "import X" and "from X import Y" patterns
    const pyImportRegex = /(?:^|\n)\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm
    while ((match = pyImportRegex.exec(content)) !== null) {
      // match[1] is for "from X import", match[2] is for "import X"
      const moduleName = match[1] || match[2]
      if (moduleName) imports.push(moduleName)
=======
    // Python imports - process line by line to avoid multiline matching issues
    const lines = content.split('\n')
    for (const line of lines) {
      // Check for "from X import Y" pattern first
      const fromMatch = line.match(/from\s+([\w.]+)\s+import\s+([\w.,\s*]+)/)
      if (fromMatch) {
        imports.push(fromMatch[1])
        continue
      }

      // Check for "import X" pattern
      const importMatch = line.match(/import\s+([\w.,\s*]+)/)
      if (importMatch) {
        const importedModules = importMatch[1]
          .split(',')
          .map(m => {
            // Split on 'as' to get the actual module name
            const parts = m.trim().split(/\s+as\s+/)
            // Get the first part (module name) and split on dots to get root module
            return parts[0].split('.')[0].trim()
          })
          .filter(m => m && m !== '*')
        imports.push(...importedModules)
      }
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    }

    return imports
  }

  private extractWorkspaceContext(): WorkspaceContext {
    // Note: In a real implementation, this would query the workspace
    // For now, we return mock data
    return {
      rootPath: '/workspace',
      files: [],
      openFiles: [],
      currentFile: this.editor.getModel()?.uri.path || '',
    }
  }

  // ==========================================================================
  // Diagnostics
  // ==========================================================================

  private setupDiagnostics(): void {
    this.log('Setting up diagnostics')
    this.scheduleDiagnostics()
  }

  private scheduleDiagnostics(): void {
    if (this.diagnosticsTimeout) {
      clearTimeout(this.diagnosticsTimeout)
    }

    this.diagnosticsTimeout = setTimeout(() => {
      this.runDiagnostics().catch(error => {
        this.log('Diagnostics error:', error)
      })
    }, this.config.diagnosticsDebounce)
  }

  private async runDiagnostics(): Promise<void> {
    if (!this.wsClient || !this.wsClient.isConnected()) {
      this.log('WebSocket not connected, skipping diagnostics')
      return
    }

    const context = this.extractEditorContext()
    const model = this.editor.getModel()
    if (!model) return

    try {
      const diagnostics: AgentDiagnostic[] = []
      let completed = false

      await this.wsClient.stream(
        {
          action: 'analyze',
          context,
        },
        {
          onChunk: (chunk) => {
            const data = chunk.data as { diagnostics?: AgentDiagnostic[] }
            if (data.diagnostics) {
              diagnostics.push(...data.diagnostics)
            }
          },
          onComplete: () => {
            completed = true
          },
          onError: (error) => {
            this.log('Diagnostics stream error:', error)
          },
        }
      )

      if (completed && diagnostics.length > 0) {
        this.applyDiagnostics(model, diagnostics)
      }
    } catch (error) {
      this.log('Diagnostics error:', error)
    }
  }

  private applyDiagnostics(model: monaco.editor.ITextModel, diagnostics: AgentDiagnostic[]): void {
    const markers: monaco.editor.IMarkerData[] = diagnostics.map(d => ({
      severity: d.severity,
      message: d.message,
      startLineNumber: d.startLine,
      startColumn: d.startColumn,
      endLineNumber: d.endLine,
      endColumn: d.endColumn,
      source: d.source,
      code: d.code,
      relatedInformation: d.relatedInformation?.map(info => ({
        resource: monaco.Uri.file(info.file),
        message: info.message,
        startLineNumber: info.startLine,
        startColumn: info.startColumn,
        endLineNumber: info.endLine,
        endColumn: info.endColumn,
      })),
    }))

    monaco.editor.setModelMarkers(model, 'agent-api', markers)
    this.log(`Applied ${markers.length} diagnostics`)
  }

  // ==========================================================================
  // Agent Communication
  // ==========================================================================

  /**
   * Request completion suggestions from agent
   */
  async requestCompletions(
    position: monaco.Position,
    context: monaco.languages.CompletionContext
  ): Promise<AgentCompletion[]> {
    const startTime = Date.now()
    const editorContext = this.extractEditorContext()

    try {
      const completions: AgentCompletion[] = []
      let completed = false

      if (this.wsClient && this.wsClient.isConnected()) {
        await this.wsClient.stream(
          {
            action: 'complete',
            context: editorContext,
            position: { line: position.lineNumber, column: position.column },
            triggerKind: context.triggerKind,
            triggerCharacter: context.triggerCharacter,
          },
          {
            onChunk: (chunk) => {
              const data = chunk.data as { completions?: AgentCompletion[] }
              if (data.completions) {
                completions.push(...data.completions)
              }
            },
            onComplete: () => {
              completed = true
            },
            onError: (error) => {
              this.log('Completion stream error:', error)
            },
          }
        )
      }

      const latency = Date.now() - startTime
      this.log(`Completions received in ${latency}ms (target: <${this.config.completionTimeout}ms)`)

      return completed ? completions : []
    } catch (error) {
      this.log('Completion error:', error)
      return []
    }
  }

  /**
   * Request hover information from agent
   */
  async requestHover(position: monaco.Position): Promise<AgentHover | null> {
    const editorContext = this.extractEditorContext()

    try {
      let hoverInfo: AgentHover | null = null

      if (this.wsClient && this.wsClient.isConnected()) {
        await this.wsClient.stream(
          {
            action: 'hover',
            context: editorContext,
            position: { line: position.lineNumber, column: position.column },
          },
          {
            onChunk: (chunk) => {
              const data = chunk.data as { hover?: AgentHover }
              if (data.hover) {
                hoverInfo = data.hover
              }
            },
          }
        )
      }

      return hoverInfo
    } catch (error) {
      this.log('Hover error:', error)
      return null
    }
  }

  /**
   * Request code actions from agent
   */
  async requestCodeActions(
    range: monaco.Range,
    context: monaco.languages.CodeActionContext
  ): Promise<AgentCodeAction[]> {
    const editorContext = this.extractEditorContext()

    try {
      const actions: AgentCodeAction[] = []

      if (this.wsClient && this.wsClient.isConnected()) {
        await this.wsClient.stream(
          {
            action: 'codeAction',
            context: editorContext,
            range: {
              startLine: range.startLineNumber,
              startColumn: range.startColumn,
              endLine: range.endLineNumber,
              endColumn: range.endColumn,
            },
            diagnostics: context.markers,
          },
          {
            onChunk: (chunk) => {
              const data = chunk.data as { actions?: AgentCodeAction[] }
              if (data.actions) {
                actions.push(...data.actions)
              }
            },
          }
        )
      }

      return actions
    } catch (error) {
      this.log('Code actions error:', error)
      return []
    }
  }

  /**
   * Apply agent suggestion to editor
   */
  async applySuggestion(suggestion: AgentSuggestion): Promise<void> {
    const model = this.editor.getModel()
    if (!model) return

    const edit: monaco.editor.IIdentifiedSingleEditOperation = {
      range: suggestion.range,
      text: suggestion.text,
      forceMoveMarkers: true,
    }

    model.pushEditOperations(
      this.editor.getSelections(),
      [edit],
      () => null
    )

    if (suggestion.command) {
      // Execute command if provided
      this.log('Executing command:', suggestion.command)
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.info('[MonacoAgentAPI]', ...args)
    }
  }
}

// ============================================================================
// Monaco Provider Registration
// ============================================================================

/**
 * Register all Monaco providers for agent API integration
 */
export function registerMonacoAgentProviders(
  monacoInstance: typeof monaco,
  languageId: string,
  agentAPI: MonacoAgentAPI
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = []

  // Completion provider
  disposables.push(
    monacoInstance.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ':', '<', '"', "'", '/', '@', '#'],
      provideCompletionItems: async (model, position, context, token) => {
        const completions = await agentAPI.requestCompletions(position, context)
        return {
          suggestions: completions,
        }
      },
    })
  )

  // Hover provider
  disposables.push(
    monacoInstance.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position, token) => {
        const hover = await agentAPI.requestHover(position)
        return hover || null
      },
    })
  )

  // Code action provider
  disposables.push(
    monacoInstance.languages.registerCodeActionProvider(languageId, {
      provideCodeActions: async (model, range, context, token) => {
        const actions = await agentAPI.requestCodeActions(range, context)
        return {
          actions,
          dispose: () => {},
        }
      },
    })
  )

  return disposables
}
