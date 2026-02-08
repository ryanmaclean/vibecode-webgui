/**
 * Tests for src/lib/utils/retry.ts
 * Retry with backoff, circuit breaker, error categorization
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  categorizeError,
  isRetryableError,
  calculateBackoff,
  sleep,
  withTimeout,
  retryWithBackoff,
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
  ErrorCategory,
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  withRetry,
  withCircuitBreaker,
} from '@/lib/utils/retry';

describe('Retry Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Error Classes', () => {
    it('should create RetryExhaustedError with correct properties', () => {
      const lastError = new Error('network');
      const err = new RetryExhaustedError('exhausted', 3, lastError);
      expect(err.name).toBe('RetryExhaustedError');
      expect(err.attempts).toBe(3);
      expect(err.lastError).toBe(lastError);
      expect(err.category).toBe(ErrorCategory.RETRYABLE);
      expect(err).toBeInstanceOf(Error);
    });

    it('should create CircuitOpenError with correct properties', () => {
      const metrics = {
        state: CircuitState.OPEN,
        failureCount: 5,
        successCount: 0,
        totalRequests: 10,
        lastFailureTime: Date.now(),
        lastSuccessTime: null,
        stateChangedTime: Date.now(),
        failureRate: 0.5,
      };
      const err = new CircuitOpenError('my-service', metrics);
      expect(err.name).toBe('CircuitOpenError');
      expect(err.serviceName).toBe('my-service');
      expect(err.metrics).toBe(metrics);
      expect(err.category).toBe(ErrorCategory.CIRCUIT_OPEN);
      expect(err.message).toContain('my-service');
    });

    it('should create TimeoutError with correct properties', () => {
      const err = new TimeoutError('timed out', 5000);
      expect(err.name).toBe('TimeoutError');
      expect(err.timeoutMs).toBe(5000);
      expect(err.category).toBe(ErrorCategory.TIMEOUT);
    });
  });

  describe('categorizeError', () => {
    it('should categorize CircuitOpenError', () => {
      const metrics = {
        state: CircuitState.OPEN,
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        stateChangedTime: Date.now(),
        failureRate: 0,
      };
      const err = new CircuitOpenError('svc', metrics);
      expect(categorizeError(err)).toBe(ErrorCategory.CIRCUIT_OPEN);
    });

    it('should categorize TimeoutError', () => {
      const err = new TimeoutError('timeout', 1000);
      expect(categorizeError(err)).toBe(ErrorCategory.TIMEOUT);
    });

    it('should categorize retryable HTTP status codes from message', () => {
      expect(categorizeError(new Error('status: 429'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('status: 500'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('status: 502'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('status: 503'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('status: 504'))).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize non-retryable HTTP status codes from message', () => {
      expect(categorizeError(new Error('status: 400'))).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError(new Error('status: 401'))).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError(new Error('status: 403'))).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError(new Error('status: 404'))).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError(new Error('status: 422'))).toBe(ErrorCategory.NON_RETRYABLE);
    });

    it('should categorize retryable error patterns', () => {
      expect(categorizeError(new Error('ECONNRESET'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('ECONNREFUSED'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('ETIMEDOUT'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('socket hang up'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('network error'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('rate limit exceeded'))).toBe(ErrorCategory.RETRYABLE);
      expect(categorizeError(new Error('service unavailable'))).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize retryable by status property', () => {
      const err = new Error('fail') as Error & { status: number };
      err.status = 503;
      expect(categorizeError(err)).toBe(ErrorCategory.RETRYABLE);
    });

    it('should categorize non-retryable by statusCode property', () => {
      const err = new Error('fail') as Error & { statusCode: number };
      err.statusCode = 404;
      expect(categorizeError(err)).toBe(ErrorCategory.NON_RETRYABLE);
    });

    it('should default to NON_RETRYABLE for unknown errors', () => {
      expect(categorizeError(new Error('unknown'))).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError('string error')).toBe(ErrorCategory.NON_RETRYABLE);
      expect(categorizeError(42)).toBe(ErrorCategory.NON_RETRYABLE);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isRetryableError(new TimeoutError('timeout', 1000))).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryableError(new Error('status: 404'))).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential delay', () => {
      const opts = { baseDelay: 1000, maxDelay: 30000, jitter: 0 };
      // With jitter=0, delay should be exactly baseDelay * 2^attempt
      expect(calculateBackoff(0, opts)).toBe(1000);
      expect(calculateBackoff(1, opts)).toBe(2000);
      expect(calculateBackoff(2, opts)).toBe(4000);
      expect(calculateBackoff(3, opts)).toBe(8000);
    });

    it('should cap at maxDelay', () => {
      const opts = { baseDelay: 1000, maxDelay: 5000, jitter: 0 };
      expect(calculateBackoff(10, opts)).toBe(5000);
    });

    it('should add jitter when configured', () => {
      const opts = { baseDelay: 1000, maxDelay: 30000, jitter: 0.5 };
      const delays = Array.from({ length: 20 }, () => calculateBackoff(0, opts));
      const hasVariation = new Set(delays).size > 1;
      expect(hasVariation).toBe(true);
      // All should be within acceptable range
      delays.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(500);
        expect(d).toBeLessThanOrEqual(1500);
      });
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      jest.useFakeTimers();
      const promise = sleep(100);
      jest.advanceTimersByTime(100);
      await promise;
      jest.useRealTimers();
    });

    it('should reject when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(sleep(100, controller.signal)).rejects.toThrow('Aborted');
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes within timeout', async () => {
      const result = await withTimeout(Promise.resolve('ok'), 5000);
      expect(result).toBe('ok');
    });

    it('should reject with TimeoutError if promise exceeds timeout', async () => {
      jest.useFakeTimers();
      const slowPromise = new Promise(resolve => setTimeout(resolve, 10000));
      const timeoutPromise = withTimeout(slowPromise, 100);
      jest.advanceTimersByTime(100);
      await expect(timeoutPromise).rejects.toThrow(TimeoutError);
      jest.useRealTimers();
    });

    it('should reject when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(withTimeout(Promise.resolve('ok'), 5000, controller.signal)).rejects.toThrow('Aborted');
    });

    it('should propagate promise rejection', async () => {
      await expect(withTimeout(Promise.reject(new Error('fail')), 5000)).rejects.toThrow('fail');
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const op = jest.fn<() => Promise<string>>().mockResolvedValue('success');
      const result = await retryWithBackoff(op, { maxRetries: 3, timeout: 5000 });
      expect(result).toBe('success');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const op = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('ok');

      const result = await retryWithBackoff(op, {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 10,
        jitter: 0,
        timeout: 5000,
      });
      expect(result).toBe('ok');
      expect(op).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-retryable error', async () => {
      const op = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new Error('status: 404'));

      await expect(retryWithBackoff(op, {
        maxRetries: 3,
        baseDelay: 1,
        timeout: 5000,
      })).rejects.toThrow('status: 404');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('should throw RetryExhaustedError after all retries', async () => {
      const op = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new Error('ECONNRESET'));

      await expect(retryWithBackoff(op, {
        maxRetries: 2,
        baseDelay: 1,
        maxDelay: 10,
        jitter: 0,
        timeout: 5000,
      })).rejects.toThrow(RetryExhaustedError);
      expect(op).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const op = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('ok');

      await retryWithBackoff(op, {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 10,
        jitter: 0,
        timeout: 5000,
        onRetry,
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should call onExhausted callback', async () => {
      const onExhausted = jest.fn();
      const op = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new Error('ECONNRESET'));

      await expect(retryWithBackoff(op, {
        maxRetries: 1,
        baseDelay: 1,
        maxDelay: 10,
        jitter: 0,
        timeout: 5000,
        onExhausted,
      })).rejects.toThrow(RetryExhaustedError);
      expect(onExhausted).toHaveBeenCalledTimes(1);
    });

    it('should use custom isRetryable function', async () => {
      const op = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('custom-retryable'))
        .mockResolvedValue('ok');

      const result = await retryWithBackoff(op, {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 10,
        jitter: 0,
        timeout: 5000,
        isRetryable: (err) => err.message === 'custom-retryable',
      });
      expect(result).toBe('ok');
    });

    it('should respect abort signal', async () => {
      const controller = new AbortController();
      controller.abort();
      const op = jest.fn<() => Promise<string>>().mockResolvedValue('ok');

      await expect(retryWithBackoff(op, {
        maxRetries: 3,
        timeout: 5000,
        signal: controller.signal,
      })).rejects.toThrow('Aborted');
    });
  });

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const cb = new CircuitBreaker('test');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.isHealthy()).toBe(true);
    });

    it('should pass through successful operations', async () => {
      const cb = new CircuitBreaker('test', { timeout: 5000 });
      const result = await cb.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should open circuit after failure threshold', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 3,
        timeout: 5000,
      });

      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('ECONNRESET')));
        } catch {}
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);
      expect(cb.isHealthy()).toBe(false);
    });

    it('should throw CircuitOpenError when circuit is open', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        cooldownPeriod: 60000,
        timeout: 5000,
      });

      try {
        await cb.execute(() => Promise.reject(new Error('ECONNRESET')));
      } catch {}

      await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
    });

    it('should use fallback when circuit is open', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        cooldownPeriod: 60000,
        timeout: 5000,
      });

      try {
        await cb.execute(() => Promise.reject(new Error('ECONNRESET')));
      } catch {}

      const result = await cb.execute(
        () => Promise.resolve('ok'),
        () => Promise.resolve('fallback')
      );
      expect(result).toBe('fallback');
    });

    it('should track metrics correctly', async () => {
      const cb = new CircuitBreaker('test', { timeout: 5000 });
      await cb.execute(() => Promise.resolve('ok'));
      const metrics = cb.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should call onStateChange callback', async () => {
      const onStateChange = jest.fn();
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        timeout: 5000,
        onStateChange,
      });

      try {
        await cb.execute(() => Promise.reject(new Error('ECONNRESET')));
      } catch {}

      expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);
    });

    it('should reset to initial state', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        timeout: 5000,
      });

      try {
        await cb.execute(() => Promise.reject(new Error('ECONNRESET')));
      } catch {}

      expect(cb.getState()).toBe(CircuitState.OPEN);
      cb.reset();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getMetrics().totalRequests).toBe(0);
    });

    it('should force state transition', () => {
      const cb = new CircuitBreaker('test');
      cb.forceState(CircuitState.OPEN);
      expect(cb.getState()).toBe(CircuitState.OPEN);
      cb.forceState(CircuitState.HALF_OPEN);
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should not count non-retryable errors as circuit failures', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        timeout: 5000,
      });

      try {
        await cb.execute(() => Promise.reject(new Error('status: 404')));
      } catch {}

      // 404 is non-retryable, so circuit should stay closed
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('CircuitBreakerRegistry', () => {
    it('should create and retrieve circuit breakers', () => {
      const registry = new CircuitBreakerRegistry();
      const cb1 = registry.get('service-a');
      const cb2 = registry.get('service-a');
      expect(cb1).toBe(cb2); // Same instance
    });

    it('should execute operations through named breaker', async () => {
      const registry = new CircuitBreakerRegistry({ timeout: 5000 });
      const result = await registry.execute('svc', () => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should return health status for all breakers', async () => {
      const registry = new CircuitBreakerRegistry({ timeout: 5000 });
      await registry.execute('a', () => Promise.resolve('ok'));
      await registry.execute('b', () => Promise.resolve('ok'));

      const health = registry.getHealthStatus();
      expect(health['a']).toBeDefined();
      expect(health['b']).toBeDefined();
      expect(health['a'].state).toBe(CircuitState.CLOSED);
    });

    it('should reset all breakers', async () => {
      const registry = new CircuitBreakerRegistry({ timeout: 5000 });
      await registry.execute('a', () => Promise.resolve('ok'));
      registry.resetAll();
      const health = registry.getHealthStatus();
      expect(health['a'].totalRequests).toBe(0);
    });

    it('should remove a specific breaker', () => {
      const registry = new CircuitBreakerRegistry();
      registry.get('svc');
      expect(registry.remove('svc')).toBe(true);
      expect(registry.remove('nonexistent')).toBe(false);
    });

    it('should clear all breakers', () => {
      const registry = new CircuitBreakerRegistry();
      registry.get('a');
      registry.get('b');
      registry.clear();
      expect(registry.getHealthStatus()).toEqual({});
    });
  });

  describe('withRetry', () => {
    it('should create a retryable function wrapper', async () => {
      const fn = jest.fn<(x: number) => Promise<number>>().mockResolvedValue(42);
      const retryableFn = withRetry(fn, { maxRetries: 3, timeout: 5000 });
      const result = await retryableFn(1);
      expect(result).toBe(42);
    });
  });

  describe('withCircuitBreaker', () => {
    it('should create a circuit-breaker-protected function wrapper', async () => {
      const fn = jest.fn<(x: string) => Promise<string>>().mockResolvedValue('result');
      const protectedFn = withCircuitBreaker('svc', fn, { timeout: 5000 });
      const result = await protectedFn('arg');
      expect(result).toBe('result');
    });
  });
});
