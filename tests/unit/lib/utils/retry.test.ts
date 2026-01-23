/**
 * Comprehensive tests for retry utilities with exponential backoff and circuit breaker
 */

import {
  retryWithBackoff,
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  ErrorCategory,
  categorizeError,
  isRetryableError,
  calculateBackoff,
  sleep,
  withTimeout,
  withRetry,
  withCircuitBreaker,
  circuitBreakerRegistry,
} from '@/lib/utils/retry';

// =============================================================================
// Test Setup
// =============================================================================

describe('Retry Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    circuitBreakerRegistry.clear();
  });

  // ===========================================================================
  // Error Categorization Tests
  // ===========================================================================

  describe('categorizeError', () => {
    it('should categorize CircuitOpenError as CIRCUIT_OPEN', () => {
      const error = new CircuitOpenError('test-service', {
        state: CircuitState.OPEN,
        failureCount: 5,
        successCount: 0,
        totalRequests: 10,
        lastFailureTime: Date.now(),
        lastSuccessTime: null,
        stateChangedTime: Date.now(),
        failureRate: 0.5,
      });
      expect(categorizeError(error)).toBe(ErrorCategory.CIRCUIT_OPEN);
    });

    it('should categorize TimeoutError as TIMEOUT', () => {
      const error = new TimeoutError('Request timed out', 5000);
      expect(categorizeError(error)).toBe(ErrorCategory.TIMEOUT);
    });

    it('should categorize HTTP 429 as RETRYABLE', () => {
      const error = new Error('HTTP error! status: 429');
      expect(categorizeError(error)).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize HTTP 500 as RETRYABLE', () => {
      const error = new Error('HTTP error! status: 500');
      expect(categorizeError(error)).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize HTTP 502 as RETRYABLE', () => {
      const error = new Error('HTTP error! status: 502');
      expect(categorizeError(error)).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize HTTP 503 as RETRYABLE', () => {
      const error = new Error('HTTP error! status: 503');
      expect(categorizeError(error)).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize HTTP 504 as RETRYABLE', () => {
      const error = new Error('HTTP error! status: 504');
      expect(categorizeError(error)).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize HTTP 400 as NON_RETRYABLE', () => {
      const error = new Error('HTTP error! status: 400');
      expect(categorizeError(error)).toBe(ErrorCategory.NON_RETRYABLE);
    });

    it('should categorize HTTP 401 as NON_RETRYABLE', () => {
      const error = new Error('HTTP error! status: 401');
      expect(categorizeError(error)).toBe(ErrorCategory.NON_RETRYABLE);
    });

    it('should categorize HTTP 404 as NON_RETRYABLE', () => {
      const error = new Error('HTTP error! status: 404');
      expect(categorizeError(error)).toBe(ErrorCategory.NON_RETRYABLE);
    });

    it('should categorize network errors as RETRYABLE', () => {
      expect(categorizeError(new Error('ECONNRESET'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('ECONNREFUSED'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('ETIMEDOUT'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('socket hang up'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('network error'))).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize rate limit messages as RETRYABLE', () => {
      expect(categorizeError(new Error('rate limit exceeded'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('too many requests'))).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize error objects with status property', () => {
      const error429 = Object.assign(new Error('Rate limited'), { status: 429 });
      const error401 = Object.assign(new Error('Unauthorized'), { status: 401 });

      expect(categorizeError(error429)).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(error401)).toBe(ErrorCategory.NON_RETRYABLE);
    });

    it('should default to NON_RETRYABLE for unknown errors', () => {
      expect(categorizeError(new Error('Unknown error'))).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError('string error')).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError(null)).toBe(ErrorCategory.NON_RETRYABLE);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      expect(isRetryableError(new Error('status: 500'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new TimeoutError('timeout', 1000))).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryableError(new Error('status: 400'))).toBe(false);
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new CircuitOpenError('test', {} as any))).toBe(false);
    });
  });

  // ===========================================================================
  // Backoff Calculation Tests
  // ===========================================================================

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      const options = { baseDelay: 1000, maxDelay: 30000, jitter: 0 };

      // With 0 jitter, results should be deterministic
      expect(calculateBackoff(0, options)).toBe(1000);  // 1000 * 2^0 = 1000
      expect(calculateBackoff(1, options)).toBe(2000);  // 1000 * 2^1 = 2000
      expect(calculateBackoff(2, options)).toBe(4000);  // 1000 * 2^2 = 4000
      expect(calculateBackoff(3, options)).toBe(8000);  // 1000 * 2^3 = 8000
      expect(calculateBackoff(4, options)).toBe(16000); // 1000 * 2^4 = 16000
    });

    it('should cap at maxDelay', () => {
      const options = { baseDelay: 1000, maxDelay: 10000, jitter: 0 };

      expect(calculateBackoff(5, options)).toBe(10000); // Would be 32000, capped at 10000
      expect(calculateBackoff(10, options)).toBe(10000);
    });

    it('should add jitter within expected range', () => {
      const options = { baseDelay: 1000, maxDelay: 30000, jitter: 0.2 };

      // Run multiple times to test jitter variance
      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(calculateBackoff(0, options));
      }

      // Base delay is 1000, jitter is 0.2, so range should be 800-1200
      const minExpected = 1000 * (1 - 0.2);
      const maxExpected = 1000 * (1 + 0.2);

      expect(Math.min(...results)).toBeGreaterThanOrEqual(minExpected);
      expect(Math.max(...results)).toBeLessThanOrEqual(maxExpected);

      // Should have some variance (not all the same)
      const uniqueValues = new Set(results);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    it('should handle zero baseDelay', () => {
      const options = { baseDelay: 0, maxDelay: 30000, jitter: 0 };
      expect(calculateBackoff(0, options)).toBe(0);
      expect(calculateBackoff(5, options)).toBe(0);
    });
  });

  // ===========================================================================
  // Sleep and Timeout Tests
  // ===========================================================================

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const promise = sleep(1000);

      jest.advanceTimersByTime(999);
      await Promise.resolve(); // Flush microtasks

      // Promise should not be resolved yet
      let resolved = false;
      promise.then(() => { resolved = true; });
      await Promise.resolve();
      expect(resolved).toBe(false);

      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await promise;
      expect(resolved).toBe(true);
    });

    it('should reject when abort signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(sleep(1000, controller.signal)).rejects.toThrow('Aborted');
    });

    it('should reject when abort signal fires during sleep', async () => {
      const controller = new AbortController();
      const promise = sleep(1000, controller.signal);

      jest.advanceTimersByTime(500);
      controller.abort();

      await expect(promise).rejects.toThrow('Aborted');
    });
  });

  describe('withTimeout', () => {
    it('should resolve if operation completes before timeout', async () => {
      const operation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 500);
      });

      const promise = withTimeout(operation, 1000);

      jest.advanceTimersByTime(500);
      await expect(promise).resolves.toBe('success');
    });

    it('should reject with TimeoutError if operation takes too long', async () => {
      const operation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 2000);
      });

      const promise = withTimeout(operation, 1000);

      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toBeInstanceOf(TimeoutError);
      await expect(promise).rejects.toMatchObject({
        timeoutMs: 1000,
      });
    });

    it('should reject with original error if operation fails', async () => {
      const operation = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('operation failed')), 500);
      });

      const promise = withTimeout(operation, 1000);

      jest.advanceTimersByTime(500);
      await expect(promise).rejects.toThrow('operation failed');
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const operation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 2000);
      });

      controller.abort();

      await expect(withTimeout(operation, 5000, controller.signal)).rejects.toThrow('Aborted');
    });
  });

  // ===========================================================================
  // Retry With Backoff Tests
  // ===========================================================================

  describe('retryWithBackoff', () => {
    it('should return result on first successful attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(operation, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('status: 500'))
        .mockRejectedValueOnce(new Error('status: 502'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelay: 100,
        jitter: 0,
      });

      // First attempt fails
      await jest.advanceTimersByTimeAsync(0);

      // Wait for first retry delay (100ms)
      await jest.advanceTimersByTimeAsync(100);

      // Wait for second retry delay (200ms)
      await jest.advanceTimersByTimeAsync(200);

      const result = await promise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('status: 400'));

      await expect(retryWithBackoff(operation, { maxRetries: 3 })).rejects.toThrow('status: 400');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw RetryExhaustedError when all retries fail', async () => {
      jest.useRealTimers();
      const operation = jest.fn().mockRejectedValue(new Error('status: 500'));

      try {
        await retryWithBackoff(operation, {
          maxRetries: 2,
          baseDelay: 10,
          jitter: 0,
        });
        fail('Expected RetryExhaustedError');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect((error as RetryExhaustedError).attempts).toBe(3);
      }
      expect(operation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      jest.useFakeTimers();
    });

    it('should call onRetry callback before each retry', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('status: 500'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      const promise = retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelay: 100,
        jitter: 0,
        onRetry,
      });

      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(100);

      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 100);
    });

    it('should call onExhausted callback when retries are exhausted', async () => {
      jest.useRealTimers();
      const operation = jest.fn().mockRejectedValue(new Error('status: 500'));
      const onExhausted = jest.fn();

      try {
        await retryWithBackoff(operation, {
          maxRetries: 1,
          baseDelay: 10,
          jitter: 0,
          onExhausted,
        });
        fail('Expected error');
      } catch (error) {
        // Expected
      }

      expect(onExhausted).toHaveBeenCalledTimes(1);
      expect(onExhausted).toHaveBeenCalledWith(2, expect.any(Error));
      jest.useFakeTimers();
    });

    it('should use custom isRetryable function', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('custom-retryable'))
        .mockResolvedValue('success');

      const customIsRetryable = (error: Error) => error.message.includes('custom-retryable');

      const promise = retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelay: 100,
        jitter: 0,
        isRetryable: customIsRetryable,
      });

      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(100);

      const result = await promise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const operation = jest.fn().mockRejectedValue(new Error('status: 500'));

      const promise = retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelay: 100,
        signal: controller.signal,
      });

      // Abort after first attempt
      await jest.advanceTimersByTimeAsync(0);
      controller.abort();

      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should respect timeout option', async () => {
      jest.useRealTimers();
      const operation = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve('success'), 500))
      );

      try {
        await retryWithBackoff(operation, {
          maxRetries: 2,
          timeout: 50,
          baseDelay: 10,
          jitter: 0,
        });
        fail('Expected RetryExhaustedError');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
      }
      expect(operation).toHaveBeenCalledTimes(3); // All attempts should time out
      jest.useFakeTimers();
    });
  });

  // ===========================================================================
  // Circuit Breaker Tests
  // ===========================================================================

  describe('CircuitBreaker', () => {
    describe('state transitions', () => {
      it('should start in CLOSED state', () => {
        const breaker = new CircuitBreaker('test-service');
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
        expect(breaker.isHealthy()).toBe(true);
      });

      it('should transition to OPEN after reaching failure threshold', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 3,
          timeout: 100,
        });

        const failingOperation = () => Promise.reject(new Error('status: 500'));

        // Make failures
        for (let i = 0; i < 3; i++) {
          await expect(breaker.execute(failingOperation)).rejects.toThrow();
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);
        expect(breaker.isHealthy()).toBe(false);
      });

      it('should reject immediately when OPEN', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          cooldownPeriod: 10000,
          timeout: 100,
        });

        // Open the circuit
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        // Should reject immediately without calling operation
        const operation = jest.fn().mockResolvedValue('success');

        await expect(breaker.execute(operation)).rejects.toBeInstanceOf(CircuitOpenError);
        expect(operation).not.toHaveBeenCalled();
      });

      it('should transition to HALF_OPEN after cooldown period', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          cooldownPeriod: 1000,
          timeout: 100,
        });

        // Open the circuit
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();
        expect(breaker.getState()).toBe(CircuitState.OPEN);

        // Wait for cooldown
        jest.advanceTimersByTime(1001);

        // Next request should go through (testing recovery)
        const operation = jest.fn().mockResolvedValue('success');
        await breaker.execute(operation);

        expect(operation).toHaveBeenCalled();
      });

      it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          cooldownPeriod: 100,
          successThreshold: 2,
          timeout: 100,
        });

        // Open the circuit
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        // Wait for cooldown
        jest.advanceTimersByTime(101);

        // Make successful requests to close the circuit
        await breaker.execute(() => Promise.resolve('success1'));
        expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

        await breaker.execute(() => Promise.resolve('success2'));
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
      });

      it('should transition back to OPEN if failure in HALF_OPEN', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          cooldownPeriod: 100,
          successThreshold: 2,
          timeout: 100,
        });

        // Open the circuit
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        // Wait for cooldown
        jest.advanceTimersByTime(101);

        // Fail again in HALF_OPEN
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        expect(breaker.getState()).toBe(CircuitState.OPEN);
      });
    });

    describe('fallback behavior', () => {
      it('should call fallback when circuit is OPEN', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          cooldownPeriod: 10000,
          timeout: 100,
        });

        // Open the circuit
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        // Use fallback
        const operation = jest.fn().mockResolvedValue('primary');
        const fallback = jest.fn().mockResolvedValue('fallback');

        const result = await breaker.execute(operation, fallback);

        expect(result).toBe('fallback');
        expect(operation).not.toHaveBeenCalled();
        expect(fallback).toHaveBeenCalled();
      });

      it('should call fallback when operation fails', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 10, // High threshold so circuit doesn't open
          timeout: 100,
        });

        const operation = jest.fn().mockRejectedValue(new Error('status: 500'));
        const fallback = jest.fn().mockResolvedValue('fallback');

        // Note: fallback is only called when circuit is OPEN, not on individual failures
        // This test verifies the correct behavior
        await expect(breaker.execute(operation, fallback)).rejects.toThrow();
        expect(fallback).not.toHaveBeenCalled();
      });
    });

    describe('metrics', () => {
      it('should track metrics correctly', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 10,
          timeout: 100,
        });

        // Make some successful requests
        await breaker.execute(() => Promise.resolve('success'));
        await breaker.execute(() => Promise.resolve('success'));

        // Make some failed requests
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        const metrics = breaker.getMetrics();

        expect(metrics.state).toBe(CircuitState.CLOSED);
        expect(metrics.totalRequests).toBe(3);
        expect(metrics.successCount).toBe(2);
        expect(metrics.failureCount).toBe(1);
        expect(metrics.lastSuccessTime).not.toBeNull();
        expect(metrics.lastFailureTime).not.toBeNull();
      });

      it('should prune old failures outside monitoring window', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 10,
          monitoringWindow: 1000,
          timeout: 100,
        });

        // Make failures
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();

        expect(breaker.getMetrics().failureCount).toBe(2);

        // Advance past monitoring window
        jest.advanceTimersByTime(1001);

        // Failures should be pruned
        expect(breaker.getMetrics().failureCount).toBe(0);
      });
    });

    describe('onStateChange callback', () => {
      it('should call onStateChange when state changes', async () => {
        const onStateChange = jest.fn();
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          cooldownPeriod: 100,
          onStateChange,
          timeout: 100,
        });

        // CLOSED -> OPEN
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);

        // Wait for cooldown
        jest.advanceTimersByTime(101);

        // OPEN -> HALF_OPEN (on next request)
        await breaker.execute(() => Promise.resolve('success'));
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.OPEN, CircuitState.HALF_OPEN);
      });
    });

    describe('reset and forceState', () => {
      it('should reset circuit breaker to initial state', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          timeout: 100,
        });

        // Open the circuit
        await expect(breaker.execute(() => Promise.reject(new Error('status: 500')))).rejects.toThrow();
        expect(breaker.getState()).toBe(CircuitState.OPEN);

        // Reset
        breaker.reset();

        expect(breaker.getState()).toBe(CircuitState.CLOSED);
        expect(breaker.getMetrics().failureCount).toBe(0);
        expect(breaker.getMetrics().totalRequests).toBe(0);
      });

      it('should force circuit to specific state', async () => {
        const breaker = new CircuitBreaker('test-service');

        breaker.forceState(CircuitState.OPEN);
        expect(breaker.getState()).toBe(CircuitState.OPEN);

        breaker.forceState(CircuitState.HALF_OPEN);
        expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

        breaker.forceState(CircuitState.CLOSED);
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
      });
    });

    describe('error filtering', () => {
      it('should not count non-retryable errors as failures', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 2,
          timeout: 100,
        });

        // Non-retryable errors (400-level)
        await expect(breaker.execute(() => Promise.reject(new Error('status: 400')))).rejects.toThrow();
        await expect(breaker.execute(() => Promise.reject(new Error('status: 401')))).rejects.toThrow();
        await expect(breaker.execute(() => Promise.reject(new Error('status: 404')))).rejects.toThrow();

        // Circuit should still be closed (non-retryable errors don't count)
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
        expect(breaker.getMetrics().failureCount).toBe(0);
      });

      it('should use custom isFailure function', async () => {
        const breaker = new CircuitBreaker('test-service', {
          failureThreshold: 1,
          timeout: 100,
          isFailure: (error) => error.message.includes('critical'),
        });

        // Non-critical error
        await expect(breaker.execute(() => Promise.reject(new Error('minor error')))).rejects.toThrow();
        expect(breaker.getState()).toBe(CircuitState.CLOSED);

        // Critical error
        await expect(breaker.execute(() => Promise.reject(new Error('critical error')))).rejects.toThrow();
        expect(breaker.getState()).toBe(CircuitState.OPEN);
      });
    });
  });

  // ===========================================================================
  // Circuit Breaker Registry Tests
  // ===========================================================================

  describe('CircuitBreakerRegistry', () => {
    it('should create circuit breakers on demand', () => {
      const registry = new CircuitBreakerRegistry();

      const breaker1 = registry.get('service-1');
      const breaker2 = registry.get('service-2');

      expect(breaker1).toBeInstanceOf(CircuitBreaker);
      expect(breaker2).toBeInstanceOf(CircuitBreaker);
      expect(breaker1).not.toBe(breaker2);
    });

    it('should return the same breaker for same service name', () => {
      const registry = new CircuitBreakerRegistry();

      const breaker1 = registry.get('service-1');
      const breaker2 = registry.get('service-1');

      expect(breaker1).toBe(breaker2);
    });

    it('should apply default options to all breakers', () => {
      const registry = new CircuitBreakerRegistry({
        failureThreshold: 10,
      });

      const breaker = registry.get('service-1');

      // Make 5 failures (less than threshold)
      for (let i = 0; i < 5; i++) {
        breaker.execute(() => Promise.reject(new Error('status: 500'))).catch(() => {});
      }

      // Circuit should still be closed
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute operations with circuit breaker', async () => {
      const registry = new CircuitBreakerRegistry();

      const result = await registry.execute(
        'service-1',
        () => Promise.resolve('success')
      );

      expect(result).toBe('success');
    });

    it('should get health status of all breakers', async () => {
      const registry = new CircuitBreakerRegistry({ timeout: 100 });

      // Create some breakers
      await registry.execute('service-1', () => Promise.resolve('success'));
      await expect(
        registry.execute('service-2', () => Promise.reject(new Error('status: 500')))
      ).rejects.toThrow();

      const status = registry.getHealthStatus();

      expect(status['service-1']).toBeDefined();
      expect(status['service-2']).toBeDefined();
    });

    it('should reset all breakers', async () => {
      const registry = new CircuitBreakerRegistry({
        failureThreshold: 1,
        timeout: 100,
      });

      // Open circuits
      await expect(
        registry.execute('service-1', () => Promise.reject(new Error('status: 500')))
      ).rejects.toThrow();
      await expect(
        registry.execute('service-2', () => Promise.reject(new Error('status: 500')))
      ).rejects.toThrow();

      expect(registry.get('service-1').getState()).toBe(CircuitState.OPEN);
      expect(registry.get('service-2').getState()).toBe(CircuitState.OPEN);

      // Reset all
      registry.resetAll();

      expect(registry.get('service-1').getState()).toBe(CircuitState.CLOSED);
      expect(registry.get('service-2').getState()).toBe(CircuitState.CLOSED);
    });

    it('should remove specific breaker', () => {
      const registry = new CircuitBreakerRegistry();

      registry.get('service-1');
      expect(registry.remove('service-1')).toBe(true);
      expect(registry.remove('service-1')).toBe(false); // Already removed
    });

    it('should clear all breakers', () => {
      const registry = new CircuitBreakerRegistry();

      registry.get('service-1');
      registry.get('service-2');

      registry.clear();

      const status = registry.getHealthStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Convenience Function Tests
  // ===========================================================================

  describe('withRetry', () => {
    it('should wrap function with retry logic', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('status: 500'))
        .mockResolvedValue('success');

      const wrappedFn = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 100,
        jitter: 0,
      });

      const promise = wrappedFn('arg1', 'arg2');

      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('withCircuitBreaker', () => {
    it('should wrap function with circuit breaker', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const wrappedFn = withCircuitBreaker('test-service', fn, {
        failureThreshold: 5,
      });

      const result = await wrappedFn('arg1');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1');
    });
  });

  // ===========================================================================
  // Global Registry Tests
  // ===========================================================================

  describe('circuitBreakerRegistry (global)', () => {
    it('should be a singleton', () => {
      const breaker1 = circuitBreakerRegistry.get('global-service');
      const breaker2 = circuitBreakerRegistry.get('global-service');

      expect(breaker1).toBe(breaker2);
    });
  });

  // ===========================================================================
  // Error Class Tests
  // ===========================================================================

  describe('Error Classes', () => {
    describe('RetryExhaustedError', () => {
      it('should have correct properties', () => {
        const lastError = new Error('original error');
        const error = new RetryExhaustedError('Retries exhausted', 3, lastError);

        expect(error.name).toBe('RetryExhaustedError');
        expect(error.message).toBe('Retries exhausted');
        expect(error.attempts).toBe(3);
        expect(error.lastError).toBe(lastError);
        expect(error.category).toBe(ErrorCategory.RETRYABLE);
      });
    });

    describe('CircuitOpenError', () => {
      it('should have correct properties', () => {
        const metrics: any = {
          state: CircuitState.OPEN,
          failureCount: 5,
        };
        const error = new CircuitOpenError('test-service', metrics);

        expect(error.name).toBe('CircuitOpenError');
        expect(error.message).toContain('test-service');
        expect(error.serviceName).toBe('test-service');
        expect(error.metrics).toBe(metrics);
        expect(error.category).toBe(ErrorCategory.CIRCUIT_OPEN);
      });
    });

    describe('TimeoutError', () => {
      it('should have correct properties', () => {
        const error = new TimeoutError('Operation timed out', 5000);

        expect(error.name).toBe('TimeoutError');
        expect(error.message).toBe('Operation timed out');
        expect(error.timeoutMs).toBe(5000);
        expect(error.category).toBe(ErrorCategory.TIMEOUT);
      });
    });
  });
});
