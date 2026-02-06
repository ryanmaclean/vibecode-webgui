/**
 * Circuit Breaker Types for AI Provider Clients
 * Type definitions for the circuit breaker pattern implementation
 */

/**
 * Circuit breaker states following the standard pattern
 */
export enum CircuitState {
  /** Normal operation - all requests pass through */
  CLOSED = 'CLOSED',
  /** Circuit is open - requests fail fast without calling the service */
  OPEN = 'OPEN',
  /** Testing recovery - limited requests are allowed through */
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold: number
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN (default: 30000) */
  resetTimeout: number
  /** Maximum test calls allowed in HALF_OPEN state (default: 3) */
  halfOpenMaxCalls: number
  /** Time window in ms for counting failures (default: 60000) */
  monitoringWindowMs: number
  /** Request timeout in ms (default: 30000) */
  requestTimeoutMs: number
  /** Number of successes needed to close circuit from HALF_OPEN (default: 2) */
  successThreshold: number
}

/**
 * AI provider identifier
 */
export type AIProviderName =
  | 'openai'
  | 'anthropic'
  | 'azure-openai'
  | 'openrouter'
  | 'ollama'
  | 'gemini'
  | 'bedrock'
  | 'litellm'
  | string

/**
 * Metrics for a circuit breaker instance
 */
export interface CircuitBreakerMetrics {
  /** Current circuit state */
  state: CircuitState
  /** Total failure count in current window */
  failureCount: number
  /** Total success count in current window */
  successCount: number
  /** Total request count since last reset */
  totalRequests: number
  /** Timestamp of last failure */
  lastFailureTime: number | null
  /** Timestamp of last success */
  lastSuccessTime: number | null
  /** Timestamp of last state transition */
  lastStateChangeTime: number
  /** Current half-open test call count */
  halfOpenCallCount: number
  /** Consecutive failure count */
  consecutiveFailures: number
  /** Consecutive success count */
  consecutiveSuccesses: number
  /** Average response time in ms for recent requests */
  averageResponseTimeMs: number
  /** Recent request history for analysis */
  recentRequests: RequestRecord[]
}

/**
 * Record of a single request for metrics tracking
 */
export interface RequestRecord {
  timestamp: number
  success: boolean
  durationMs: number
  errorType?: string
}

/**
 * Event types emitted by the circuit breaker
 */
export type CircuitBreakerEventType =
  | 'state_change'
  | 'failure'
  | 'success'
  | 'timeout'
  | 'fallback_executed'
  | 'circuit_reset'

/**
 * Event payload for circuit breaker state changes
 */
export interface CircuitBreakerEvent {
  type: CircuitBreakerEventType
  provider: AIProviderName
  timestamp: number
  previousState?: CircuitState
  currentState: CircuitState
  metrics: CircuitBreakerMetrics
  error?: Error
  durationMs?: number
}

/**
 * Listener function type for circuit breaker events
 */
export type CircuitBreakerEventListener = (event: CircuitBreakerEvent) => void

/**
 * Health status report for a circuit breaker
 */
export interface CircuitBreakerHealthStatus {
  provider: AIProviderName
  state: CircuitState
  isHealthy: boolean
  failureRate: number
  averageResponseTimeMs: number
  uptimeMs: number
  lastError?: string
  lastStateChangeTime: number
  metrics: CircuitBreakerMetrics
}

/**
 * Options for executing an operation through the circuit breaker
 */
export interface ExecuteOptions<T> {
  /** Fallback function to call when circuit is open */
  fallback?: () => Promise<T>
  /** Override timeout for this specific call */
  timeoutMs?: number
  /** Skip circuit breaker check (for critical operations) */
  skipCircuitBreaker?: boolean
  /** Custom tags for metrics */
  tags?: Record<string, string>
}

/**
 * Result of a circuit breaker operation
 */
export interface CircuitBreakerResult<T> {
  success: boolean
  result?: T
  error?: Error
  durationMs: number
  usedFallback: boolean
  circuitState: CircuitState
}

/**
 * Provider configuration with circuit breaker settings
 */
export interface ProviderCircuitConfig {
  provider: AIProviderName
  config: Partial<CircuitBreakerConfig>
  enabled: boolean
  fallbackProvider?: AIProviderName
}

/**
 * Aggregate health status for all circuit breakers
 */
export interface CircuitBreakerAggregateHealth {
  totalProviders: number
  healthyProviders: number
  degradedProviders: number
  openCircuits: string[]
  overallHealth: 'healthy' | 'degraded' | 'critical'
  providers: Record<AIProviderName, CircuitBreakerHealthStatus>
}

/**
 * Error thrown when circuit breaker prevents execution
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly provider: AIProviderName,
    public readonly metrics: CircuitBreakerMetrics,
    public readonly retryAfterMs: number
  ) {
    super(`Circuit breaker is OPEN for provider ${provider}. Retry after ${retryAfterMs}ms`)
    this.name = 'CircuitBreakerOpenError'
  }
}

/**
 * Error thrown when operation times out
 */
export class CircuitBreakerTimeoutError extends Error {
  constructor(
    public readonly provider: AIProviderName,
    public readonly timeoutMs: number
  ) {
    super(`Operation timed out after ${timeoutMs}ms for provider ${provider}`)
    this.name = 'CircuitBreakerTimeoutError'
  }
}
