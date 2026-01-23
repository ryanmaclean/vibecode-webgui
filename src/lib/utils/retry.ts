/**
 * Retry Utilities with Exponential Backoff and Circuit Breaker
 *
 * This module provides robust retry functionality for API clients with:
 * - Exponential backoff with configurable jitter
 * - Circuit breaker pattern for protecting against cascade failures
 * - Error categorization (retryable vs non-retryable)
 * - Configurable options for different use cases
 *
 * @example
 * ```typescript
 * // Simple retry with backoff
 * const result = await retryWithBackoff(() => fetchData(), {
 *   maxRetries: 3,
 *   baseDelay: 1000,
 * });
 *
 * // With circuit breaker
 * const breaker = new CircuitBreaker('api-service');
 * const result = await breaker.execute(() => fetchData());
 * ```
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration options for retry with backoff
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay: number;
  /** Jitter factor (0-1) to add randomness to delays (default: 0.2) */
  jitter: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout: number;
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Called when all retries are exhausted */
  onExhausted?: (attempts: number, lastError: Error) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Normal operation - requests pass through */
  CLOSED = 'CLOSED',
  /** Failing fast - requests are rejected immediately */
  OPEN = 'OPEN',
  /** Testing recovery - allowing limited requests through */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms before attempting recovery from OPEN state (default: 30000) */
  cooldownPeriod: number;
  /** Number of successes in HALF_OPEN state to close the circuit (default: 2) */
  successThreshold: number;
  /** Time window in ms to track failures (default: 60000) */
  monitoringWindow: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeout: number;
  /** Custom function to determine if an error should count as a failure */
  isFailure?: (error: Error) => boolean;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChangedTime: number;
  failureRate: number;
}

/**
 * Error categories for retry decisions
 */
export enum ErrorCategory {
  /** Errors that can be retried (network issues, rate limits, etc.) */
  RETRYABLE = 'RETRYABLE',
  /** Errors that should not be retried (auth errors, validation errors, etc.) */
  NON_RETRYABLE = 'NON_RETRYABLE',
  /** Errors from circuit breaker being open */
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  /** Errors from timeout */
  TIMEOUT = 'TIMEOUT',
}

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when all retry attempts are exhausted
 */
export class RetryExhaustedError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;
  public readonly category = ErrorCategory.RETRYABLE;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryExhaustedError);
    }
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  public readonly serviceName: string;
  public readonly metrics: CircuitBreakerMetrics;
  public readonly category = ErrorCategory.CIRCUIT_OPEN;

  constructor(serviceName: string, metrics: CircuitBreakerMetrics) {
    super(`Circuit breaker is OPEN for service: ${serviceName}`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.metrics = metrics;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircuitOpenError);
    }
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly category = ErrorCategory.TIMEOUT;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

// =============================================================================
// Error Categorization
// =============================================================================

/** HTTP status codes that indicate retryable errors */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/** HTTP status codes that indicate non-retryable errors */
const NON_RETRYABLE_STATUS_CODES = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  405, // Method Not Allowed
  409, // Conflict
  410, // Gone
  422, // Unprocessable Entity
]);

/** Error message patterns that indicate retryable errors */
const RETRYABLE_ERROR_PATTERNS = [
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENETUNREACH/i,
  /ENOTFOUND/i,
  /socket hang up/i,
  /network/i,
  /timeout/i,
  /rate.?limit/i,
  /too many requests/i,
  /temporary/i,
  /unavailable/i,
  /overloaded/i,
];

/**
 * Categorize an error for retry decisions
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof CircuitOpenError) {
    return ErrorCategory.CIRCUIT_OPEN;
  }

  if (error instanceof TimeoutError) {
    return ErrorCategory.TIMEOUT;
  }

  if (error instanceof Error) {
    // Check for HTTP status code in error
    const statusMatch = error.message.match(/status[:\s]*(\d{3})/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (RETRYABLE_STATUS_CODES.has(status)) {
        return ErrorCategory.RETRYABLE;
      }
      if (NON_RETRYABLE_STATUS_CODES.has(status)) {
        return ErrorCategory.NON_RETRYABLE;
      }
    }

    // Check for retryable error patterns
    for (const pattern of RETRYABLE_ERROR_PATTERNS) {
      if (pattern.test(error.message)) {
        return ErrorCategory.RETRYABLE;
      }
    }

    // Check for 'status' property (common in HTTP error objects)
    const errorWithStatus = error as Error & { status?: number; statusCode?: number };
    const status = errorWithStatus.status || errorWithStatus.statusCode;
    if (status) {
      if (RETRYABLE_STATUS_CODES.has(status)) {
        return ErrorCategory.RETRYABLE;
      }
      if (NON_RETRYABLE_STATUS_CODES.has(status)) {
        return ErrorCategory.NON_RETRYABLE;
      }
    }
  }

  // Default to non-retryable for unknown errors
  return ErrorCategory.NON_RETRYABLE;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const category = categorizeError(error);
  return category === ErrorCategory.RETRYABLE || category === ErrorCategory.TIMEOUT;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt + random_jitter)
 *
 * @param attempt - Current attempt number (0-based)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  options: Pick<RetryOptions, 'baseDelay' | 'maxDelay' | 'jitter'>
): number {
  const { baseDelay, maxDelay, jitter } = options;

  // Calculate exponential delay: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter: random value between -jitter*delay and +jitter*delay
  // This helps prevent thundering herd when multiple clients retry simultaneously
  const jitterAmount = exponentialDelay * jitter * (Math.random() * 2 - 1);

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitterAmount, maxDelay);
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 * @param signal - Optional abort signal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Wrap a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param signal - Optional abort signal
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    signal?.addEventListener('abort', () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    });

    promise
      .then((result) => {
        cleanup();
        resolve(result);
      })
      .catch((error) => {
        cleanup();
        reject(error);
      });
  });
}

// =============================================================================
// Retry with Backoff
// =============================================================================

/** Default retry options */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: 0.2,
  timeout: 30000,
};

/**
 * Execute an operation with retry and exponential backoff
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the operation
 * @throws RetryExhaustedError if all retries are exhausted
 * @throws Original error if error is non-retryable
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   },
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const { maxRetries, timeout, isRetryable: customIsRetryable, onRetry, onExhausted, signal } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for abort signal
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      // Execute operation with timeout
      return await withTimeout(operation(), timeout, signal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if abort was requested
      if (lastError.name === 'AbortError') {
        throw lastError;
      }

      // Determine if error is retryable
      const retryable = customIsRetryable
        ? customIsRetryable(lastError)
        : isRetryableError(lastError);

      // If not retryable or last attempt, throw immediately
      if (!retryable || attempt === maxRetries) {
        if (attempt === maxRetries && retryable) {
          onExhausted?.(attempt + 1, lastError);
          throw new RetryExhaustedError(
            `Operation failed after ${attempt + 1} attempts: ${lastError.message}`,
            attempt + 1,
            lastError
          );
        }
        throw lastError;
      }

      // Calculate backoff delay
      const delay = calculateBackoff(attempt, opts);

      // Notify retry callback
      onRetry?.(attempt + 1, lastError, delay);

      // Wait before retrying
      await sleep(delay, signal);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error('Unexpected retry loop exit');
}

// =============================================================================
// Circuit Breaker
// =============================================================================

/** Default circuit breaker options */
const DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  cooldownPeriod: 30000,
  successThreshold: 2,
  monitoringWindow: 60000,
  timeout: 10000,
};

/**
 * Circuit Breaker implementation for protecting against cascade failures
 *
 * The circuit breaker has three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests are rejected immediately
 * - HALF_OPEN: Testing recovery, allowing limited requests through
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker('payment-service', {
 *   failureThreshold: 5,
 *   cooldownPeriod: 30000,
 * });
 *
 * try {
 *   const result = await breaker.execute(() => processPayment(order));
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Handle service unavailable
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly name: string;
  private readonly options: CircuitBreakerOptions;

  private state: CircuitState = CircuitState.CLOSED;
  private failures: Array<{ timestamp: number; error: Error }> = [];
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private stateChangedTime: number = Date.now();

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }

  /**
   * Execute an operation with circuit breaker protection
   *
   * @param operation - Async function to execute
   * @param fallback - Optional fallback function when circuit is open
   * @returns Result of the operation or fallback
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        if (fallback) {
          return fallback();
        }
        throw new CircuitOpenError(this.name, this.getMetrics());
      }
    }

    this.totalRequests++;

    try {
      // Execute with timeout
      const result = await withTimeout(operation(), this.options.timeout);
      this.recordSuccess();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.recordFailure(err);

      // Try fallback if available
      if (fallback && this.state === CircuitState.OPEN) {
        return fallback();
      }

      throw err;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(error: Error): void {
    const now = Date.now();
    this.lastFailureTime = now;

    // Check if this error should count as a failure
    const isFailure = this.options.isFailure
      ? this.options.isFailure(error)
      : isRetryableError(error);

    if (!isFailure) {
      return; // Don't count non-retryable errors as circuit breaker failures
    }

    // Add to failures list
    this.failures.push({ timestamp: now, error });

    // Clean up old failures outside monitoring window
    this.pruneOldFailures();

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Remove failures outside the monitoring window
   */
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.options.monitoringWindow;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    return (
      this.state !== CircuitState.OPEN &&
      this.failures.length >= this.options.failureThreshold
    );
  }

  /**
   * Check if recovery should be attempted
   */
  private shouldAttemptRecovery(): boolean {
    return Date.now() - this.stateChangedTime >= this.options.cooldownPeriod;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateChangedTime = Date.now();

    // Reset counters on state change
    if (newState === CircuitState.CLOSED) {
      this.failures = [];
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }

    // Notify state change callback
    this.options.onStateChange?.(oldState, newState);
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    this.pruneOldFailures();
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedTime: this.stateChangedTime,
      failureRate:
        this.totalRequests > 0
          ? this.failures.length / this.totalRequests
          : 0,
    };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is healthy (closed)
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Force circuit to a specific state (for testing/emergency)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.stateChangedTime = Date.now();
  }
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

/**
 * Registry for managing multiple circuit breakers
 *
 * @example
 * ```typescript
 * const registry = new CircuitBreakerRegistry();
 *
 * // Get or create a circuit breaker
 * const breaker = registry.get('payment-service');
 *
 * // Execute with circuit breaker
 * const result = await registry.execute('payment-service', () => processPayment());
 *
 * // Get all health statuses
 * const health = registry.getHealthStatus();
 * ```
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultOptions: Partial<CircuitBreakerOptions>;

  constructor(defaultOptions: Partial<CircuitBreakerOptions> = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a circuit breaker for a service
   */
  get(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(
        name,
        new CircuitBreaker(name, { ...this.defaultOptions, ...options })
      );
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    name: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<T> {
    const breaker = this.get(name, options);
    return breaker.execute(operation, fallback);
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): Record<string, CircuitBreakerMetrics> {
    const status: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getMetrics();
    }
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove a circuit breaker from the registry
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a function wrapper that adds retry with backoff
 *
 * @example
 * ```typescript
 * const fetchWithRetry = withRetry(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * );
 *
 * const data = await fetchWithRetry('https://api.example.com/data');
 * ```
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return ((...args: Parameters<T>) =>
    retryWithBackoff(() => fn(...args), options)) as T;
}

/**
 * Create a function wrapper that adds circuit breaker protection
 *
 * @example
 * ```typescript
 * const protectedFetch = withCircuitBreaker(
 *   'api-service',
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { failureThreshold: 5 }
 * );
 *
 * const data = await protectedFetch('https://api.example.com/data');
 * ```
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  options: Partial<CircuitBreakerOptions> = {}
): T {
  const breaker = new CircuitBreaker(name, options);
  return ((...args: Parameters<T>) =>
    breaker.execute(() => fn(...args))) as T;
}

// =============================================================================
// Global Circuit Breaker Registry
// =============================================================================

/** Global circuit breaker registry instance */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// =============================================================================
// Export Default
// =============================================================================

export default {
  retryWithBackoff,
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  categorizeError,
  isRetryableError,
  calculateBackoff,
  withRetry,
  withCircuitBreaker,
};
