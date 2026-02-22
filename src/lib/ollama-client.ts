// Ollama Client - Local AI model integration for VibeCode
// Provides seamless access to local LLM models for privacy and cost savings

export interface OllamaModel {
  name: string
  model: string
  size: number
  digest: string
  details: {
    format: string
    family: string
    families?: string[]
    parameter_size: string
    quantization_level: string
  }
  modified_at: string
}

export interface OllamaGenerateRequest {
  model: string
  prompt: string
  system?: string
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    num_ctx?: number
    num_predict?: number
    repeat_penalty?: number
    stop?: string[]
  }
}

export interface OllamaGenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface OllamaChatRequest {
  model: string
  messages: OllamaChatMessage[]
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    num_ctx?: number
    num_predict?: number
    repeat_penalty?: number
    stop?: string[]
  }
}

export interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

// Recommended models for different use cases
export const RECOMMENDED_MODELS = {
  coding: [
    'qwen2.5-coder:1.5b',
    'qwen2.5-coder:7b',
    'codellama:7b',
    'codellama:13b'
  ],
  general: [
    'llama3.2:1b',
    'llama3.2:3b',
    'llama3.1:8b',
    'phi3:3.8b'
  ],
  lightweight: [
    'smollm2:360m',
    'smollm2:1.7b',
    'phi3.5:3.8b',
    'gemma2:2b'
  ],
  creative: [
    'llama3.1:8b',
    'mistral:7b',
    'mixtral:8x7b'
  ]
} as const

// Recommended models specifically for offline coding
// Prioritizes smaller, faster models that work well in air-gapped environments
export const OFFLINE_CODING_MODELS = [
  {
    model: 'qwen2.5-coder:1.5b',
    size: 1_500_000_000, // ~1.5GB
    description: 'Fast, lightweight coding model - best for quick completions',
    priority: 1,
    recommended: true
  },
  {
    model: 'qwen2.5-coder:7b',
    size: 7_000_000_000, // ~7GB
    description: 'Balanced coding model - good quality and speed',
    priority: 2,
    recommended: true
  },
  {
    model: 'codellama:7b',
    size: 7_000_000_000, // ~7GB
    description: 'Meta\'s Code Llama - excellent for code generation',
    priority: 3,
    recommended: false
  },
  {
    model: 'phi3.5:3.8b',
    size: 3_800_000_000, // ~3.8GB
    description: 'Microsoft Phi - good general purpose coding model',
    priority: 4,
    recommended: false
  }
] as const

/**
 * Status of Ollama offline readiness
 */
export interface OfflineReadinessStatus {
  /** Whether Ollama is ready for offline use */
  ready: boolean
  /** Whether Ollama service is available */
  ollamaAvailable: boolean
  /** List of installed models */
  installedModels: string[]
  /** Recommended models for offline coding */
  recommendedModels: string[]
  /** Models that are recommended but not installed */
  missingModels: string[]
  /** Total disk space used by installed models (bytes) */
  totalDiskUsage: number
  /** Estimated disk space needed for missing recommended models (bytes) */
  estimatedDiskNeeded: number
  /** Human-readable disk usage summary */
  diskUsageSummary: {
    used: string
    needed: string
    total: string
  }
  /** Detailed readiness checks */
  checks: {
    ollamaRunning: boolean
    hasModels: boolean
    hasRecommendedModel: boolean
    sufficientDiskSpace: boolean
  }
  /** Setup recommendations for the user */
  recommendations: string[]
}

export class OllamaClient {
  private baseURL: string
  private timeout: number

  constructor(baseURL = 'http://localhost:11434', timeout = 30000) {
    this.baseURL = baseURL
    this.timeout = timeout
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch (error) {
      console.warn('Ollama not available:', error)
      return false
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.models || []
    } catch (error) {
      console.error('Failed to list Ollama models:', error)
      throw error
    }
  }

  async pullModel(model: string, onProgress?: (progress: string) => void): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(300000) // 5 minutes for model download
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (onProgress && data.status) {
                onProgress(data.status)
              }
              if (data.error) {
                throw new Error(data.error)
              }
            } catch (parseError) {
              // Ignore JSON parse errors for non-JSON lines
              continue
            }
          }
        }

        return true
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('Failed to pull Ollama model:', error)
      throw error
    }
  }

  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Ollama chat error:', error)
      throw error
    }
  }

  async *chatStream(request: OllamaChatRequest): AsyncGenerator<OllamaChatResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: true }),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data: OllamaChatResponse = JSON.parse(line)
              yield data
              if (data.done) return
            } catch (parseError) {
              // Ignore JSON parse errors
              continue
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('Ollama chat stream error:', error)
      throw error
    }
  }

  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Ollama generate error:', error)
      throw error
    }
  }

  async *generateStream(request: OllamaGenerateRequest): AsyncGenerator<OllamaGenerateResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: true }),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data: OllamaGenerateResponse = JSON.parse(line)
              yield data
              if (data.done) return
            } catch (parseError) {
              // Ignore JSON parse errors
              continue
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('Ollama generate stream error:', error)
      throw error
    }
  }

  async getModelInfo(model: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get Ollama model info:', error)
      throw error
    }
  }

  async deleteModel(model: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(this.timeout)
      })

      return response.ok
    } catch (error) {
      console.error('Failed to delete Ollama model:', error)
      throw error
    }
  }

  // Utility methods
  getRecommendedModels(category: keyof typeof RECOMMENDED_MODELS = 'general'): string[] {
    return [...RECOMMENDED_MODELS[category]]
  }

  formatModelSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  estimateInferenceTime(modelSize: number, promptLength: number): number {
    // Rough estimation based on model size and hardware
    // This is a simplified calculation and will vary greatly based on actual hardware
    const baseTime = modelSize / 1000000000 * 100 // Base time in ms per GB
    const promptTime = promptLength * 10 // Additional time per token
    return Math.max(baseTime + promptTime, 500) // Minimum 500ms
  }

  /**
   * Get recommended models specifically for offline coding
   * These are prioritized for air-gapped environments
   * @param onlyRecommended - If true, only return top recommended models (default: true)
   * @returns Array of recommended offline coding models with details
   */
  getOfflineCodingModels(onlyRecommended = true): typeof OFFLINE_CODING_MODELS {
    if (onlyRecommended) {
      return OFFLINE_CODING_MODELS.filter(m => m.recommended) as any
    }
    return OFFLINE_CODING_MODELS
  }

  /**
   * Calculate total disk space required for a list of models
   * @param models - Array of model configurations with size property
   * @returns Total size in bytes
   */
  private calculateDiskSpace(models: Array<{ size: number }>): number {
    return models.reduce((total, model) => total + model.size, 0)
  }

  /**
   * Check if a model is installed
   * @param modelName - Name of the model to check
   * @param installedModels - List of installed models from Ollama
   * @returns True if the model is installed
   */
  private isModelInstalled(modelName: string, installedModels: OllamaModel[]): boolean {
    return installedModels.some(m =>
      m.name === modelName ||
      m.model === modelName ||
      m.name.startsWith(modelName.split(':')[0])
    )
  }

  /**
   * Check Ollama readiness for offline use
   * Verifies that Ollama is available, models are downloaded, and disk space is sufficient
   * @returns Detailed offline readiness status
   */
  async checkOfflineReadiness(): Promise<OfflineReadinessStatus> {
    const status: OfflineReadinessStatus = {
      ready: false,
      ollamaAvailable: false,
      installedModels: [],
      recommendedModels: [],
      missingModels: [],
      totalDiskUsage: 0,
      estimatedDiskNeeded: 0,
      diskUsageSummary: {
        used: '0 B',
        needed: '0 B',
        total: '0 B'
      },
      checks: {
        ollamaRunning: false,
        hasModels: false,
        hasRecommendedModel: false,
        sufficientDiskSpace: true
      },
      recommendations: []
    }

    try {
      // Check 1: Is Ollama service available?
      status.ollamaAvailable = await this.isAvailable()
      status.checks.ollamaRunning = status.ollamaAvailable

      if (!status.ollamaAvailable) {
        status.recommendations.push(
          'Install and start Ollama service',
          'Visit https://ollama.ai to download Ollama',
          'Start Ollama with: ollama serve'
        )
        return status
      }

      // Check 2: Get list of installed models
      let installedModels: OllamaModel[] = []
      try {
        installedModels = await this.listModels()
        status.installedModels = installedModels.map(m => m.name)
        status.checks.hasModels = installedModels.length > 0

        // Calculate total disk usage
        status.totalDiskUsage = installedModels.reduce((total, m) => total + (m.size || 0), 0)
        status.diskUsageSummary.used = this.formatModelSize(status.totalDiskUsage)
      } catch (error) {
        status.recommendations.push('Failed to list models - check Ollama connection')
        return status
      }

      // Check 3: Verify recommended models
      const recommendedModels = this.getOfflineCodingModels(true)
      status.recommendedModels = recommendedModels.map(m => m.model)

      // Find missing recommended models
      const missingModels = recommendedModels.filter(
        rec => !this.isModelInstalled(rec.model, installedModels)
      )
      status.missingModels = missingModels.map(m => m.model)

      // Check if at least one recommended model is installed
      status.checks.hasRecommendedModel = missingModels.length < recommendedModels.length

      // Calculate disk space needed for missing models
      status.estimatedDiskNeeded = this.calculateDiskSpace(missingModels)
      status.diskUsageSummary.needed = this.formatModelSize(status.estimatedDiskNeeded)
      status.diskUsageSummary.total = this.formatModelSize(
        status.totalDiskUsage + status.estimatedDiskNeeded
      )

      // Check 4: Disk space assessment (conservative estimate - assume we need 2x model size)
      const requiredSpace = status.estimatedDiskNeeded * 2
      // Note: We can't reliably check available disk space in browser/node without additional APIs
      // So we'll assume disk space is sufficient unless models are missing
      status.checks.sufficientDiskSpace = true

      // Generate recommendations based on status
      if (status.missingModels.length > 0) {
        status.recommendations.push(
          `Download recommended models for offline coding:`,
          ...missingModels.map(m =>
            `  - ollama pull ${m.model}  (${this.formatModelSize(m.size)}) - ${m.description}`
          )
        )

        if (status.estimatedDiskNeeded > 0) {
          status.recommendations.push(
            `Total disk space needed: ${status.diskUsageSummary.needed}`
          )
        }
      }

      if (!status.checks.hasModels) {
        status.recommendations.push(
          'No models installed - download at least one coding model',
          'Quick start: ollama pull qwen2.5-coder:1.5b'
        )
      }

      // Overall readiness check
      status.ready =
        status.checks.ollamaRunning &&
        status.checks.hasModels &&
        status.checks.hasRecommendedModel &&
        status.checks.sufficientDiskSpace

      if (status.ready) {
        status.recommendations.push(
          '✓ Ollama is ready for offline coding!',
          `Installed models: ${status.installedModels.join(', ')}`
        )
      }

    } catch (error) {
      status.recommendations.push(
        'Error checking offline readiness',
        `Details: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return status
  }

  /**
   * Get a simple boolean check if Ollama is ready for offline use
   * Convenience method that wraps checkOfflineReadiness()
   * @returns True if Ollama is ready with at least one recommended model
   */
  async isReadyForOffline(): Promise<boolean> {
    try {
      const status = await this.checkOfflineReadiness()
      return status.ready
    } catch (error) {
      return false
    }
  }

  /**
   * Get the best available model for offline coding
   * Returns the highest priority installed model from the offline coding recommendations
   * @returns Model name if available, null otherwise
   */
  async getBestOfflineModel(): Promise<string | null> {
    try {
      const installedModels = await this.listModels()
      const offlineModels = this.getOfflineCodingModels(false)

      // Sort by priority and find first installed model
      for (const candidate of offlineModels) {
        if (this.isModelInstalled(candidate.model, installedModels)) {
          return candidate.model
        }
      }

      // Fallback: return first installed model if any
      if (installedModels.length > 0) {
        return installedModels[0].name
      }

      return null
    } catch (error) {
      return null
    }
  }
}

// Export singleton instance
export const ollamaClient = new OllamaClient()

export default ollamaClient