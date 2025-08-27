/**
 * Integration test for cache invalidation with real Redis/Valkey backend
 * Tests the complete cache invalidation flow with actual Redis operations
 */

import { ProductionVectorCacheInvalidator } from '../../src/lib/cache/production-vector-cache-invalidator';

// Mock the metrics module
jest.mock('../../src/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn()
  }
}));

// Mock Redis client conditionally - only if Redis is not available
let mockRedisClient: any = null;
let realRedisAvailable = false;

// Try to import real Redis client
try {
  const { Redis } = require('ioredis');
  
  // Test Redis connection
  const testClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '1'), // Use DB 1 for testing
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 2000,
    commandTimeout: 1000
  });

  // Check if Redis is actually available
  beforeAll(async () => {
    try {
      await testClient.ping();
      realRedisAvailable = true;
      console.log('✅ Real Redis/Valkey backend detected - running integration tests');
    } catch (error) {
      console.warn('⚠️ Redis/Valkey not available - using mock for cache backend tests');
      realRedisAvailable = false;
      
      // Create stateful mock Redis client that simulates actual Redis behavior
      const mockCacheStore = new Map<string, string>();
      
      const mockPipeline = {
        commands: [] as Array<{type: 'setex' | 'del', key: string, value?: string, ttl?: number}>,
        
        setex: jest.fn().mockImplementation(function(key: string, ttl: number, value: string) {
          this.commands.push({type: 'setex', key, value, ttl});
          return this;
        }),
        
        del: jest.fn().mockImplementation(function(key: string) {
          this.commands.push({type: 'del', key});
          return this;
        }),
        
        exec: jest.fn().mockImplementation(async function() {
          const results = [];
          
          for (const command of this.commands) {
            try {
              if (command.type === 'setex' && command.value) {
                mockCacheStore.set(command.key, command.value);
                results.push([null, 'OK']);
              } else if (command.type === 'del') {
                const deleted = mockCacheStore.delete(command.key) ? 1 : 0;
                results.push([null, deleted]);
              }
            } catch (error) {
              results.push([error, null]);
            }
          }
          
          this.commands = []; // Clear commands after execution
          return results;
        })
      };

      mockRedisClient = {
        get: jest.fn().mockImplementation((key: string) => Promise.resolve(mockCacheStore.get(key) || null)),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockImplementation((key: string, ttl: number, value: string) => {
          mockCacheStore.set(key, value);
          return Promise.resolve('OK');
        }),
        del: jest.fn().mockImplementation((key: string) => {
          const deleted = mockCacheStore.delete(key) ? 1 : 0;
          return Promise.resolve(deleted);
        }),
        exists: jest.fn().mockImplementation((key: string) => 
          Promise.resolve(mockCacheStore.has(key) ? 1 : 0)
        ),
        keys: jest.fn().mockImplementation((pattern: string) => {
          const allKeys = Array.from(mockCacheStore.keys());
          
          if (pattern === '*') return Promise.resolve(allKeys);
          
          // Convert Redis pattern to regex
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return Promise.resolve(allKeys.filter(key => regex.test(key)));
        }),
        mget: jest.fn().mockImplementation((...keys: string[]) => {
          return Promise.resolve(keys.map(key => mockCacheStore.get(key) || null));
        }),
        pipeline: jest.fn().mockImplementation(() => {
          // Return a new instance of mock pipeline for each call
          return {
            commands: [],
            setex: mockPipeline.setex.bind({commands: []}),
            del: mockPipeline.del.bind({commands: []}),
            exec: mockPipeline.exec.bind({commands: []})
          };
        }),
        flushdb: jest.fn().mockImplementation(() => {
          mockCacheStore.clear();
          return Promise.resolve('OK');
        }),
        ping: jest.fn().mockResolvedValue('PONG'),
        disconnect: jest.fn().mockResolvedValue(undefined)
      };
    }
  });

  afterAll(async () => {
    if (realRedisAvailable) {
      await testClient.flushdb(); // Clean up test data
      await testClient.disconnect();
    }
  });

} catch (importError) {
  console.warn('Redis client not available - using comprehensive mocks');
  realRedisAvailable = false;
}

/**
 * Redis-integrated cache invalidation system
 * Extends the production invalidator with real Redis operations
 */
class RedisIntegratedCacheInvalidator extends ProductionVectorCacheInvalidator {
  private redis: any;

  constructor(redisClient: any, config?: any) {
    super(config);
    this.redis = redisClient;
  }

  // Override the actual invalidation to use Redis
  protected async executeActualInvalidation(keys: string[]): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis client not available');
    }

    // Use Redis pipeline for efficient batch operations
    const pipeline = this.redis.pipeline();
    
    for (const key of keys) {
      pipeline.del(key);
    }
    
    const results = await pipeline.exec();
    
    // Check for any Redis errors
    for (const [error, result] of results) {
      if (error) {
        throw new Error(`Redis invalidation failed for batch: ${error.message}`);
      }
    }

    console.log(`✅ Redis invalidation completed: ${keys.length} keys processed`);
  }

  // Add method to populate cache with test data
  async populateCache(data: Record<string, string>, ttl = 3600): Promise<void> {
    if (!this.redis) return;

    const pipeline = this.redis.pipeline();
    
    for (const [key, value] of Object.entries(data)) {
      pipeline.setex(key, ttl, value);
    }
    
    await pipeline.exec();
  }

  // Add method to verify cache state
  async getCacheKeys(pattern = '*'): Promise<string[]> {
    if (!this.redis) return [];
    return await this.redis.keys(pattern);
  }

  // Add method to get cache values
  async getCacheValues(keys: string[]): Promise<(string | null)[]> {
    if (!this.redis) return [];
    return await this.redis.mget(...keys);
  }
}

describe('Cache Invalidation with Redis/Valkey Backend', () => {
  let invalidator: RedisIntegratedCacheInvalidator;
  let redisClient: any;

  beforeEach(async () => {
    if (realRedisAvailable) {
      const { Redis } = require('ioredis');
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '1'),
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000
      });
      
      // Clean up any existing test data
      await redisClient.flushdb();
    } else {
      redisClient = mockRedisClient;
    }

    invalidator = new RedisIntegratedCacheInvalidator(redisClient, {
      batchSize: 5,
      batchTimeoutMs: 100,
      enableMetrics: false,
      enableLogging: true
    });
  });

  afterEach(async () => {
    if (realRedisAvailable && redisClient) {
      await redisClient.flushdb();
      await redisClient.disconnect();
    }
  });

  describe('Basic Redis Integration', () => {
    test('should populate and invalidate cache entries via Redis', async () => {
      // Populate cache with test data
      const testData = {
        'user:123:profile': '{"name": "Alice", "email": "alice@example.com"}',
        'user:456:profile': '{"name": "Bob", "email": "bob@example.com"}',
        'search:embedding:query1': '[0.1, 0.2, 0.3, 0.4]',
        'workspace:ws1:metadata': '{"name": "Test Workspace", "type": "demo"}'
      };

      await invalidator.populateCache(testData);

      // Verify data was cached
      const cacheKeys = await invalidator.getCacheKeys('*');
      expect(cacheKeys.length).toBe(4);

      // Verify specific values
      const values = await invalidator.getCacheValues(Object.keys(testData));
      expect(values).not.toContain(null);

      // Invalidate specific keys
      const keysToInvalidate = ['user:123:profile', 'search:embedding:query1'];
      await invalidator.invalidateCache(keysToInvalidate, 'high', 'redis-test');

      // Wait a moment for async processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify invalidation
      const remainingKeys = await invalidator.getCacheKeys('*');
      expect(remainingKeys).not.toContain('user:123:profile');
      expect(remainingKeys).not.toContain('search:embedding:query1');
      expect(remainingKeys).toContain('user:456:profile');
      expect(remainingKeys).toContain('workspace:ws1:metadata');
    });

    test('should handle pattern-based invalidation with Redis', async () => {
      // Populate cache with workspace-specific data
      const workspaceData = {
        'workspace:ws1:config': '{"theme": "dark", "language": "en"}',
        'workspace:ws1:file:main.ts': 'console.log("Hello World");',
        'workspace:ws1:embedding:chunk1': '[0.5, 0.6, 0.7]',
        'workspace:ws2:config': '{"theme": "light", "language": "fr"}',
        'user:123:session': '{"token": "abc123", "expires": 1234567890}'
      };

      await invalidator.populateCache(workspaceData);

      // Verify all data is cached
      expect((await invalidator.getCacheKeys('*')).length).toBe(5);

      // Invalidate workspace ws1 data using content type invalidation
      await invalidator.invalidateByContentType('workspace', 'ws1', 'high');

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify workspace ws1 data is invalidated but ws2 remains
      const remainingKeys = await invalidator.getCacheKeys('*');
      
      // Should not contain ws1 keys
      expect(remainingKeys.filter(key => key.includes('ws1'))).toHaveLength(0);
      
      // Should still contain ws2 and user data
      expect(remainingKeys).toContain('workspace:ws2:config');
      expect(remainingKeys).toContain('user:123:session');
    });

    test('should handle concurrent invalidation operations', async () => {
      // Populate cache with concurrent test data
      const concurrentData: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        concurrentData[`concurrent:key:${i}`] = `value_${i}`;
        concurrentData[`embedding:batch:${i}`] = `[0.${i}, 0.${i+1}, 0.${i+2}]`;
      }

      await invalidator.populateCache(concurrentData);

      // Verify initial state
      expect((await invalidator.getCacheKeys('*')).length).toBe(40);

      // Launch concurrent invalidation operations
      const concurrentPromises = [];
      
      // Invalidate individual keys
      for (let i = 0; i < 10; i++) {
        concurrentPromises.push(
          invalidator.invalidateCache([`concurrent:key:${i}`], 'medium', `concurrent-${i}`)
        );
      }

      // Invalidate by pattern
      concurrentPromises.push(
        invalidator.invalidateByPattern('embedding:batch:*', 'high', 'pattern-concurrent')
      );

      await Promise.all(concurrentPromises);

      // Wait for all batch processing to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify results
      const remainingKeys = await invalidator.getCacheKeys('*');
      
      // Should have invalidated 10 concurrent keys + 20 embedding keys = 30 total
      expect(remainingKeys.length).toBe(10); // Only concurrent:key:10-19 should remain

      // Verify specific keys remain
      expect(remainingKeys.filter(key => key.startsWith('concurrent:key:1'))).toHaveLength(10);
      expect(remainingKeys.filter(key => key.startsWith('embedding:'))).toHaveLength(0);
    });
  });

  describe('Performance and Reliability', () => {
    test('should maintain performance under load', async () => {
      // Populate large dataset
      const largeDataset: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeDataset[`perf:key:${i}`] = `large_value_${i}`.repeat(100); // ~1.3KB per value
        largeDataset[`perf:embedding:${i}`] = JSON.stringify(new Array(1536).fill(i / 100));
      }

      const populateStart = Date.now();
      await invalidator.populateCache(largeDataset);
      const populateTime = Date.now() - populateStart;

      expect(populateTime).toBeLessThan(5000); // Should populate in under 5 seconds

      // Test invalidation performance
      const invalidateStart = Date.now();
      
      // Invalidate in batches to simulate real-world usage
      const batchPromises = [];
      for (let i = 0; i < 20; i++) {
        const batchKeys = [];
        for (let j = 0; j < 5; j++) {
          batchKeys.push(`perf:key:${i * 5 + j}`);
        }
        batchPromises.push(
          invalidator.invalidateCache(batchKeys, 'medium', `perf-batch-${i}`)
        );
      }

      await Promise.all(batchPromises);
      
      const invalidateTime = Date.now() - invalidateStart;
      expect(invalidateTime).toBeLessThan(3000); // Should invalidate in under 3 seconds

      // Wait for processing completion
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify performance results
      const remainingKeys = await invalidator.getCacheKeys('*');
      expect(remainingKeys.filter(key => key.startsWith('perf:key:')).length).toBe(0);
      expect(remainingKeys.filter(key => key.startsWith('perf:embedding:')).length).toBe(100);
    });

    test('should handle Redis connection failures gracefully', async () => {
      if (!realRedisAvailable) {
        // For mock tests, simulate connection failure
        const failingRedisClient = {
          ...mockRedisClient,
          pipeline: jest.fn().mockImplementation(() => ({
            del: jest.fn().mockReturnThis(),
            exec: jest.fn().mockRejectedValue(new Error('Redis connection lost'))
          }))
        };

        const failingInvalidator = new RedisIntegratedCacheInvalidator(failingRedisClient);

        await expect(
          failingInvalidator.invalidateCache(['test:key'], 'high', 'failure-test')
        ).rejects.toThrow('Redis invalidation failed');
      } else {
        // For real Redis tests, disconnect and test resilience
        await redisClient.disconnect();

        await expect(
          invalidator.invalidateCache(['test:key'], 'high', 'disconnect-test')
        ).rejects.toThrow();

        // Verify the invalidator can still provide stats even when Redis is down
        const stats = invalidator.getStats();
        expect(stats).toBeDefined();
        expect(typeof stats.circuitBreakerState).toBe('string');
      }
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should trigger circuit breaker after Redis failures', async () => {
      // Create invalidator with low failure threshold
      const circuitBreakerInvalidator = new RedisIntegratedCacheInvalidator(redisClient, {
        circuitBreakerThreshold: 2,
        maxRetries: 1,
        enableMetrics: false,
        enableLogging: true
      });

      if (!realRedisAvailable) {
        // Mock consecutive failures
        const failingClient = {
          ...mockRedisClient,
          pipeline: jest.fn().mockImplementation(() => ({
            del: jest.fn().mockReturnThis(),
            exec: jest.fn().mockRejectedValue(new Error('Simulated Redis failure'))
          }))
        };

        const failingInvalidator = new RedisIntegratedCacheInvalidator(failingClient, {
          circuitBreakerThreshold: 2,
          maxRetries: 1,
          enableMetrics: false,
          enableLogging: false
        });

        // Trigger failures to open circuit breaker
        try {
          await failingInvalidator.invalidateCache(['test:key1'], 'high', 'cb-test');
        } catch (error) {
          // Expected to fail
        }

        try {
          await failingInvalidator.invalidateCache(['test:key2'], 'high', 'cb-test');
        } catch (error) {
          // Expected to fail
        }

        // Verify circuit breaker opened
        const stats = failingInvalidator.getStats();
        expect(stats.failureCount).toBeGreaterThanOrEqual(2);
      }

      // Test normal operation should work
      await invalidator.populateCache({'test:normal': 'value'});
      await expect(
        invalidator.invalidateCache(['test:normal'], 'high', 'normal-test')
      ).resolves.not.toThrow();

      const normalStats = invalidator.getStats();
      expect(normalStats.circuitBreakerState).toBe('closed');
    });
  });

  describe('Integration Statistics', () => {
    test('should provide comprehensive Redis integration statistics', async () => {
      // Perform various operations to generate statistics
      await invalidator.populateCache({
        'stats:test1': 'value1',
        'stats:test2': 'value2',
        'stats:embedding:test': '[0.1, 0.2]'
      });

      await invalidator.invalidateCache(['stats:test1'], 'high', 'stats-test');
      await invalidator.invalidateByPattern('stats:embedding:*', 'medium', 'stats-test');

      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = invalidator.getStats();

      expect(stats).toHaveProperty('pendingInvalidations');
      expect(stats).toHaveProperty('queuedRequests');
      expect(stats).toHaveProperty('circuitBreakerState');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('isProcessing');

      expect(typeof stats.pendingInvalidations).toBe('number');
      expect(typeof stats.queuedRequests).toBe('number');
      expect(['closed', 'open', 'half_open']).toContain(stats.circuitBreakerState);
      expect(stats.failureCount).toBe(0); // Should be no failures in normal operation
    });
  });
});