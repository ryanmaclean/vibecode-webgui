/**
 * Tests for Unified Cache Client
 *
 * Tests CacheManager operations, CacheKeys generators, CacheTTL constants,
 * withCache wrapper, and CacheInvalidation patterns.
 */

// Mock dependencies before importing the module under test
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    mget: jest.fn(),
    pipeline: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
    dbsize: jest.fn(),
    flushdb: jest.fn(),
    ping: jest.fn(),
    on: jest.fn(),
  };

  mockRedis.pipeline.mockReturnValue({
    setex: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  });

  return {
    Redis: jest.fn(() => mockRedis),
    __mockRedis: mockRedis,
  };
});

jest.mock('@/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn(),
  },
}));

jest.mock('@/lib/utils/api-response', () => ({
  getErrorMessage: jest.fn((error) => error?.message || 'Unknown error'),
}));

jest.mock('@/lib/security/macos-keychain-server', () => ({
  loadSecret: jest.fn(() => null),
}));

jest.mock('@/lib/monitoring/database-instrumentation', () => ({
  traceRedisOperation: jest.fn(async (_operation, _attributes, fn) => {
    return await fn();
  }),
  getRedisTraceContext: jest.fn(() => ({
    trace_id: 'test-trace-id',
    span_id: 'test-span-id',
  })),
}));

// Import after mocks are set up
import {
  CacheManager,
  cache,
  CacheKeys,
  CacheTTL,
  withCache,
  CacheInvalidation,
} from '@/lib/cache/unified-cache-client';
import { metrics } from '@/lib/server-monitoring';
import { traceRedisOperation, getRedisTraceContext } from '@/lib/monitoring/database-instrumentation';

const mockedMetrics = metrics as jest.Mocked<typeof metrics>;
const mockedTraceRedisOperation = traceRedisOperation as jest.MockedFunction<typeof traceRedisOperation>;
const mockedGetRedisTraceContext = getRedisTraceContext as jest.MockedFunction<typeof getRedisTraceContext>;

// Get mock Redis instance
const getMockRedis = () => {
  const { __mockRedis } = require('ioredis');
  return __mockRedis;
};

describe('Unified Cache Client', () => {
  let mockRedis: ReturnType<typeof getMockRedis>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = getMockRedis();
    mockRedis.get.mockReset();
    mockRedis.setex.mockReset();
    mockRedis.del.mockReset();
    mockRedis.exists.mockReset();
    mockRedis.mget.mockReset();
    mockRedis.incr.mockReset();
    mockRedis.expire.mockReset();
    mockRedis.keys.mockReset();
    mockRedis.info.mockReset();
    mockRedis.dbsize.mockReset();
    mockRedis.flushdb.mockReset();
    mockRedis.ping.mockReset();
    mockRedis.pipeline.mockReturnValue({
      setex: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
  });

  describe('CacheKeys', () => {
    it('should generate user key', () => {
      const key = CacheKeys.user('user-123');
      expect(key).toBe('user:user-123');
    });

    it('should generate workspace key', () => {
      const key = CacheKeys.workspace('ws-456');
      expect(key).toBe('workspace:ws-456');
    });

    it('should generate project key', () => {
      const key = CacheKeys.project('proj-789');
      expect(key).toBe('project:proj-789');
    });

    it('should generate aiResponse key', () => {
      const key = CacheKeys.aiResponse('abc123');
      expect(key).toBe('ai:response:abc123');
    });

    it('should generate vectorSearch key without workspaceId', () => {
      const key = CacheKeys.vectorSearch('test query');
      expect(key).toContain('vector:search:');
      expect(key.length).toBeGreaterThan('vector:search:'.length);
    });

    it('should generate vectorSearch key with workspaceId', () => {
      const key = CacheKeys.vectorSearch('test query', 'ws-123');
      expect(key).toContain('vector:search:');
      expect(key.length).toBeGreaterThan('vector:search:'.length);
    });

    it('should generate different vectorSearch keys for different queries', () => {
      const key1 = CacheKeys.vectorSearch('query1');
      const key2 = CacheKeys.vectorSearch('query2');
      expect(key1).not.toBe(key2);
    });

    it('should generate fileContent key', () => {
      const key = CacheKeys.fileContent('file-123');
      expect(key).toBe('file:content:file-123');
    });

    it('should generate embeddings key', () => {
      const key = CacheKeys.embeddings('hash-abc');
      expect(key).toBe('embeddings:hash-abc');
    });

    it('should generate rateLimit key', () => {
      const key = CacheKeys.rateLimit('user-123');
      expect(key).toBe('ratelimit:user-123');
    });

    it('should generate session key', () => {
      const key = CacheKeys.session('session-xyz');
      expect(key).toBe('session:session-xyz');
    });

    it('should generate apiMetrics key', () => {
      const key = CacheKeys.apiMetrics('/api/users', '1h');
      expect(key).toBe('metrics:/api/users:1h');
    });
  });

  describe('CacheTTL', () => {
    it('should have SHORT TTL', () => {
      expect(CacheTTL.SHORT).toBe(60);
    });

    it('should have MEDIUM TTL', () => {
      expect(CacheTTL.MEDIUM).toBe(300);
    });

    it('should have LONG TTL', () => {
      expect(CacheTTL.LONG).toBe(1800);
    });

    it('should have HOUR TTL', () => {
      expect(CacheTTL.HOUR).toBe(3600);
    });

    it('should have DAY TTL', () => {
      expect(CacheTTL.DAY).toBe(86400);
    });

    it('should have WEEK TTL', () => {
      expect(CacheTTL.WEEK).toBe(604800);
    });

    it('should have EMBEDDINGS TTL', () => {
      expect(CacheTTL.EMBEDDINGS).toBe(2592000);
    });
  });

  describe('CacheManager.get', () => {
    it('should get value from cache and parse JSON', async () => {
      const testData = { name: 'test', value: 42 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cache.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.hit');
      expect(mockedMetrics.histogram).toHaveBeenCalledWith('cache.get.duration', expect.any(Number));
    });

    it('should return null for cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get('missing-key');

      expect(result).toBeNull();
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.miss');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection failed'));

      const result = await cache.get('error-key');

      expect(result).toBeNull();
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.error');
    });

    it('should use traceRedisOperation for observability', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      await cache.get('traced-key');

      expect(mockedTraceRedisOperation).toHaveBeenCalledWith(
        'get',
        expect.objectContaining({
          'db.redis.key': 'traced-key',
          'db.redis.client_type': expect.any(String),
        }),
        expect.any(Function)
      );
    });
  });

  describe('CacheManager.set', () => {
    it('should set value with default TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cache.set('test-key', { data: 'test' });

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        CacheTTL.MEDIUM,
        JSON.stringify({ data: 'test' })
      );
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.set.success');
      expect(mockedMetrics.histogram).toHaveBeenCalledWith('cache.set.duration', expect.any(Number));
    });

    it('should set value with custom TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cache.set('test-key', 'value', 600);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 600, JSON.stringify('value'));
    });

    it('should handle errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Write failed'));

      const result = await cache.set('error-key', 'value');

      expect(result).toBe(false);
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.set.error');
    });

    it('should use traceRedisOperation for observability', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cache.set('traced-key', 'value', 300);

      expect(mockedTraceRedisOperation).toHaveBeenCalledWith(
        'set',
        expect.objectContaining({
          'db.redis.key': 'traced-key',
          'db.redis.ttl': 300,
          'db.redis.client_type': expect.any(String),
        }),
        expect.any(Function)
      );
    });
  });

  describe('CacheManager.del', () => {
    it('should delete single key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.del('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.delete', { count: '1' });
    });

    it('should delete multiple keys', async () => {
      mockRedis.del.mockResolvedValue(3);

      const result = await cache.del(['key1', 'key2', 'key3']);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.delete', { count: '3' });
    });

    it('should handle errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Delete failed'));

      const result = await cache.del('error-key');

      expect(result).toBe(false);
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.delete.error');
    });

    it('should use traceRedisOperation for observability', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cache.del(['key1', 'key2']);

      expect(mockedTraceRedisOperation).toHaveBeenCalledWith(
        'del',
        expect.objectContaining({
          'db.redis.key_count': 2,
          'db.redis.client_type': expect.any(String),
        }),
        expect.any(Function)
      );
    });
  });

  describe('CacheManager.exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cache.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cache.exists('missing-key');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Connection failed'));

      const result = await cache.exists('error-key');

      expect(result).toBe(false);
    });
  });

  describe('CacheManager.mget', () => {
    it('should get multiple values', async () => {
      mockRedis.mget.mockResolvedValue([
        JSON.stringify({ id: 1 }),
        JSON.stringify({ id: 2 }),
        null,
      ]);

      const result = await cache.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, null]);
      expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should return empty array for empty input', async () => {
      const result = await cache.mget([]);

      expect(result).toEqual([]);
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.mget.mockRejectedValue(new Error('Connection failed'));

      const result = await cache.mget(['key1', 'key2']);

      expect(result).toEqual([null, null]);
    });
  });

  describe('CacheManager.mset', () => {
    it('should set multiple values with default TTL', async () => {
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const pairs = [
        { key: 'key1', value: { id: 1 } },
        { key: 'key2', value: { id: 2 } },
      ];

      const result = await cache.mset(pairs);

      expect(result).toBe(true);
      expect(mockPipeline.setex).toHaveBeenCalledWith('key1', CacheTTL.MEDIUM, JSON.stringify({ id: 1 }));
      expect(mockPipeline.setex).toHaveBeenCalledWith('key2', CacheTTL.MEDIUM, JSON.stringify({ id: 2 }));
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.mset.success', { count: '2' });
    });

    it('should set multiple values with custom TTL', async () => {
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const pairs = [
        { key: 'key1', value: 'value1', ttl: 600 },
        { key: 'key2', value: 'value2', ttl: 1200 },
      ];

      const result = await cache.mset(pairs);

      expect(result).toBe(true);
      expect(mockPipeline.setex).toHaveBeenCalledWith('key1', 600, JSON.stringify('value1'));
      expect(mockPipeline.setex).toHaveBeenCalledWith('key2', 1200, JSON.stringify('value2'));
    });

    it('should return false for empty input', async () => {
      const result = await cache.mset([]);

      expect(result).toBe(false);
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Pipeline failed')),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await cache.mset([{ key: 'key1', value: 'value1' }]);

      expect(result).toBe(false);
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.mset.error');
    });
  });

  describe('CacheManager.incr', () => {
    it('should increment counter', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await cache.incr('counter-key');

      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith('counter-key');
    });

    it('should set TTL on first increment', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.incr('counter-key', 60);

      expect(result).toBe(1);
      expect(mockRedis.expire).toHaveBeenCalledWith('counter-key', 60);
    });

    it('should not set TTL on subsequent increments', async () => {
      mockRedis.incr.mockResolvedValue(2);

      const result = await cache.incr('counter-key', 60);

      expect(result).toBe(2);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Increment failed'));

      const result = await cache.incr('error-key');

      expect(result).toBe(0);
    });
  });

  describe('CacheManager.keys', () => {
    it('should get keys matching pattern', async () => {
      mockRedis.keys.mockResolvedValue(['user:1', 'user:2', 'user:3']);

      const result = await cache.keys('user:*');

      expect(result).toEqual(['user:1', 'user:2', 'user:3']);
      expect(mockRedis.keys).toHaveBeenCalledWith('user:*');
    });

    it('should return empty array when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await cache.keys('nonexistent:*');

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Keys failed'));

      const result = await cache.keys('pattern:*');

      expect(result).toEqual([]);
    });
  });

  describe('CacheManager.getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.info.mockResolvedValue('used_memory_human:1.5M\nother_stat:value');
      mockRedis.dbsize.mockResolvedValue(42);

      const stats = await cache.getStats();

      expect(stats).toEqual({
        connected: true,
        keyCount: 42,
        memoryUsage: '1.5M',
        hitRate: 0.85,
      });
    });

    it('should handle missing memory info', async () => {
      mockRedis.info.mockResolvedValue('no_memory_info:here');
      mockRedis.dbsize.mockResolvedValue(10);

      const stats = await cache.getStats();

      expect(stats.memoryUsage).toBe('0B');
    });

    it('should return disconnected stats on error', async () => {
      mockRedis.info.mockRejectedValue(new Error('Stats failed'));

      const stats = await cache.getStats();

      expect(stats).toEqual({
        connected: false,
        keyCount: 0,
        memoryUsage: '0B',
        hitRate: 0,
      });
    });
  });

  describe('CacheManager.clear', () => {
    it('should clear all cache', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      const result = await cache.clear();

      expect(result).toBe(true);
      expect(mockRedis.flushdb).toHaveBeenCalled();
      expect(mockedMetrics.increment).toHaveBeenCalledWith('cache.clear');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.flushdb.mockRejectedValue(new Error('Clear failed'));

      const result = await cache.clear();

      expect(result).toBe(false);
    });
  });

  describe('CacheManager.healthCheck', () => {
    it('should return true when healthy', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await cache.healthCheck();

      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Ping failed'));

      const result = await cache.healthCheck();

      expect(result).toBe(false);
    });

    it('should use traceRedisOperation for observability', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      await cache.healthCheck();

      expect(mockedTraceRedisOperation).toHaveBeenCalledWith(
        'ping',
        expect.objectContaining({
          'db.redis.operation': 'health_check',
          'db.redis.client_type': expect.any(String),
        }),
        expect.any(Function)
      );
    });
  });

  describe('CacheManager.healthCheckWithTrace', () => {
    it('should return health status with trace context', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await cache.healthCheckWithTrace();

      expect(result).toEqual({
        healthy: true,
        traceContext: {
          trace_id: 'test-trace-id',
          span_id: 'test-span-id',
        },
      });
    });

    it('should return unhealthy status on error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Ping failed'));

      const result = await cache.healthCheckWithTrace();

      expect(result).toEqual({
        healthy: false,
        traceContext: {},
      });
    });
  });

  describe('CacheManager.getTraceContext', () => {
    it('should return current trace context', () => {
      const context = cache.getTraceContext();

      expect(context).toEqual({
        trace_id: 'test-trace-id',
        span_id: 'test-span-id',
      });
      expect(mockedGetRedisTraceContext).toHaveBeenCalled();
    });
  });

  describe('CacheManager.getClientType', () => {
    it('should return client type', () => {
      const clientType = cache.getClientType();

      expect(clientType).toBe('redis');
    });
  });

  describe('withCache', () => {
    it('should return cached value if available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));

      const fn = jest.fn().mockResolvedValue({ cached: false });
      const cachedFn = withCache(fn, () => 'test-key', 60);

      const result = await cachedFn();

      expect(result).toEqual({ cached: true });
      expect(fn).not.toHaveBeenCalled();
    });

    it('should execute function and cache result on miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const fn = jest.fn().mockResolvedValue({ data: 'fresh' });
      const cachedFn = withCache(fn, () => 'test-key', 60);

      const result = await cachedFn();

      expect(result).toEqual({ data: 'fresh' });
      expect(fn).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 60, JSON.stringify({ data: 'fresh' }));
    });

    it('should generate key from function arguments', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const fn = jest.fn().mockResolvedValue('result');
      const keyGen = (id: number, name: string) => `item:${id}:${name}`;
      const cachedFn = withCache(fn, keyGen, 60);

      await cachedFn(123, 'test');

      expect(mockRedis.get).toHaveBeenCalledWith('item:123:test');
    });
  });

  describe('CacheInvalidation', () => {
    describe('invalidateUser', () => {
      it('should invalidate all user-related keys', async () => {
        mockRedis.keys
          .mockResolvedValueOnce(['user:123'])
          .mockResolvedValueOnce(['workspace:1:user:123', 'workspace:2:user:123'])
          .mockResolvedValueOnce(['project:1:user:123']);
        mockRedis.del.mockResolvedValue(1);

        await CacheInvalidation.invalidateUser('123');

        expect(mockRedis.keys).toHaveBeenCalledWith('user:123');
        expect(mockRedis.keys).toHaveBeenCalledWith('workspace:*:user:123');
        expect(mockRedis.keys).toHaveBeenCalledWith('project:*:user:123');
        expect(mockRedis.del).toHaveBeenCalledWith('user:123');
        expect(mockRedis.del).toHaveBeenCalledWith('workspace:1:user:123', 'workspace:2:user:123');
        expect(mockRedis.del).toHaveBeenCalledWith('project:1:user:123');
      });

      it('should handle patterns with no matching keys', async () => {
        mockRedis.keys.mockResolvedValue([]);

        await CacheInvalidation.invalidateUser('123');

        expect(mockRedis.del).not.toHaveBeenCalled();
      });
    });

    describe('invalidateWorkspace', () => {
      it('should invalidate all workspace-related keys', async () => {
        mockRedis.keys
          .mockResolvedValueOnce(['workspace:ws-1'])
          .mockResolvedValueOnce(['project:1:workspace:ws-1'])
          .mockResolvedValueOnce(['vector:search:abc:ws-1']);
        mockRedis.del.mockResolvedValue(1);

        await CacheInvalidation.invalidateWorkspace('ws-1');

        expect(mockRedis.keys).toHaveBeenCalledWith('workspace:ws-1');
        expect(mockRedis.keys).toHaveBeenCalledWith('project:*:workspace:ws-1');
        expect(mockRedis.keys).toHaveBeenCalledWith('vector:search:*:ws-1');
        expect(mockRedis.del).toHaveBeenCalledTimes(3);
      });
    });

    describe('invalidateProject', () => {
      it('should invalidate project key', async () => {
        mockRedis.del.mockResolvedValue(1);

        await CacheInvalidation.invalidateProject('proj-1');

        expect(mockRedis.del).toHaveBeenCalledWith('project:proj-1');
      });
    });
  });

  describe('CacheManager instance', () => {
    it('should export singleton cache instance', () => {
      expect(cache).toBeInstanceOf(CacheManager);
    });

    it('should maintain state across calls', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify({ value: 'test' }));

      await cache.set('persistence-test', { value: 'test' });
      const result = await cache.get('persistence-test');

      expect(result).toEqual({ value: 'test' });
    });
  });
});
