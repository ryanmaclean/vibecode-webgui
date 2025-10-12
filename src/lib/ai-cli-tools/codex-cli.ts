/**
 * Codex CLI Integration for VibeCode Platform
 * Provides seamless integration with OpenAI's Codex CLI
 * 
 * License: Apache 2.0
 * Version: 1.0.0
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { access } from 'fs/promises'
import { logger } from '@/lib/logger'

const execAsync = promisify(exec)

export interface CodexConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
  endpoint?: string
}

export interface CodeGenerationRequest {
  prompt: string
  language?: string
  context?: string
  model?: string
}

export interface CodeGenerationResponse {
  code: string
  explanation?: string
  model: string
  tokens: number
  cost?: number
  latency: number
}

export interface CodeExplanationRequest {
  code: string
  language?: string
  detail?: 'basic' | 'detailed' | 'expert'
}

export interface CodeOptimizationRequest {
  code: string
  language?: string
  focus?: 'performance' | 'readability' | 'security' | 'all'
}

export interface ChatRequest {
  message: string
  context?: string
  model?: string
}

export interface ChatResponse {
  response: string
  model: string
  tokens: number
  cost?: number
  latency: number
}

export interface CodexCLIStatus {
  installed: boolean
  version?: string
  configPath?: string
  cliPath?: string
  models: string[]
  lastUsed?: Date
}

export class CodexCLI {
  private config: CodexConfig
  private cliPath: string
  private configPath: string
  private isInitialized: boolean = false

  constructor(config: CodexConfig) {
    this.config = {
      model: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7,
      ...config
    }
    
    this.cliPath = '/usr/local/bin/codex-cli'
    this.configPath = '/etc/vibecode/codex/config.json'
  }

  /**
   * Initialize the Codex CLI
   */
  async initialize(): Promise<void> {
    try {
      // Check if CLI is installed
      await this.checkInstallation()
      
      // Set API key in environment
      process.env.OPENAI_API_KEY = this.config.apiKey
      
      // Test connection
      await this.testConnection()
      
      this.isInitialized = true
    } catch (error) {
      throw new Error(`Failed to initialize Codex CLI: ${error}`)
    }
  }

  /**
   * Check if Codex CLI is installed
   */
  async checkInstallation(): Promise<CodexCLIStatus> {
    try {
      // Check if CLI executable exists
      await access(this.cliPath)
      
      // Get version
      const { stdout } = await execAsync(`${this.cliPath} --version 2>/dev/null || echo "1.0.0"`)
      const version = stdout.trim()
      
      // Check if config file exists
      let configExists = false
      try {
        await access(this.configPath)
        configExists = true
      } catch {
        // Config file doesn't exist, that's okay
      }
      
      return {
        installed: true,
        version,
        configPath: configExists ? this.configPath : undefined,
        cliPath: this.cliPath,
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
      }
    } catch (error) {
      return {
        installed: false,
        models: []
      }
    }
  }

  /**
   * Test connection to Codex API
   */
  async testConnection(): Promise<boolean> {
    try {
      const startTime = Date.now()
      const result = await this.chat({ message: 'Hello, this is a test message.' })
      const latency = Date.now() - startTime
      
      if (result.response && latency < 10000) { // 10 second timeout
        return true
      }
      return false
    } catch (error) {
      throw new Error(`Connection test failed: ${error}`)
    }
  }

  /**
   * Generate code based on prompt
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()
    
    try {
      const language = request.language || 'python'
      const model = request.model || this.config.model || 'gpt-4'
      
      // Escape the prompt for shell safety
      const escapedPrompt = request.prompt.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} generate '${escapedPrompt}' --language ${language} --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, OPENAI_API_KEY: this.config.apiKey },
        timeout: 30000 // 30 second timeout
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      const latency = Date.now() - startTime
      
      return {
        code: stdout.trim(),
        model,
        tokens: this.estimateTokens(request.prompt + stdout),
        latency
      }
    } catch (error) {
      throw new Error(`Code generation failed: ${error}`)
    }
  }

  /**
   * Explain code in detail
   */
  async explainCode(request: CodeExplanationRequest): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const language = request.language || 'python'
      const model = this.config.model || 'gpt-4'
      
      // Escape the code for shell safety
      const escapedCode = request.code.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} explain '${escapedCode}' --language ${language} --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, OPENAI_API_KEY: this.config.apiKey },
        timeout: 30000
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      return stdout.trim()
    } catch (error) {
      throw new Error(`Code explanation failed: ${error}`)
    }
  }

  /**
   * Optimize code for better performance, readability, or security
   */
  async optimizeCode(request: CodeOptimizationRequest): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const language = request.language || 'python'
      const model = this.config.model || 'gpt-4'
      
      // Escape the code for shell safety
      const escapedCode = request.code.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} optimize '${escapedCode}' --language ${language} --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, OPENAI_API_KEY: this.config.apiKey },
        timeout: 30000
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      return stdout.trim()
    } catch (error) {
      throw new Error(`Code optimization failed: ${error}`)
    }
  }

  /**
   * Chat with Codex
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()
    
    try {
      const model = request.model || this.config.model || 'gpt-4'
      
      // Escape the message for shell safety
      const escapedMessage = request.message.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} chat '${escapedMessage}' --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, OPENAI_API_KEY: this.config.apiKey },
        timeout: 30000
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      const latency = Date.now() - startTime
      
      return {
        response: stdout.trim(),
        model,
        tokens: this.estimateTokens(request.message + stdout),
        latency
      }
    } catch (error) {
      throw new Error(`Chat failed: ${error}`)
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  }

  /**
   * Get model information
   */
  async getModelInfo(model: string): Promise<{
    name: string
    description: string
    contextWindow: number
    maxTokens: number
    costPer1kTokens: { input: number; output: number }
  }> {
    const models = {
      'gpt-4': {
        name: 'GPT-4',
        description: 'Most capable model for complex reasoning and code generation',
        contextWindow: 8192,
        maxTokens: 4096,
        costPer1kTokens: { input: 0.03, output: 0.06 }
      },
      'gpt-4-turbo': {
        name: 'GPT-4 Turbo',
        description: 'Faster GPT-4 with larger context window',
        contextWindow: 128000,
        maxTokens: 4096,
        costPer1kTokens: { input: 0.01, output: 0.03 }
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective for most coding tasks',
        contextWindow: 16384,
        maxTokens: 4096,
        costPer1kTokens: { input: 0.0015, output: 0.002 }
      }
    }

    return models[model as keyof typeof models] || models['gpt-4']
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4)
  }

  /**
   * Calculate cost based on tokens
   */
  calculateCost(inputTokens: number, outputTokens: number, model: string = 'gpt-4'): number {
    const modelInfo = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    }

    const rates = modelInfo[model as keyof typeof modelInfo] || modelInfo['gpt-4']
    
    const inputCost = (inputTokens / 1000) * rates.input
    const outputCost = (outputTokens / 1000) * rates.output
    
    return inputCost + outputCost
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<CodexConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    
    // Update environment variable if API key changed
    if (newConfig.apiKey) {
      process.env.OPENAI_API_KEY = newConfig.apiKey
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CodexConfig {
    return { ...this.config }
  }

  /**
   * Install Codex CLI (if not already installed)
   */
  static async install(): Promise<void> {
    try {
      const { stderr } = await execAsync('sudo bash scripts/install-codex-cli.sh', {
        cwd: process.cwd(),
        timeout: 300000 // 5 minutes
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      logger.info('Codex CLI installed successfully')
    } catch (error) {
      throw new Error(`Failed to install Codex CLI: ${error}`)
    }
  }

  /**
   * Uninstall Codex CLI
   */
  static async uninstall(): Promise<void> {
    try {
      const { stderr } = await execAsync('sudo /opt/vibecode/ai-cli-tools/codex/uninstall.sh', {
        timeout: 60000 // 1 minute
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      logger.info('Codex CLI uninstalled successfully')
    } catch (error) {
      throw new Error(`Failed to uninstall Codex CLI: ${error}`)
    }
  }
}

// Export default instance
export default CodexCLI