/**
 * Resilient AI Client
 * Wraps AI provider calls with circuit breaker protection and intelligent fallback
 *
 * Features:
 * - Automatic circuit breaker protection for all AI providers
 * - Dynamic fallback chain based on provider health
 * - Comprehensive logging and metrics
 * - Provider-specific configuration
 * - Datadog integration for monitoring
 */

import {
  AICircuitBreaker,
  AICircuitBreakerManager,
  aiCircuitBreakerManager,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerEvent,
  CircuitBreakerHealthStatus,
  CircuitBreakerResult,
  ExecuteOptions
} from './circuit-breaker'
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics'
import type { AIProviderName } from '@/types/circuit-breaker'

/**
 * Configuration for a provider in the resilient client
 */
export interface ProviderConfig {
  /** Provider identifier */
  name: AIProviderName
  /** Circuit breaker configuration overrides */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  /** Priority in fallback chain (lower = higher priority) */
  priority: number
  /** Whether this provider is enabled */
  enabled: boolean
  /** Function to check if provider is configured */
  isConfigured: () => boolean
}

/**
 * Options for resilient AI operations
 */
export interface ResilientOperationOptions<T> extends ExecuteOptions<T> {
  /** Provider to use (will try fallbacks if circuit is open) */
  preferredProvider?: AIProviderName
  /** Maximum number of fallback attempts */
  maxFallbackAttempts?: number
  /** Custom operation name for logging */
  operationName?: string
}

/**
 * Result from a resilient AI operation
 */
export interface ResilientOperationResult<T> extends CircuitBreakerResult<T> {
  /** Provider that handled the request */
  provider: AIProviderName
  /** Providers that were tried and failed */
  failedProviders: AIProviderName[]
  /** Total latency including fallback attempts */
  totalLatencyMs: number
}

/**
 * Metrics exposed by the resilient client
 */
export interface ResilientClientMetrics {
  /** Health status per provider */
  providerHealth: Map<AIProviderName, CircuitBreakerHealthStatus>
  /** Current fallback chain order */
  fallbackChain: AIProviderName[]
  /** Number of requests handled */
  totalRequests: number
  /** Number of fallback executions */
  fallbackExecutions: number
  /** Number of complete failures (all providers failed) */
  completeFailures: number
}

/**
 * Default provider configurations
 */
const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    name: 'openrouter',
    priority: 1,
    enabled: true,
    isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    }
  },
  {
    name: 'anthropic',
    priority: 2,
    enabled: true,
    isConfigured: () => !!process.env.ANTHROPIC_API_KEY,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    }
  },
  {
    name: 'azure-openai',
    priority: 3,
    enabled: true,
    isConfigured: () => !!process.env.AZURE_OPENAI_API_KEY && !!process.env.AZURE_OPENAI_ENDPOINT,
    circuitBreakerConfig: {
      failureThreshold: 3,
      resetTimeout: 60000, // Azure may need longer recovery
      halfOpenMaxCalls: 2
    }
  },
  {
    name: 'openai',
    priority: 4,
    enabled: true,
    isConfigured: () => !!process.env.OPENAI_API_KEY,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    }
  },
  {
    name: 'litellm',
    priority: 5,
    enabled: true,
    isConfigured: () => !!process.env.LITELLM_BASE_URL,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    }
  },
  {
    name: 'ollama',
    priority: 10, // Lower priority as it's typically local
    enabled: true,
    isConfigured: () => !!process.env.OLLAMA_ENDPOINT,
    circuitBreakerConfig: {
      failureThreshold: 3,
      resetTimeout: 10000, // Local can recover faster
      halfOpenMaxCalls: 5
    }
  },
  {
    name: 'gemini',
    priority: 6,
    enabled: true,
    isConfigured: () => !!process.env.GOOGLE_AI_API_KEY,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    }
  },
  {
    name: 'bedrock',
    priority: 7,
    enabled: true,
    isConfigured: () => !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY,
    circuitBreakerConfig: {
      failureThreshold: 3,
      resetTimeout: 45000,
      halfOpenMaxCalls: 2
    }
  }
]

/**
 * Resilient AI Client with circuit breaker protection
 */
export class ResilientAIClient {
  private readonly circuitBreakerManager: AICircuitBreakerManager
  private readonly providerConfigs: Map<AIProviderName, ProviderConfig>
  private metrics: {
    totalRequests: number
    fallbackExecutions: number
    completeFailures: number
  }

  constructor(
    providerConfigs: ProviderConfig[] = DEFAULT_PROVIDER_CONFIGS,
    circuitBreakerManager?: AICircuitBreakerManager
  ) {
    this.circuitBreakerManager = circuitBreakerManager ?? aiCircuitBreakerManager
    this.providerConfigs = new Map()
    this.metrics = {
      totalRequests: 0,
      fallbackExecutions: 0,
      completeFailures: 0
    }

    // Initialize provider configs
    for (const config of providerConfigs) {
      this.providerConfigs.set(config.name, config)
      // Pre-initialize circuit breakers for configured providers
      if (config.enabled && config.isConfigured()) {
        this.circuitBreakerManager.getCircuitBreaker(config.name, config.circuitBreakerConfig)
      }
    }

    // Set up event logging
    this.setupEventLogging()

    console.log(`[ResilientAIClient] Initialized with ${this.getAvailableProviders().length} providers`)
  }

  /**
   * Set up logging for circuit breaker events
   */
  private setupEventLogging(): void {
    this.circuitBreakerManager.addGlobalListener((event: CircuitBreakerEvent) => {
      switch (event.type) {
        case 'state_change':
          console.log(
            `[ResilientAIClient] Circuit state change: ${event.provider} ${event.previousState} -> ${event.currentState}`
          )
          this.recordStateChangeMetric(event)
          break

        case 'failure':
          console.warn(
            `[ResilientAIClient] Provider failure: ${event.provider}`,
            event.error?.message
          )
          break

        case 'fallback_executed':
          console.info(`[ResilientAIClient] Fallback executed for ${event.provider}`)
          break

        case 'circuit_reset':
          console.info(`[ResilientAIClient] Circuit reset for ${event.provider}`)
          break
      }
    })
  }

  /**
   * Record state change metrics to Datadog
   */
  private recordStateChangeMetric(event: CircuitBreakerEvent): void {
    try {
      datadogMetrics.increment('resilient_ai.circuit_state_change', 1, {
        tags: {
          component: 'resilient_ai_client',
          provider: event.provider,
          previous_state: (event.previousState ?? 'unknown').toLowerCase(),
          current_state: event.currentState.toLowerCase()
        }
      })

      // Record current state as a gauge
      const stateValue =
        event.currentState === CircuitState.CLOSED
          ? 0
          : event.currentState === CircuitState.HALF_OPEN
            ? 1
            : 2

      datadogMetrics.histogram('resilient_ai.circuit_state', stateValue, {
        tags: {
          component: 'resilient_ai_client',
          provider: event.provider
        }
      })
    } catch (error) {
      console.debug('[ResilientAIClient] Failed to record metrics:', error)
    }
  }

  /**
   * Get available (enabled and configured) providers
   */
  getAvailableProviders(): AIProviderName[] {
    return Array.from(this.providerConfigs.values())
      .filter((config) => config.enabled && config.isConfigured())
      .sort((a, b) => a.priority - b.priority)
      .map((config) => config.name)
  }

  /**
   * Get the dynamic fallback chain based on current circuit states
   */
  getFallbackChain(excludeProvider?: AIProviderName): AIProviderName[] {
    const available = this.getAvailableProviders()
    const chain: AIProviderName[] = []

    for (const provider of available) {
      if (provider === excludeProvider) continue

      const breaker = this.circuitBreakerManager.getCircuitBreaker(provider)
      const state = breaker.getState()

      // Only include CLOSED or HALF_OPEN providers in the chain
      if (state !== CircuitState.OPEN) {
        chain.push(provider)
      }
    }

    return chain
  }

  /**
   * Execute an operation with circuit breaker protection and fallback
   */
  async execute<T>(
    operation: (provider: AIProviderName) => Promise<T>,
    options: ResilientOperationOptions<T> = {}
  ): Promise<ResilientOperationResult<T>> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    const {
      preferredProvider,
      maxFallbackAttempts = 3,
      operationName = 'ai_operation',
      ...executeOptions
    } = options

    const failedProviders: AIProviderName[] = []
    let currentProvider = preferredProvider ?? this.getAvailableProviders()[0]

    if (!currentProvider) {
      throw new Error('No AI providers are available')
    }

    // Try the preferred provider first
    const fallbackChain = this.getFallbackChain()
    let attempts = 0

    while (attempts < maxFallbackAttempts + 1) {
      const providerConfig = this.providerConfigs.get(currentProvider)
      const breaker = this.circuitBreakerManager.getCircuitBreaker(
        currentProvider,
        providerConfig?.circuitBreakerConfig
      )

      try {
        const result = await breaker.execute(() => operation(currentProvider), {
          ...executeOptions,
          tags: {
            ...executeOptions.tags,
            operation: operationName,
            attempt: String(attempts + 1)
          }
        })

        if (result.success) {
          this.recordOperationMetrics(
            operationName,
            currentProvider,
            Date.now() - startTime,
            true,
            failedProviders.length > 0
          )

          return {
            ...result,
            provider: currentProvider,
            failedProviders,
            totalLatencyMs: Date.now() - startTime
          }
        }

        // Operation failed but we can try fallback
        failedProviders.push(currentProvider)
      } catch (error) {
        failedProviders.push(currentProvider)
        console.warn(
          `[ResilientAIClient] Provider ${currentProvider} failed:`,
          (error as Error).message
        )
      }

      // Get next provider in fallback chain
      attempts++
      const nextProviders = fallbackChain.filter(
        (p) => !failedProviders.includes(p) && p !== currentProvider
      )

      if (nextProviders.length === 0) {
        break
      }

      this.metrics.fallbackExecutions++
      currentProvider = nextProviders[0]
      console.info(`[ResilientAIClient] Falling back to provider: ${currentProvider}`)
    }

    // All providers failed
    this.metrics.completeFailures++
    this.recordOperationMetrics(
      operationName,
      failedProviders[0] ?? 'unknown',
      Date.now() - startTime,
      false,
      true
    )

    return {
      success: false,
      error: new Error(`All providers failed: ${failedProviders.join(', ')}`),
      durationMs: Date.now() - startTime,
      usedFallback: failedProviders.length > 1,
      circuitState: CircuitState.OPEN,
      provider: failedProviders[failedProviders.length - 1] ?? currentProvider,
      failedProviders,
      totalLatencyMs: Date.now() - startTime
    }
  }

  /**
   * Execute an operation with a specific provider (no fallback)
   */
  async executeWithProvider<T>(
    provider: AIProviderName,
    operation: () => Promise<T>,
    options: ExecuteOptions<T> = {}
  ): Promise<CircuitBreakerResult<T>> {
    const providerConfig = this.providerConfigs.get(provider)
    const breaker = this.circuitBreakerManager.getCircuitBreaker(
      provider,
      providerConfig?.circuitBreakerConfig
    )

    return breaker.execute(operation, options)
  }

  /**
   * Record operation metrics to Datadog
   */
  private recordOperationMetrics(
    operationName: string,
    provider: AIProviderName,
    latencyMs: number,
    success: boolean,
    usedFallback: boolean
  ): void {
    try {
      datadogMetrics.histogram('resilient_ai.operation_latency', latencyMs, {
        tags: {
          component: 'resilient_ai_client',
          operation: operationName,
          provider,
          success: String(success),
          used_fallback: String(usedFallback)
        }
      })

      datadogMetrics.increment('resilient_ai.operations', 1, {
        tags: {
          component: 'resilient_ai_client',
          operation: operationName,
          provider,
          success: String(success),
          used_fallback: String(usedFallback)
        }
      })

      if (usedFallback) {
        datadogMetrics.increment('resilient_ai.fallback_used', 1, {
          tags: {
            component: 'resilient_ai_client',
            operation: operationName
          }
        })
      }
    } catch (error) {
      console.debug('[ResilientAIClient] Failed to record metrics:', error)
    }
  }

  /**
   * Get health status for all providers
   */
  getProviderHealth(): Map<AIProviderName, CircuitBreakerHealthStatus> {
    return this.circuitBreakerManager.getAllHealthStatuses()
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): {
    healthy: boolean
    totalProviders: number
    healthyProviders: number
    degradedProviders: number
    openCircuits: AIProviderName[]
  } {
    const health = this.circuitBreakerManager.getAggregateHealth()
    return {
      healthy: health.overallHealth === 'healthy',
      totalProviders: health.totalProviders,
      healthyProviders: health.healthyProviders,
      degradedProviders: health.totalProviders - health.healthyProviders,
      openCircuits: health.openCircuits
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): ResilientClientMetrics {
    return {
      providerHealth: this.getProviderHealth(),
      fallbackChain: this.getFallbackChain(),
      totalRequests: this.metrics.totalRequests,
      fallbackExecutions: this.metrics.fallbackExecutions,
      completeFailures: this.metrics.completeFailures
    }
  }

  /**
   * Reset a specific provider's circuit breaker
   */
  resetProvider(provider: AIProviderName): void {
    this.circuitBreakerManager.reset(provider)
    console.log(`[ResilientAIClient] Reset circuit breaker for ${provider}`)
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.circuitBreakerManager.resetAll()
    this.metrics = {
      totalRequests: 0,
      fallbackExecutions: 0,
      completeFailures: 0
    }
    console.log('[ResilientAIClient] Reset all circuit breakers and metrics')
  }

  /**
   * Add a new provider configuration
   */
  addProvider(config: ProviderConfig): void {
    this.providerConfigs.set(config.name, config)
    if (config.enabled && config.isConfigured()) {
      this.circuitBreakerManager.getCircuitBreaker(config.name, config.circuitBreakerConfig)
    }
    console.log(`[ResilientAIClient] Added provider: ${config.name}`)
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(
    provider: AIProviderName,
    updates: Partial<Omit<ProviderConfig, 'name'>>
  ): void {
    const existing = this.providerConfigs.get(provider)
    if (existing) {
      this.providerConfigs.set(provider, { ...existing, ...updates })
      console.log(`[ResilientAIClient] Updated config for ${provider}`)
    }
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(provider: AIProviderName, enabled: boolean): void {
    const config = this.providerConfigs.get(provider)
    if (config) {
      config.enabled = enabled
      console.log(`[ResilientAIClient] Provider ${provider} ${enabled ? 'enabled' : 'disabled'}`)
    }
  }

  /**
   * Force a provider's circuit state (for ops/testing)
   */
  forceProviderState(provider: AIProviderName, state: CircuitState): void {
    const breaker = this.circuitBreakerManager.getCircuitBreaker(provider)
    breaker.forceState(state)
    console.warn(`[ResilientAIClient] Forced ${provider} to state: ${state}`)
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.circuitBreakerManager.destroy()
    console.log('[ResilientAIClient] Destroyed')
  }
}

/**
 * Create a resilient AI client with default configuration
 */
export function createResilientAIClient(
  customConfigs?: ProviderConfig[]
): ResilientAIClient {
  return new ResilientAIClient(customConfigs)
}

// Export singleton instance
export const resilientAIClient = new ResilientAIClient()

// Export types and utilities
export {
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerHealthStatus,
  type AIProviderName
}
