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
}

// Export singleton instance
export const ollamaClient = new OllamaClient()

export default ollamaClient