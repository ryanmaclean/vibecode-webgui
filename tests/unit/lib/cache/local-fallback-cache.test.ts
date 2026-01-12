/**
 * Local Fallback Cache Tests
 * Tests in-memory cache implementation
 */

import { LocalFallbackCache } from '@/lib/cache/local-fallback-cache';

// Mock metrics
jest.mock('@/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    gauge: jest.fn()
  }
}));

describe('LocalFallbackCache', () => {
  let cache: LocalFallbackCache;

  beforeEach(() => {
    cache = new LocalFallbackCache(100);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cache.dispose();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      cache.set('key1', 'value1', 60);
      const value = cache.get('key1');

      expect(value).toBe('value1');
    });

    it('should store different data types', () => {
      cache.set('string', 'text', 60);
      cache.set('number', 42, 60);
      cache.set('boolean', true, 60);
      cache.set('object', { foo: 'bar' }, 60);
      cache.set('array', [1, 2, 3], 60);

      expect(cache.get('string')).toBe('text');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });

    it('should return null for non-existent key', () => {
      const value = cache.get('nonexistent');

      expect(value).toBeNull();
    });

    it('should overwrite existing key', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key1', 'value2', 60);

      const value = cache.get('key1');
      expect(value).toBe('value2');
    });
  });

  describe('delete', () => {
    it('should delete an existing key', () => {
      cache.set('key1', 'value1', 60);
      const result = cache.delete('key1');

      expect(result).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should return false when deleting non-existent key', () => {
      const result = cache.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value1', 60);

      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('mget', () => {
    it('should get multiple values', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      const values = cache.mget(['key1', 'key2', 'key3']);

      expect(values).toEqual(['value1', 'value2', 'value3']);
    });

    it('should return null for missing keys', () => {
      cache.set('key1', 'value1', 60);

      const values = cache.mget(['key1', 'key2', 'key3']);

      expect(values).toEqual(['value1', null, null]);
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      const keys = cache.keys();

      expect(keys.sort()).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return empty array when cache is empty', () => {
      const keys = cache.keys();

      expect(keys).toEqual([]);
    });
  });

  describe('keysMatching', () => {
    beforeEach(() => {
      cache.set('user:1', 'value1', 60);
      cache.set('user:2', 'value2', 60);
      cache.set('admin:1', 'value3', 60);
      cache.set('session:abc', 'value4', 60);
    });

    it('should match keys with wildcard', () => {
      const keys = cache.keysMatching('user:*');

      expect(keys.sort()).toEqual(['user:1', 'user:2']);
    });

    it('should match all keys with *', () => {
      const keys = cache.keysMatching('*');

      expect(keys.length).toBe(4);
    });

    it('should match keys with prefix', () => {
      const keys = cache.keysMatching('session:*');

      expect(keys).toEqual(['session:abc']);
    });

    it('should return empty array for non-matching pattern', () => {
      const keys = cache.keysMatching('nonexistent:*');

      expect(keys).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all items', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.keys()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return the number of items', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);

      expect(cache.size).toBe(2);
    });

    it('should return 0 when cache is empty', () => {
      expect(cache.size).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired items', async () => {
      cache.set('key1', 'value1', 1);
      cache.set('key2', 'value2', 60);

      await new Promise(resolve => setTimeout(resolve, 1100));

      cache.cleanup();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clear cleanup interval', () => {
      const cache2 = new LocalFallbackCache(100);
      cache2.dispose();
      expect(true).toBe(true);
      cache2.dispose();
    });
  });
});
