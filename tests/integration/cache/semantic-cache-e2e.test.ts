/**
 * End-to-End Integration Tests for Semantic Caching
 *
 * Tests the complete semantic caching flow from LLMResponseCache through
 * SemanticCacheManager with Redis integration. Validates cache hits, misses,
 * similarity matching, and performance characteristics.
 *
 * Target coverage: Full E2E flow validation
 */

import { jest } from '@jest/globals';

// Mock Redis client module
jest.mock('../../../src/lib/cache/redis-client', () => {
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    getClient: jest.fn(),
  };

  return {
    getRedisClient: jest.fn().mockResolvedValue(mockRedisClient),
    _mockRedisClient: mockRedisClient,
  };
});

// Mock embedding service
jest.mock('../../../src/lib/ai/embedding-service', () => ({
  EmbeddingService: jest.fn(),
}));

import { LLMResponseCache, getLLMResponseCache, resetLLMResponseCache } from '../../../src/lib/cache/llm-response-cache';
import { SemanticCacheManager } from '../../../src/lib/cache/semantic-cache-manager';
import { CacheTTL } from '../../../src/lib/cache/cache-constants';
import type { LLMQuery, LLMResponse } from '../../../src/lib/cache/llm-response-cache';
import type { SemanticQuery } from '../../../src/lib/cache/semantic-cache-manager';
import type { EmbeddingService } from '../../../src/lib/ai/embedding-service';

// Get mock Redis client
const redisModule = require('../../../src/lib/cache/redis-client');
const mockRedis = redisModule._mockRedisClient;

// Create mock data store to simulate Redis
let mockCacheData: Map<string, any>;

// Mock embedding service
const createMockEmbeddingService = (): EmbeddingService => ({
  generateEmbedding: jest.fn().mockImplementation((text: string) => {
    // Generate deterministic embeddings based on text content
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const dimension = 384; // Standard embedding dimension
    const embedding = Array.from({ length: dimension }, (_, i) => {
      return Math.sin((hash + i) / dimension) * 0.5 + 0.5;
    });
    return Promise.resolve(embedding);
  }),
  generateBatchEmbeddings: jest.fn(),
  model: 'mock-embedding-model',
  dimension: 384,
} as any);

describe('Semantic Cache E2E Integration', () => {
  let llmCache: LLMResponseCache;
  let semanticCache: SemanticCacheManager;
  let mockEmbeddingService: EmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetLLMResponseCache();

    // Reset mock cache data
    mockCacheData = new Map();

    // Setup Redis mock behavior
    mockRedis.get.mockImplementation((key: string) => {
      return Promise.resolve(mockCacheData.get(key) || null);
    });

    mockRedis.set.mockImplementation((key: string, value: any, ttl?: number) => {
      mockCacheData.set(key, value);
      return Promise.resolve(true);
    });

    mockRedis.delete.mockImplementation((key: string) => {
      const existed = mockCacheData.has(key);
      mockCacheData.delete(key);
      return Promise.resolve(existed);
    });

    mockRedis.deleteMany.mockImplementation((keys: string[]) => {
      keys.forEach(key => mockCacheData.delete(key));
      return Promise.resolve(true);
    });

    mockRedis.getClient.mockReturnValue({
      scan: jest.fn().mockImplementation((cursor: number, options: any) => {
        const allKeys = Array.from(mockCacheData.keys());
        const pattern = options.MATCH;

        // Simple pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const matchedKeys = allKeys.filter(key => regex.test(key));

        return Promise.resolve({
          cursor: 0, // Single iteration for simplicity
          keys: matchedKeys,
        });
      }),
    });

    // Create mock embedding service
    mockEmbeddingService = createMockEmbeddingService();

    // Initialize caches
    llmCache = new LLMResponseCache({
      similarityThreshold: 0.85,
      ttl: CacheTTL.LONG,
      maxCacheSize: 1000,
      enableSemanticSearch: true,
      embeddingService: mockEmbeddingService,
    });

    semanticCache = new SemanticCacheManager('semantic:test', {
      similarityThreshold: 0.85,
      ttl: CacheTTL.LONG,
      maxResults: 10,
      enablePgVector: false,
      embeddingService: mockEmbeddingService,
    });

    // Reset stats
    llmCache.resetStats();
    semanticCache.resetStats();
  });

  afterEach(() => {
    mockCacheData.clear();
  });

  describe('LLM Response Cache E2E Flow', () => {
    it('should cache and retrieve exact match LLM responses', async () => {
      const query: LLMQuery = {
        prompt: 'Explain what TypeScript is',
        model: 'gpt-4',
        temperature: 0.7,
        provider: 'openai',
      };

      const response: LLMResponse = {
        content: 'TypeScript is a strongly typed programming language built on JavaScript.',
        model: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };

      // Set cache
      const setResult = await llmCache.set(query, response);
      expect(setResult).toBe(true);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(query.prompt);

      // Verify data in mock cache
      expect(mockCacheData.size).toBeGreaterThan(0);

      // Get exact match
      const cachedResponse = await llmCache.get(query);
      expect(cachedResponse).toBeDefined();
      expect(cachedResponse?.content).toBe(response.content);
      expect(cachedResponse?.model).toBe(response.model);
      expect(cachedResponse?.cachedAt).toBeDefined();

      // Verify stats
      const stats = llmCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.writes).toBe(1);
      expect(stats.hitRate).toBe(1.0);
    });

    it('should find semantically similar responses', async () => {
      const originalQuery: LLMQuery = {
        prompt: 'What is TypeScript and how does it work?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const originalResponse: LLMResponse = {
        content: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
        model: 'gpt-4',
        provider: 'openai',
      };

      // Cache original
      await llmCache.set(originalQuery, originalResponse);

      // Similar query (not exact match)
      const similarQuery: LLMQuery = {
        prompt: 'Explain how TypeScript works',
        model: 'gpt-4',
        provider: 'openai',
      };

      // Should find similar cached response
      const cachedResponse = await llmCache.get(similarQuery);
      expect(cachedResponse).toBeDefined();
      expect(cachedResponse?.content).toBe(originalResponse.content);
      expect(cachedResponse?.metadata?.semanticMatch).toBe(true);
      expect(cachedResponse?.metadata?.similarity).toBeGreaterThanOrEqual(0.85);

      const stats = llmCache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should return null for dissimilar queries', async () => {
      const query1: LLMQuery = {
        prompt: 'What is TypeScript?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response1: LLMResponse = {
        content: 'TypeScript is a typed superset of JavaScript.',
        model: 'gpt-4',
        provider: 'openai',
      };

      await llmCache.set(query1, response1);

      // Completely different query
      const query2: LLMQuery = {
        prompt: 'How do I cook pasta?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const cachedResponse = await llmCache.get(query2);
      expect(cachedResponse).toBeNull();

      const stats = llmCache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should respect model and provider matching', async () => {
      const query: LLMQuery = {
        prompt: 'What is React?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response: LLMResponse = {
        content: 'React is a JavaScript library for building user interfaces.',
        model: 'gpt-4',
        provider: 'openai',
      };

      await llmCache.set(query, response);

      // Same prompt but different model
      const differentModelQuery: LLMQuery = {
        prompt: 'What is React?',
        model: 'gpt-3.5-turbo',
        provider: 'openai',
      };

      const cachedResponse = await llmCache.get(differentModelQuery);
      expect(cachedResponse).toBeNull();

      // Same prompt but different provider
      const differentProviderQuery: LLMQuery = {
        prompt: 'What is React?',
        model: 'gpt-4',
        provider: 'anthropic',
      };

      const cachedResponse2 = await llmCache.get(differentProviderQuery);
      expect(cachedResponse2).toBeNull();
    });

    it('should handle cache invalidation', async () => {
      const query: LLMQuery = {
        prompt: 'Test prompt for invalidation',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      await llmCache.set(query, response);

      // Verify cached
      let cachedResponse = await llmCache.get(query);
      expect(cachedResponse).toBeDefined();

      // Invalidate
      const invalidateResult = await llmCache.invalidate(query);
      expect(invalidateResult).toBe(true);

      // Verify invalidated
      cachedResponse = await llmCache.get(query);
      expect(cachedResponse).toBeNull();
    });

    it('should clear all cache entries', async () => {
      // Add multiple entries
      for (let i = 0; i < 5; i++) {
        const query: LLMQuery = {
          prompt: `Test prompt ${i}`,
          model: 'gpt-4',
          provider: 'openai',
        };

        const response: LLMResponse = {
          content: `Test response ${i}`,
          model: 'gpt-4',
          provider: 'openai',
        };

        await llmCache.set(query, response);
      }

      expect(llmCache.getStats().writes).toBe(5);

      // Clear cache
      const clearResult = await llmCache.clear();
      expect(clearResult).toBe(true);

      // Verify all entries cleared
      const query: LLMQuery = {
        prompt: 'Test prompt 0',
        model: 'gpt-4',
        provider: 'openai',
      };

      const cachedResponse = await llmCache.get(query);
      expect(cachedResponse).toBeNull();
    });
  });

  describe('Semantic Cache Manager E2E Flow', () => {
    it('should cache and retrieve semantic queries', async () => {
      const query: SemanticQuery = {
        text: 'How to implement authentication in React',
        model: 'gpt-4',
        provider: 'openai',
      };

      const data = {
        answer: 'You can implement authentication in React using context and hooks...',
        confidence: 0.95,
      };

      // Cache the query
      const setResult = await semanticCache.set(query, data);
      expect(setResult).toBe(true);

      // Retrieve exact match
      const result = await semanticCache.findSimilar(query);
      expect(result).toBeDefined();
      expect(result?.entry.data).toEqual(data);
      expect(result?.similarity).toBe(1.0);
      expect(result?.isExactMatch).toBe(true);
    });

    it('should find semantically similar queries', async () => {
      const originalQuery: SemanticQuery = {
        text: 'Best practices for React state management',
        model: 'gpt-4',
        provider: 'openai',
      };

      const data = {
        practices: ['Use Redux for complex state', 'Use Context for simple state'],
      };

      await semanticCache.set(originalQuery, data);

      // Similar query
      const similarQuery: SemanticQuery = {
        text: 'React state management best practices',
        model: 'gpt-4',
        provider: 'openai',
      };

      const result = await semanticCache.findSimilar(similarQuery);
      expect(result).toBeDefined();
      expect(result?.entry.data).toEqual(data);
      expect(result?.similarity).toBeGreaterThanOrEqual(0.85);
      expect(result?.isExactMatch).toBe(false);
    });

    it('should skip caching for short queries', async () => {
      const shortQuery: SemanticQuery = {
        text: 'Hi',
        model: 'gpt-4',
        provider: 'openai',
      };

      const shouldSkip = semanticCache.shouldSkipCache(shortQuery);
      expect(shouldSkip).toBe(true);

      const stats = semanticCache.getStats();
      expect(stats.skips).toBe(1);
    });

    it('should track cache statistics accurately', async () => {
      // Add multiple entries and queries
      const queries = [
        { text: 'What is Node.js?', model: 'gpt-4' },
        { text: 'What is Python?', model: 'gpt-4' },
        { text: 'What is Java?', model: 'gpt-4' },
      ];

      // Cache all queries
      for (const query of queries) {
        await semanticCache.set(query as SemanticQuery, { answer: `${query.text} answer` });
      }

      // Hit first query (exact match)
      await semanticCache.findSimilar(queries[0] as SemanticQuery);

      // Hit second query (exact match)
      await semanticCache.findSimilar(queries[1] as SemanticQuery);

      // Miss on new query
      await semanticCache.findSimilar({ text: 'What is Ruby?', model: 'gpt-4' } as SemanticQuery);

      const stats = semanticCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });

    it('should update cache configuration dynamically', async () => {
      const config = semanticCache.getConfig();
      expect(config.similarityThreshold).toBe(0.85);

      // Update config
      semanticCache.updateConfig({ similarityThreshold: 0.95 });

      const updatedConfig = semanticCache.getConfig();
      expect(updatedConfig.similarityThreshold).toBe(0.95);
    });

    it('should handle embedding service updates', async () => {
      const newEmbeddingService = createMockEmbeddingService();

      semanticCache.setEmbeddingService(newEmbeddingService);

      const retrievedService = semanticCache.getEmbeddingService();
      expect(retrievedService).toBe(newEmbeddingService);
    });
  });

  describe('End-to-End Performance', () => {
    it('should handle multiple concurrent cache operations', async () => {
      const operations = [];

      // Create 20 concurrent cache operations
      for (let i = 0; i < 20; i++) {
        const query: LLMQuery = {
          prompt: `Concurrent test query ${i}`,
          model: 'gpt-4',
          provider: 'openai',
        };

        const response: LLMResponse = {
          content: `Response ${i}`,
          model: 'gpt-4',
          provider: 'openai',
        };

        operations.push(llmCache.set(query, response));
      }

      // Execute concurrently
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(results.every(r => r === true)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      const stats = llmCache.getStats();
      expect(stats.writes).toBe(20);
    });

    it('should maintain performance with cache growth', async () => {
      // Add 50 entries
      for (let i = 0; i < 50; i++) {
        const query: LLMQuery = {
          prompt: `Performance test query ${i}`,
          model: 'gpt-4',
          provider: 'openai',
        };

        const response: LLMResponse = {
          content: `Response ${i}`,
          model: 'gpt-4',
          provider: 'openai',
        };

        await llmCache.set(query, response);
      }

      // Test retrieval performance
      const testQuery: LLMQuery = {
        prompt: 'Performance test query 25',
        model: 'gpt-4',
        provider: 'openai',
      };

      const startTime = Date.now();
      const result = await llmCache.get(testQuery);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should retrieve within 1 second
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis unavailability gracefully', async () => {
      // Simulate Redis unavailable
      redisModule.getRedisClient.mockResolvedValueOnce(null);

      const newCache = new LLMResponseCache({
        embeddingService: mockEmbeddingService,
      });

      const query: LLMQuery = {
        prompt: 'Test query',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      // Should handle gracefully
      const setResult = await newCache.set(query, response);
      expect(setResult).toBe(false);

      const getResult = await newCache.get(query);
      expect(getResult).toBeNull();
    });

    it('should handle embedding generation failures', async () => {
      // Create failing embedding service
      const failingEmbeddingService = {
        generateEmbedding: jest.fn().mockRejectedValue(new Error('Embedding generation failed')),
      } as any;

      const newCache = new LLMResponseCache({
        embeddingService: failingEmbeddingService,
        enableSemanticSearch: true,
      });

      const query: LLMQuery = {
        prompt: 'Test query',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      // Should still cache (without embedding)
      const setResult = await newCache.set(query, response);
      expect(setResult).toBe(true);
    });

    it('should handle empty or null prompts', async () => {
      const emptyQuery: SemanticQuery = {
        text: '',
        model: 'gpt-4',
      };

      const shouldSkip = semanticCache.shouldSkipCache(emptyQuery);
      expect(shouldSkip).toBe(true);
    });

    it('should handle cache key collisions gracefully', async () => {
      // Create two queries with same parameters
      const query1: LLMQuery = {
        prompt: 'Same prompt',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response1: LLMResponse = {
        content: 'First response',
        model: 'gpt-4',
        provider: 'openai',
      };

      const response2: LLMResponse = {
        content: 'Second response',
        model: 'gpt-4',
        provider: 'openai',
      };

      await llmCache.set(query1, response1);
      await llmCache.set(query1, response2);

      // Should retrieve latest
      const cached = await llmCache.get(query1);
      expect(cached?.content).toBe('Second response');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance when using getLLMResponseCache', () => {
      const instance1 = getLLMResponseCache();
      const instance2 = getLLMResponseCache();

      expect(instance1).toBe(instance2);
    });

    it('should update config on existing instance', () => {
      resetLLMResponseCache();

      const instance1 = getLLMResponseCache({ similarityThreshold: 0.8 });
      const config1 = instance1.getConfig();
      expect(config1.similarityThreshold).toBe(0.8);

      const instance2 = getLLMResponseCache({ similarityThreshold: 0.9 });
      const config2 = instance2.getConfig();
      expect(config2.similarityThreshold).toBe(0.9);
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getLLMResponseCache();
      resetLLMResponseCache();
      const instance2 = getLLMResponseCache();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Cosine Similarity Calculation', () => {
    it('should calculate perfect similarity for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const similarity = SemanticCacheManager.calculateCosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate zero similarity for orthogonal vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const similarity = SemanticCacheManager.calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should throw error for vectors of different dimensions', () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2];

      expect(() => {
        SemanticCacheManager.calculateCosineSimilarity(vector1, vector2);
      }).toThrow('Vectors must have the same dimensions');
    });

    it('should handle zero magnitude vectors', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 2, 3];
      const similarity = SemanticCacheManager.calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });
  });
});
