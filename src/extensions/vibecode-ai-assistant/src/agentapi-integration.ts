/**
 * VS Code Extension Integration with Agent API
 *
 * Provides bidirectional communication between VS Code and agents:
 * - Command palette integration
 * - Webview for agent chat
 * - File change listeners
 * - Selection change events
 * - Terminal integration
 *
 * @module extensions/agentapi-integration
 */

import * as vscode from 'vscode'
import axios, { AxiosInstance } from 'axios'
// import { logger } from '@/lib/logger';
// ============================================================================
// Types
// ============================================================================

export interface AgentAPIConfig {
  baseUrl: string
  wsUrl?: string
  model?: string
  timeout?: number
  debug?: boolean
}

export interface CodeContext {
  /** Current file content */
  content: string
  /** File path */
  filePath: string
  /** Language ID */
  languageId: string
  /** Cursor position */
  position: { line: number; character: number }
  /** Current selection */
  selection?: {
    start: { line: number; character: number }
    end: { line: number; character: number }
    text: string
  }
  /** Workspace root */
  workspaceRoot?: string
  /** Recent edits */
  recentEdits: RecentEdit[]
  /** Imported modules */
  imports: string[]
  /** Git branch */
  gitBranch?: string
}

export interface RecentEdit {
  timestamp: number
  range: vscode.Range
  text: string
  operation: 'insert' | 'delete' | 'replace'
}

export interface AgentRequest {
  action: 'complete' | 'analyze' | 'hover' | 'codeAction' | 'chat' | 'refactor' | 'explain' | 'fix'
  context: CodeContext
  prompt?: string
  options?: Record<string, unknown>
}

export interface AgentResponse {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    latency: number
    tokens?: number
    model?: string
  }
}

export interface AgentStreamChunk {
  type: 'text' | 'code' | 'error' | 'complete'
  content: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Agent API Client
// ============================================================================

export class AgentAPIClient {
  private client: AxiosInstance
  private config: Required<AgentAPIConfig>
  private currentAgentId: string | null = null

  constructor(config: AgentAPIConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      wsUrl: config.wsUrl || config.baseUrl.replace('http', 'ws'),
      model: config.model || 'claude-3-5-sonnet-20241022',
      timeout: config.timeout || 30000,
      debug: config.debug ?? false,
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Start a new agent session
   */
  async startAgent(workspace: string, task: string): Promise<string> {
    try {
      const response = await this.client.post('/agents', {
        agent_type: 'aider',
        workspace,
        model: this.config.model,
        task,
      })

      this.currentAgentId = response.data.agent_id ?? null
      this.log('Agent started:', this.currentAgentId)
      return this.currentAgentId as string
    } catch (error) {
      this.log('Error starting agent:', error)
      throw error
    }
  }

  /**
   * Send a request to the agent
   */
  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      const response = await this.client.post('/agents/request', request)
      const latency = Date.now() - startTime

      return {
        success: true,
        data: response.data,
        metadata: {
          latency,
          model: this.config.model,
        },
      }
    } catch (error) {
      this.log('Request error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          latency: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Stream responses from the agent
   */
  async *streamRequest(request: AgentRequest): AsyncGenerator<AgentStreamChunk> {
    try {
      const response = await this.client.post('/agents/stream', request, {
        responseType: 'stream',
      })

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            yield data as AgentStreamChunk
          }
        }
      }
    } catch (error) {
      this.log('Stream error:', error)
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Stop the current agent
   */
  async stopAgent(): Promise<void> {
    if (!this.currentAgentId) {
      return
    }

    try {
      await this.client.post(`/agents/${this.currentAgentId}/stop`)
      this.log('Agent stopped:', this.currentAgentId)
      this.currentAgentId = null
    } catch (error) {
      this.log('Error stopping agent:', error)
    }
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.info('[AgentAPIClient]', ...args)
    }
  }
}

// ============================================================================
// VS Code Extension Integration
// ============================================================================

export class AgentAPIExtension {
  private client: AgentAPIClient
  private context: vscode.ExtensionContext
  private outputChannel: vscode.OutputChannel
  private recentEdits: RecentEdit[] = []
  private disposables: vscode.Disposable[] = []

  constructor(context: vscode.ExtensionContext, config: AgentAPIConfig) {
    this.context = context
    this.client = new AgentAPIClient(config)
    this.outputChannel = vscode.window.createOutputChannel('VibeCode Agent API')

    this.registerCommands()
    this.setupEventListeners()
  }

  // ==========================================================================
  // Command Registration
  // ==========================================================================

  private registerCommands(): void {
    // Code completion command
    this.disposables.push(
      vscode.commands.registerCommand('vibecode.agentComplete', async () => {
        await this.handleCompletion()
      })
    )

    // Code explanation command
    this.disposables.push(
      vscode.commands.registerCommand('vibecode.agentExplain', async () => {
        await this.handleExplanation()
      })
    )

    // Code fix command
    this.disposables.push(
      vscode.commands.registerCommand('vibecode.agentFix', async () => {
        await this.handleFix()
      })
    )

    // Code refactor command
    this.disposables.push(
      vscode.commands.registerCommand('vibecode.agentRefactor', async () => {
        await this.handleRefactor()
      })
    )

    // Chat with agent command
    this.disposables.push(
      vscode.commands.registerCommand('vibecode.agentChat', async () => {
        await this.handleChat()
      })
    )

    // Analyze code command
    this.disposables.push(
      vscode.commands.registerCommand('vibecode.agentAnalyze', async () => {
        await this.handleAnalysis()
      })
    )

    this.log('Commands registered')
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================

  private setupEventListeners(): void {
    // Listen for text document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        this.handleTextDocumentChange(e)
      })
    )

    // Listen for selection changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
        this.handleSelectionChange(e)
      })
    )

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
        this.handleActiveEditorChange(editor)
      })
    )

    // Listen for file saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        this.handleFileSave(document)
      })
    )

    this.log('Event listeners setup')
  }

  private handleTextDocumentChange(e: vscode.TextDocumentChangeEvent): void {
    // Track recent edits
    for (const change of e.contentChanges) {
      const edit: RecentEdit = {
        timestamp: Date.now(),
        range: change.range,
        text: change.text,
        operation: this.detectOperation(change),
      }

      this.recentEdits.push(edit)
      if (this.recentEdits.length > 10) {
        this.recentEdits.shift()
      }
    }
  }

  private handleSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
    this.log('Selection changed:', e.selections)
  }

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (editor) {
      this.log('Active editor changed:', editor.document.fileName)
    }
  }

  private handleFileSave(document: vscode.TextDocument): void {
    this.log('File saved:', document.fileName)
    // Could trigger automatic analysis here
  }

  private detectOperation(change: vscode.TextDocumentContentChangeEvent): 'insert' | 'delete' | 'replace' {
    if (change.text === '' && change.rangeLength > 0) return 'delete'
    if (change.rangeLength === 0 && change.text !== '') return 'insert'
    return 'replace'
  }

  // ==========================================================================
  // Context Extraction
  // ==========================================================================

  private extractCodeContext(editor: vscode.TextEditor): CodeContext {
    const document = editor.document
    const position = editor.selection.active
    const selection = editor.selection.isEmpty ? undefined : {
      start: editor.selection.start,
      end: editor.selection.end,
      text: document.getText(editor.selection),
    }

    return {
      content: document.getText(),
      filePath: document.fileName,
      languageId: document.languageId,
      position: { line: position.line, character: position.character },
      selection,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      recentEdits: this.recentEdits,
      imports: this.extractImports(document.getText()),
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

    // Python imports
    const pyImportRegex = /(?:from\s+([\w.]+)\s+)?import\s+([\w,\s*]+)/g
    while ((match = pyImportRegex.exec(content)) !== null) {
      if (match[1]) imports.push(match[1])
    }

    return imports
  }

  // ==========================================================================
  // Command Handlers
  // ==========================================================================

  private async handleCompletion(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor')
      return
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Getting AI completion...',
        cancellable: true,
      },
      async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => {
        const context = this.extractCodeContext(editor)
        const response = await this.client.sendRequest({
          action: 'complete',
          context,
        })

        if (response.success && response.data) {
          // Apply completion
          this.log('Completion received:', response.data)
          vscode.window.showInformationMessage('Completion received')
        } else {
          vscode.window.showErrorMessage(response.error || 'Completion failed')
        }
      }
    )
  }

  private async handleExplanation(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor')
      return
    }

    if (editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select code to explain')
      return
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Explaining code...',
      },
      async () => {
        const context = this.extractCodeContext(editor)
        const response = await this.client.sendRequest({
          action: 'explain',
          context,
        })

        if (response.success && response.data) {
          // Show explanation in webview or output channel
          this.outputChannel.clear()
          this.outputChannel.appendLine('Code Explanation:')
          this.outputChannel.appendLine('='.repeat(50))
          this.outputChannel.appendLine(JSON.stringify(response.data, null, 2))
          this.outputChannel.show()
        } else {
          vscode.window.showErrorMessage(response.error || 'Explanation failed')
        }
      }
    )
  }

  private async handleFix(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor')
      return
    }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
    if (diagnostics.length === 0) {
      vscode.window.showInformationMessage('No issues found')
      return
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Fixing code issues...',
      },
      async () => {
        const context = this.extractCodeContext(editor)
        const response = await this.client.sendRequest({
          action: 'fix',
          context,
          options: { diagnostics },
        })

        if (response.success && response.data) {
          vscode.window.showInformationMessage('Code fixes suggested')
        } else {
          vscode.window.showErrorMessage(response.error || 'Fix failed')
        }
      }
    )
  }

  private async handleRefactor(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select code to refactor')
      return
    }

    const refactorType = await vscode.window.showQuickPick(
      ['Extract Function', 'Extract Variable', 'Inline', 'Rename', 'Simplify'],
      { placeHolder: 'Select refactoring type' }
    )

    if (!refactorType) return

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Refactoring: ${refactorType}...`,
      },
      async () => {
        const context = this.extractCodeContext(editor)
        const response = await this.client.sendRequest({
          action: 'refactor',
          context,
          options: { type: refactorType },
        })

        if (response.success && response.data) {
          vscode.window.showInformationMessage('Refactoring complete')
        } else {
          vscode.window.showErrorMessage(response.error || 'Refactoring failed')
        }
      }
    )
  }

  private async handleChat(): Promise<void> {
    const prompt = await vscode.window.showInputBox({
      placeHolder: 'Ask the AI assistant...',
      prompt: 'What would you like to know?',
    })

    if (!prompt) return

    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor')
      return
    }

    // Stream the response
    this.outputChannel.clear()
    this.outputChannel.show()
    this.outputChannel.appendLine('AI Assistant:')
    this.outputChannel.appendLine('='.repeat(50))

    const context = this.extractCodeContext(editor)
    const stream = this.client.streamRequest({
      action: 'chat',
      context,
      prompt,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'text' || chunk.type === 'code') {
        this.outputChannel.append(chunk.content)
      } else if (chunk.type === 'error') {
        this.outputChannel.appendLine(`\nError: ${chunk.content}`)
      } else if (chunk.type === 'complete') {
        this.outputChannel.appendLine('\n' + '='.repeat(50))
      }
    }
  }

  private async handleAnalysis(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor')
      return
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing code...',
      },
      async () => {
        const context = this.extractCodeContext(editor)
        const response = await this.client.sendRequest({
          action: 'analyze',
          context,
        })

        if (response.success && response.data) {
          // Show analysis in webview
          this.outputChannel.clear()
          this.outputChannel.appendLine('Code Analysis:')
          this.outputChannel.appendLine('='.repeat(50))
          this.outputChannel.appendLine(JSON.stringify(response.data, null, 2))
          this.outputChannel.show()
        } else {
          vscode.window.showErrorMessage(response.error || 'Analysis failed')
        }
      }
    )
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  dispose(): void {
    this.disposables.forEach(d => d.dispose())
    this.outputChannel.dispose()
    this.client.stopAgent()
  }

  private log(...args: unknown[]): void {
    console.info('[AgentAPIExtension]', ...args)
  }
}

// ============================================================================
// Extension Activation
// ============================================================================

export function activateAgentAPI(context: vscode.ExtensionContext): AgentAPIExtension {
  const config: AgentAPIConfig = {
    baseUrl: vscode.workspace.getConfiguration('vibecode').get('agentApiUrl') || 'http://localhost:3000/api',
    debug: vscode.workspace.getConfiguration('vibecode').get('debug') || false,
  }

  const extension = new AgentAPIExtension(context, config)
  context.subscriptions.push(extension)

  return extension
}
