/**
 * Claude Code CLI Integration
 *
 * Terminal-based integration with Claude Code CLI for code-server
 * Claude Code runs as a CLI tool in the terminal, not as a webview extension
 *
 * Staff Engineer Implementation - Production-ready CLI integration
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs/promises'

export interface ClaudeCliConfig {
  apiKey?: string
  model?: string
  maxTokens?: number
  temperature?: number
  workingDirectory: string
  timeout?: number
}

export interface ClaudeCliRequest {
  command: 'chat' | 'generate' | 'analyze' | 'explain' | 'optimize' | 'debug' | 'test'
  input: string
  files?: string[]
  context?: string
  options?: Record<string, any>
}

export interface ClaudeCliResponse {
  success: boolean
  output: string
  error?: string
  metadata?: {
    tokensUsed?: number
    responseTime?: number
    model?: string
  }
}

export class ClaudeCliIntegration extends EventEmitter {
  private config: ClaudeCliConfig
  private activeProcesses: Map<string, ChildProcess> = new Map()
  private sessionId: string

  constructor(config: ClaudeCliConfig) {
    super()
    this.config = config
    this.sessionId = `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Execute Claude Code CLI command
   */
  async executeCommand(request: ClaudeCliRequest): Promise<ClaudeCliResponse> {
    const startTime = Date.now()

    try {
      // Build CLI command
      const command = await this.buildClaudeCommand(request)

      // Execute command
      const result = await this.runCliCommand(command, request.input)

      const responseTime = Date.now() - startTime

      return {
        success: true,
        output: result.stdout,
        metadata: {
          responseTime,
          model: this.config.model
        }
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          responseTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Start interactive Claude Code session
   */
  async startInteractiveSession(): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = [
        'claude-code',
        '--interactive',
        '--session-id', this.sessionId
      ]

      if (this.config.apiKey) {
        command.push('--api-key', this.config.apiKey)
      }

      if (this.config.model) {
        command.push('--model', this.config.model)
      }

      const child = spawn(command[0], command.slice(1), {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
          CLAUDE_MODEL: this.config.model || process.env.CLAUDE_MODEL
        }
      })

      this.activeProcesses.set(this.sessionId, child)

      child.stdout?.on('data', (data) => {
        this.emit('output', data.toString())
      })

      child.stderr?.on('data', (data) => {
        this.emit('error', data.toString())
      })

      child.on('close', (code) => {
        this.activeProcesses.delete(this.sessionId)
        this.emit('session-closed', { sessionId: this.sessionId, exitCode: code })
      })

      child.on('error', (error) => {
        this.activeProcesses.delete(this.sessionId)
        reject(error)
      })

      // Wait for Claude to be ready
      const readyTimeout = setTimeout(() => {
        reject(new Error('Claude Code session failed to start within timeout'))
      }, 10000)

      process.stdout?.once('data', () => {
        clearTimeout(readyTimeout)
        resolve(this.sessionId)
      })
    })
  }

  /**
   * Send message to interactive session
   */
  async sendToSession(sessionId: string, message: string): Promise<void> {
    const process = this.activeProcesses.get(sessionId)
    if (!process || !process.stdin) {
      throw new Error(`No active session found: ${sessionId}`)
    }

    return new Promise((resolve, reject) => {
      process.stdin!.write(`${message}\n`, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Close interactive session
   */
  async closeSession(sessionId: string): Promise<void> {
    const process = this.activeProcesses.get(sessionId)
    if (process) {
      process.kill('SIGTERM')
      this.activeProcesses.delete(sessionId)
    }
  }

  /**
   * Generate code using Claude CLI
   */
  async generateCode(prompt: string, filePath?: string): Promise<ClaudeCliResponse> {
    const request: ClaudeCliRequest = {
      command: 'generate',
      input: prompt,
      files: filePath ? [filePath] : undefined,
      context: await this.getFileContext(filePath)
    }

    return this.executeCommand(request)
  }

  /**
   * Explain code using Claude CLI
   */
  async explainCode(code: string, language?: string): Promise<ClaudeCliResponse> {
    const tempFile = await this.createTempFile(code, language)

    try {
      const request: ClaudeCliRequest = {
        command: 'explain',
        input: `Explain this code:`,
        files: [tempFile],
        options: { language }
      }

      return this.executeCommand(request)
    } finally {
      await this.cleanupTempFile(tempFile)
    }
  }

  /**
   * Analyze code for issues
   */
  async analyzeCode(code: string, language?: string): Promise<ClaudeCliResponse> {
    const tempFile = await this.createTempFile(code, language)

    try {
      const request: ClaudeCliRequest = {
        command: 'analyze',
        input: 'Analyze this code for potential issues and improvements',
        files: [tempFile],
        options: { language }
      }

      return this.executeCommand(request)
    } finally {
      await this.cleanupTempFile(tempFile)
    }
  }

  /**
   * Debug code issues
   */
  async debugCode(code: string, errorMessage?: string): Promise<ClaudeCliResponse> {
    const tempFile = await this.createTempFile(code)

    try {
      const input = errorMessage
        ? `Debug this code. Error: ${errorMessage}`
        : 'Debug this code and find potential issues'

      const request: ClaudeCliRequest = {
        command: 'debug',
        input,
        files: [tempFile]
      }

      return this.executeCommand(request)
    } finally {
      await this.cleanupTempFile(tempFile)
    }
  }

  /**
   * Generate tests for code
   */
  async generateTests(code: string, language?: string): Promise<ClaudeCliResponse> {
    const tempFile = await this.createTempFile(code, language)

    try {
      const request: ClaudeCliRequest = {
        command: 'test',
        input: 'Generate comprehensive test cases for this code',
        files: [tempFile],
        options: { language }
      }

      return this.executeCommand(request)
    } finally {
      await this.cleanupTempFile(tempFile)
    }
  }

  /**
   * Optimize code performance
   */
  async optimizeCode(code: string, language?: string): Promise<ClaudeCliResponse> {
    const tempFile = await this.createTempFile(code, language)

    try {
      const request: ClaudeCliRequest = {
        command: 'optimize',
        input: 'Optimize this code for better performance and readability',
        files: [tempFile],
        options: { language }
      }

      return this.executeCommand(request)
    } finally {
      await this.cleanupTempFile(tempFile)
    }
  }

  /**
   * Chat with Claude about code
   */
  async chatWithClaude(message: string, contextFiles?: string[]): Promise<ClaudeCliResponse> {
    const request: ClaudeCliRequest = {
      command: 'chat',
      input: message,
      files: contextFiles,
      context: contextFiles ? await this.getMultiFileContext(contextFiles) : undefined
    }

    return this.executeCommand(request)
  }

  /**
   * Build Claude CLI command based on request
   */
  private async buildClaudeCommand(request: ClaudeCliRequest): Promise<string[]> {
    const command = ['claude-code', request.command]

    // Add API configuration
    if (this.config.apiKey) {
      command.push('--api-key', this.config.apiKey)
    }

    if (this.config.model) {
      command.push('--model', this.config.model)
    }

    if (this.config.maxTokens) {
      command.push('--max-tokens', this.config.maxTokens.toString())
    }

    if (this.config.temperature !== undefined) {
      command.push('--temperature', this.config.temperature.toString())
    }

    // Add files if specified
    if (request.files && request.files.length > 0) {
      request.files.forEach(file => {
        command.push('--file', file)
      })
    }

    // Add additional options
    if (request.options) {
      Object.entries(request.options).forEach(([key, value]) => {
        command.push(`--${key}`, value.toString())
      })
    }

    // Add JSON output for easier parsing
    command.push('--output', 'json')

    return command
  }

  /**
   * Run CLI command and capture output
   */
  private async runCliCommand(command: string[], input: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: this.config.apiKey || process.env.ANTHROPIC_API_KEY
        }
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Claude command failed with exit code ${code}: ${stderr}`))
        }
      })

      child.on('error', (error) => {
        reject(error)
      })

      // Send input to Claude
      if (input) {
        child.stdin?.write(input)
        child.stdin?.end()
      }

      // Set timeout
      if (this.config.timeout) {
        setTimeout(() => {
          process.kill('SIGTERM')
          reject(new Error('Claude command timed out'))
        }, this.config.timeout)
      }
    })
  }

  /**
   * Get file context for Claude
   */
  private async getFileContext(filePath?: string): Promise<string | undefined> {
    if (!filePath) return undefined

    try {
      const content = await fs.readFile(path.resolve(this.config.workingDirectory, filePath), 'utf-8')
      return `File: ${filePath}\n\n${content}`
    } catch (error) {
      console.warn(`Failed to read file context: ${filePath}`, error)
      return undefined
    }
  }

  /**
   * Get context from multiple files
   */
  private async getMultiFileContext(filePaths: string[]): Promise<string> {
    const contexts = await Promise.all(
      filePaths.map(async (filePath) => {
        try {
          const content = await fs.readFile(path.resolve(this.config.workingDirectory, filePath), 'utf-8')
          return `=== ${filePath} ===\n${content}\n`
        } catch (error) {
          return `=== ${filePath} ===\n[Error reading file]\n`
        }
      })
    )

    return contexts.join('\n')
  }

  /**
   * Create temporary file for code analysis
   */
  private async createTempFile(code: string, language?: string): Promise<string> {
    const extension = this.getFileExtension(language)
    const tempFileName = `claude_temp_${Date.now()}.${extension}`
    const tempFilePath = path.join(this.config.workingDirectory, '.claude', tempFileName)

    // Ensure .claude directory exists
    await fs.mkdir(path.dirname(tempFilePath), { recursive: true })

    // Write code to temp file
    await fs.writeFile(tempFilePath, code, 'utf-8')

    return tempFilePath
  }

  /**
   * Cleanup temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.warn(`Failed to cleanup temp file: ${filePath}`, error)
    }
  }

  /**
   * Get file extension based on language
   */
  private getFileExtension(language?: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      rust: 'rs',
      go: 'go',
      php: 'php',
      ruby: 'rb',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      html: 'html',
      css: 'css',
      json: 'json',
      yaml: 'yaml',
      markdown: 'md',
      shell: 'sh',
      sql: 'sql'
    }

    return extensions[language || ''] || 'txt'
  }

  /**
   * Cleanup all resources
   */
  async destroy(): Promise<void> {
    // Close all active sessions
    const sessionPromises = Array.from(this.activeProcesses.keys()).map(sessionId =>
      this.closeSession(sessionId)
    )

    await Promise.all(sessionPromises)

    // Cleanup temp directory
    try {
      const tempDir = path.join(this.config.workingDirectory, '.claude')
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup Claude temp directory', error)
    }

    this.removeAllListeners()
  }
}

// Singleton instance for the application
let claudeCliInstance: ClaudeCliIntegration | null = null

export function getClaudeCliInstance(config?: ClaudeCliConfig): ClaudeCliIntegration {
  if (!claudeCliInstance && config) {
    claudeCliInstance = new ClaudeCliIntegration(config)
  }

  if (!claudeCliInstance) {
    throw new Error('Claude CLI instance not initialized. Provide config on first call.')
  }

  return claudeCliInstance
}

export function destroyClaudeCliInstance(): Promise<void> {
  if (claudeCliInstance) {
    const promise = claudeCliInstance.destroy()
    claudeCliInstance = null
    return promise
  }
  return Promise.resolve()
}
