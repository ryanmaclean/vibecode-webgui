/**
 * Tests for ValKey vector caching implementation
 * 
 * @jest-environment node
 */

import { PrismaClient } from '@prisma/client';
import { VectorCacheManager } from '../../../src/lib/cache/vector-cache-strategy';
import { mockRedisClient } from '../../../tests/__mocks__/redis-mock';
import { mockMetrics } from '../../../tests/__mocks__/metrics-mock';

// Mock dependencies
jest.mock('../../../src/lib/server-monitoring', () => ({
  metrics: mockMetrics,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/lib/cache/redis-client', () => ({
  cache: mockRedisClient,
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

// Mock Prisma - use the comprehensive mock
jest.mock('@prisma/client');

describe('ValKey Vector Cache Strategy', () => {
  // Sample test data
  const sampleEmbedding = Array(1536).fill(0.1);
  const sampleResults = [
    {
      id: 1,
      similarity: 0.95,
      content: 'Sample content 1',
      metadata: { language: 'typescript' },
      contentType: 'code'
    },
    {
      id: 2,
      similarity: 0.85,
      content: 'Sample content 2',
      metadata: { language: 'typescript' },
      contentType: 'code'
    }
  ];
  
  // Basic query for testing
  const sampleQuery = {
    embedding: sampleEmbedding,
    table: 'rag_chunks',
    limit: 10,
    minSimilarity: 0.7,
    filter: { language: 'typescript' },
    contentTypes: ['code']
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.clear();
  });
  
  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys for the same query', () => {
      const key1 = VectorCacheManager.calculateCacheKey(sampleQuery);
      const key2 = VectorCacheManager.calculateCacheKey(sampleQuery);
      
      expect(key1).toBe(key2);
    });
    
    test('should generate different keys for different queries', () => {
      const key1 = VectorCacheManager.calculateCacheKey(sampleQuery);
      
      const differentQuery = {
        ...sampleQuery,
        limit: 20
      };
      
      const key2 = VectorCacheManager.calculateCacheKey(differentQuery);
      
      expect(key1).not.toBe(key2);
    });
    
    test('should include workspace in key when provided', () => {
      const key1 = VectorCacheManager.calculateCacheKey(sampleQuery);
      const key2 = VectorCacheManager.calculateCacheKey(sampleQuery, 'workspace1');
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('Cache Operations', () => {
    test('should store and retrieve results from cache', async () => {
      // Store in cache
      await VectorCacheManager.cacheResults(sampleQuery, sampleResults);
      
      // Get from cache
      const cachedResults = await VectorCacheManager.getCachedResults(sampleQuery);
      
      expect(cachedResults).toEqual(sampleResults);
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalled();
    });
    
    test('should return null when cache miss occurs', async () => {
      const cachedResults = await VectorCacheManager.getCachedResults(sampleQuery);
      
      expect(cachedResults).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalled();
    });
    
    test('should respect workspace isolation', async () => {
      // Store in cache with workspace
      await VectorCacheManager.cacheResults(sampleQuery, sampleResults, 'workspace1');
      
      // Try to get from cache without workspace - should be a miss
      const cachedResults1 = await VectorCacheManager.getCachedResults(sampleQuery);
      expect(cachedResults1).toBeNull();
      
      // Get from cache with correct workspace - should hit
      const cachedResults2 = await VectorCacheManager.getCachedResults(sampleQuery, 'workspace1');
      expect(cachedResults2).toEqual(sampleResults);
    });
  });
  
  describe('Cache Invalidation', () => {
    test('should invalidate cache for a specific table', async () => {
      // Store in cache
      await VectorCacheManager.cacheResults(sampleQuery, sampleResults);
      
      // Verify it's in cache
      const beforeInvalidation = await VectorCacheManager.getCachedResults(sampleQuery);
      expect(beforeInvalidation).toEqual(sampleResults);
      
      // Invalidate cache
      await VectorCacheManager.invalidateForTable('rag_chunks');
      
      // Verify it's removed from cache
      const afterInvalidation = await VectorCacheManager.getCachedResults(sampleQuery);
      expect(afterInvalidation).toBeNull();
      
      expect(mockRedisClient.keys).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
    
    test('should invalidate cache for a specific content type', async () => {
      // Store in cache
      await VectorCacheManager.cacheResults(sampleQuery, sampleResults);
      
      // Store different content type
      const differentQuery = {
        ...sampleQuery,
        contentTypes: ['documentation']
      };
      
      await VectorCacheManager.cacheResults(differentQuery, sampleResults);
      
      // Invalidate only code content type
      await VectorCacheManager.invalidateForTable('rag_chunks', 'code');
      
      // Code should be invalidated
      const codeResults = await VectorCacheManager.getCachedResults(sampleQuery);
      expect(codeResults).toBeNull();
      
      // Documentation should still be in cache
      const docResults = await VectorCacheManager.getCachedResults(differentQuery);
      expect(docResults).toEqual(sampleResults);
    });
  });
  
  describe('Optimization Logic', () => {
    test('should skip caching for very specific filters', async () => {
      const complexQuery = {
        ...sampleQuery,
        filter: {
          language: 'typescript',
          framework: 'react',
          complexity: 'high',
          fileSize: 'large',
          modified: 'recent',
          author: 'someone'
        }
      };
      
      // Try to cache
      await VectorCacheManager.cacheResults(complexQuery, sampleResults);
      
      // Shouldn't be in cache due to shouldSkipCache logic
      const cachedResults = await VectorCacheManager.getCachedResults(complexQuery);
      expect(cachedResults).toBeNull();
      
      // Set should not be called
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
    
    test('should skip caching for very low similarity thresholds', async () => {
      const lowSimilarityQuery = {
        ...sampleQuery,
        minSimilarity: 0.05
      };
      
      // Try to cache
      await VectorCacheManager.cacheResults(lowSimilarityQuery, sampleResults);
      
      // Shouldn't be in cache due to shouldSkipCache logic
      const cachedResults = await VectorCacheManager.getCachedResults(lowSimilarityQuery);
      expect(cachedResults).toBeNull();
      
      // Set should not be called
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
    
    test('should skip caching for large result limits', async () => {
      const largeResultQuery = {
        ...sampleQuery,
        limit: 200
      };
      
      // Try to cache
      await VectorCacheManager.cacheResults(largeResultQuery, sampleResults);
      
      // Shouldn't be in cache due to shouldSkipCache logic
      const cachedResults = await VectorCacheManager.getCachedResults(largeResultQuery);
      expect(cachedResults).toBeNull();
      
      // Set should not be called
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });
  
  describe('TTL Optimization', () => {
    test('should use longer TTL for code embeddings', async () => {
      const codeQuery = {
        ...sampleQuery,
        table: 'rag_chunks',
        contentTypes: ['code']
      };

      // Use more than 3 results to trigger EMBEDDINGS TTL
      const largerResults = [
        ...sampleResults,
        { id: 3, similarity: 0.75, content: 'Sample 3', metadata: {}, contentType: 'code' }
      ];

      await VectorCacheManager.cacheResults(codeQuery, largerResults);

      // Check TTL value
      expect(mockRedisClient.set).toHaveBeenCalled();
      const setCall = mockRedisClient.set.mock.calls[0];

      // Third argument should be TTL
      expect(setCall[2]).toBe(2592000); // EMBEDDINGS TTL
    });
    
    test('should use shorter TTL for small result sets', async () => {
      const smallResultsQuery = { ...sampleQuery };
      const smallResults = [sampleResults[0]]; // Just one result
      
      await VectorCacheManager.cacheResults(smallResultsQuery, smallResults);
      
      // Check TTL value
      expect(mockRedisClient.set).toHaveBeenCalled();
      const setCall = mockRedisClient.set.mock.calls[0];
      
      // Third argument should be TTL
      expect(setCall[2]).toBe(150); // Half of MEDIUM TTL
    });
  });
  
  describe('Cache Statistics', () => {
    test('should track cache hits and misses', async () => {
      // Reset stats
      VectorCacheManager.resetStats();
      
      // Cache miss
      await VectorCacheManager.getCachedResults(sampleQuery);
      
      // Cache hit
      await VectorCacheManager.cacheResults(sampleQuery, sampleResults);
      await VectorCacheManager.getCachedResults(sampleQuery);
      
      // Get stats
      const stats = VectorCacheManager.getCacheStats();
      
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5); // 1 hit out of 2 attempts
    });
    
    test('should reset statistics correctly', () => {
      // Set some stats
      // @ts-ignore - accessing private for testing
      VectorCacheManager.hitCount = 10;
      // @ts-ignore
      VectorCacheManager.missCount = 5;
      
      // Reset stats
      VectorCacheManager.resetStats();
      
      // Get stats
      const stats = VectorCacheManager.getCacheStats();
      
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});