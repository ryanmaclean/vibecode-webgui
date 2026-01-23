/**
 * Tests for Cache Utilities
 *
 * Tests TTL expiration, cache key generation, delete operations,
 * and various cache scenarios.
 */

// Mock modules before any imports using factory pattern
jest.mock('../unified-cache-client', () => {
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockDel = jest.fn();
  const mockKeys = jest.fn();

  return {
    cache: {
      get: mockGet,
      set: mockSet,
      del: mockDel,
      keys: mockKeys,
    },
    CacheKeys: {},
    CacheTTL: {
      SHORT: 300,
      MEDIUM: 1800,
      LONG: 3600,
    },
    __mockGet: mockGet,
    __mockSet: mockSet,
    __mockDel: mockDel,
    __mockKeys: mockKeys,
  };
});

jest.mock('../cache-constants', () => ({
  CacheTTL: {
    SHORT: 300,
    MEDIUM: 1800,
    LONG: 3600,
    VERY_LONG: 86400,
  },
  CACHE_PREFIXES: {
    VECTOR: 'vector:',
    QUERY: 'query:',
    SESSION: 'session:',
    USER: 'user:',
    EMBEDDING: 'embedding:',
  },
}));

jest.mock('../../server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
  },
}));

// Now import the modules under test
import {
  generateCacheKey,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheGetOrSet,
  withCaching,
  CacheKeyGenerators,
  CacheInvalidators,
  TTLPresets,
  getMemoryCacheStats,
  clearMemoryCache,
} from '../cache-utils';
import { metrics } from '../../server-monitoring';
import * as unifiedCache from '../unified-cache-client';

const mockedMetrics = metrics as jest.Mocked<typeof metrics>;

// Get mock functions from the module
const getMocks = () => {
  const mod = unifiedCache as unknown as {
    __mockGet: jest.Mock;
    __mockSet: jest.Mock;
    __mockDel: jest.Mock;
    __mockKeys: jest.Mock;
  };
  return {
    mockGet: mod.__mockGet,
    mockSet: mod.__mockSet,
    mockDel: mod.__mockDel,
    mockKeys: mod.__mockKeys,
  };
};

describe('Cache Utils', () => {
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockDel: jest.Mock;
  let mockKeys: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = getMocks();
    mockGet = mocks.mockGet;
    mockSet = mocks.mockSet;
    mockDel = mocks.mockDel;
    mockKeys = mocks.mockKeys;
    mockGet.mockReset();
    mockSet.mockReset();
    mockDel.mockReset();
    mockKeys.mockReset();
    clearMemoryCache();
  });

  describe('generateCacheKey', () => {
    it('should join parts with colons', () => {
      const key = generateCacheKey(['user', '123', 'profile']);
      expect(key).toBe('user:123:profile');
    });

    it('should add prefix when provided', () => {
      const key = generateCacheKey(['123', 'settings'], 'user:');
      expect(key).toBe('user:123:settings');
    });

    it('should handle single part', () => {
      const key = generateCacheKey(['single']);
      expect(key).toBe('single');
    });

    it('should handle empty parts array', () => {
      const key = generateCacheKey([]);
      expect(key).toBe('');
    });

    it('should handle special characters in parts', () => {
      const key = generateCacheKey(['api', 'v1/users', 'data']);
      expect(key).toBe('api:v1/users:data');
    });
  });

  describe('CacheKeyGenerators', () => {
    it('should generate user cache key', () => {
      const key = CacheKeyGenerators.user('123');
      expect(key).toContain('user');
      expect(key).toContain('123');
    });

    it('should generate workspace cache key', () => {
      const key = CacheKeyGenerators.workspace('ws-456');
      expect(key).toContain('workspace');
      expect(key).toContain('ws-456');
    });

    it('should generate userPreferences cache key', () => {
      const key = CacheKeyGenerators.userPreferences(789);
      expect(key).toContain('preferences');
      expect(key).toContain('789');
    });

    it('should generate templates cache key', () => {
      const key = CacheKeyGenerators.templates();
      expect(key).toContain('templates');
    });

    it('should generate featureFlag cache key', () => {
      const key = CacheKeyGenerators.featureFlag('dark-mode', 'user-123');
      expect(key).toContain('feature');
      expect(key).toContain('dark-mode');
      expect(key).toContain('user-123');
    });

    it('should generate apiResponse cache key', () => {
      const key = CacheKeyGenerators.apiResponse('/api/users');
      expect(key).toContain('api');
      expect(key).toContain('/api/users');
    });

    it('should generate apiResponse cache key with params', () => {
      const key1 = CacheKeyGenerators.apiResponse('/api/users', 'page=1');
      const key2 = CacheKeyGenerators.apiResponse('/api/users', 'page=2');
      expect(key1).not.toBe(key2);
    });

    it('should generate dbQuery cache key', () => {
      const key = CacheKeyGenerators.dbQuery('users', 'findMany');
      expect(key).toContain('users');
      expect(key).toContain('findMany');
    });

    it('should generate session cache key', () => {
      const key = CacheKeyGenerators.session('session-abc');
      expect(key).toContain('session');
      expect(key).toContain('session-abc');
    });
  });

  describe('TTLPresets', () => {
    it('should have VERY_SHORT preset', () => {
      expect(TTLPresets.VERY_SHORT).toBe(60);
    });

    it('should have SHORT preset', () => {
      expect(TTLPresets.SHORT).toBe(300);
    });

    it('should have MEDIUM preset', () => {
      expect(TTLPresets.MEDIUM).toBe(1800);
    });

    it('should have LONG preset', () => {
      expect(TTLPresets.LONG).toBe(3600);
    });

    it('should have VERY_LONG preset', () => {
      expect(TTLPresets.VERY_LONG).toBe(86400);
    });

    it('should have TEMPLATES preset', () => {
      expect(TTLPresets.TEMPLATES).toBe(7200);
    });

    it('should have USER_PREFERENCES preset', () => {
      expect(TTLPresets.USER_PREFERENCES).toBe(900);
    });

    it('should have FEATURE_FLAGS preset', () => {
      expect(TTLPresets.FEATURE_FLAGS).toBe(600);
    });

    it('should have HEALTH_CHECK preset', () => {
      expect(TTLPresets.HEALTH_CHECK).toBe(30);
    });

    it('should have SESSION preset', () => {
      expect(TTLPresets.SESSION).toBe(3600);
    });
  });

  describe('cacheGet', () => {
    it('should return value from Redis on hit', async () => {
      const cachedValue = { id: 1, name: 'Test' };
      mockGet.mockResolvedValue(cachedValue);

      const result = await cacheGet('test-key');

      expect(result).toEqual(cachedValue);
      expect(mockGet).toHaveBeenCalledWith('test-key');
    });

    it('should return null on cache miss', async () => {
      mockGet.mockResolvedValue(null);

      const result = await cacheGet('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should track cache hit metrics', async () => {
      mockGet.mockResolvedValue({ data: 'test' });

      await cacheGet('test-key', { trackMetrics: true });

      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.unified.hit', {
        source: 'redis',
      });
    });

    it('should track cache miss metrics', async () => {
      mockGet.mockResolvedValue(null);

      await cacheGet('missing-key', { trackMetrics: true });

      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.unified.miss');
    });

    it('should fall back to memory cache when Redis fails', async () => {
      mockGet.mockRejectedValue(new Error('Redis error'));

      const result = await cacheGet('test-key', { useMemoryFallback: true });

      // Should not throw, returns null since memory cache is empty
      expect(result).toBeNull();
    });

    it('should track duration metrics', async () => {
      mockGet.mockResolvedValue(null);

      await cacheGet('test-key', { trackMetrics: true });

      expect(mockedMetrics.histogram).toHaveBeenCalledWith(
        'cache.unified.get.duration',
        expect.any(Number)
      );
    });

    it('should not track metrics when disabled', async () => {
      mockGet.mockResolvedValue({ data: 'test' });

      await cacheGet('test-key', { trackMetrics: false });

      expect(mockedMetrics.increment).not.toHaveBeenCalled();
      expect(mockedMetrics.histogram).not.toHaveBeenCalled();
    });
  });

  describe('cacheSet', () => {
    it('should set value in Redis', async () => {
      mockSet.mockResolvedValue(true);

      const result = await cacheSet('test-key', { id: 1 });

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        { id: 1 },
        expect.any(Number)
      );
    });

    it('should use custom TTL', async () => {
      mockSet.mockResolvedValue(true);

      await cacheSet('test-key', { id: 1 }, { ttl: 600 });

      expect(mockSet).toHaveBeenCalledWith('test-key', { id: 1 }, 600);
    });

    it('should use default TTL when not specified', async () => {
      mockSet.mockResolvedValue(true);

      await cacheSet('test-key', { id: 1 });

      // Default TTL is MEDIUM (1800)
      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        { id: 1 },
        1800
      );
    });

    it('should fall back to memory cache when Redis fails', async () => {
      mockSet.mockRejectedValue(new Error('Redis error'));

      const result = await cacheSet('test-key', { id: 1 }, {
        useMemoryFallback: true,
      });

      // Should succeed using memory fallback
      expect(result).toBe(true);
    });

    it('should track set metrics', async () => {
      mockSet.mockResolvedValue(true);

      await cacheSet('test-key', { id: 1 }, { trackMetrics: true });

      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.unified.set', {
        success: 'true',
      });
    });
  });

  describe('cacheDelete', () => {
    it('should delete key from Redis', async () => {
      mockDel.mockResolvedValue(true);

      const result = await cacheDelete('test-key');

      expect(result).toBe(true);
      expect(mockDel).toHaveBeenCalledWith('test-key');
    });

    it('should handle Redis deletion failure gracefully', async () => {
      mockDel.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      const result = await cacheDelete('test-key');

      expect(result).toBe(true); // Memory cache deletion succeeds
    });
  });

  describe('cacheDeletePattern', () => {
    it('should delete keys matching pattern', async () => {
      mockKeys.mockResolvedValue(['user:1', 'user:2', 'user:3']);
      mockDel.mockResolvedValue(true);

      const result = await cacheDeletePattern('user:*');

      expect(result).toBeGreaterThanOrEqual(0);
      expect(mockKeys).toHaveBeenCalledWith('user:*');
    });

    it('should handle empty key list', async () => {
      mockKeys.mockResolvedValue([]);

      const result = await cacheDeletePattern('nonexistent:*');

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle Redis failure gracefully', async () => {
      mockKeys.mockRejectedValue(new Error('Redis error'));

      // Should not throw, falls back to memory cache
      const result = await cacheDeletePattern('user:*');

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cacheGetOrSet', () => {
    it('should return cached value if available', async () => {
      const cachedValue = { id: 1, name: 'Cached' };
      mockGet.mockResolvedValue(cachedValue);

      const factory = jest.fn().mockResolvedValue({ id: 1, name: 'Fresh' });

      const result = await cacheGetOrSet('test-key', factory);

      expect(result).toEqual(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      mockGet.mockResolvedValue(null);
      mockSet.mockResolvedValue(true);

      const freshValue = { id: 1, name: 'Fresh' };
      const factory = jest.fn().mockResolvedValue(freshValue);

      const result = await cacheGetOrSet('test-key', factory);

      expect(result).toEqual(freshValue);
      expect(factory).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        freshValue,
        expect.any(Number)
      );
    });

    it('should pass options to underlying cache operations', async () => {
      mockGet.mockResolvedValue(null);
      mockSet.mockResolvedValue(true);

      const factory = jest.fn().mockResolvedValue({ data: 'test' });

      await cacheGetOrSet('test-key', factory, { ttl: 600 });

      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        { data: 'test' },
        600
      );
    });
  });

  describe('withCaching decorator', () => {
    it('should cache function results', async () => {
      mockGet.mockResolvedValue(null);
      mockSet.mockResolvedValue(true);

      const originalFn = jest.fn().mockResolvedValue({ result: 'computed' });
      const keyGen = (id: number) => `fn:${id}`;

      const cachedFn = withCaching(originalFn, keyGen);

      // First call - computes and caches
      const result1 = await cachedFn(123);
      expect(result1).toEqual({ result: 'computed' });
      expect(originalFn).toHaveBeenCalledWith(123);

      // Simulate cache hit on second call
      mockGet.mockResolvedValue({ result: 'computed' });

      const result2 = await cachedFn(123);
      expect(result2).toEqual({ result: 'computed' });
      // Original function should only be called once
      expect(originalFn).toHaveBeenCalledTimes(1);
    });

    it('should use custom key generator', async () => {
      mockGet.mockResolvedValue(null);
      mockSet.mockResolvedValue(true);

      const originalFn = jest.fn().mockResolvedValue('result');
      const keyGen = (a: string, b: number) => `custom:${a}:${b}`;

      const cachedFn = withCaching(originalFn, keyGen);

      await cachedFn('test', 42);

      expect(mockGet).toHaveBeenCalledWith('custom:test:42');
    });
  });

  describe('CacheInvalidators', () => {
    beforeEach(() => {
      mockKeys.mockResolvedValue([]);
      mockDel.mockResolvedValue(true);
    });

    it('should invalidate user cache', async () => {
      await CacheInvalidators.invalidateUser('user-123');

      expect(mockKeys).toHaveBeenCalledWith(
        expect.stringContaining('user-123')
      );
    });

    it('should invalidate workspace cache', async () => {
      await CacheInvalidators.invalidateWorkspace('ws-456');

      expect(mockKeys).toHaveBeenCalledWith(
        expect.stringContaining('workspace:ws-456')
      );
    });

    it('should invalidate templates cache', async () => {
      await CacheInvalidators.invalidateTemplates();

      expect(mockDel).toHaveBeenCalled();
    });

    it('should invalidate feature flag for specific user', async () => {
      await CacheInvalidators.invalidateFeatureFlag('dark-mode', 'user-123');

      expect(mockDel).toHaveBeenCalled();
    });

    it('should invalidate all feature flag caches when no user specified', async () => {
      await CacheInvalidators.invalidateFeatureFlag('dark-mode');

      expect(mockKeys).toHaveBeenCalledWith(
        expect.stringContaining('dark-mode')
      );
    });
  });

  describe('Memory Cache Stats', () => {
    it('should return memory cache statistics', () => {
      const stats = getMemoryCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxEntries');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxEntries).toBe('number');
    });

    it('should clear memory cache', () => {
      clearMemoryCache();

      const stats = getMemoryCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('TTL Expiration', () => {
    it('should respect TTL when setting cache', async () => {
      mockSet.mockResolvedValue(true);

      await cacheSet('test-key', { data: 'test' }, { ttl: TTLPresets.SHORT });

      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        { data: 'test' },
        300 // SHORT = 5 minutes = 300 seconds
      );
    });

    it('should use VERY_LONG TTL for persistent data', async () => {
      mockSet.mockResolvedValue(true);

      await cacheSet('persistent-key', { data: 'persistent' }, {
        ttl: TTLPresets.VERY_LONG,
      });

      expect(mockSet).toHaveBeenCalledWith(
        'persistent-key',
        { data: 'persistent' },
        86400 // VERY_LONG = 24 hours = 86400 seconds
      );
    });
  });
});
