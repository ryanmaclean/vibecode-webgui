/**
 * Vector Database Error Handler
 * Enhanced error handling for vector database operations with retry mechanism
 */

import { logger } from '../logger';
import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler';

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  maxRetries: number;

  /**
   * Base delay between retries in milliseconds
   * Default: 1000 (1 second)
   */
  baseDelay: number;

  /**
   * Maximum delay between retries in milliseconds
   * Default: 30000 (30 seconds)
   */
  maxDelay: number;

  /**
   * Factor to increase delay by on each retry (exponential backoff)
   * Default: 2
   */
  backoffFactor: number;

  /**
   * Add jitter to delay to prevent synchronized retries
   * Default: true
   */
  jitter: boolean;

  /**
   * Time window in milliseconds to track failures for circuit breaking
   * Default: 60000 (1 minute)
   */
  failureWindowMs: number;

  /**
   * Number of failures in the window to trigger circuit breaking
   * Default: 5
   */
  failureThreshold: number;

  /**
   * Time in milliseconds to keep the circuit open before trying again
   * Default: 30000 (30 seconds)
   */
  circuitResetTimeMs: number;
}

/**
 * Retry handler class with circuit breaker pattern
 */
export class RetryHandler {
  private config: RetryConfig;
  private failures: { timestamp: number; error: Error }[] = [];
  private circuitBroken = false;
  private circuitBrokenUntil = 0;
  private errorHandler: VectorDbErrorHandler;
  private readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
    failureWindowMs: 60000,
    failureThreshold: 5,
    circuitResetTimeMs: 30000
  };

  /**
   * Create a new retry handler
   * @param config Retry configuration
   * @param provider Provider name for error handler
   */
  constructor(config: Partial<RetryConfig> = {}, provider: string = 'retry-handler') {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.errorHandler = new VectorDbErrorHandler(provider);
  }

  /**
   * Execute an operation with retry logic
   * @param operation The async operation to execute
   * @param operationName Name of the operation for logging
   * @param isRetryable Optional function to determine if an error is retryable
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    isRetryable?: (error: Error) => boolean
  ): Promise<T> {
    // Check if circuit is broken
    if (this.isCircuitBroken()) {
      throw this.errorHandler.handleError(
        new Error(`Circuit broken for operation: ${operationName}. Too many recent failures.`),
        operationName,
        VectorDbErrorType.SERVICE,
        false,
        {
          circuitBroken: true,
          failureCount: this.failures.length,
          resetAfterMs: Math.max(0, this.circuitBrokenUntil - Date.now())
        }
      );
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.config.maxRetries) {
      try {
        // Execute the operation
        const result = await operation();
        
        // Operation succeeded, return the result
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        
        // Record the failure
        this.recordFailure(err);
        
        // Check if we should break the circuit
        if (this.shouldBreakCircuit()) {
          this.breakCircuit();
          throw this.errorHandler.handleError(
            new Error(`Circuit broken for operation: ${operationName}. Too many recent failures.`),
            operationName,
            VectorDbErrorType.SERVICE,
            false,
            {
              circuitBroken: true,
              failureCount: this.failures.length,
              resetAfterMs: this.config.circuitResetTimeMs
            }
          );
        }
        
        // Check if we've reached max retries
        if (attempt >= this.config.maxRetries) {
          break;
        }
        
        // Check if the error is retryable
        const retryable = isRetryable ? 
          isRetryable(err) : 
          this.isErrorRetryable(err);
        
        if (!retryable) {
          logger.warn(`Non-retryable error in operation "${operationName}":`, { 
            error: err.message, 
            stack: err.stack 
          });
          
          // If the error is already a VectorDbError, just throw it
          if (err instanceof VectorDbError) {
            throw err;
          }
          
          // Otherwise, wrap it with our error handler
          throw this.errorHandler.handleError(
            err,
            operationName,
            undefined, // Let the error handler determine the type
            false,
            { retryAttempt: attempt }
          );
        }
        
        // Calculate delay for next retry
        const delay = this.calculateBackoff(attempt);
        
        logger.info(`Retrying operation "${operationName}" after ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries}):`, { 
          error: err.message
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increment attempt counter
        attempt++;
      }
    }
    
    // If we got here, all retries failed
    logger.error(`All ${this.config.maxRetries} retry attempts failed for operation "${operationName}":`, { 
      error: lastError?.message, 
      stack: lastError?.stack 
    });
    
    // If the last error is already a VectorDbError, just throw it
    if (lastError instanceof VectorDbError) {
      throw lastError;
    }
    
    // Otherwise, wrap it with our error handler
    throw this.errorHandler.handleError(
      lastError || new Error(`Unknown error in operation: ${operationName}`),
      operationName,
      undefined, // Let the error handler determine the type
      false,
      { maxRetries: this.config.maxRetries, allRetriesFailed: true }
    );
  }

  /**
   * Determine if an error is retryable based on its properties
   * @param error The error to check
   */
  private isErrorRetryable(error: Error): boolean {
      // If it's a VectorDbError, check if it's retryable based on error type
      if (error instanceof VectorDbError) {
        return (error.details && 'retryable' in error.details && error.details.retryable === true) || 
               error.type === VectorDbErrorType.CONNECTION_FAILED ||
               error.type === VectorDbErrorType.TIMEOUT;
    }
    
    // Otherwise, use the error handler to check if it's retryable
    return this.errorHandler.isRetryableError(error);
  }

  /**
   * Calculate the backoff delay with exponential increase
   * @param attempt Current attempt number (0-based)
   */
  private calculateBackoff(attempt: number): number {
    // Calculate exponential backoff
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt);
    
    // Cap at maximum delay
    let delay = Math.min(exponentialDelay, this.config.maxDelay);
    
    // Add jitter if enabled (±20% randomness)
    if (this.config.jitter) {
      const jitterFactor = 0.8 + (Math.random() * 0.4); // 0.8-1.2
      delay = Math.floor(delay * jitterFactor);
    }
    
    return delay;
  }

  /**
   * Record a failure for circuit breaker tracking
   * @param error The error that occurred
   */
  private recordFailure(error: Error): void {
    const now = Date.now();
    
    // Add the failure to the list
    this.failures.push({ timestamp: now, error });
    
    // Prune old failures outside the window
    this.failures = this.failures.filter(
      failure => (now - failure.timestamp) < this.config.failureWindowMs
    );
  }

  /**
   * Determine if the circuit should be broken based on recent failures
   */
  private shouldBreakCircuit(): boolean {
    return this.failures.length >= this.config.failureThreshold;
  }

  /**
   * Break the circuit for the configured reset time
   */
  private breakCircuit(): void {
    this.circuitBroken = true;
    this.circuitBrokenUntil = Date.now() + this.config.circuitResetTimeMs;
    
    logger.warn('Circuit breaker triggered due to excessive failures', {
      failureCount: this.failures.length,
      resetAfterMs: this.config.circuitResetTimeMs,
      recentErrors: this.failures.slice(-3).map(f => f.error.message)
    });
  }

  /**
   * Check if the circuit is currently broken
   */
  private isCircuitBroken(): boolean {
    if (!this.circuitBroken) {
      return false;
    }
    
    // Check if the circuit reset time has elapsed
    if (Date.now() > this.circuitBrokenUntil) {
      // Reset the circuit
      this.circuitBroken = false;
      this.failures = [];
      
      logger.info('Circuit breaker reset after timeout period');
      return false;
    }
    
    return true;
  }

  /**
   * Reset the circuit breaker manually
   */
  public resetCircuit(): void {
    this.circuitBroken = false;
    this.failures = [];
    
    logger.info('Circuit breaker manually reset');
  }

  /**
   * Get current circuit breaker status
   */
  public getStatus(): {
    circuitBroken: boolean;
    recentFailures: number;
    remainingResetTimeMs: number;
  } {
    return {
      circuitBroken: this.circuitBroken,
      recentFailures: this.failures.length,
      remainingResetTimeMs: Math.max(0, this.circuitBrokenUntil - Date.now())
    };
  }
}

// Legacy types for backward compatibility
import { VectorDBErrorType } from './vector-db-error-handler';
export { VectorDBErrorType };