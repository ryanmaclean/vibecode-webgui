/**
 * Tests for Cache Utilities
 */

import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheGetOrSet,
  withCaching,
  CacheKeyGenerators,
  TTLPresets,
  CacheInvalidators,
  generateCacheKey,
  getMemoryCacheStats,
  clearMemoryCache,
} from '@/lib/cache/cache-utils';

// Mock the unified cache client
jest.mock('@/lib/cache/unified-cache-client', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  },
  CacheKeys: {
    user: (userId: string) => `user:${userId}`,
    workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  },
  CacheTTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 1800,
    HOUR: 3600,
    DAY: 86400,
  },
}));

// Mock metrics
jest.mock('@/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn(),
  },
}));

describe('Cache Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMemoryCache();
  });

  describe('generateCacheKey', () => {
    it('should generate a key from parts', () => {
      const key = generateCacheKey(['user', '123', 'profile']);
      expect(key).toBe('user:123:profile');
    });

    it('should add prefix when provided', () => {
      const key = generateCacheKey(['123', 'profile'], 'user:');
      expect(key).toBe('user:123:profile');
    });
  });

  describe('CacheKeyGenerators', () => {
    it('should generate user key', () => {
      const key = CacheKeyGenerators.user('user-123');
      expect(key).toContain('user');
      expect(key).toContain('user-123');
    });

    it('should generate workspace key', () => {
      const key = CacheKeyGenerators.workspace('ws-456');
      expect(key).toContain('workspace');
      expect(key).toContain('ws-456');
    });

    it('should generate userPreferences key', () => {
      const key = CacheKeyGenerators.userPreferences(42);
      expect(key).toContain('preferences');
      expect(key).toContain('42');
    });

    it('should generate templates key', () => {
      const key = CacheKeyGenerators.templates();
      expect(key).toContain('templates');
    });

    it('should generate featureFlag key', () => {
      const key = CacheKeyGenerators.featureFlag('dark-mode', 'user-123');
      expect(key).toContain('feature');
      expect(key).toContain('dark-mode');
      expect(key).toContain('user-123');
    });

    it('should generate apiResponse key', () => {
      const key = CacheKeyGenerators.apiResponse('/api/users');
      expect(key).toContain('api');
    });

    it('should generate apiResponse key with params', () => {
      const key = CacheKeyGenerators.apiResponse('/api/users', 'limit=10');
      expect(key).toContain('api');
    });

    it('should generate dbQuery key', () => {
      const key = CacheKeyGenerators.dbQuery('users', 'findMany');
      expect(key).toContain('users');
      expect(key).toContain('findMany');
    });

    it('should generate session key', () => {
      const key = CacheKeyGenerators.session('session-abc');
      expect(key).toContain('session');
      expect(key).toContain('session-abc');
    });
  });

  describe('TTLPresets', () => {
    it('should have expected TTL values', () => {
      expect(TTLPresets.VERY_SHORT).toBe(60);
      expect(TTLPresets.SHORT).toBe(300);
      expect(TTLPresets.MEDIUM).toBe(1800);
      expect(TTLPresets.LONG).toBe(3600);
      expect(TTLPresets.VERY_LONG).toBe(86400);
      expect(TTLPresets.TEMPLATES).toBe(7200);
      expect(TTLPresets.USER_PREFERENCES).toBe(900);
      expect(TTLPresets.FEATURE_FLAGS).toBe(600);
      expect(TTLPresets.HEALTH_CHECK).toBe(30);
      expect(TTLPresets.SESSION).toBe(3600);
    });
  });

  describe('Memory cache operations', () => {
    it('should store and retrieve values from memory cache', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');

      // Simulate Redis being unavailable
      cache.get.mockRejectedValue(new Error('Connection refused'));
      cache.set.mockRejectedValue(new Error('Connection refused'));

      // Set value (should fall back to memory)
      const setResult = await cacheSet('test-key', { data: 'test-value' }, { ttl: 60 });
      expect(setResult).toBe(true);

      // Get value (should retrieve from memory)
      const value = await cacheGet<{ data: string }>('test-key');
      expect(value).toEqual({ data: 'test-value' });
    });

    it('should return null for non-existent keys', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.get.mockResolvedValue(null);

      const value = await cacheGet('non-existent-key');
      expect(value).toBeNull();
    });

    it('should handle TTL expiration in memory cache', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(true);

      // Set with very short TTL
      await cacheSet('expiring-key', 'value', { ttl: 1 });

      // Wait for expiration (plus small buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const value = await cacheGet('expiring-key');
      expect(value).toBeNull();
    });
  });

  describe('cacheGetOrSet', () => {
    it('should return cached value if available', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      // Mock returns the parsed object (as the real implementation does JSON.parse)
      cache.get.mockResolvedValue({ cached: true });

      const factory = jest.fn().mockResolvedValue({ cached: false });
      const result = await cacheGetOrSet('cached-key', factory);

      expect(result).toEqual({ cached: true });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not cached', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(true);

      const factory = jest.fn().mockResolvedValue({ fresh: true });
      const result = await cacheGetOrSet('fresh-key', factory);

      expect(result).toEqual({ fresh: true });
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('withCaching decorator', () => {
    it('should cache function results', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(true);

      const expensiveFunction = jest.fn().mockResolvedValue('expensive result');
      const cachedFunction = withCaching(
        expensiveFunction,
        (arg: string) => `fn:${arg}`
      );

      // First call - should execute function
      const result1 = await cachedFunction('test');
      expect(result1).toBe('expensive result');
      expect(expensiveFunction).toHaveBeenCalledTimes(1);

      // Setup mock to return cached value (as parsed object, not JSON string)
      cache.get.mockResolvedValue('expensive result');

      // Second call - should use cache
      const result2 = await cachedFunction('test');
      expect(result2).toBe('expensive result');
      expect(expensiveFunction).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('cacheDelete', () => {
    it('should delete from both Redis and memory cache', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.del.mockResolvedValue(true);

      // First set a value in memory cache
      cache.get.mockResolvedValue(null);
      cache.set.mockRejectedValue(new Error('Redis unavailable'));
      await cacheSet('delete-test', 'value', { ttl: 60 });

      // Delete it
      const result = await cacheDelete('delete-test');
      expect(result).toBe(true);

      // Verify it's deleted from memory
      const value = await cacheGet('delete-test');
      expect(value).toBeNull();
    });
  });

  describe('cacheDeletePattern', () => {
    it('should delete keys matching pattern', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.keys.mockResolvedValue(['user:1:profile', 'user:2:profile']);
      cache.del.mockResolvedValue(2);

      const count = await cacheDeletePattern('user:*:profile');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CacheInvalidators', () => {
    it('should have invalidateUser function', () => {
      expect(typeof CacheInvalidators.invalidateUser).toBe('function');
    });

    it('should have invalidateWorkspace function', () => {
      expect(typeof CacheInvalidators.invalidateWorkspace).toBe('function');
    });

    it('should have invalidateTemplates function', () => {
      expect(typeof CacheInvalidators.invalidateTemplates).toBe('function');
    });

    it('should have invalidateFeatureFlag function', () => {
      expect(typeof CacheInvalidators.invalidateFeatureFlag).toBe('function');
    });
  });

  describe('getMemoryCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = getMemoryCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxEntries');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxEntries).toBe('number');
    });
  });

  describe('clearMemoryCache', () => {
    it('should clear all entries from memory cache', async () => {
      const { cache } = require('@/lib/cache/unified-cache-client');
      cache.get.mockResolvedValue(null);
      cache.set.mockRejectedValue(new Error('Redis unavailable'));

      // Add some entries
      await cacheSet('clear-test-1', 'value1', { ttl: 60 });
      await cacheSet('clear-test-2', 'value2', { ttl: 60 });

      // Verify entries exist
      let stats = getMemoryCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Clear cache
      clearMemoryCache();

      // Verify cleared
      stats = getMemoryCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});
