/**
 * Tests for BatchLoader enhanced error handling
 *
 * Tests cover:
 * - Error context in logs (keys involved)
 * - Retry logic with configurable count
 * - Individual failure handling within batches
 * - Error tracking metrics
 * - Promise rejection behavior
 */

import { BatchLoader, BatchQueryError, BatchLoaderDisposedError } from '../../../../src/lib/database/optimized-queries';

// Mock the metrics module
jest.mock('../../../../src/lib/server-monitoring', () => ({
  metrics: {
    histogram: jest.fn(),
    increment: jest.fn(),
  },
}));

// Mock TTLPresets
jest.mock('../../../../src/lib/cache/cache-utils', () => ({
  TTLPresets: {
    SHORT: 300,
    MEDIUM: 900,
    LONG: 3600,
  },
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDelete: jest.fn(),
  CacheKeyGenerators: {
    user: (id: string) => `user:${id}`,
    workspace: (id: string) => `workspace:${id}`,
  },
}));

import { metrics } from '../../../../src/lib/server-monitoring';

describe('BatchLoader Error Handling', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('BatchQueryError class', () => {
    it('should create error with all context properties', () => {
      const originalError = new Error('Database connection failed');
      const keys = [1, 2, 3];
      const error = new BatchQueryError(
        'Batch query failed',
        keys,
        originalError,
        'user_loader',
        2
      );

      expect(error.name).toBe('BatchQueryError');
      expect(error.message).toBe('Batch query failed');
      expect(error.keys).toEqual([1, 2, 3]);
      expect(error.originalError).toBe(originalError);
      expect(error.operation).toBe('user_loader');
      expect(error.attemptNumber).toBe(2);
    });

    it('should default attemptNumber to 1', () => {
      const error = new BatchQueryError(
        'Test error',
        [],
        new Error('Original'),
        'test_op'
      );
      expect(error.attemptNumber).toBe(1);
    });
  });

  describe('Basic batch loading with errors', () => {
    it('should reject promises when batch function throws', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Database error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        trackMetrics: true,
      });

      await expect(loader.load(1)).rejects.toThrow(BatchQueryError);
      await expect(loader.load(2)).rejects.toThrow(BatchQueryError);
    });

    it('should include keys in error context', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      try {
        await loader.load(42);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BatchQueryError);
        const batchError = error as BatchQueryError;
        expect(batchError.keys).toContain(42);
        expect(batchError.operation).toBe('test_loader');
      }
    });

    it('should log detailed error information', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      await expect(loader.load(1)).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BatchLoader] Batch query error:'),
        expect.objectContaining({
          operation: 'test_loader',
          batchSize: 1,
        })
      );
    });
  });

  describe('Retry logic', () => {
    it('should retry failed queries up to retryCount times', async () => {
      const batchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce(new Map([[1, 'success']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        retryCount: 2,
      });

      const result = await loader.load(1);
      expect(result).toBe('success');
      expect(batchFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after exhausting all retries', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        retryCount: 2,
      });

      await expect(loader.load(1)).rejects.toThrow(BatchQueryError);
      expect(batchFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should log retry warnings', async () => {
      const batchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(new Map([[1, 'success']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        retryCount: 1,
      });

      await loader.load(1);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BatchLoader] Retrying batch query')
      );
    });

    it('should track retry metrics', async () => {
      const batchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(new Map([[1, 'success']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        retryCount: 1,
        trackMetrics: true,
      });

      await loader.load(1);

      expect(metrics.increment).toHaveBeenCalledWith('db.batch.retries', expect.any(Object));
    });

    it('should use exponential backoff between retries', async () => {
      // Test that retry delays increase with each attempt
      // We verify this by checking the calls happen and the backoff formula works
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: TimerHandler, delay?: number) => {
        if (delay !== undefined && delay > 0) {
          delays.push(delay);
        }
        // Call the function immediately for testing
        if (typeof fn === 'function') {
          fn();
        }
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      const batchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(new Map([[1, 'success']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        retryCount: 2,
      });

      const result = await loader.load(1);
      expect(result).toBe('success');
      expect(batchFn).toHaveBeenCalledTimes(3);

      // Verify exponential backoff: 100ms, 200ms
      expect(delays).toContain(100);
      expect(delays).toContain(200);

      jest.restoreAllMocks();
    });
  });

  describe('onError callback', () => {
    it('should call onError callback when error occurs', async () => {
      const onError = jest.fn();
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        onError,
      });

      await expect(loader.load(1)).rejects.toThrow();

      expect(onError).toHaveBeenCalledWith(
        expect.any(BatchQueryError),
        [1]
      );
    });

    it('should pass correct keys to onError callback', async () => {
      const onError = jest.fn();
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<string, string>(batchFn, {
        cachePrefix: 'test_loader',
        onError,
      });

      // Schedule multiple loads
      const promise1 = loader.load('key1');
      const promise2 = loader.load('key2');
      const promise3 = loader.load('key3');

      await expect(Promise.all([promise1, promise2, promise3])).rejects.toThrow();

      expect(onError).toHaveBeenCalledWith(
        expect.any(BatchQueryError),
        expect.arrayContaining(['key1', 'key2', 'key3'])
      );
    });

    it('should handle errors in onError callback gracefully', async () => {
      const onError = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        onError,
      });

      await expect(loader.load(1)).rejects.toThrow(BatchQueryError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BatchLoader] Error in onError callback:',
        expect.any(Error)
      );
    });
  });

  describe('Metrics tracking', () => {
    it('should track error metrics with error type', async () => {
      class CustomError extends Error {
        name = 'CustomDatabaseError';
      }
      const batchFn = jest.fn().mockRejectedValue(new CustomError('Custom error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        trackMetrics: true,
      });

      await expect(loader.load(1)).rejects.toThrow();

      expect(metrics.increment).toHaveBeenCalledWith('db.batch.errors', {
        operation: 'test_loader',
        attempt: '1',
        error_type: 'CustomDatabaseError',
      });
    });

    it('should track error timing metrics', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        trackMetrics: true,
      });

      await expect(loader.load(1)).rejects.toThrow();

      expect(metrics.histogram).toHaveBeenCalledWith(
        'db.batch.error_time',
        expect.any(Number),
        expect.objectContaining({
          operation: 'test_loader',
          attempt: '1',
        })
      );
    });

    it('should track final failure metrics after all retries exhausted', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        trackMetrics: true,
        retryCount: 1,
      });

      await expect(loader.load(1)).rejects.toThrow();

      expect(metrics.increment).toHaveBeenCalledWith('db.batch.final_failures', {
        operation: 'test_loader',
        batch_size: '1',
      });
    });

    it('should track successful query metrics with attempt number', async () => {
      const batchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(new Map([[1, 'success']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        trackMetrics: true,
        retryCount: 1,
      });

      await loader.load(1);

      expect(metrics.histogram).toHaveBeenCalledWith(
        'db.batch.query_time',
        expect.any(Number),
        expect.objectContaining({
          operation: 'test_loader',
          attempt: '2',
        })
      );
    });
  });

  describe('Promise rejection behavior', () => {
    it('should reject with BatchQueryError instead of resolving to null', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Query failed'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      const result = loader.load(1);

      await expect(result).rejects.toBeInstanceOf(BatchQueryError);
      await expect(result).rejects.not.toEqual(null);
    });

    it('should reject each key with individual error containing key info', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Batch failed'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      const promise1 = loader.load(1);
      const promise2 = loader.load(2);

      try {
        await promise1;
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BatchQueryError);
        const batchError = error as BatchQueryError;
        expect(batchError.keys).toContain(1);
      }

      try {
        await promise2;
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BatchQueryError);
        const batchError = error as BatchQueryError;
        expect(batchError.keys).toContain(2);
      }
    });
  });

  describe('Cache behavior with errors', () => {
    it('should not cache failed results', async () => {
      let callCount = 0;
      const batchFn = jest.fn().mockImplementation(async (keys: number[]) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call fails');
        }
        return new Map(keys.map(k => [k, `value-${k}`]));
      });

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      // First call fails
      await expect(loader.load(1)).rejects.toThrow();

      // Second call should retry (not use cache)
      const result = await loader.load(1);
      expect(result).toBe('value-1');
    });

    it('should cache successful results after retry', async () => {
      const batchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(new Map([[1, 'cached-value']]))
        .mockResolvedValueOnce(new Map([[1, 'new-value']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        retryCount: 1,
      });

      // First load succeeds after retry
      const result1 = await loader.load(1);
      expect(result1).toBe('cached-value');

      // Second load uses cache
      const result2 = await loader.load(1);
      expect(result2).toBe('cached-value');
      expect(batchFn).toHaveBeenCalledTimes(2); // Only 2 calls (initial fail + retry success)
    });
  });

  describe('Multiple keys formatting', () => {
    it('should format small key arrays completely', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      const promises = [1, 2, 3].map(k => loader.load(k));
      await expect(Promise.all(promises)).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: '[1,2,3]',
        })
      );
    });

    it('should truncate large key arrays in logs', async () => {
      const batchFn = jest.fn().mockRejectedValue(new Error('Test error'));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      const largeKeyArray = Array.from({ length: 15 }, (_, i) => i);
      const promises = largeKeyArray.map(k => loader.load(k));
      await expect(Promise.all(promises)).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: expect.stringContaining('... and 5 more'),
        })
      );
    });
  });

  describe('Cache management methods', () => {
    it('should clear specific key from cache', async () => {
      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'first']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      await loader.load(1);
      loader.clear(1);

      // Need to call load again
      batchFn.mockResolvedValueOnce(new Map([[1, 'second']]));
      const result = await loader.load(1);
      expect(result).toBe('second');
      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should clear multiple keys from cache', async () => {
      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'v1'], [2, 'v2'], [3, 'v3']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);
      loader.clearMany([1, 2]);

      batchFn.mockResolvedValueOnce(new Map([[1, 'new1'], [2, 'new2']]));
      const results = await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);

      expect(results).toEqual(['new1', 'new2', 'v3']); // 3 still cached
    });

    it('should clear all cache with clearAll', async () => {
      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'v1'], [2, 'v2']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      await Promise.all([loader.load(1), loader.load(2)]);
      loader.clearAll();

      batchFn.mockResolvedValueOnce(new Map([[1, 'new1'], [2, 'new2']]));
      const results = await Promise.all([loader.load(1), loader.load(2)]);

      expect(results).toEqual(['new1', 'new2']);
      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should prime cache with value', async () => {
      const batchFn = jest.fn();

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      loader.prime(1, 'primed-value');
      const result = await loader.load(1);

      expect(result).toBe('primed-value');
      expect(batchFn).not.toHaveBeenCalled();
    });
  });

  describe('Memory management - dispose()', () => {
    it('should clear all internal state on dispose', async () => {
      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'v1'], [2, 'v2']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
      });

      // Load some values to populate cache
      await Promise.all([loader.load(1), loader.load(2)]);
      expect(loader.getCacheSize()).toBe(2);

      // Dispose
      loader.dispose();

      // Verify state is cleared
      expect(loader.getCacheSize()).toBe(0);
      expect(loader.getPendingSize()).toBe(0);
      expect(loader.isDisposed()).toBe(true);
    });

    it('should be idempotent - calling dispose multiple times is safe', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      // Should not throw
      loader.dispose();
      loader.dispose();
      loader.dispose();

      expect(loader.isDisposed()).toBe(true);
    });

    it('should throw BatchLoaderDisposedError on load() after dispose', async () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      await expect(loader.load(1)).rejects.toThrow(BatchLoaderDisposedError);
      await expect(loader.load(1)).rejects.toThrow('BatchLoader has been disposed');
    });

    it('should throw BatchLoaderDisposedError on loadMany() after dispose', async () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      await expect(loader.loadMany([1, 2, 3])).rejects.toThrow(BatchLoaderDisposedError);
    });

    it('should throw BatchLoaderDisposedError on clear() after dispose', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      expect(() => loader.clear(1)).toThrow(BatchLoaderDisposedError);
      expect(() => loader.clear()).toThrow(BatchLoaderDisposedError);
    });

    it('should throw BatchLoaderDisposedError on clearMany() after dispose', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      expect(() => loader.clearMany([1, 2])).toThrow(BatchLoaderDisposedError);
    });

    it('should throw BatchLoaderDisposedError on clearAll() after dispose', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      expect(() => loader.clearAll()).toThrow(BatchLoaderDisposedError);
    });

    it('should throw BatchLoaderDisposedError on prime() after dispose', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      expect(() => loader.prime(1, 'value')).toThrow(BatchLoaderDisposedError);
    });

    it('should throw BatchLoaderDisposedError on primeMany() after dispose', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
      });

      loader.dispose();

      expect(() => loader.primeMany(new Map([[1, 'v1']]))).toThrow(BatchLoaderDisposedError);
    });
  });

  describe('Memory management - TTL eviction', () => {
    it('should return number of expired entries cleaned up', async () => {
      // Use a very short TTL and real timers with manual Date.now mocking
      const originalDateNow = Date.now;
      let mockNow = originalDateNow();
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'v1'], [2, 'v2'], [3, 'v3']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        cacheTTL: 1, // 1 second TTL
      });

      try {
        // Load values
        await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);
        expect(loader.getCacheSize()).toBe(3);

        // Advance mock time past TTL
        mockNow += 2000;

        // Manually trigger cleanup
        const cleaned = loader.cleanupExpiredEntries();

        expect(cleaned).toBe(3);
        expect(loader.getCacheSize()).toBe(0);
      } finally {
        jest.spyOn(Date, 'now').mockRestore();
        loader.dispose();
      }
    });

    it('should not clean up entries that have not expired', async () => {
      const originalDateNow = Date.now;
      let mockNow = originalDateNow();
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'v1'], [2, 'v2']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        cacheTTL: 60, // 60 seconds TTL
      });

      try {
        await Promise.all([loader.load(1), loader.load(2)]);
        expect(loader.getCacheSize()).toBe(2);

        // Advance time but not past TTL (only 30 seconds)
        mockNow += 30000;

        const cleaned = loader.cleanupExpiredEntries();

        expect(cleaned).toBe(0);
        expect(loader.getCacheSize()).toBe(2);
      } finally {
        jest.spyOn(Date, 'now').mockRestore();
        loader.dispose();
      }
    });

    it('should return 0 when cleanupExpiredEntries called after dispose', () => {
      const loader = new BatchLoader<number, string>(jest.fn(), {
        cachePrefix: 'test_loader',
        cacheTTL: 60,
      });

      loader.dispose();

      // Should not throw, just return 0
      const cleaned = loader.cleanupExpiredEntries();
      expect(cleaned).toBe(0);
    });

    it('should evict expired entries on access', async () => {
      const originalDateNow = Date.now;
      let mockNow = originalDateNow();
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      const batchFn = jest.fn()
        .mockResolvedValueOnce(new Map([[1, 'v1']]));

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        cacheTTL: 1, // 1 second TTL
      });

      try {
        // Load a value
        await loader.load(1);
        expect(loader.getCacheSize()).toBe(1);

        // Advance time past TTL
        mockNow += 2000;

        // Next load should refetch
        batchFn.mockResolvedValueOnce(new Map([[1, 'new-v1']]));
        const result = await loader.load(1);

        expect(result).toBe('new-v1');
        expect(batchFn).toHaveBeenCalledTimes(2);
      } finally {
        jest.spyOn(Date, 'now').mockRestore();
        loader.dispose();
      }
    });
  });

  describe('Memory management - LRU eviction', () => {
    it('should evict least recently used entries when cache exceeds maxCacheSize', async () => {
      const batchFn = jest.fn()
        .mockImplementation(async (keys: number[]) => {
          return new Map(keys.map(k => [k, `value-${k}`]));
        });

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        maxCacheSize: 3,
      });

      // Load 3 items - should all fit
      await loader.load(1);
      await loader.load(2);
      await loader.load(3);
      expect(loader.getCacheSize()).toBe(3);

      // Access item 1 to make it recently used
      await loader.load(1);

      // Load item 4 - should evict item 2 (least recently used)
      await loader.load(4);
      expect(loader.getCacheSize()).toBe(3);

      // Item 1 should still be cached (was accessed recently)
      batchFn.mockClear();
      await loader.load(1);
      expect(batchFn).not.toHaveBeenCalled();

      // Item 2 should have been evicted
      batchFn.mockResolvedValueOnce(new Map([[2, 'new-value-2']]));
      const result = await loader.load(2);
      expect(result).toBe('new-value-2');
      expect(batchFn).toHaveBeenCalledWith([2]);
    });

    it('should not evict when cache is at or below maxCacheSize', async () => {
      const batchFn = jest.fn()
        .mockImplementation(async (keys: number[]) => {
          return new Map(keys.map(k => [k, `value-${k}`]));
        });

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        maxCacheSize: 5,
      });

      // Load 3 items - should all fit without eviction
      await loader.load(1);
      await loader.load(2);
      await loader.load(3);

      expect(loader.getCacheSize()).toBe(3);

      // All should still be cached
      batchFn.mockClear();
      await loader.load(1);
      await loader.load(2);
      await loader.load(3);
      expect(batchFn).not.toHaveBeenCalled();
    });

    it('should not perform LRU eviction when maxCacheSize is not set', async () => {
      const batchFn = jest.fn()
        .mockImplementation(async (keys: number[]) => {
          return new Map(keys.map(k => [k, `value-${k}`]));
        });

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        // No maxCacheSize set
      });

      // Load many items
      for (let i = 1; i <= 100; i++) {
        await loader.load(i);
      }

      // All should be cached
      expect(loader.getCacheSize()).toBe(100);
    });

    it('should handle primeMany with LRU eviction', async () => {
      const batchFn = jest.fn();

      const loader = new BatchLoader<number, string>(batchFn, {
        cachePrefix: 'test_loader',
        maxCacheSize: 3,
      });

      // Prime 5 items - should evict oldest 2
      loader.primeMany(new Map([
        [1, 'v1'],
        [2, 'v2'],
        [3, 'v3'],
        [4, 'v4'],
        [5, 'v5'],
      ]));

      expect(loader.getCacheSize()).toBe(3);
    });
  });
});
