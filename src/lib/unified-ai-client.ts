// Unified AI Client - LiteLLM-inspired interface for VibeCode
// Provides seamless switching between providers while maintaining compatibility

import OpenAI from 'openai'
// import { logger } from '@/lib/logger';
import {
  retryWithBackoff,
  CircuitBreakerRegistry,
  CircuitState,
  isRetryableError,
  RetryExhaustedError,
  CircuitOpenError,
} from '@/lib/utils/retry'

// Retry configuration for rate limiting (429) errors
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second initial delay
  maxDelayMs: 30000, // 30 seconds max delay
}

// Circuit breaker registry for all AI providers
const aiProviderCircuitBreakers = new CircuitBreakerRegistry({
  failureThreshold: 5,
  cooldownPeriod: 30000,
  successThreshold: 2,
})

/**
 * Sleep helper for async delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if an error is a rate limit (429) error
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429
  }
  // Check for rate limit error messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('429') ||
           message.includes('rate limit') ||
           message.includes('too many requests')
  }
  return false
}

/**
 * Check if an error should trigger retry (combines rate limit and other retryable errors)
 */
function shouldRetryError(error: unknown): boolean {
  return isRateLimitError(error) || isRetryableError(error)
}
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

  public getProviderForModel(model: string): string {
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
      // Use circuit breaker with retry for resilient API calls
      return await aiProviderCircuitBreakers.execute(
        providerId,
        () => retryWithBackoff(
          async () => {
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
          },
          {
            maxRetries: RETRY_CONFIG.maxRetries,
            baseDelay: RETRY_CONFIG.baseDelayMs,
            maxDelay: RETRY_CONFIG.maxDelayMs,
            jitter: 0.1,
            timeout: 60000,
            isRetryable: shouldRetryError,
            onRetry: (attempt, error, delay) => {
              console.warn(
                `[UnifiedAI] Request to ${providerId} failed, ` +
                `retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${RETRY_CONFIG.maxRetries}): ${error.message}`
              )
            },
          }
        )
        // Note: Circuit breaker fallback is handled in the catch block below
      )
    } catch (error) {
      console.error(`Chat error with ${providerId}:`, error)

      // If circuit breaker is open or retries exhausted, try fallback
      if (
        (error instanceof CircuitOpenError || error instanceof RetryExhaustedError) &&
        providerId !== 'openrouter' &&
        this.clients.has('openrouter')
      ) {
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

    // Check circuit breaker state before streaming
    const circuitBreaker = aiProviderCircuitBreakers.get(providerId)
    if (!circuitBreaker.isHealthy()) {
      // Circuit is open, try fallback
      if (providerId !== 'openrouter' && this.clients.has('openrouter')) {
        console.warn(`[UnifiedAI] Circuit open for ${providerId}, falling back to OpenRouter`)
        yield* this.chatStream(messages, 'openai/gpt-3.5-turbo', options)
        return
      }
      throw new CircuitOpenError(providerId, circuitBreaker.getMetrics())
    }

    // Retry loop for rate limit (429) errors with exponential backoff
    let lastError: Error | unknown
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
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
        // Stream completed successfully, exit retry loop
        return
      } catch (error) {
        lastError = error

        // Check if this is a retryable error and we have retries left
        if (shouldRetryError(error) && attempt < RETRY_CONFIG.maxRetries) {
          const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt) +
            (RETRY_CONFIG.baseDelayMs * 0.1 * (Math.random() * 2 - 1))
          console.warn(
            `[UnifiedAI] Stream request to ${providerId} failed, ` +
            `retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`
          )
          await sleep(Math.min(delayMs, RETRY_CONFIG.maxDelayMs))
          continue
        }

        // For non-retryable errors or exhausted retries, break out
        break
      }
    }

    console.error(`Stream error with ${providerId}:`, lastError)

    // Try fallback to OpenRouter if not already using it
    if (providerId !== 'openrouter' && this.clients.has('openrouter')) {
      console.warn(`Falling back to OpenRouter for failed stream`)
      yield* this.chatStream(messages, 'openai/gpt-3.5-turbo', options)
      return
    }

    throw lastError
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

  /**
   * Get circuit breaker health status for all providers
   */
  public getCircuitBreakerHealth(): Record<string, { healthy: boolean; metrics: ReturnType<typeof aiProviderCircuitBreakers.getHealthStatus>[string] }> {
    const status: Record<string, { healthy: boolean; metrics: ReturnType<typeof aiProviderCircuitBreakers.getHealthStatus>[string] }> = {}
    const metrics = aiProviderCircuitBreakers.getHealthStatus()

    for (const providerId of this.clients.keys()) {
      const providerMetrics = metrics[providerId]
      if (providerMetrics) {
        status[providerId] = {
          healthy: providerMetrics.state === 'CLOSED',
          metrics: providerMetrics
        }
      } else {
        // Circuit breaker not yet created for this provider
        status[providerId] = {
          healthy: true,
          metrics: {
            state: CircuitState.CLOSED,
            failureCount: 0,
            successCount: 0,
            totalRequests: 0,
            lastFailureTime: null,
            lastSuccessTime: null,
            stateChangedTime: Date.now(),
            failureRate: 0
          }
        }
      }
    }

    return status
  }

  /**
   * Reset circuit breakers for all or specific providers
   */
  public resetCircuitBreakers(providerId?: string): void {
    if (providerId) {
      const breaker = aiProviderCircuitBreakers.get(providerId)
      breaker.reset()
      console.log(`[UnifiedAI] Circuit breaker reset for ${providerId}`)
    } else {
      aiProviderCircuitBreakers.resetAll()
      console.log('[UnifiedAI] All circuit breakers reset')
    }
  }
}

// Export singleton instance (lazy-loaded to avoid initialization during tests)
let _unifiedAI: UnifiedAIClient | null = null;

export function getUnifiedAI(): UnifiedAIClient {
  if (!_unifiedAI) {
    _unifiedAI = new UnifiedAIClient({
      openrouter: process.env.OPENROUTER_API_KEY || '',
      openai: process.env.OPENAI_API_KEY || '',
      anthropic: process.env.ANTHROPIC_API_KEY || ''
    });
  }
  return _unifiedAI;
}

// Keep legacy export for backward compatibility (but lazy)
export const unifiedAI: UnifiedAIClient = new Proxy({} as UnifiedAIClient, {
  get(target, prop) {
    return (getUnifiedAI() as any)[prop];
  }
});

export default unifiedAI;
