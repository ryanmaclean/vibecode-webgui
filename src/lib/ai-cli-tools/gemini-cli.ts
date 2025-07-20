/**
 * Google Gemini CLI Integration for VibeCode Platform
 * Provides seamless integration with Google's Gemini AI models
 * 
 * License: Apache 2.0
 * Version: 1.0.0
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, access } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

export interface GeminiConfig {
  apiKey: string
  model?: string
  language?: string
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

export interface GeminiCLIStatus {
  installed: boolean
  version?: string
  configPath?: string
  cliPath?: string
  models: string[]
  lastUsed?: Date
}

export class GeminiCLI {
  private config: GeminiConfig
  private cliPath: string
  private configPath: string
  private isInitialized: boolean = false

  constructor(config: GeminiConfig) {
    this.config = {
      model: 'gemini-pro',
      language: 'python',
      maxTokens: 4096,
      temperature: 0.7,
      ...config
    }
    
    this.cliPath = '/usr/local/bin/gemini-cli'
    this.configPath = '/etc/vibecode/gemini/config.json'
  }

  /**
   * Initialize the Gemini CLI
   */
  async initialize(): Promise<void> {
    try {
      // Check if CLI is installed
      await this.checkInstallation()
      
      // Set API key in environment
      process.env.GOOGLE_AI_API_KEY = this.config.apiKey
      
      // Test connection
      await this.testConnection()
      
      this.isInitialized = true
    } catch (error) {
      throw new Error(`Failed to initialize Gemini CLI: ${error}`)
    }
  }

  /**
   * Check if Gemini CLI is installed
   */
  async checkInstallation(): Promise<GeminiCLIStatus> {
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
        models: ['gemini-pro', 'gemini-1.5-pro']
      }
    } catch (error) {
      return {
        installed: false,
        models: []
      }
    }
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<boolean> {
    try {
      const startTime = Date.now()
      const result = await this.chat('Hello, this is a test message.')
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
      const language = request.language || this.config.language || 'python'
      const model = request.model || this.config.model || 'gemini-pro'
      
      // Escape the prompt for shell safety
      const escapedPrompt = request.prompt.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} generate '${escapedPrompt}' --language ${language} --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey },
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
      const language = request.language || this.config.language || 'python'
      const model = this.config.model || 'gemini-pro'
      
      // Escape the code for shell safety
      const escapedCode = request.code.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} explain '${escapedCode}' --language ${language} --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey },
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
      const language = request.language || this.config.language || 'python'
      const model = this.config.model || 'gemini-pro'
      
      // Escape the code for shell safety
      const escapedCode = request.code.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} optimize '${escapedCode}' --language ${language} --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey },
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
   * Chat with Gemini
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()
    
    try {
      const model = request.model || this.config.model || 'gemini-pro'
      
      // Escape the message for shell safety
      const escapedMessage = request.message.replace(/'/g, "'\"'\"'")
      
      const command = `${this.cliPath} chat '${escapedMessage}' --model ${model}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey },
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
    return ['gemini-pro', 'gemini-1.5-pro']
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
      'gemini-pro': {
        name: 'Gemini Pro',
        description: 'Google\'s advanced model for code and reasoning',
        contextWindow: 32768,
        maxTokens: 8192,
        costPer1kTokens: { input: 0.0005, output: 0.0015 }
      },
      'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        description: 'Latest model with enhanced capabilities',
        contextWindow: 1000000,
        maxTokens: 8192,
        costPer1kTokens: { input: 0.00125, output: 0.00375 }
      }
    }

    return models[model as keyof typeof models] || models['gemini-pro']
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
  calculateCost(inputTokens: number, outputTokens: number, model: string = 'gemini-pro'): number {
    const modelInfo = {
      'gemini-pro': { input: 0.0005, output: 0.0015 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.00375 }
    }

    const rates = modelInfo[model as keyof typeof modelInfo] || modelInfo['gemini-pro']
    
    const inputCost = (inputTokens / 1000) * rates.input
    const outputCost = (outputTokens / 1000) * rates.output
    
    return inputCost + outputCost
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<GeminiConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    
    // Update environment variable if API key changed
    if (newConfig.apiKey) {
      process.env.GOOGLE_AI_API_KEY = newConfig.apiKey
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): GeminiConfig {
    return { ...this.config }
  }

  /**
   * Install Gemini CLI (if not already installed)
   */
  static async install(): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync('sudo bash scripts/install-gemini-cli.sh', {
        cwd: process.cwd(),
        timeout: 300000 // 5 minutes
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      console.log('Gemini CLI installed successfully')
    } catch (error) {
      throw new Error(`Failed to install Gemini CLI: ${error}`)
    }
  }

  /**
   * Uninstall Gemini CLI
   */
  static async uninstall(): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync('sudo /opt/vibecode/ai-cli-tools/gemini/uninstall.sh', {
        timeout: 60000 // 1 minute
      })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }

      console.log('Gemini CLI uninstalled successfully')
    } catch (error) {
      throw new Error(`Failed to uninstall Gemini CLI: ${error}`)
    }
  }
}

// Export default instance
export default GeminiCLI 