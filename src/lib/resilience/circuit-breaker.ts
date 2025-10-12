/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by monitoring service health and failing fast
 */

import { logger } from '@/lib/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not calling service
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures to open circuit
  recoveryTimeout: number       // Time to wait before attempting recovery (ms)
  requestTimeout: number        // Timeout for individual requests (ms)
  monitoringWindow: number      // Time window for monitoring failures (ms)
  minimumRequestThreshold: number // Minimum requests before circuit can open
  successThreshold: number      // Successful requests needed to close circuit in half-open
  maxRetries: number           // Maximum retry attempts with exponential backoff
}

export interface CircuitBreakerMetrics {
  state: CircuitState
  failureCount: number
  successCount: number
  requestCount: number
  lastFailureTime: number
  lastSuccessTime: number
  stateChangedTime: number
  recentRequests: Array<{ timestamp: number; success: boolean; duration: number }>
}

/**
 * Production-ready Circuit Breaker with exponential backoff and monitoring
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private metrics: CircuitBreakerMetrics
  private timers: Set<NodeJS.Timeout> = new Set()

  constructor(
    private serviceName: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      requestTimeout: 10000,  // 10 seconds
      monitoringWindow: 60000, // 1 minute
      minimumRequestThreshold: 3,
      successThreshold: 3,
      maxRetries: 3,
      ...config
    }

    this.metrics = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      requestCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChangedTime: Date.now(),
      recentRequests: []
    }

    this.startMonitoring()
    logger.info(`🔧 Circuit breaker initialized for service: ${serviceName}`)
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if circuit is open
    if (this.metrics.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.transitionTo(CircuitState.HALF_OPEN)
      } else {
        logger.warn(`⚡ Circuit breaker OPEN for ${this.serviceName} - failing fast`)
        if (fallback) {
          return await fallback()
        }
        throw new CircuitBreakerError(`Service ${this.serviceName} is currently unavailable`, this.metrics)
      }
    }

    const startTime = Date.now()
    this.metrics.requestCount++

    try {
      // Execute with timeout and retry logic
      const result = await this.executeWithRetry(operation)
      
      this.recordSuccess(Date.now() - startTime)
      return result

    } catch (error) {
      this.recordFailure(Date.now() - startTime, error)
      
      if (fallback) {
        logger.warn(`🔄 Circuit breaker executing fallback for ${this.serviceName}:`, error)
        return await fallback()
      }
      
      throw error
    }
  }

  /**
   * Execute operation with retry and exponential backoff
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Apply timeout to individual attempts
        return await this.withTimeout(operation(), this.config.requestTimeout)
        
      } catch (error) {
        lastError = error
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          break
        }
        
        // Calculate exponential backoff with jitter
        const backoffTime = this.calculateBackoff(attempt)
        logger.warn(`⏰ Retry attempt ${attempt + 1}/${this.config.maxRetries} for ${this.serviceName} in ${backoffTime}ms`)
        
        await this.delay(backoffTime)
      }
    }
    
    throw lastError
  }

  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`))
      }, timeout)

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer))
    })
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000 // 1 second
    const maxDelay = 30000 // 30 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attempt)
    const jitter = Math.random() * 1000 // Add up to 1 second jitter
    
    return Math.min(exponentialDelay + jitter, maxDelay)
  }

  /**
   * Record successful operation
   */
  private recordSuccess(duration: number): void {
    this.metrics.successCount++
    this.metrics.lastSuccessTime = Date.now()
    
    this.addToRecentRequests(true, duration)
    
    // If in half-open state, check if we should close
    if (this.metrics.state === CircuitState.HALF_OPEN) {
      if (this.metrics.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED)
      }
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(duration: number, error: any): void {
    this.metrics.failureCount++
    this.metrics.lastFailureTime = Date.now()
    
    this.addToRecentRequests(false, duration)
    
    logger.warn(`❌ Circuit breaker recorded failure for ${this.serviceName}:`, {
      error: error.message,
      failureCount: this.metrics.failureCount,
      threshold: this.config.failureThreshold
    })
    
    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionTo(CircuitState.OPEN)
    }
  }

  /**
   * Add request to recent requests tracking
   */
  private addToRecentRequests(success: boolean, duration: number): void {
    const now = Date.now()
    this.metrics.recentRequests.push({
      timestamp: now,
      success,
      duration
    })
    
    // Keep only requests within monitoring window
    const cutoff = now - this.config.monitoringWindow
    this.metrics.recentRequests = this.metrics.recentRequests.filter(
      req => req.timestamp > cutoff
    )
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    const recentFailures = this.metrics.recentRequests.filter(req => !req.success)
    const recentRequestCount = this.metrics.recentRequests.length
    
    return (
      recentRequestCount >= this.config.minimumRequestThreshold &&
      recentFailures.length >= this.config.failureThreshold &&
      this.metrics.state !== CircuitState.OPEN
    )
  }

  /**
   * Check if should attempt recovery
   */
  private shouldAttemptRecovery(): boolean {
    return Date.now() - this.metrics.stateChangedTime >= this.config.recoveryTimeout
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.metrics.state
    this.metrics.state = newState
    this.metrics.stateChangedTime = Date.now()
    
    // Reset counters on state change
    if (newState === CircuitState.CLOSED) {
      this.metrics.failureCount = 0
      this.metrics.successCount = 0
    } else if (newState === CircuitState.HALF_OPEN) {
      this.metrics.successCount = 0
    }
    
    logger.info(`🔄 Circuit breaker ${this.serviceName}: ${oldState} -> ${newState}`)
  }

  /**
   * Start monitoring and cleanup
   */
  private startMonitoring(): void {
    // Clean up old requests periodically
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.config.monitoringWindow
      this.metrics.recentRequests = this.metrics.recentRequests.filter(
        req => req.timestamp > cutoff
      )
    }, this.config.monitoringWindow / 4)
    
    this.timers.add(cleanupInterval)
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    serviceName: string
    state: CircuitState
    isHealthy: boolean
    failureRate: number
    averageResponseTime: number
    uptime: number
  } {
    const recentRequests = this.metrics.recentRequests
    const failureRate = recentRequests.length > 0 
      ? recentRequests.filter(r => !r.success).length / recentRequests.length
      : 0
    
    const averageResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
      : 0
    
    const uptime = Date.now() - this.metrics.stateChangedTime
    
    return {
      serviceName: this.serviceName,
      state: this.metrics.state,
      isHealthy: this.metrics.state === CircuitState.CLOSED,
      failureRate,
      averageResponseTime,
      uptime
    }
  }

  /**
   * Force circuit state (for testing/emergency)
   */
  forceState(state: CircuitState): void {
    logger.warn(`🔧 Forcing circuit breaker ${this.serviceName} to ${state}`)
    this.transitionTo(state)
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    logger.info(`🔄 Resetting circuit breaker for ${this.serviceName}`)
    this.metrics = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      requestCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChangedTime: Date.now(),
      recentRequests: []
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.timers.forEach(timer => clearInterval(timer))
    this.timers.clear()
    logger.info(`🗑️ Circuit breaker destroyed for ${this.serviceName}`)
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly metrics: CircuitBreakerMetrics
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

/**
 * Circuit Breaker Manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map()

  /**
   * Get or create circuit breaker for service
   */
  getCircuitBreaker(
    serviceName: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config))
    }
    return this.breakers.get(serviceName)!
  }

  /**
   * Execute operation with circuit breaker
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(serviceName, config)
    return breaker.execute(operation, fallback)
  }

  /**
   * Get all circuit breaker health statuses
   */
  getAllHealthStatuses() {
    const statuses: Array<ReturnType<CircuitBreaker['getHealthStatus']>> = []
    
    for (const breaker of this.breakers.values()) {
      statuses.push(breaker.getHealthStatus())
    }
    
    return statuses
  }

  /**
   * Cleanup all circuit breakers
   */
  destroy(): void {
    this.breakers.forEach(breaker => breaker.destroy())
    this.breakers.clear()
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager()