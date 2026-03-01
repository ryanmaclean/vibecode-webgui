/**
 * Tests for LLM Response Cache
 *
 * Tests semantic caching for LLM responses using embedding-based similarity matching.
 */

// Mock dependencies before importing the module under test
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  getClient: jest.fn(),
};

jest.mock('@/lib/cache/redis-client', () => ({
  getRedisClient: jest.fn(() => mockRedisClient),
}));

jest.mock('@/lib/cache/cache-constants', () => ({
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
    LLM_RESPONSE: 'llm:response:',
  },
}));

// Import after mocks are set up
import {
  LLMResponseCache,
  getLLMResponseCache,
  resetLLMResponseCache,
  type LLMQuery,
  type LLMResponse,
  type CachedLLMEntry,
} from '@/lib/cache/llm-response-cache';
import { CacheTTL } from '@/lib/cache/cache-constants';

// Mock embedding service
const mockEmbeddingService = {
  generateEmbedding: jest.fn(),
};

describe('LLMResponseCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.get.mockReset();
    mockRedisClient.set.mockReset();
    mockRedisClient.delete.mockReset();
    mockRedisClient.deleteMany.mockReset();
    mockRedisClient.getClient.mockReset();
    mockEmbeddingService.generateEmbedding.mockReset();
    resetLLMResponseCache();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const cache = new LLMResponseCache();
      const config = cache.getConfig();

      expect(config.similarityThreshold).toBe(0.85);
      expect(config.ttl).toBe(CacheTTL.LONG);
      expect(config.maxCacheSize).toBe(1000);
      expect(config.enableSemanticSearch).toBe(true);
      expect(config.embeddingService).toBeUndefined();
    });

    it('should create instance with custom config', () => {
      const cache = new LLMResponseCache({
        similarityThreshold: 0.9,
        ttl: CacheTTL.MEDIUM,
        maxCacheSize: 500,
        enableSemanticSearch: false,
        embeddingService: mockEmbeddingService as any,
      });
      const config = cache.getConfig();

      expect(config.similarityThreshold).toBe(0.9);
      expect(config.ttl).toBe(CacheTTL.MEDIUM);
      expect(config.maxCacheSize).toBe(500);
      expect(config.enableSemanticSearch).toBe(false);
      expect(config.embeddingService).toBe(mockEmbeddingService);
    });

    it('should accept partial config', () => {
      const cache = new LLMResponseCache({
        similarityThreshold: 0.95,
      });
      const config = cache.getConfig();

      expect(config.similarityThreshold).toBe(0.95);
      expect(config.ttl).toBe(CacheTTL.LONG);
      expect(config.maxCacheSize).toBe(1000);
      expect(config.enableSemanticSearch).toBe(true);
    });
  });

  describe('get', () => {
    it('should return null when redis client is unavailable', async () => {
      const { getRedisClient } = require('@/lib/cache/redis-client');
      getRedisClient.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const result = await cache.get(query);

      expect(result).toBeNull();
      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should return cached response for exact match', async () => {
      const query: LLMQuery = {
        prompt: 'test prompt',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        provider: 'openai',
      };

      const cachedEntry: CachedLLMEntry = {
        query,
        response: {
          content: 'cached response',
          model: 'gpt-4',
          provider: 'openai',
        },
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);

      const cache = new LLMResponseCache();
      const result = await cache.get(query);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('cached response');
      expect(result?.cachedAt).toBe(cachedEntry.createdAt);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should increment hitCount on cache hit', async () => {
      const query: LLMQuery = { prompt: 'test prompt' };
      const cachedEntry: CachedLLMEntry = {
        query,
        response: {
          content: 'cached response',
          model: 'gpt-4',
          provider: 'openai',
        },
        embedding: [],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);

      const cache = new LLMResponseCache();
      await cache.get(query);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ hitCount: 1 }),
        CacheTTL.LONG
      );
    });

    it('should return null for cache miss without semantic search', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache({
        enableSemanticSearch: false,
      });
      const query: LLMQuery = { prompt: 'test prompt' };
      const result = await cache.get(query);

      expect(result).toBeNull();
      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('should try semantic search when exact match fails and semantic search is enabled', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: [],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
      });
      const query: LLMQuery = { prompt: 'test prompt' };
      await cache.get(query);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test prompt');
    });

    it('should find similar response when similarity exceeds threshold', async () => {
      const query: LLMQuery = {
        prompt: 'what is AI?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const cachedEntry: CachedLLMEntry = {
        query: {
          prompt: 'what is artificial intelligence?',
          model: 'gpt-4',
          provider: 'openai',
        },
        response: {
          content: 'AI is...',
          model: 'gpt-4',
          provider: 'openai',
        },
        embedding: [0.9, 0.1, 0.1],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      // First get call - exact match fails
      mockRedisClient.get.mockResolvedValueOnce(null);
      // Semantic search - get cached entry
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc123'],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.85, 0.15, 0.1]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.85,
      });

      const result = await cache.get(query);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('AI is...');
      expect(result?.metadata?.semanticMatch).toBe(true);
      expect(result?.metadata?.similarity).toBeGreaterThan(0);
    });

    it('should not return similar response when similarity below threshold', async () => {
      const query: LLMQuery = {
        prompt: 'what is AI?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const cachedEntry: CachedLLMEntry = {
        query: {
          prompt: 'what is the weather?',
          model: 'gpt-4',
          provider: 'openai',
        },
        response: {
          content: 'Weather is...',
          model: 'gpt-4',
          provider: 'openai',
        },
        embedding: [0.1, 0.9, 0.1],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc123'],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.9, 0.1, 0.1]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.9,
      });

      const result = await cache.get(query);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));

      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const result = await cache.get(query);

      expect(result).toBeNull();
      const stats = cache.getStats();
      expect(stats.errors).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should return false when redis client is unavailable', async () => {
      const { getRedisClient } = require('@/lib/cache/redis-client');
      getRedisClient.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      const result = await cache.set(query, response);

      expect(result).toBe(false);
    });

    it('should cache response without embedding', async () => {
      const cache = new LLMResponseCache();
      const query: LLMQuery = {
        prompt: 'test prompt',
        model: 'gpt-4',
        temperature: 0.7,
      };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      const result = await cache.set(query, response);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query,
          response,
          embedding: [],
          hitCount: 0,
        }),
        CacheTTL.LONG
      );

      const stats = cache.getStats();
      expect(stats.writes).toBe(1);
    });

    it('should cache response with embedding when service is available', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);

      const cache = new LLMResponseCache({
        embeddingService: mockEmbeddingService as any,
      });
      const query: LLMQuery = { prompt: 'test prompt' };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      const result = await cache.set(query, response);

      expect(result).toBe(true);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test prompt');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          embedding: [0.1, 0.2, 0.3],
        }),
        CacheTTL.LONG
      );
    });

    it('should use custom TTL when provided', async () => {
      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      await cache.set(query, response, CacheTTL.SHORT);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        CacheTTL.SHORT
      );
    });

    it('should continue without embedding if generation fails', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(new Error('Embedding error'));

      const cache = new LLMResponseCache({
        embeddingService: mockEmbeddingService as any,
      });
      const query: LLMQuery = { prompt: 'test prompt' };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      const result = await cache.set(query, response);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          embedding: [],
        }),
        CacheTTL.LONG
      );
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis error'));

      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      const result = await cache.set(query, response);

      expect(result).toBe(false);
      const stats = cache.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('invalidate', () => {
    it('should return false when redis client is unavailable', async () => {
      const { getRedisClient } = require('@/lib/cache/redis-client');
      getRedisClient.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const result = await cache.invalidate(query);

      expect(result).toBe(false);
    });

    it('should delete cache entry for query', async () => {
      mockRedisClient.delete.mockResolvedValueOnce(true);

      const cache = new LLMResponseCache();
      const query: LLMQuery = {
        prompt: 'test prompt',
        model: 'gpt-4',
        temperature: 0.7,
      };

      const result = await cache.invalidate(query);

      expect(result).toBe(true);
      expect(mockRedisClient.delete).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.delete).toHaveBeenCalledWith(expect.any(String));
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.delete.mockRejectedValueOnce(new Error('Redis error'));

      const cache = new LLMResponseCache();
      const query: LLMQuery = { prompt: 'test prompt' };
      const result = await cache.invalidate(query);

      expect(result).toBe(false);
      const stats = cache.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('clear', () => {
    it('should return false when redis client is unavailable', async () => {
      const { getRedisClient } = require('@/lib/cache/redis-client');
      getRedisClient.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache();
      const result = await cache.clear();

      expect(result).toBe(false);
    });

    it('should delete all LLM cache entries', async () => {
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc', 'embedding:llm:def'],
        }),
      });
      mockRedisClient.deleteMany.mockResolvedValueOnce(true);

      const cache = new LLMResponseCache();
      const result = await cache.clear();

      expect(result).toBe(true);
      expect(mockRedisClient.deleteMany).toHaveBeenCalledWith([
        'embedding:llm:abc',
        'embedding:llm:def',
      ]);
    });

    it('should return true when no keys to delete', async () => {
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: [],
        }),
      });

      const cache = new LLMResponseCache();
      const result = await cache.clear();

      expect(result).toBe(true);
      expect(mockRedisClient.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockRejectedValueOnce(new Error('Redis error')),
      });

      const cache = new LLMResponseCache();
      const result = await cache.clear();

      expect(result).toBe(false);
      const stats = cache.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const cache = new LLMResponseCache();
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.writes).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should calculate hit rate correctly', async () => {
      mockRedisClient.get.mockResolvedValueOnce({
        query: { prompt: 'test' },
        response: { content: 'response', model: 'gpt-4', provider: 'openai' },
        embedding: [],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      });
      mockRedisClient.get.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache({ enableSemanticSearch: false });

      await cache.get({ prompt: 'test1' }); // hit
      await cache.get({ prompt: 'test2' }); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const cache = new LLMResponseCache({ enableSemanticSearch: false });
      await cache.get({ prompt: 'test' });

      let stats = cache.getStats();
      expect(stats.misses).toBe(1);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.writes).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const cache = new LLMResponseCache({
        similarityThreshold: 0.9,
        ttl: CacheTTL.MEDIUM,
      });
      const config = cache.getConfig();

      expect(config.similarityThreshold).toBe(0.9);
      expect(config.ttl).toBe(CacheTTL.MEDIUM);
    });

    it('should return a copy of config', () => {
      const cache = new LLMResponseCache();
      const config1 = cache.getConfig();
      const config2 = cache.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const cache = new LLMResponseCache({
        similarityThreshold: 0.85,
      });

      cache.updateConfig({
        similarityThreshold: 0.95,
        ttl: CacheTTL.SHORT,
      });

      const config = cache.getConfig();
      expect(config.similarityThreshold).toBe(0.95);
      expect(config.ttl).toBe(CacheTTL.SHORT);
    });

    it('should update embedding service', () => {
      const cache = new LLMResponseCache();

      cache.updateConfig({
        embeddingService: mockEmbeddingService as any,
      });

      const config = cache.getConfig();
      expect(config.embeddingService).toBe(mockEmbeddingService);
    });

    it('should allow partial config updates', () => {
      const cache = new LLMResponseCache({
        similarityThreshold: 0.85,
        ttl: CacheTTL.LONG,
      });

      cache.updateConfig({
        similarityThreshold: 0.9,
      });

      const config = cache.getConfig();
      expect(config.similarityThreshold).toBe(0.9);
      expect(config.ttl).toBe(CacheTTL.LONG);
    });
  });

  describe('cosine similarity calculation', () => {
    it('should calculate cosine similarity correctly', async () => {
      const query: LLMQuery = { prompt: 'test' };
      const cachedEntry: CachedLLMEntry = {
        query: { prompt: 'similar' },
        response: { content: 'response', model: 'gpt-4', provider: 'openai' },
        embedding: [1, 0, 0],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc'],
        }),
      });
      // Identical vectors should have similarity of 1.0
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([1, 0, 0]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.99,
      });

      const result = await cache.get(query);

      expect(result).not.toBeNull();
      expect(result?.metadata?.similarity).toBeCloseTo(1.0, 2);
    });

    it('should handle zero magnitude vectors', async () => {
      const query: LLMQuery = { prompt: 'test', model: 'gpt-4', provider: 'openai' };
      const cachedEntry: CachedLLMEntry = {
        query: { prompt: 'similar', model: 'gpt-4', provider: 'openai' },
        response: { content: 'response', model: 'gpt-4', provider: 'openai' },
        embedding: [0, 0, 0],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc'],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([1, 0, 0]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.85,
      });

      const result = await cache.get(query);

      // Should not match because zero magnitude returns similarity of 0
      expect(result).toBeNull();
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent keys for same query', async () => {
      const cache = new LLMResponseCache();
      const query: LLMQuery = {
        prompt: 'test prompt',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        provider: 'openai',
      };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      await cache.set(query, response);
      const firstKey = mockRedisClient.set.mock.calls[0][0];

      mockRedisClient.set.mockClear();
      await cache.set(query, response);
      const secondKey = mockRedisClient.set.mock.calls[0][0];

      expect(firstKey).toBe(secondKey);
    });

    it('should generate different keys for different queries', async () => {
      const cache = new LLMResponseCache();
      const query1: LLMQuery = { prompt: 'test prompt 1' };
      const query2: LLMQuery = { prompt: 'test prompt 2' };
      const response: LLMResponse = {
        content: 'test response',
        model: 'gpt-4',
        provider: 'openai',
      };

      await cache.set(query1, response);
      const firstKey = mockRedisClient.set.mock.calls[0][0];

      mockRedisClient.set.mockClear();
      await cache.set(query2, response);
      const secondKey = mockRedisClient.set.mock.calls[0][0];

      expect(firstKey).not.toBe(secondKey);
    });

    it('should include model in cache key', async () => {
      const cache = new LLMResponseCache();
      const query1: LLMQuery = { prompt: 'test', model: 'gpt-4' };
      const query2: LLMQuery = { prompt: 'test', model: 'gpt-3.5' };
      const response: LLMResponse = {
        content: 'test',
        model: 'gpt-4',
        provider: 'openai',
      };

      await cache.set(query1, response);
      const firstKey = mockRedisClient.set.mock.calls[0][0];

      mockRedisClient.set.mockClear();
      await cache.set(query2, response);
      const secondKey = mockRedisClient.set.mock.calls[0][0];

      expect(firstKey).not.toBe(secondKey);
    });
  });

  describe('singleton getLLMResponseCache', () => {
    it('should create instance on first call', () => {
      const cache1 = getLLMResponseCache();
      const cache2 = getLLMResponseCache();

      expect(cache1).toBe(cache2);
    });

    it('should update config if provided on subsequent calls', () => {
      const cache1 = getLLMResponseCache({
        similarityThreshold: 0.85,
      });
      const config1 = cache1.getConfig();
      expect(config1.similarityThreshold).toBe(0.85);

      const cache2 = getLLMResponseCache({
        similarityThreshold: 0.95,
      });
      const config2 = cache2.getConfig();
      expect(config2.similarityThreshold).toBe(0.95);
      expect(cache1).toBe(cache2);
    });

    it('should reset instance when resetLLMResponseCache is called', () => {
      const cache1 = getLLMResponseCache();
      resetLLMResponseCache();
      const cache2 = getLLMResponseCache();

      expect(cache1).not.toBe(cache2);
    });
  });

  describe('semantic search with model/provider filtering', () => {
    it('should not match if model differs', async () => {
      const query: LLMQuery = {
        prompt: 'what is AI?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const cachedEntry: CachedLLMEntry = {
        query: {
          prompt: 'what is artificial intelligence?',
          model: 'gpt-3.5',
          provider: 'openai',
        },
        response: {
          content: 'AI is...',
          model: 'gpt-3.5',
          provider: 'openai',
        },
        embedding: [0.9, 0.1, 0.1],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc'],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.85, 0.15, 0.1]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.85,
      });

      const result = await cache.get(query);

      expect(result).toBeNull();
    });

    it('should not match if provider differs', async () => {
      const query: LLMQuery = {
        prompt: 'what is AI?',
        model: 'gpt-4',
        provider: 'openai',
      };

      const cachedEntry: CachedLLMEntry = {
        query: {
          prompt: 'what is artificial intelligence?',
          model: 'gpt-4',
          provider: 'anthropic',
        },
        response: {
          content: 'AI is...',
          model: 'gpt-4',
          provider: 'anthropic',
        },
        embedding: [0.9, 0.1, 0.1],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc'],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.85, 0.15, 0.1]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.85,
      });

      const result = await cache.get(query);

      expect(result).toBeNull();
    });

    it('should match when query has no model/provider specified', async () => {
      const query: LLMQuery = {
        prompt: 'what is AI?',
      };

      const cachedEntry: CachedLLMEntry = {
        query: {
          prompt: 'what is artificial intelligence?',
          model: 'gpt-4',
          provider: 'openai',
        },
        response: {
          content: 'AI is...',
          model: 'gpt-4',
          provider: 'openai',
        },
        embedding: [0.9, 0.1, 0.1],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0,
      };

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(cachedEntry);
      mockRedisClient.getClient.mockReturnValueOnce({
        scan: jest.fn().mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:abc'],
        }),
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.85, 0.15, 0.1]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
        similarityThreshold: 0.85,
      });

      const result = await cache.get(query);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('AI is...');
    });
  });

  describe('SCAN pagination', () => {
    it('should handle multiple SCAN iterations', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const mockScan = jest
        .fn()
        .mockResolvedValueOnce({
          cursor: 1,
          keys: ['embedding:llm:key1'],
        })
        .mockResolvedValueOnce({
          cursor: 0,
          keys: ['embedding:llm:key2'],
        });

      mockRedisClient.getClient.mockReturnValueOnce({
        scan: mockScan,
      });
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);

      const cache = new LLMResponseCache({
        enableSemanticSearch: true,
        embeddingService: mockEmbeddingService as any,
      });

      await cache.get({ prompt: 'test' });

      expect(mockScan).toHaveBeenCalledTimes(2);
    });
  });
});
