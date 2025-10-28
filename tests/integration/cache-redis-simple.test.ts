/**
 * Simple integration test for cache invalidation with Redis backend
 * Focuses on core functionality with robust mocking
 */

import { ProductionVectorCacheInvalidator } from '../../src/lib/cache/production-vector-cache-invalidator';

// Mock the metrics module
jest.mock('../../src/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn()
  }
}));

/**
 * Redis-integrated cache invalidation system
 */
class SimplifiedRedisInvalidator extends ProductionVectorCacheInvalidator {
  private redis: any;
  private deletedKeys = new Set<string>();

  constructor(redisClient: any, config?: any) {
    super(config);
    this.redis = redisClient;
  }

  // Override the actual invalidation to use Redis
  protected async executeActualInvalidation(keys: string[]): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis client not available');
    }

    // Use Redis del command for each key
    for (const key of keys) {
      await this.redis.del(key);
      this.deletedKeys.add(key);
    }

    console.log(`✅ Redis invalidation completed: ${keys.length} keys processed`);
  }

  // Override pattern-based invalidation to use Redis KEYS directly
  public async invalidateByPattern(
    pattern: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
    source = 'pattern-invalidation'
  ): Promise<void> {
    if (!this.redis) {
      console.warn('Redis client not available for pattern invalidation');
      return;
    }

    try {
      console.log(`🔍 Finding keys matching pattern: ${pattern}`);
      const keys = await this.redis.keys(pattern);
      console.log(`🔍 Pattern "${pattern}" expanded to ${keys.length} keys: ${keys.join(', ')}`);
      
      if (keys.length > 0) {
        await this.invalidateCache(keys, priority, source, { pattern });
      } else {
        console.log(`No keys found for pattern: ${pattern}`);
      }
    } catch (error) {
      console.warn(`Failed to expand pattern "${pattern}":`, error);
    }
  }

  // Test helper methods
  async setTestData(key: string, value: string): Promise<void> {
    if (this.redis) {
      await this.redis.setex(key, 3600, value);
    }
  }

  async getTestData(key: string): Promise<string | null> {
    if (this.redis) {
      return await this.redis.get(key);
    }
    return null;
  }

  getDeletedKeys(): string[] {
    return Array.from(this.deletedKeys);
  }

  clearDeletedKeys(): void {
    this.deletedKeys.clear();
  }
}

describe('Cache Invalidation with Redis Backend - Simple Tests', () => {
  let invalidator: SimplifiedRedisInvalidator;
  let mockRedisClient: any;
  let mockCacheData: Map<string, string>;

  beforeEach(() => {
    // Create in-memory mock cache store
    mockCacheData = new Map();

    // Create comprehensive Redis mock
    mockRedisClient = {
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(mockCacheData.get(key) || null);
      }),
      
      setex: jest.fn().mockImplementation((key: string, ttl: number, value: string) => {
        mockCacheData.set(key, value);
        return Promise.resolve('OK');
      }),
      
      del: jest.fn().mockImplementation((key: string) => {
        const existed = mockCacheData.has(key);
        mockCacheData.delete(key);
        return Promise.resolve(existed ? 1 : 0);
      }),
      
      keys: jest.fn().mockImplementation((pattern: string) => {
        const allKeys = Array.from(mockCacheData.keys());
        if (pattern === '*') return Promise.resolve(allKeys);
        
        // Simple pattern matching for test
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Promise.resolve(allKeys.filter(key => regex.test(key)));
      }),
      
      ping: jest.fn().mockResolvedValue('PONG'),
      flushdb: jest.fn().mockImplementation(() => {
        mockCacheData.clear();
        return Promise.resolve('OK');
      })
    };

    invalidator = new SimplifiedRedisInvalidator(mockRedisClient, {
      batchSize: 5,
      batchTimeoutMs: 50,
      enableMetrics: false,
      enableLogging: true
    });
  });

  afterEach(() => {
    invalidator.clearDeletedKeys();
  });

  describe('Basic Cache Operations', () => {
    test('should invalidate individual cache keys', async () => {
      // Set up test data
      await invalidator.setTestData('user:123', 'Alice');
      await invalidator.setTestData('user:456', 'Bob');
      await invalidator.setTestData('cache:query1', 'search-results');

      // Verify data exists
      expect(await invalidator.getTestData('user:123')).toBe('Alice');
      expect(mockCacheData.size).toBe(3);

      // Invalidate specific keys
      await invalidator.invalidateCache(['user:123', 'cache:query1'], 'high', 'test');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify invalidation
      expect(await invalidator.getTestData('user:123')).toBeNull();
      expect(await invalidator.getTestData('cache:query1')).toBeNull();
      expect(await invalidator.getTestData('user:456')).toBe('Bob'); // Should remain

      // Verify Redis del was called
      expect(mockRedisClient.del).toHaveBeenCalledWith('user:123');
      expect(mockRedisClient.del).toHaveBeenCalledWith('cache:query1');
    });

    test('should handle batch invalidation efficiently', async () => {
      // Set up multiple test keys
      const testKeys = [];
      for (let i = 0; i < 10; i++) {
        const key = `batch:key:${i}`;
        await invalidator.setTestData(key, `value_${i}`);
        testKeys.push(key);
      }

      expect(mockCacheData.size).toBe(10);

      // Invalidate in batch
      await invalidator.invalidateCache(testKeys, 'medium', 'batch-test');

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all keys were invalidated
      for (const key of testKeys) {
        expect(await invalidator.getTestData(key)).toBeNull();
      }

      // Verify Redis del was called for each key
      expect(mockRedisClient.del).toHaveBeenCalledTimes(10);
    });

    test('should handle concurrent invalidation requests', async () => {
      // Set up test data for concurrent access
      for (let i = 0; i < 20; i++) {
        await invalidator.setTestData(`concurrent:${i}`, `data_${i}`);
      }

      // Launch concurrent invalidation requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          invalidator.invalidateCache([`concurrent:${i}`], 'medium', `concurrent-${i}`)
        );
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify concurrent invalidations worked
      for (let i = 0; i < 10; i++) {
        expect(await invalidator.getTestData(`concurrent:${i}`)).toBeNull();
      }

      // Remaining keys should still exist
      for (let i = 10; i < 20; i++) {
        expect(await invalidator.getTestData(`concurrent:${i}`)).toBe(`data_${i}`);
      }
    });
  });

  describe('Pattern-based Invalidation', () => {
    test('should invalidate by content type pattern', async () => {
      // Set up workspace-specific test data
      await invalidator.setTestData('workspace:ws1:config', 'config1');
      await invalidator.setTestData('workspace:ws1:file:main.ts', 'typescript-code');
      await invalidator.setTestData('workspace:ws2:config', 'config2');
      await invalidator.setTestData('user:session:123', 'session-data');

      expect(mockCacheData.size).toBe(4);

      // Invalidate workspace ws1 content
      await invalidator.invalidateByContentType('workspace', 'ws1', 'high');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify ws1 data invalidated but ws2 and user data remain
      expect(await invalidator.getTestData('workspace:ws1:config')).toBeNull();
      expect(await invalidator.getTestData('workspace:ws1:file:main.ts')).toBeNull();
      expect(await invalidator.getTestData('workspace:ws2:config')).toBe('config2');
      expect(await invalidator.getTestData('user:session:123')).toBe('session-data');
    });

    test('should handle workspace-wide invalidation', async () => {
      // Set up mixed workspace data
      await invalidator.setTestData('workspace:test123:config', 'workspace-config');
      await invalidator.setTestData('embedding:test123:chunk1', 'vector-data');
      await invalidator.setTestData('search:test123:query', 'search-results');
      await invalidator.setTestData('workspace:other:config', 'other-config');

      // Perform workspace invalidation
      await invalidator.invalidateWorkspace('test123', {
        contentTypes: ['workspace', 'embedding', 'search'],
        batchSize: 3
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify test123 workspace data invalidated
      expect(await invalidator.getTestData('workspace:test123:config')).toBeNull();
      expect(await invalidator.getTestData('embedding:test123:chunk1')).toBeNull();
      expect(await invalidator.getTestData('search:test123:query')).toBeNull();
      
      // Other workspace should remain
      expect(await invalidator.getTestData('workspace:other:config')).toBe('other-config');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle Redis operation failures gracefully', async () => {
      // Create failing Redis client
      const failingRedisClient = {
        ...mockRedisClient,
        del: jest.fn().mockRejectedValue(new Error('Redis operation failed'))
      };

      const failingInvalidator = new SimplifiedRedisInvalidator(failingRedisClient);

      await expect(
        failingInvalidator.invalidateCache(['test:key'], 'high', 'failure-test')
      ).rejects.toThrow('Redis operation failed');

      // Verify stats are still available
      const stats = failingInvalidator.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.circuitBreakerState).toBe('string');
    });

    test('should provide accurate statistics', async () => {
      // Perform various operations
      await invalidator.setTestData('stats:test1', 'value1');
      await invalidator.setTestData('stats:test2', 'value2');
      
      await invalidator.invalidateCache(['stats:test1'], 'high', 'stats-test');
      await invalidator.invalidateByPattern('stats:*', 'medium', 'stats-test');

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = invalidator.getStats();

      expect(stats).toHaveProperty('pendingInvalidations');
      expect(stats).toHaveProperty('queuedRequests');
      expect(stats).toHaveProperty('circuitBreakerState');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('isProcessing');

      expect(typeof stats.pendingInvalidations).toBe('number');
      expect(['closed', 'open', 'half_open']).toContain(stats.circuitBreakerState);
    });
  });

  describe('Performance Validation', () => {
    test('should handle moderate load efficiently', async () => {
      const startTime = Date.now();

      // Set up moderate dataset
      const keys = [];
      for (let i = 0; i < 50; i++) {
        const key = `perf:key:${i}`;
        await invalidator.setTestData(key, `value_${i}`);
        keys.push(key);
      }

      const setupTime = Date.now() - startTime;
      expect(setupTime).toBeLessThan(1000); // Setup should be fast

      // Invalidate in batches
      const invalidateStart = Date.now();
      
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        batches.push(
          invalidator.invalidateCache(batch, 'medium', `perf-batch-${i/batchSize}`)
        );
      }

      await Promise.all(batches);
      await new Promise(resolve => setTimeout(resolve, 200));

      const invalidateTime = Date.now() - invalidateStart;
      expect(invalidateTime).toBeLessThan(2000); // Should complete quickly

      // Verify all keys invalidated
      for (const key of keys) {
        expect(await invalidator.getTestData(key)).toBeNull();
      }
    });
  });

  describe('Integration Completeness', () => {
    test('should demonstrate full cache lifecycle', async () => {
      console.log('🧪 Testing complete cache lifecycle...');

      // 1. Populate cache
      const cacheData = {
        'user:profile:123': '{"name":"Alice","role":"admin"}',
        'embedding:doc:456': '[0.1,0.2,0.3,0.4,0.5]',
        'search:query:789': '{"results":["doc1","doc2"],"count":2}',
        'workspace:demo:config': '{"theme":"dark","lang":"typescript"}'
      };

      for (const [key, value] of Object.entries(cacheData)) {
        await invalidator.setTestData(key, value);
      }

      expect(mockCacheData.size).toBe(4);

      // 2. Verify cache population
      for (const [key, expectedValue] of Object.entries(cacheData)) {
        const actualValue = await invalidator.getTestData(key);
        expect(actualValue).toBe(expectedValue);
      }

      // 3. Selective invalidation
      await invalidator.invalidateCache(['user:profile:123'], 'high', 'lifecycle-test');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(await invalidator.getTestData('user:profile:123')).toBeNull();
      expect(await invalidator.getTestData('embedding:doc:456')).toBe('[0.1,0.2,0.3,0.4,0.5]');

      // 4. Pattern invalidation
      await invalidator.invalidateByPattern('workspace:demo:*', 'medium', 'lifecycle-test');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(await invalidator.getTestData('workspace:demo:config')).toBeNull();
      expect(await invalidator.getTestData('search:query:789')).toBe('{"results":["doc1","doc2"],"count":2}');

      // 5. Verify final state
      const finalStats = invalidator.getStats();
      expect(finalStats.circuitBreakerState).toBe('closed');
      expect(finalStats.failureCount).toBe(0);

      console.log('✅ Cache lifecycle test completed successfully');
    });
  });
});