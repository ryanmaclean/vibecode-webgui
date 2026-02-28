// Unified AI Client - LiteLLM-inspired interface for VibeCode
// Provides seamless switching between providers while maintaining compatibility

import OpenAI from 'openai'
import { createServiceLogger } from '@/lib/logging'
import {
  retryWithBackoff,
  CircuitBreakerRegistry,
  CircuitState,
  isRetryableError,
  RetryExhaustedError,
  CircuitOpenError,
} from '@/lib/utils/retry'
import { getDefaultOfflineDetector, NetworkStatus } from '@/lib/offline-mode'
import { recordAIOperation, recordAIError } from '@/lib/monitoring/datadog-ai-metrics'

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

// Service logger for unified AI client
const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'unified-ai-client'
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

/**
 * Check if an error indicates network/offline issues
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const errorName = error.name?.toLowerCase() || ''

    // Common network error patterns
    const networkErrorPatterns = [
      'network',
      'offline',
      'econnrefused',
      'enotfound',
      'etimedout',
      'econnreset',
      'enetunreach',
      'ehostunreach',
      'fetch failed',
      'failed to fetch',
      'connection refused',
      'connection timeout',
      'no internet',
      'dns',
      'socket hang up'
    ]

    return networkErrorPatterns.some(pattern =>
      message.includes(pattern) || errorName.includes(pattern)
    )
  }

  // Check for network-related error codes in OpenAI errors
  if (error instanceof OpenAI.APIError) {
    // Connection errors typically don't have a status or have specific codes
    return !error.status || error.status === 0 || error.code === 'ECONNREFUSED'
  }

  return false
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

/**
 * Offline status tracking
 */
export interface OfflineStatus {
  /** Whether the client is currently in offline mode */
  isOffline: boolean
  /** Timestamp of when offline mode was detected (null if online) */
  offlineSince: number | null
  /** Last network error encountered */
  lastNetworkError: string | null
  /** Providers that are offline */
  offlineProviders: Set<string>
}

export class UnifiedAIClient {
  private clients: Map<string, OpenAI> = new Map()
  private apiKeys: Record<string, string> = {}
  private offlineStatus: OfflineStatus = {
    isOffline: false,
    offlineSince: null,
    lastNetworkError: null,
    offlineProviders: new Set()
  }

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
        apiKey: 'ollama', // Ollama doesn't require real API key
        timeout: 5000 // 5 second timeout for local requests
      }))
      log.debug('Ollama client initialized', { baseURL: AI_PROVIDERS.ollama.baseURL })
    } catch (error) {
      log.debug('Ollama client initialization failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      // Ollama not available - this is expected if not running locally
    }

    try {
      this.clients.set('localai', new OpenAI({
        baseURL: AI_PROVIDERS.localai.baseURL,
        apiKey: 'localai', // LocalAI doesn't require real API key
        timeout: 5000 // 5 second timeout for local requests
      }))
      log.debug('LocalAI client initialized', { baseURL: AI_PROVIDERS.localai.baseURL })
    } catch (error) {
      log.debug('LocalAI client initialization failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      // LocalAI not available - this is expected if not running locally
    }
  }

  public updateApiKeys(newKeys: Record<string, string>) {
    this.apiKeys = { ...this.apiKeys, ...newKeys }
    this.initializeClients()
  }

  public getProviderForModel(model: string): string {
    // Check for Ollama model format (e.g., llama3.2:1b, qwen2.5-coder:1.5b)
    // Ollama models typically have colons for tags or use specific naming patterns
    if (model.includes(':') && !model.includes('/')) {
      // Check if it's an Ollama model
      if (AI_PROVIDERS.ollama.models.includes(model)) {
        return 'ollama'
      }
      // Check if base model name (before colon) matches any Ollama model pattern
      const baseModel = model.split(':')[0]
      const ollamaModelBases = AI_PROVIDERS.ollama.models.map(m => m.split(':')[0])
      if (ollamaModelBases.includes(baseModel)) {
        return 'ollama'
      }
    }

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

  /**
   * Select best provider based on offline status and availability
   * Falls back to Ollama when offline, with clear error if unavailable
   */
  private selectProviderForOfflineMode(
    preferredProviderId: string,
    model: string
  ): { providerId: string; model: string; isOfflineFallback: boolean } {
    const offlineDetector = getDefaultOfflineDetector()
    const isOnline = offlineDetector.isOnline()

    // If we're online, use the preferred provider
    if (isOnline) {
      return {
        providerId: preferredProviderId,
        model,
        isOfflineFallback: false
      }
    }

    // Offline mode - check if preferred provider is local (Ollama/LocalAI)
    const localProviders = ['ollama', 'localai']
    if (localProviders.includes(preferredProviderId)) {
      if (this.clients.has(preferredProviderId)) {
        return {
          providerId: preferredProviderId,
          model,
          isOfflineFallback: false
        }
      }
    }

    // Offline mode with non-local provider - fallback to Ollama
    if (this.clients.has('ollama')) {
      log.warn('Offline mode detected - falling back to Ollama', {
        originalProvider: preferredProviderId,
        originalModel: model
      })

      // Use a default Ollama model suitable for coding
      const ollamaModel = 'qwen2.5-coder:1.5b'
      return {
        providerId: 'ollama',
        model: ollamaModel,
        isOfflineFallback: true
      }
    }

    // No local provider available in offline mode
    throw new Error(
      'Cannot process AI requests in offline mode: Ollama is not available. ' +
      'Please install and start Ollama (https://ollama.ai) with a model like qwen2.5-coder:1.5b, ' +
      'or restore internet connectivity to use cloud providers.'
    )
  }

  /**
   * Update offline status based on error
   */
  private updateOfflineStatus(providerId: string, error: unknown): void {
    if (isNetworkError(error)) {
      this.offlineStatus.offlineProviders.add(providerId)

      // Mark as globally offline if all configured providers are offline
      const configuredProviders = Array.from(this.clients.keys())
      const allOffline = configuredProviders.every(p => this.offlineStatus.offlineProviders.has(p))

      if (allOffline && !this.offlineStatus.isOffline) {
        this.offlineStatus.isOffline = true
        this.offlineStatus.offlineSince = Date.now()
        this.offlineStatus.lastNetworkError = error instanceof Error ? error.message : String(error)
        log.warn('All providers offline - entering offline mode', {
          offlineProviders: Array.from(this.offlineStatus.offlineProviders),
          error: this.offlineStatus.lastNetworkError
        })
      }
    }
  }

  /**
   * Clear offline status for a provider (on successful connection)
   */
  private clearOfflineStatus(providerId: string): void {
    if (this.offlineStatus.offlineProviders.has(providerId)) {
      this.offlineStatus.offlineProviders.delete(providerId)

      // If we have any online providers, clear global offline status
      if (this.offlineStatus.offlineProviders.size === 0 && this.offlineStatus.isOffline) {
        log.info('Connectivity restored - exiting offline mode')
        this.offlineStatus.isOffline = false
        this.offlineStatus.offlineSince = null
        this.offlineStatus.lastNetworkError = null
      }
    }
  }

  /**
   * Get current offline status
   */
  public getOfflineStatus(): Readonly<OfflineStatus> {
    return {
      ...this.offlineStatus,
      offlineProviders: new Set(this.offlineStatus.offlineProviders)
    }
  }

  /**
   * Check if client is currently in offline mode
   */
  public isOffline(): boolean {
    return this.offlineStatus.isOffline
  }

  private async testProviderConnection(providerId: string): Promise<boolean> {
    const client = this.clients.get(providerId)
    if (!client) return false

    try {
      // For local providers like Ollama, use a shorter timeout
      const isLocal = providerId === 'ollama' || providerId === 'localai'
      const timeoutMs = isLocal ? 2000 : 5000

      // Simple API test - try to list models or make a minimal request
      const testPromise = client.models.list()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
      )

      await Promise.race([testPromise, timeoutPromise])
      log.debug(`Provider ${providerId} connection test succeeded`)
      // Clear offline status on successful connection
      this.clearOfflineStatus(providerId)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (providerId === 'ollama' || providerId === 'localai') {
        log.debug(`Local provider ${providerId} not available`, { error: errorMessage })
      } else {
        log.debug(`Provider ${providerId} connection test failed`, { error: errorMessage })
      }
      // Update offline status if network error
      this.updateOfflineStatus(providerId, error)
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
    const preferredProviderId = this.getProviderForModel(model)

    // Select provider based on offline status
    const { providerId, model: selectedModel, isOfflineFallback } = this.selectProviderForOfflineMode(
      preferredProviderId,
      model
    )

    const client = this.clients.get(providerId)

    if (!client) {
      throw new Error(`No client available for provider: ${providerId}`)
    }

    // Log offline fallback
    if (isOfflineFallback) {
      log.info('Using offline fallback', {
        originalProvider: preferredProviderId,
        originalModel: model,
        fallbackProvider: providerId,
        fallbackModel: selectedModel
      })
    }

    // Test connection first
    const isConnected = await this.testProviderConnection(providerId)
    if (!isConnected) {
      const offlineDetector = getDefaultOfflineDetector()

      // For local providers, provide specific error message
      if (providerId === 'ollama') {
        const errorMsg = 'Ollama is not running. Please start Ollama with: ollama serve'
        log.warn(errorMsg, { model })

        // Try fallback to OpenRouter if available and online
        if (offlineDetector.isOnline() && this.clients.has('openrouter')) {
          log.info('Falling back to OpenRouter', { originalModel: model, reason: 'ollama_not_available' })
          return this.chat(messages, `openai/gpt-3.5-turbo`, options)
        }
        throw new Error(errorMsg)
      }

      // Try fallback to OpenRouter if available and online
      if (offlineDetector.isOnline() && providerId !== 'openrouter' && this.clients.has('openrouter')) {
        log.info('Falling back to OpenRouter', { originalModel: model, reason: 'connection_failed' })
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

    const startTime = Date.now()
    let operationSuccess = false
    let operationError: string | undefined

    try {
      // Use circuit breaker with retry for resilient API calls
      const result = await aiProviderCircuitBreakers.execute(
        providerId,
        () => retryWithBackoff(
          async () => {
            const response = await client.chat.completions.create({
              model: selectedModel,
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

            // Clear offline status on successful response
            this.clearOfflineStatus(providerId)

            return {
              content: choice.message.content,
              model: selectedModel,
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
              log.warn('Request failed, retrying', {
                providerId,
                attempt,
                maxRetries: RETRY_CONFIG.maxRetries,
                delayMs: Math.round(delay),
                error: error.message
              })
            },
          }
        )
        // Note: Circuit breaker fallback is handled in the catch block below
      )

      // Record successful operation metrics
      operationSuccess = true
      const durationMs = Date.now() - startTime
      recordAIOperation({
        provider: providerId,
        model: selectedModel,
        operation: 'chat',
        durationMs,
        tokensInput: result.usage?.promptTokens,
        tokensOutput: result.usage?.completionTokens,
        tokensTotal: result.usage?.totalTokens,
        success: true
      })

      return result
    } catch (error) {
      // Update offline status if network error
      this.updateOfflineStatus(providerId, error)

      // Determine error type for metrics
      if (error instanceof CircuitOpenError) {
        operationError = 'circuit_open'
      } else if (error instanceof RetryExhaustedError) {
        operationError = 'retries_exhausted'
      } else if (isRateLimitError(error)) {
        operationError = 'rate_limit'
      } else if (isNetworkError(error)) {
        operationError = 'network_error'
      } else if (error instanceof OpenAI.APIError) {
        operationError = `api_error_${error.status || 'unknown'}`
      } else {
        operationError = 'unknown_error'
      }

      // Record failed operation metrics
      const durationMs = Date.now() - startTime
      recordAIOperation({
        provider: providerId,
        model: selectedModel,
        operation: 'chat',
        durationMs,
        success: false,
        errorType: operationError,
        errorMessage: error instanceof Error ? error.message : String(error)
      })

      log.error('Chat request failed', {
        providerId,
        model,
        isNetworkError: isNetworkError(error),
        isOffline: this.offlineStatus.isOffline,
        error: error instanceof Error ? error.message : String(error)
      })

      // If circuit breaker is open or retries exhausted, try fallback
      if (
        (error instanceof CircuitOpenError || error instanceof RetryExhaustedError) &&
        providerId !== 'openrouter' &&
        this.clients.has('openrouter')
      ) {
        log.info('Falling back to OpenRouter', { reason: 'circuit_open_or_retries_exhausted' })
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
    const preferredProviderId = this.getProviderForModel(model)

    // Select provider based on offline status
    const { providerId, model: selectedModel, isOfflineFallback } = this.selectProviderForOfflineMode(
      preferredProviderId,
      model
    )

    const client = this.clients.get(providerId)

    if (!client) {
      throw new Error(`No client available for provider: ${providerId}`)
    }

    // Log offline fallback
    if (isOfflineFallback) {
      log.info('Using offline fallback for streaming', {
        originalProvider: preferredProviderId,
        originalModel: model,
        fallbackProvider: providerId,
        fallbackModel: selectedModel
      })
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
        log.info('Circuit open, falling back to OpenRouter', { providerId })
        yield* this.chatStream(messages, 'openai/gpt-3.5-turbo', options)
        return
      }
      throw new CircuitOpenError(providerId, circuitBreaker.getMetrics())
    }

    // Retry loop for rate limit (429) errors with exponential backoff
    const startTime = Date.now()
    let lastError: Error | unknown
    let tokensInput = 0
    let tokensOutput = 0
    let tokensTotal = 0

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const stream = await client.chat.completions.create({
          model: selectedModel,
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

          // Accumulate token usage from chunks
          if (chunk.usage) {
            tokensInput = chunk.usage.prompt_tokens || tokensInput
            tokensOutput = chunk.usage.completion_tokens || tokensOutput
            tokensTotal = chunk.usage.total_tokens || tokensTotal
          }

          yield {
            content,
            done: choice?.finish_reason !== null,
            model: selectedModel,
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

        // Stream completed successfully, clear offline status and record metrics
        this.clearOfflineStatus(providerId)
        const durationMs = Date.now() - startTime

        recordAIOperation({
          provider: providerId,
          model: selectedModel,
          operation: 'stream',
          durationMs,
          tokensInput: tokensInput || undefined,
          tokensOutput: tokensOutput || undefined,
          tokensTotal: tokensTotal || undefined,
          success: true
        })

        return
      } catch (error) {
        lastError = error

        // Check if this is a retryable error and we have retries left
        if (shouldRetryError(error) && attempt < RETRY_CONFIG.maxRetries) {
          const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt) +
            (RETRY_CONFIG.baseDelayMs * 0.1 * (Math.random() * 2 - 1))
          log.warn('Stream request failed, retrying', {
            providerId,
            attempt: attempt + 1,
            maxRetries: RETRY_CONFIG.maxRetries,
            delayMs: Math.round(delayMs)
          })
          await sleep(Math.min(delayMs, RETRY_CONFIG.maxDelayMs))
          continue
        }

        // For non-retryable errors or exhausted retries, break out
        break
      }
    }

    // Update offline status if network error
    this.updateOfflineStatus(providerId, lastError)

    // Determine error type for metrics
    let operationError: string
    if (isRateLimitError(lastError)) {
      operationError = 'rate_limit'
    } else if (isNetworkError(lastError)) {
      operationError = 'network_error'
    } else if (lastError instanceof OpenAI.APIError) {
      operationError = `api_error_${lastError.status || 'unknown'}`
    } else {
      operationError = 'unknown_error'
    }

    // Record failed stream metrics
    const durationMs = Date.now() - startTime
    recordAIOperation({
      provider: providerId,
      model: selectedModel,
      operation: 'stream',
      durationMs,
      tokensInput: tokensInput || undefined,
      tokensOutput: tokensOutput || undefined,
      tokensTotal: tokensTotal || undefined,
      success: false,
      errorType: operationError,
      errorMessage: lastError instanceof Error ? lastError.message : String(lastError)
    })

    log.error('Stream request failed after all retries', {
      providerId,
      model,
      isNetworkError: isNetworkError(lastError),
      isOffline: this.offlineStatus.isOffline,
      error: lastError instanceof Error ? lastError.message : String(lastError)
    })

    // Try fallback to OpenRouter if not already using it
    if (providerId !== 'openrouter' && this.clients.has('openrouter')) {
      log.info('Falling back to OpenRouter for failed stream', { providerId })
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
      log.info('Circuit breaker reset', { providerId })
    } else {
      aiProviderCircuitBreakers.resetAll()
      log.info('All circuit breakers reset')
    }
  }

  /**
   * Check if Ollama is available and running locally
   */
  public async isOllamaAvailable(): Promise<boolean> {
    if (!this.clients.has('ollama')) {
      return false
    }
    return await this.testProviderConnection('ollama')
  }

  /**
   * Get available Ollama models from running Ollama instance
   * Returns empty array if Ollama is not available
   */
  public async getOllamaModels(): Promise<string[]> {
    const client = this.clients.get('ollama')
    if (!client) {
      return []
    }

    try {
      const response = await client.models.list()
      // Extract model IDs from the response
      const models = response.data.map((model: { id: string }) => model.id)
      log.debug('Retrieved Ollama models', { count: models.length, models })
      return models
    } catch (error) {
      log.debug('Failed to retrieve Ollama models', {
        error: error instanceof Error ? error.message : String(error)
      })
      return []
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
    return (getUnifiedAI() as unknown as Record<string | symbol, unknown>)[prop];
  }
});

export default unifiedAI;
