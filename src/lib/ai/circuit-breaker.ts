/**
 * AI Provider Circuit Breaker
 * Implements the circuit breaker pattern for AI provider resilience
 *
 * Features:
 * - Three-state pattern: CLOSED, OPEN, HALF_OPEN
 * - Per-provider failure tracking
 * - Automatic state transitions based on success/failure rates
 * - Event emission for observability
 * - Datadog custom metrics integration
 * - Thread-safe (async-safe) state management
 */

import { EventEmitter } from 'events'
import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerEventType,
  CircuitBreakerEventListener,
  CircuitBreakerHealthStatus,
  ExecuteOptions,
  CircuitBreakerResult,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
  RequestRecord,
  AIProviderName
} from '@/types/circuit-breaker'
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3,
  monitoringWindowMs: 60000, // 1 minute
  requestTimeoutMs: 30000, // 30 seconds
  successThreshold: 2
}

/**
 * Circuit Breaker implementation for AI providers
 * Prevents cascade failures by failing fast when a provider is unhealthy
 */
export class AICircuitBreaker {
  private readonly config: CircuitBreakerConfig
  private readonly provider: AIProviderName
  private readonly emitter: EventEmitter
  private state: CircuitState = CircuitState.CLOSED
  private metrics: CircuitBreakerMetrics
  private stateTransitionLock: boolean = false
  private resetTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(provider: AIProviderName, config: Partial<CircuitBreakerConfig> = {}) {
    this.provider = provider
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.emitter = new EventEmitter()
    this.emitter.setMaxListeners(20)

    this.metrics = this.initializeMetrics()
    this.startMetricsCleanup()

    console.log(`[CircuitBreaker] Initialized for provider: ${provider}`, {
      failureThreshold: this.config.failureThreshold,
      resetTimeout: this.config.resetTimeout,
      halfOpenMaxCalls: this.config.halfOpenMaxCalls
    })
  }

  /**
   * Initialize fresh metrics
   */
  private initializeMetrics(): CircuitBreakerMetrics {
    return {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChangeTime: Date.now(),
      halfOpenCallCount: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      averageResponseTimeMs: 0,
      recentRequests: []
    }
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: ExecuteOptions<T> = {}
  ): Promise<CircuitBreakerResult<T>> {
    const startTime = Date.now()

    // Skip circuit breaker if requested
    if (options.skipCircuitBreaker) {
      try {
        const result = await this.executeWithTimeout(operation, options.timeoutMs)
        return {
          success: true,
          result,
          durationMs: Date.now() - startTime,
          usedFallback: false,
          circuitState: this.state
        }
      } catch (error) {
        return {
          success: false,
          error: error as Error,
          durationMs: Date.now() - startTime,
          usedFallback: false,
          circuitState: this.state
        }
      }
    }

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        await this.transitionTo(CircuitState.HALF_OPEN)
      } else {
        // Execute fallback if available
        if (options.fallback) {
          this.emitEvent('fallback_executed')
          this.recordDatadogMetric('fallback_executed', 1, options.tags)
          try {
            const fallbackResult = await options.fallback()
            return {
              success: true,
              result: fallbackResult,
              durationMs: Date.now() - startTime,
              usedFallback: true,
              circuitState: this.state
            }
          } catch (fallbackError) {
            return {
              success: false,
              error: fallbackError as Error,
              durationMs: Date.now() - startTime,
              usedFallback: true,
              circuitState: this.state
            }
          }
        }

        // No fallback - throw circuit breaker error
        const retryAfterMs = this.config.resetTimeout - (Date.now() - this.metrics.lastStateChangeTime)
        throw new CircuitBreakerOpenError(this.provider, this.metrics, Math.max(0, retryAfterMs))
      }
    }

    // Check half-open call limit
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.metrics.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        // Wait for current half-open calls to complete
        if (options.fallback) {
          this.emitEvent('fallback_executed')
          const fallbackResult = await options.fallback()
          return {
            success: true,
            result: fallbackResult,
            durationMs: Date.now() - startTime,
            usedFallback: true,
            circuitState: this.state
          }
        }
        throw new CircuitBreakerOpenError(
          this.provider,
          this.metrics,
          1000 // Retry after 1 second
        )
      }
      this.metrics.halfOpenCallCount++
    }

    this.metrics.totalRequests++

    try {
      const result = await this.executeWithTimeout(operation, options.timeoutMs)
      const durationMs = Date.now() - startTime

      await this.recordSuccess(durationMs, options.tags)

      return {
        success: true,
        result,
        durationMs,
        usedFallback: false,
        circuitState: this.state
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const typedError = error as Error

      await this.recordFailure(durationMs, typedError, options.tags)

      // Try fallback on failure
      if (options.fallback) {
        this.emitEvent('fallback_executed')
        this.recordDatadogMetric('fallback_executed', 1, options.tags)
        try {
          const fallbackResult = await options.fallback()
          return {
            success: true,
            result: fallbackResult,
            durationMs,
            usedFallback: true,
            circuitState: this.state
          }
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError as Error,
            durationMs,
            usedFallback: true,
            circuitState: this.state
          }
        }
      }

      return {
        success: false,
        error: typedError,
        durationMs,
        usedFallback: false,
        circuitState: this.state
      }
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs ?? this.config.requestTimeoutMs

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new CircuitBreakerTimeoutError(this.provider, timeout))
      }, timeout)

      operation()
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * Record a successful operation
   */
  private async recordSuccess(durationMs: number, tags?: Record<string, string>): Promise<void> {
    const now = Date.now()

    this.addRequestRecord(true, durationMs)

    this.metrics.successCount++
    this.metrics.lastSuccessTime = now
    this.metrics.consecutiveSuccesses++
    this.metrics.consecutiveFailures = 0

    this.emitEvent('success', undefined, durationMs)
    this.recordDatadogMetric('success', 1, tags)
    this.recordDatadogMetric('response_time', durationMs, tags)

    // Handle state transitions
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
        await this.transitionTo(CircuitState.CLOSED)
      }
    }
  }

  /**
   * Record a failed operation
   */
  private async recordFailure(
    durationMs: number,
    error: Error,
    tags?: Record<string, string>
  ): Promise<void> {
    const now = Date.now()
    const errorType = error.name || 'UnknownError'

    this.addRequestRecord(false, durationMs, errorType)

    this.metrics.failureCount++
    this.metrics.lastFailureTime = now
    this.metrics.consecutiveFailures++
    this.metrics.consecutiveSuccesses = 0

    this.emitEvent('failure', error, durationMs)
    this.recordDatadogMetric('failure', 1, { ...tags, error_type: errorType })
    this.recordDatadogMetric('response_time', durationMs, { ...tags, status: 'error' })

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED && this.shouldOpenCircuit()) {
      await this.transitionTo(CircuitState.OPEN)
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      await this.transitionTo(CircuitState.OPEN)
    }
  }

  /**
   * Add a request record to recent requests
   */
  private addRequestRecord(success: boolean, durationMs: number, errorType?: string): void {
    const record: RequestRecord = {
      timestamp: Date.now(),
      success,
      durationMs,
      errorType
    }

    this.metrics.recentRequests.push(record)

    // Keep only requests within the monitoring window
    this.pruneOldRequests()

    // Update average response time
    this.updateAverageResponseTime()
  }

  /**
   * Remove requests outside the monitoring window
   */
  private pruneOldRequests(): void {
    const cutoff = Date.now() - this.config.monitoringWindowMs
    this.metrics.recentRequests = this.metrics.recentRequests.filter(
      (req) => req.timestamp > cutoff
    )
  }

  /**
   * Update average response time from recent requests
   */
  private updateAverageResponseTime(): void {
    const requests = this.metrics.recentRequests
    if (requests.length === 0) {
      this.metrics.averageResponseTimeMs = 0
      return
    }

    const totalDuration = requests.reduce((sum, req) => sum + req.durationMs, 0)
    this.metrics.averageResponseTimeMs = totalDuration / requests.length
  }

  /**
   * Check if circuit should be opened based on failure threshold
   */
  private shouldOpenCircuit(): boolean {
    this.pruneOldRequests()

    const recentFailures = this.metrics.recentRequests.filter((req) => !req.success)
    return recentFailures.length >= this.config.failureThreshold
  }

  /**
   * Check if we should attempt recovery (transition from OPEN to HALF_OPEN)
   */
  private shouldAttemptRecovery(): boolean {
    const timeSinceOpen = Date.now() - this.metrics.lastStateChangeTime
    return timeSinceOpen >= this.config.resetTimeout
  }

  /**
   * Transition to a new state
   */
  private async transitionTo(newState: CircuitState): Promise<void> {
    // Prevent concurrent state transitions
    if (this.stateTransitionLock) {
      return
    }

    this.stateTransitionLock = true

    try {
      const previousState = this.state
      this.state = newState
      this.metrics.state = newState
      this.metrics.lastStateChangeTime = Date.now()

      // Reset half-open call count on state change
      if (newState === CircuitState.HALF_OPEN) {
        this.metrics.halfOpenCallCount = 0
      }

      // Reset counters when closing circuit
      if (newState === CircuitState.CLOSED) {
        this.metrics.consecutiveFailures = 0
        this.metrics.consecutiveSuccesses = 0
        if (this.resetTimer) {
          clearTimeout(this.resetTimer)
          this.resetTimer = null
        }
      }

      // Schedule automatic recovery check when opening
      if (newState === CircuitState.OPEN) {
        this.scheduleRecoveryCheck()
      }

      console.log(`[CircuitBreaker] ${this.provider}: ${previousState} -> ${newState}`)

      this.emitEvent('state_change', undefined, undefined, previousState)
      this.recordDatadogMetric('state_change', 1, {
        previous_state: previousState.toLowerCase(),
        current_state: newState.toLowerCase()
      })
      this.recordDatadogGauge('circuit_state', this.stateToNumber(newState))
    } finally {
      this.stateTransitionLock = false
    }
  }

  /**
   * Schedule automatic recovery check
   */
  private scheduleRecoveryCheck(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
    }

    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.transitionTo(CircuitState.HALF_OPEN).catch((error) => {
          console.error(`[CircuitBreaker] Failed to transition to HALF_OPEN:`, error)
        })
      }
    }, this.config.resetTimeout)
  }

  /**
   * Start periodic metrics cleanup
   */
  private startMetricsCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.pruneOldRequests()
      this.updateAverageResponseTime()
    }, this.config.monitoringWindowMs / 4)
  }

  /**
   * Convert state to numeric value for Datadog gauge
   */
  private stateToNumber(state: CircuitState): number {
    switch (state) {
      case CircuitState.CLOSED:
        return 0
      case CircuitState.HALF_OPEN:
        return 1
      case CircuitState.OPEN:
        return 2
      default:
        return -1
    }
  }

  /**
   * Emit a circuit breaker event
   */
  private emitEvent(
    type: CircuitBreakerEventType,
    error?: Error,
    durationMs?: number,
    previousState?: CircuitState
  ): void {
    const event: CircuitBreakerEvent = {
      type,
      provider: this.provider,
      timestamp: Date.now(),
      previousState,
      currentState: this.state,
      metrics: this.getMetrics(),
      error,
      durationMs
    }

    this.emitter.emit('event', event)
    this.emitter.emit(type, event)
  }

  /**
   * Record a custom metric to Datadog
   */
  private recordDatadogMetric(
    metricName: string,
    value: number,
    additionalTags?: Record<string, string>
  ): void {
    try {
      datadogMetrics.increment(`circuit_breaker.${metricName}`, value, {
        tags: {
          component: 'circuit_breaker',
          provider: this.provider,
          state: this.state.toLowerCase(),
          ...additionalTags
        }
      })
    } catch (error) {
      // Silently fail - don't let metrics errors affect circuit breaker
      console.debug(`[CircuitBreaker] Failed to record metric: ${error}`)
    }
  }

  /**
   * Record a gauge metric to Datadog
   */
  private recordDatadogGauge(metricName: string, value: number, tags?: Record<string, string>): void {
    try {
      datadogMetrics.histogram(`circuit_breaker.${metricName}`, value, {
        tags: {
          component: 'circuit_breaker',
          provider: this.provider,
          ...tags
        }
      })
    } catch (error) {
      console.debug(`[CircuitBreaker] Failed to record gauge: ${error}`)
    }
  }

  /**
   * Subscribe to circuit breaker events
   */
  on(event: CircuitBreakerEventType | 'event', listener: CircuitBreakerEventListener): void {
    this.emitter.on(event, listener)
  }

  /**
   * Unsubscribe from circuit breaker events
   */
  off(event: CircuitBreakerEventType | 'event', listener: CircuitBreakerEventListener): void {
    this.emitter.off(event, listener)
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics, recentRequests: [...this.metrics.recentRequests] }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Get health status
   */
  getHealthStatus(): CircuitBreakerHealthStatus {
    this.pruneOldRequests()

    const recentRequests = this.metrics.recentRequests
    const failureRate =
      recentRequests.length > 0
        ? recentRequests.filter((r) => !r.success).length / recentRequests.length
        : 0

    return {
      provider: this.provider,
      state: this.state,
      isHealthy: this.state === CircuitState.CLOSED,
      failureRate,
      averageResponseTimeMs: this.metrics.averageResponseTimeMs,
      uptimeMs: Date.now() - this.metrics.lastStateChangeTime,
      lastError: this.metrics.recentRequests.filter((r) => !r.success).pop()?.errorType,
      lastStateChangeTime: this.metrics.lastStateChangeTime,
      metrics: this.getMetrics()
    }
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset(): void {
    console.log(`[CircuitBreaker] Manual reset for ${this.provider}`)

    this.state = CircuitState.CLOSED
    this.metrics = this.initializeMetrics()

    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }

    this.emitEvent('circuit_reset')
    this.recordDatadogMetric('manual_reset', 1)
  }

  /**
   * Force a specific state (for testing or emergency ops)
   */
  forceState(state: CircuitState): void {
    console.warn(`[CircuitBreaker] Forcing ${this.provider} to state: ${state}`)
    this.transitionTo(state).catch((error) => {
      console.error(`[CircuitBreaker] Failed to force state:`, error)
    })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.emitter.removeAllListeners()
    console.log(`[CircuitBreaker] Destroyed for ${this.provider}`)
  }
}

/**
 * Manager for multiple circuit breakers
 * Maintains one circuit breaker per AI provider
 */
export class AICircuitBreakerManager {
  private breakers: Map<AIProviderName, AICircuitBreaker> = new Map()
  private defaultConfig: Partial<CircuitBreakerConfig>
  private globalListeners: Set<CircuitBreakerEventListener> = new Set()

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig
  }

  /**
   * Get or create a circuit breaker for a provider
   */
  getCircuitBreaker(
    provider: AIProviderName,
    config?: Partial<CircuitBreakerConfig>
  ): AICircuitBreaker {
    if (!this.breakers.has(provider)) {
      const breaker = new AICircuitBreaker(provider, {
        ...this.defaultConfig,
        ...config
      })

      // Attach global listeners
      for (const listener of this.globalListeners) {
        breaker.on('event', listener)
      }

      this.breakers.set(provider, breaker)
    }

    return this.breakers.get(provider)!
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    provider: AIProviderName,
    operation: () => Promise<T>,
    options?: ExecuteOptions<T>
  ): Promise<CircuitBreakerResult<T>> {
    const breaker = this.getCircuitBreaker(provider)
    return breaker.execute(operation, options)
  }

  /**
   * Get health status for all providers
   */
  getAllHealthStatuses(): Map<AIProviderName, CircuitBreakerHealthStatus> {
    const statuses = new Map<AIProviderName, CircuitBreakerHealthStatus>()
    for (const [provider, breaker] of this.breakers) {
      statuses.set(provider, breaker.getHealthStatus())
    }
    return statuses
  }

  /**
   * Get aggregate health across all circuit breakers
   */
  getAggregateHealth(): {
    totalProviders: number
    healthyProviders: number
    openCircuits: string[]
    overallHealth: 'healthy' | 'degraded' | 'critical'
  } {
    const statuses = this.getAllHealthStatuses()
    const openCircuits: string[] = []
    let healthyCount = 0

    for (const [provider, status] of statuses) {
      if (status.isHealthy) {
        healthyCount++
      } else if (status.state === CircuitState.OPEN) {
        openCircuits.push(provider)
      }
    }

    const total = statuses.size
    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy'

    if (openCircuits.length > 0) {
      overallHealth = openCircuits.length >= total / 2 ? 'critical' : 'degraded'
    }

    return {
      totalProviders: total,
      healthyProviders: healthyCount,
      openCircuits,
      overallHealth
    }
  }

  /**
   * Add a global event listener for all circuit breakers
   */
  addGlobalListener(listener: CircuitBreakerEventListener): void {
    this.globalListeners.add(listener)
    for (const breaker of this.breakers.values()) {
      breaker.on('event', listener)
    }
  }

  /**
   * Remove a global event listener
   */
  removeGlobalListener(listener: CircuitBreakerEventListener): void {
    this.globalListeners.delete(listener)
    for (const breaker of this.breakers.values()) {
      breaker.off('event', listener)
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    console.log('[CircuitBreakerManager] Resetting all circuit breakers')
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }

  /**
   * Reset a specific provider's circuit breaker
   */
  reset(provider: AIProviderName): void {
    const breaker = this.breakers.get(provider)
    if (breaker) {
      breaker.reset()
    }
  }

  /**
   * Destroy all circuit breakers
   */
  destroy(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy()
    }
    this.breakers.clear()
    this.globalListeners.clear()
  }
}

// Export singleton manager instance
export const aiCircuitBreakerManager = new AICircuitBreakerManager()

// Re-export types for convenience
export {
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics,
  type CircuitBreakerEvent,
  type CircuitBreakerHealthStatus,
  type ExecuteOptions,
  type CircuitBreakerResult,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError
} from '@/types/circuit-breaker'
