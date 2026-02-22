/**
 * Retry utilities with exponential backoff
 * Provides reliable retry logic for transient failures in VM operations
 */

import { logger } from '@/lib/logger';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds (default: 100ms) */
  initialDelay?: number;

  /** Backoff multiplier (default: 2x) */
  backoffMultiplier?: number;

  /** Maximum delay between retries in milliseconds (default: 10000ms) */
  maxDelay?: number;

  /** Function to determine if error is retryable (default: all errors retryable) */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /** Operation name for logging */
  operationName?: string;

  /** Additional context for logging */
  context?: Record<string, unknown>;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Result value if successful */
  value?: T;

  /** Error if failed */
  error?: Error;

  /** Number of attempts made */
  attempts: number;

  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'operationName' | 'context'>> = {
  maxAttempts: 3,
  initialDelay: 100,
  backoffMultiplier: 2,
  maxDelay: 10000,
};

/**
 * Calculate delay for next retry attempt using exponential backoff
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const initialDelay = options.initialDelay || DEFAULT_OPTIONS.initialDelay;
  const multiplier = options.backoffMultiplier || DEFAULT_OPTIONS.backoffMultiplier;
  const maxDelay = options.maxDelay || DEFAULT_OPTIONS.maxDelay;

  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic and exponential backoff
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to RetryResult
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => await startVM(vmId),
 *   {
 *     maxAttempts: 3,
 *     operationName: 'start-vm',
 *     context: { vmId }
 *   }
 * );
 *
 * if (!result.success) {
 *   throw result.error;
 * }
 * return result.value;
 * ```
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts || DEFAULT_OPTIONS.maxAttempts;
  const operationName = options.operationName || 'operation';
  const context = options.context || {};

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Attempting ${operationName}`, {
        attempt,
        maxAttempts,
        ...context,
      });

      const value = await operation();

      const duration = Date.now() - startTime;

      if (attempt > 1) {
        logger.info(`${operationName} succeeded after retry`, {
          attempt,
          duration,
          ...context,
        });
      }

      return {
        success: true,
        value,
        attempts: attempt,
        duration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = options.shouldRetry
        ? options.shouldRetry(lastError, attempt)
        : true;

      if (!shouldRetry || attempt >= maxAttempts) {
        const duration = Date.now() - startTime;

        logger.error(`${operationName} failed after ${attempt} attempts`, {
          error: lastError.message,
          attempt,
          maxAttempts,
          duration,
          ...context,
        });

        return {
          success: false,
          error: lastError,
          attempts: attempt,
          duration,
        };
      }

      // Calculate delay and wait before next attempt
      const delay = calculateDelay(attempt, options);

      logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        attempt,
        maxAttempts,
        delay,
        ...context,
      });

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  const duration = Date.now() - startTime;
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: maxAttempts,
    duration,
  };
}

/**
 * Execute an operation with retry logic, throwing on failure
 * Convenience wrapper around retry() that throws the error instead of returning it
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to operation result
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const vm = await retryWithThrow(
 *   async () => await startVM(vmId),
 *   {
 *     maxAttempts: 3,
 *     operationName: 'start-vm',
 *     context: { vmId }
 *   }
 * );
 * ```
 */
export async function retryWithThrow<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await retry(operation, options);

  if (!result.success) {
    throw result.error;
  }

  return result.value as T;
}

/**
 * Create a retry wrapper for a function
 * Returns a new function that automatically retries with the specified options
 *
 * @param fn - Function to wrap
 * @param options - Retry configuration options
 * @returns Wrapped function with retry logic
 *
 * @example
 * ```typescript
 * const reliableStartVM = withRetry(
 *   startVM,
 *   { maxAttempts: 3, operationName: 'start-vm' }
 * );
 *
 * const vm = await reliableStartVM(vmId);
 * ```
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return retryWithThrow(
      () => fn(...args),
      options
    );
  };
}

/**
 * Common retry predicates for determining if errors are retryable
 */
export const RetryPredicates = {
  /**
   * Retry on network errors
   */
  isNetworkError: (error: Error): boolean => {
    const networkErrorMessages = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EHOSTUNREACH',
    ];

    return networkErrorMessages.some(msg =>
      error.message.includes(msg)
    );
  },

  /**
   * Retry on timeout errors
   */
  isTimeoutError: (error: Error): boolean => {
    return error.message.includes('timeout') ||
           error.message.includes('ETIMEDOUT');
  },

  /**
   * Retry on transient VM errors
   */
  isTransientVMError: (error: Error): boolean => {
    const transientMessages = [
      'VM not ready',
      'VM starting',
      'resource temporarily unavailable',
      'device busy',
      'try again',
    ];

    return transientMessages.some(msg =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  },

  /**
   * Combine multiple retry predicates with OR logic
   */
  any: (...predicates: Array<(error: Error) => boolean>) => {
    return (error: Error): boolean => {
      return predicates.some(predicate => predicate(error));
    };
  },

  /**
   * Combine multiple retry predicates with AND logic
   */
  all: (...predicates: Array<(error: Error) => boolean>) => {
    return (error: Error): boolean => {
      return predicates.every(predicate => predicate(error));
    };
  },
};
