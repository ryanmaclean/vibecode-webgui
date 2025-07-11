/**
 * Secure Claude Code CLI Integration
 * 
 * Security-hardened terminal-based integration with Claude Code CLI
 * Addresses critical vulnerabilities identified in security review
 * 
 * Staff Engineer Implementation - Production-ready secure CLI integration
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { promisify } from 'util'

// Security constants
const MAX_PROCESS_COUNT = 10
const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const MAX_PROMPT_LENGTH = 10000
const MAX_SESSION_DURATION = 3600000 // 1 hour
const ALLOWED_FILE_EXTENSIONS = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.rs', '.go', '.php', '.rb', '.md', '.txt']
const BLOCKED_PATHS = ['/', '/etc', '/usr', '/bin', '/sbin', '/var', '/tmp', '/root', '/home']

export interface SecureClaudeCliConfig {
  apiKey?: string
  model?: string
  maxTokens?: number
  temperature?: number
  workingDirectory: string
  timeout?: number
  maxConcurrentProcesses?: number
  userId: string
  sessionId: string
}

export interface SecureClaudeCliRequest {
  command: 'chat' | 'generate' | 'analyze' | 'explain' | 'optimize' | 'debug' | 'test'
  input: string
  files?: string[]
  context?: string
  options?: Record<string, string>
}

export interface SecureClaudeCliResponse {
  success: boolean
  output: string
  error?: string
  metadata?: {
    tokensUsed?: number
    responseTime?: number
    model?: string
    sanitized?: boolean
  }
}

export class SecureClaudeCliIntegration extends EventEmitter {
  private config: SecureClaudeCliConfig
  private activeProcesses: Map<string, ChildProcess> = new Map()
  private sessionId: string
  private processCount = 0
  private rateLimiter: Map<string, number[]> = new Map()
  private tempFileCleanup: Set<string> = new Set()

  constructor(config: SecureClaudeCliConfig) {
    super()
    this.config = this.validateAndSanitizeConfig(config)
    this.sessionId = this.generateSecureSessionId()
    
    // Set up cleanup on process exit
    process.on('exit', () => this.cleanup())
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
  }

  /**
   * Validate and sanitize configuration
   */
  private validateAndSanitizeConfig(config: SecureClaudeCliConfig): SecureClaudeCliConfig {
    // Validate required fields
    if (!config.userId || typeof config.userId !== 'string') {
      throw new Error('Valid userId is required')
    }
    
    if (!config.sessionId || typeof config.sessionId !== 'string') {
      throw new Error('Valid sessionId is required')
    }

    if (!config.workingDirectory || typeof config.workingDirectory !== 'string') {
      throw new Error('Valid workingDirectory is required')
    }

    // Validate working directory is safe
    const normalizedPath = path.normalize(config.workingDirectory)
    if (this.isBlockedPath(normalizedPath)) {
      throw new Error('Working directory path is not allowed')
    }

    // Sanitize and validate other fields
    return {
      ...config,
      workingDirectory: normalizedPath,
      timeout: Math.min(config.timeout || 30000, 60000), // Max 60 seconds
      maxTokens: Math.min(config.maxTokens || 4096, 8192), // Max 8K tokens
      temperature: Math.max(0, Math.min(config.temperature || 0.1, 1)), // 0-1 range
      maxConcurrentProcesses: Math.min(config.maxConcurrentProcesses || 3, MAX_PROCESS_COUNT)
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSecureSessionId(): string {
    const timestamp = Date.now()
    const random = crypto.randomBytes(16).toString('hex')
    const hash = crypto.createHash('sha256')
      .update(`${this.config.userId}-${this.config.sessionId}-${timestamp}-${random}`)
      .digest('hex')
    return `secure_${hash.substring(0, 16)}`
  }

  /**
   * Check if path is blocked for security
   */
  private isBlockedPath(filePath: string): boolean {
    const normalized = path.normalize(filePath)
    
    // Check for path traversal
    if (normalized.includes('..') || normalized.startsWith('/')) {
      return true
    }

    // Check against blocked paths
    return BLOCKED_PATHS.some(blocked => 
      normalized.startsWith(blocked) || normalized.includes(blocked)
    )
  }

  /**
   * Validate file path for security
   */
  private validateFilePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false
    }

    // Length check
    if (filePath.length > 255) {
      return false
    }

    // Normalize and check for traversal
    const normalized = path.normalize(filePath)
    if (this.isBlockedPath(normalized)) {
      return false
    }

    // Check file extension
    const ext = path.extname(normalized).toLowerCase()
    if (ext && !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      return false
    }

    // Ensure file is within working directory
    const fullPath = path.resolve(this.config.workingDirectory, normalized)
    if (!fullPath.startsWith(path.resolve(this.config.workingDirectory))) {
      return false
    }

    return true
  }

  /**
   * Sanitize command arguments to prevent injection
   */
  private sanitizeCommandArgs(args: string[]): string[] {
    return args.map(arg => {
      // Remove dangerous characters
      const sanitized = arg.replace(/[;&|`$()[\]{}\\'"<>]/g, '')
      
      // Limit length
      return sanitized.substring(0, 1000)
    })
  }

  /**
   * Sanitize user input
   */
  private sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return ''
    }

    // Length limit
    if (input.length > MAX_PROMPT_LENGTH) {
      input = input.substring(0, MAX_PROMPT_LENGTH)
    }

    // Remove potential injection patterns
    const dangerous = [
      /\$\([^)]*\)/g,  // Command substitution
      /`[^`]*`/g,      // Backticks
      /;[\s]*rm/gi,    // Dangerous commands
      /;[\s]*cat/gi,
      /;[\s]*ls/gi,
      /\|\|/g,         // OR operators
      /&&/g            // AND operators
    ]

    let sanitized = input
    dangerous.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '')
    })

    return sanitized.trim()
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now()
    const userRequests = this.rateLimiter.get(userId) || []
    
    // Remove requests older than 1 minute
    const recentRequests = userRequests.filter(time => now - time < 60000)
    
    // Check if user has exceeded rate limit (max 20 requests per minute)
    if (recentRequests.length >= 20) {
      return false
    }

    // Add current request
    recentRequests.push(now)
    this.rateLimiter.set(userId, recentRequests)
    
    return true
  }

  /**
   * Check process limits
   */
  private checkProcessLimits(): boolean {
    return this.processCount < (this.config.maxConcurrentProcesses || 3)
  }

  /**
   * Execute Claude Code CLI command securely
   */
  async executeCommand(request: SecureClaudeCliRequest): Promise<SecureClaudeCliResponse> {
    const startTime = Date.now()
    
    try {
      // Rate limiting check
      if (!this.checkRateLimit(this.config.userId)) {
        return {
          success: false,
          output: '',
          error: 'Rate limit exceeded. Please try again later.',
          metadata: { responseTime: Date.now() - startTime }
        }
      }

      // Process limits check
      if (!this.checkProcessLimits()) {
        return {
          success: false,
          output: '',
          error: 'Too many concurrent processes. Please try again later.',
          metadata: { responseTime: Date.now() - startTime }
        }
      }

      // Validate and sanitize request
      const sanitizedRequest = await this.sanitizeRequest(request)
      if (!sanitizedRequest) {
        return {
          success: false,
          output: '',
          error: 'Invalid request parameters',
          metadata: { responseTime: Date.now() - startTime }
        }
      }

      // Build and execute command
      const command = await this.buildSecureCommand(sanitizedRequest)
      const result = await this.runSecureCliCommand(command, sanitizedRequest.input)
      
      const responseTime = Date.now() - startTime
      
      return {
        success: true,
        output: this.sanitizeOutput(result.stdout),
        metadata: {
          responseTime,
          model: this.config.model,
          sanitized: true
        }
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: 'Command execution failed',
        metadata: {
          responseTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Sanitize and validate request
   */
  private async sanitizeRequest(request: SecureClaudeCliRequest): Promise<SecureClaudeCliRequest | null> {
    // Validate command
    const allowedCommands = ['chat', 'generate', 'analyze', 'explain', 'optimize', 'debug', 'test']
    if (!allowedCommands.includes(request.command)) {
      return null
    }

    // Sanitize input
    const sanitizedInput = this.sanitizeInput(request.input)
    if (!sanitizedInput) {
      return null
    }

    // Validate and sanitize files
    let sanitizedFiles: string[] = []
    if (request.files) {
      for (const file of request.files) {
        if (this.validateFilePath(file)) {
          sanitizedFiles.push(file)
        }
      }
    }

    // Sanitize options
    const sanitizedOptions: Record<string, string> = {}
    if (request.options) {
      for (const [key, value] of Object.entries(request.options)) {
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '')
        const sanitizedValue = String(value).replace(/[;&|`$()[\]{}\\'"<>]/g, '')
        if (sanitizedKey && sanitizedValue) {
          sanitizedOptions[sanitizedKey] = sanitizedValue
        }
      }
    }

    return {
      command: request.command,
      input: sanitizedInput,
      files: sanitizedFiles,
      context: request.context ? this.sanitizeInput(request.context) : undefined,
      options: sanitizedOptions
    }
  }

  /**
   * Build secure command
   */
  private async buildSecureCommand(request: SecureClaudeCliRequest): Promise<string[]> {
    const command = ['claude-code', request.command]

    // Add authentication (if available and valid)
    if (this.config.apiKey && this.isValidApiKey(this.config.apiKey)) {
      command.push('--api-key')
      command.push(this.config.apiKey)
    }

    // Add model
    if (this.config.model && this.isValidModel(this.config.model)) {
      command.push('--model')
      command.push(this.config.model)
    }

    // Add safe configuration
    command.push('--max-tokens', String(this.config.maxTokens))
    command.push('--temperature', String(this.config.temperature))
    command.push('--timeout', '30') // Force 30 second timeout
    command.push('--session-id', this.sessionId)

    // Add validated files
    if (request.files) {
      for (const file of request.files) {
        command.push('--file')
        command.push(file)
      }
    }

    // Add sanitized options
    if (request.options) {
      for (const [key, value] of Object.entries(request.options)) {
        command.push(`--${key}`)
        command.push(value)
      }
    }

    // Force JSON output for parsing
    command.push('--output', 'json')

    return this.sanitizeCommandArgs(command)
  }

  /**
   * Validate API key format
   */
  private isValidApiKey(apiKey: string): boolean {
    return /^sk-ant-[a-zA-Z0-9]{95}$/.test(apiKey)
  }

  /**
   * Validate model name
   */
  private isValidModel(model: string): boolean {
    const allowedModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ]
    return allowedModels.includes(model)
  }

  /**
   * Run CLI command with security controls
   */
  private async runSecureCliCommand(command: string[], input: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      this.processCount++
      
      const process = spawn(command[0], command.slice(1), {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Minimal environment
          PATH: '/usr/bin:/bin',
          HOME: '/tmp',
          ANTHROPIC_API_KEY: this.config.apiKey
        },
        // Security options
        uid: 1000, // Non-root user
        gid: 1000,
        detached: false,
        shell: false
      })

      let stdout = ''
      let stderr = ''
      let killed = false

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
        // Limit output size
        if (stdout.length > MAX_FILE_SIZE) {
          if (!killed) {
            killed = true
            process.kill('SIGTERM')
            reject(new Error('Output size limit exceeded'))
          }
        }
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
        if (stderr.length > MAX_FILE_SIZE) {
          if (!killed) {
            killed = true
            process.kill('SIGTERM')
            reject(new Error('Error output size limit exceeded'))
          }
        }
      })

      process.on('close', (code) => {
        this.processCount--
        if (killed) return
        
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command failed with exit code ${code}`))
        }
      })

      process.on('error', (error) => {
        this.processCount--
        if (!killed) {
          reject(error)
        }
      })

      // Set timeout
      const timeout = setTimeout(() => {
        if (!killed) {
          killed = true
          process.kill('SIGKILL') // Force kill
          reject(new Error('Command execution timeout'))
        }
      }, this.config.timeout || 30000)

      // Send input
      if (input && process.stdin) {
        process.stdin.write(input)
        process.stdin.end()
      }

      // Clear timeout on completion
      process.on('close', () => clearTimeout(timeout))
    })
  }

  /**
   * Sanitize command output
   */
  private sanitizeOutput(output: string): string {
    if (!output) return ''

    // Remove potential sensitive information
    let sanitized = output
      .replace(/sk-ant-[a-zA-Z0-9]+/g, '[API_KEY_REDACTED]')
      .replace(/\/Users\/[^/\s]+/g, '[USER_PATH_REDACTED]')
      .replace(/\/home\/[^/\s]+/g, '[HOME_PATH_REDACTED]')
      .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
      .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')

    // Limit output size
    if (sanitized.length > MAX_FILE_SIZE) {
      sanitized = sanitized.substring(0, MAX_FILE_SIZE) + '\n[OUTPUT_TRUNCATED]'
    }

    return sanitized
  }

  /**
   * Create secure temporary file
   */
  private async createSecureTempFile(content: string, language?: string): Promise<string> {
    const extension = this.getSecureFileExtension(language)
    const randomName = crypto.randomBytes(16).toString('hex')
    const tempFileName = `claude_${randomName}.${extension}`
    
    // Create secure temp directory
    const tempDir = path.join(this.config.workingDirectory, '.claude_temp')
    await fs.mkdir(tempDir, { recursive: true, mode: 0o750 })
    
    const tempFilePath = path.join(tempDir, tempFileName)
    
    // Validate content size
    if (content.length > MAX_FILE_SIZE) {
      throw new Error('File content exceeds maximum size limit')
    }

    // Write with secure permissions
    await fs.writeFile(tempFilePath, content, { 
      encoding: 'utf-8',
      mode: 0o640 // Read/write for user, read for group
    })

    // Track for cleanup
    this.tempFileCleanup.add(tempFilePath)
    
    return tempFilePath
  }

  /**
   * Get secure file extension
   */
  private getSecureFileExtension(language?: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      rust: 'rs',
      go: 'go'
    }

    const ext = extensions[language || ''] || 'txt'
    
    // Ensure extension is allowed
    return ALLOWED_FILE_EXTENSIONS.includes(`.${ext}`) ? ext : 'txt'
  }

  /**
   * Cleanup temporary files and resources
   */
  private async cleanup(): Promise<void> {
    try {
      // Close all active processes
      for (const [sessionId, process] of this.activeProcesses) {
        try {
          process.kill('SIGTERM')
          await new Promise(resolve => setTimeout(resolve, 1000))
          if (!process.killed) {
            process.kill('SIGKILL')
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.activeProcesses.clear()

      // Cleanup temporary files
      for (const filePath of this.tempFileCleanup) {
        try {
          await fs.unlink(filePath)
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.tempFileCleanup.clear()

      // Remove temp directory
      try {
        const tempDir = path.join(this.config.workingDirectory, '.claude_temp')
        await fs.rmdir(tempDir)
      } catch (error) {
        // Ignore cleanup errors
      }

    } catch (error) {
      // Log cleanup errors but don't throw
      console.warn('Cleanup error:', error)
    }
  }

  /**
   * Destroy instance and cleanup resources
   */
  async destroy(): Promise<void> {
    await this.cleanup()
    this.removeAllListeners()
  }
}

// Secure singleton instance manager
let secureClaudeInstance: SecureClaudeCliIntegration | null = null

export function getSecureClaudeCliInstance(config?: SecureClaudeCliConfig): SecureClaudeCliIntegration {
  if (!secureClaudeInstance && config) {
    secureClaudeInstance = new SecureClaudeCliIntegration(config)
  }

  if (!secureClaudeInstance) {
    throw new Error('Secure Claude CLI instance not initialized. Provide config on first call.')
  }

  return secureClaudeInstance
}

export function destroySecureClaudeCliInstance(): Promise<void> {
  if (secureClaudeInstance) {
    const promise = secureClaudeInstance.destroy()
    secureClaudeInstance = null
    return promise
  }
  return Promise.resolve()
}