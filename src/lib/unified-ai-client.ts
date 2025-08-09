// Unified AI Client - LiteLLM-inspired interface for VibeCode
// Provides seamless switching between providers while maintaining compatibility

import { OpenAI } from 'openai'

export interface UnifiedAIProvider {
  id: string
  name: string
  baseURL: string
  models: string[]
  apiKeyRequired: boolean
  defaultHeaders?: Record<string, string>
}

export interface UnifiedChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface UnifiedChatResponse {
  content: string
  model: string
  provider: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
  // Optional tool calls (for function/tool calling capable providers)
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

export interface UnifiedStreamChunk {
  content: string
  done: boolean
  model: string
  provider: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// Provider configurations
export const AI_PROVIDERS: Record<string, UnifiedAIProvider> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4',
      'openai/gpt-4-turbo',
      'openai/gpt-3.5-turbo',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-sonnet-20240229',
      'anthropic/claude-3-haiku-20240307',
      'google/gemini-pro',
      'google/gemini-1.5-pro',
      'meta-llama/llama-3.1-70b-instruct',
      'mistralai/mistral-large',
      'mistralai/codestral-mamba'
    ],
    apiKeyRequired: true,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'X-Title': 'VibeCode Platform'
    }
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Direct',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    apiKeyRequired: true
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Direct',
    baseURL: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    apiKeyRequired: true
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama Local',
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3.2:1b', 'qwen2.5-coder:1.5b', 'smollm2:360m', 'codellama:7b'],
    apiKeyRequired: false
  },
  localai: {
    id: 'localai',
    name: 'LocalAI',
    baseURL: 'http://localhost:8080/v1',
    models: ['gpt-3.5-turbo', 'gpt-4', 'claude-instant'],
    apiKeyRequired: false
  }
}

export class UnifiedAIClient {
  private clients: Map<string, OpenAI> = new Map()
  private apiKeys: Record<string, string> = {}

  constructor(apiKeys: Record<string, string> = {}) {
    this.apiKeys = apiKeys
    this.initializeClients()
  }

  private initializeClients() {
    // Initialize OpenRouter client
    if (this.apiKeys.openrouter || process.env.OPENROUTER_API_KEY) {
      const provider = AI_PROVIDERS.openrouter
      this.clients.set('openrouter', new OpenAI({
        baseURL: provider.baseURL,
        apiKey: this.apiKeys.openrouter || process.env.OPENROUTER_API_KEY,
        defaultHeaders: provider.defaultHeaders
      }))
    }

    // Initialize direct provider clients
    if (this.apiKeys.openai || process.env.OPENAI_API_KEY) {
      this.clients.set('openai', new OpenAI({
        baseURL: AI_PROVIDERS.openai.baseURL,
        apiKey: this.apiKeys.openai || process.env.OPENAI_API_KEY
      }))
    }

    if (this.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY) {
      this.clients.set('anthropic', new OpenAI({
        baseURL: AI_PROVIDERS.anthropic.baseURL,
        apiKey: this.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY
      }))
    }

    // Initialize local clients (no API key required)
    try {
      this.clients.set('ollama', new OpenAI({
        baseURL: AI_PROVIDERS.ollama.baseURL,
        apiKey: 'ollama' // Ollama doesn't require real API key
      }))
    } catch (error) {
      console.warn('Ollama not available:', error)
    }

    try {
      this.clients.set('localai', new OpenAI({
        baseURL: AI_PROVIDERS.localai.baseURL,
        apiKey: 'localai' // LocalAI doesn't require real API key
      }))
    } catch (error) {
      console.warn('LocalAI not available:', error)
    }
  }

  public updateApiKeys(newKeys: Record<string, string>) {
    this.apiKeys = { ...this.apiKeys, ...newKeys }
    this.initializeClients()
  }

  private getProviderForModel(model: string): string {
    // Try to determine provider from model name
    if (model.includes('/')) {
      // OpenRouter format: provider/model
      return 'openrouter'
    }
    
    // Check direct providers
    for (const [providerId, provider] of Object.entries(AI_PROVIDERS)) {
      if (provider.models.includes(model)) {
        return providerId
      }
    }

    // Default to OpenRouter
    return 'openrouter'
  }

  private async testProviderConnection(providerId: string): Promise<boolean> {
    const client = this.clients.get(providerId)
    if (!client) return false

    try {
      // Simple API test - try to list models or make a minimal request
      await client.models.list()
      return true
    } catch (error) {
      console.warn(`Provider ${providerId} connection failed:`, error)
      return false
    }
  }

  public async chat(
    messages: UnifiedChatMessage[],
    model: string,
    options: {
      temperature?: number
      maxTokens?: number
      stream?: boolean
      topP?: number
      frequencyPenalty?: number
      presencePenalty?: number
    } = {}
  ): Promise<UnifiedChatResponse> {
    const providerId = this.getProviderForModel(model)
    const client = this.clients.get(providerId)

    if (!client) {
      throw new Error(`No client available for provider: ${providerId}`)
    }

    // Test connection first
    const isConnected = await this.testProviderConnection(providerId)
    if (!isConnected) {
      // Try fallback to OpenRouter if available
      if (providerId !== 'openrouter' && this.clients.has('openrouter')) {
        console.warn(`Falling back to OpenRouter for model: ${model}`)
        return this.chat(messages, `openai/gpt-3.5-turbo`, options)
      }
      throw new Error(`Provider ${providerId} is not available`)
    }

    const {
      temperature = 0.7,
      maxTokens = 4000,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0
    } = options

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: false
      })

      const choice = response.choices[0]
      if (!choice?.message?.content) {
        throw new Error('No content in response')
      }

      return {
        content: choice.message.content,
        model,
        provider: providerId,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined,
        finishReason: choice.finish_reason || undefined
      }
    } catch (error) {
      console.error(`Chat error with ${providerId}:`, error)
      
      // Try fallback to OpenRouter if not already using it
      if (providerId !== 'openrouter' && this.clients.has('openrouter')) {
        console.warn(`Falling back to OpenRouter for failed request`)
        return this.chat(messages, 'openai/gpt-3.5-turbo', options)
      }
      
      throw error
    }
  }

  public async *chatStream(
    messages: UnifiedChatMessage[],
    model: string,
    options: {
      temperature?: number
      maxTokens?: number
      topP?: number
      frequencyPenalty?: number
      presencePenalty?: number
    } = {}
  ): AsyncGenerator<UnifiedStreamChunk> {
    const providerId = this.getProviderForModel(model)
    const client = this.clients.get(providerId)

    if (!client) {
      throw new Error(`No client available for provider: ${providerId}`)
    }

    const {
      temperature = 0.7,
      maxTokens = 4000,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0
    } = options

    try {
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: true
      })

      for await (const chunk of stream) {
        const choice = chunk.choices[0]
        const content = choice?.delta?.content || ''

        yield {
          content,
          done: choice?.finish_reason !== null,
          model,
          provider: providerId,
          usage: chunk.usage ? {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0
          } : undefined
        }

        if (choice?.finish_reason) {
          break
        }
      }
    } catch (error) {
      console.error(`Stream error with ${providerId}:`, error)
      
      // Try fallback to OpenRouter if not already using it
      if (providerId !== 'openrouter' && this.clients.has('openrouter')) {
        console.warn(`Falling back to OpenRouter for failed stream`)
        yield* this.chatStream(messages, 'openai/gpt-3.5-turbo', options)
        return
      }
      
      throw error
    }
  }

  public getAvailableProviders(): UnifiedAIProvider[] {
    return Array.from(this.clients.keys())
      .map(id => AI_PROVIDERS[id])
      .filter(Boolean)
  }

  public getAvailableModels(): { model: string; provider: string }[] {
    const models: { model: string; provider: string }[] = []
    
    for (const providerId of this.clients.keys()) {
      const provider = AI_PROVIDERS[providerId]
      if (provider) {
        for (const model of provider.models) {
          models.push({ model, provider: providerId })
        }
      }
    }
    
    return models
  }

  public async getProviderHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {}
    
    for (const providerId of this.clients.keys()) {
      health[providerId] = await this.testProviderConnection(providerId)
    }
    
    return health
  }
}

// Export singleton instance
export const unifiedAI = new UnifiedAIClient({
  openrouter: process.env.OPENROUTER_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || ''
})

export default unifiedAI