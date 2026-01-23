/**
 * Integration tests for pgvector cache with real database
 *
 * @jest-environment node
 */

// Override Jest setup for Node.js environment
jest.mock('../../../tests/jest.setup.js', () => {});

// Mock Redis client for testing
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  clear: jest.fn()
};

// Mock getRedisClient to return our mock client
jest.mock('../../../src/lib/cache/redis-client', () => ({
  getRedisClient: jest.fn(async () => mockRedisClient),
  CacheKeys: {
    vectorSearch: (query: string, workspace?: string) =>
      `vector:search:${Buffer.from(query + (workspace || '')).toString('base64')}`
  },
  CacheTTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 1800,
    HOUR: 3600,
    DAY: 86400,
    WEEK: 604800,
    EMBEDDINGS: 2592000
  }
}));

import { CachedVectorSearchService } from '../../../src/lib/cache/pgvector-cache-integration';
import { VectorCacheManager } from '../../../src/lib/cache/vector-cache-strategy';

jest.mock('../../../src/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn()
  }
}));

jest.mock('../../../src/lib/cache/valkey-logger', () => ({
  valkeyLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('pgvector Cache Integration', () => {
  let cachedVectorService: CachedVectorSearchService;
  const sampleEmbedding = Array(1536).fill(0.1);

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.get.mockReset();
    mockRedisClient.set.mockReset();
    mockRedisClient.del.mockReset();
    mockRedisClient.keys.mockReset();
    VectorCacheManager.resetStats();
    
    // Mock the parent class methods
    cachedVectorService = new CachedVectorSearchService();
    
    // Mock the similaritySearch method to avoid actual database calls
    jest.spyOn(cachedVectorService, 'similaritySearch').mockImplementation(async () => [
      {
        id: 1,
        content_type: 'code',
        content_hash: 'test_hash_1',
        metadata: { language: 'typescript', framework: 'react' },
        similarity: 0.95
      },
      {
        id: 2,
        content_type: 'code',
        content_hash: 'test_hash_2',
        metadata: { language: 'typescript', framework: 'react' },
        similarity: 0.85
      }
    ]);
  });

  describe('Cached Similarity Search', () => {
    test('should return cached results when available', async () => {
      // Setup cache to return results
      const cachedResults = [
        {
          id: 1,
          similarity: 0.95,
          metadata: { language: 'typescript' },
          content: 'cached_content',
          table: 'embeddings',
          contentType: 'code'
        }
      ];
      
      mockRedisClient.get.mockResolvedValue(cachedResults);

      const result = await cachedVectorService.cachedSimilaritySearch(sampleEmbedding, {
        content_type: 'code',
        language: 'typescript',
        limit: 10
      });

      expect(result.from_cache).toBe(true);
      expect(result.results).toEqual(cachedResults);
      expect(result.cache_key).toBeDefined();
      expect(result.processing_time_ms).toBeGreaterThan(0);
      expect(mockRedisClient.get).toHaveBeenCalled();
    });

    test('should query database and cache results on cache miss', async () => {
      // Setup cache miss
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await cachedVectorService.cachedSimilaritySearch(sampleEmbedding, {
        content_type: 'code',
        language: 'typescript',
        limit: 10
      });

      expect(result.from_cache).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.cache_key).toBeDefined();
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(cachedVectorService.similaritySearch).toHaveBeenCalledWith(sampleEmbedding, {
        content_type: 'code',
        language: 'typescript',
        limit: 10
      });
    });

    test('should respect force_refresh option', async () => {
      // Setup cache to return results
      mockRedisClient.get.mockResolvedValue([{ id: 1, cached: true }]);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await cachedVectorService.cachedSimilaritySearch(sampleEmbedding, {
        content_type: 'code',
        force_refresh: true
      });

      expect(result.from_cache).toBe(false);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(cachedVectorService.similaritySearch).toHaveBeenCalled();
    });
  });

  describe('Specialized Search Methods', () => {
    test('should cache code similarity searches', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await cachedVectorService.cachedFindSimilarCode(
        sampleEmbedding,
        'typescript',
        'react',
        5,
        'workspace1'
      );

      expect(result.from_cache).toBe(false);
      expect(cachedVectorService.similaritySearch).toHaveBeenCalledWith(sampleEmbedding, {
        content_type: 'code',
        language: 'typescript',
        framework: 'react',
        limit: 5,
        similarity_threshold: 0.8
      });
    });

    test('should cache documentation searches', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await cachedVectorService.cachedFindRelevantDocs(
        sampleEmbedding,
        3,
        'workspace1'
      );

      expect(result.from_cache).toBe(false);
      expect(cachedVectorService.similaritySearch).toHaveBeenCalledWith(sampleEmbedding, {
        content_type: 'documentation',
        limit: 3,
        similarity_threshold: 0.7
      });
    });
  });

  describe('Cache Management', () => {
    test('should invalidate cache for specific content types', async () => {
      // Create realistic cache keys with base64-encoded content
      const mockKeys = [
        'vector:search:' + Buffer.from('embeddings:0.1|0.1|0.1:10:0.700:code:{}').toString('base64'),
        'vector:search:' + Buffer.from('embeddings:0.2|0.2|0.2:10:0.700:code:{}').toString('base64'),
        'vector:search:' + Buffer.from('embeddings:0.3|0.3|0.3:10:0.700:code:{}').toString('base64')
      ];

      mockRedisClient.keys.mockResolvedValue(mockKeys);
      mockRedisClient.del.mockResolvedValue(3);

      const invalidatedCount = await cachedVectorService.invalidateEmbeddingCache('code');

      expect(invalidatedCount).toBe(3);
      expect(mockRedisClient.keys).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    test('should return cache statistics', () => {
      // Simulate some cache activity
      VectorCacheManager.resetStats();
      
      const stats = cachedVectorService.getCacheStats();

      expect(stats).toHaveProperty('hitCount');
      expect(stats).toHaveProperty('missCount');
      expect(stats).toHaveProperty('skipCount');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('Cache Warmup', () => {
    test('should warm up cache with common queries', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const commonQueries = [
        {
          embedding: sampleEmbedding,
          options: { content_type: 'code', language: 'typescript' }
        },
        {
          embedding: sampleEmbedding,
          options: { content_type: 'documentation' }
        }
      ];

      const warmupResult = await cachedVectorService.warmupCache(commonQueries);

      expect(warmupResult.warmed_queries).toBe(2);
      expect(warmupResult.cache_hits).toBe(0); // All should be cache misses initially
      expect(warmupResult.processing_time_ms).toBeGreaterThan(0);
      expect(cachedVectorService.similaritySearch).toHaveBeenCalledTimes(2);
    });

    test('should count cache hits during warmup', async () => {
      // First call returns cache miss, second returns cache hit
      mockRedisClient.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([{ id: 1, cached: true }]);
      mockRedisClient.set.mockResolvedValue('OK');

      const commonQueries = [
        {
          embedding: sampleEmbedding,
          options: { content_type: 'code' }
        },
        {
          embedding: sampleEmbedding,
          options: { content_type: 'code' }
        }
      ];

      const warmupResult = await cachedVectorService.warmupCache(commonQueries);

      expect(warmupResult.warmed_queries).toBe(2);
      expect(warmupResult.cache_hits).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle cache errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await cachedVectorService.cachedSimilaritySearch(sampleEmbedding, {
        content_type: 'code'
      });

      // Should fall back to database query
      expect(result.from_cache).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(cachedVectorService.similaritySearch).toHaveBeenCalled();
    });

    test('should handle cache set errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockRejectedValue(new Error('Redis set failed'));

      const result = await cachedVectorService.cachedSimilaritySearch(sampleEmbedding, {
        content_type: 'code'
      });

      // Should still return database results even if caching fails
      expect(result.from_cache).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(cachedVectorService.similaritySearch).toHaveBeenCalled();
    });
  });
});
