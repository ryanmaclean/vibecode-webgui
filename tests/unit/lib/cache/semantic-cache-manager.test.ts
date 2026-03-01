/**
 * Tests for Semantic Cache Manager
 */

import { SemanticCacheManager } from '@/lib/cache/semantic-cache-manager'
import { CacheTTL } from '@/lib/cache/cache-constants'
import type { EmbeddingService } from '@/lib/ai/embedding-service'

// Mock Redis client
jest.mock('@/lib/cache/redis-client', () => ({
  getRedisClient: jest.fn()
}))

// Mock embedding service
const mockEmbeddingService: jest.Mocked<EmbeddingService> = {
  generateEmbedding: jest.fn(),
  batchGenerateEmbeddings: jest.fn(),
  getModel: jest.fn(),
  getDimensions: jest.fn()
}

// Import mocked Redis
import { getRedisClient } from '@/lib/cache/redis-client'

describe('SemanticCacheManager', () => {
  let mockRedis: any
  let cacheManager: SemanticCacheManager

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock Redis client
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        scan: jest.fn().mockResolvedValue({ cursor: 0, keys: [] })
      })
    }

    ;(getRedisClient as jest.Mock).mockResolvedValue(mockRedis)

    // Reset statistics
    cacheManager = new SemanticCacheManager('test')
    cacheManager.resetStats()
  })

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const manager = new SemanticCacheManager()
      const config = manager.getConfig()

      expect(config.similarityThreshold).toBe(0.85)
      expect(config.ttl).toBe(CacheTTL.LONG)
      expect(config.maxResults).toBe(10)
      expect(config.enablePgVector).toBe(false)
      expect(config.requireExactModelMatch).toBe(true)
      expect(config.requireExactProviderMatch).toBe(true)
    })

    it('should create instance with custom config', () => {
      const manager = new SemanticCacheManager('custom', {
        similarityThreshold: 0.9,
        ttl: CacheTTL.SHORT,
        maxResults: 5,
        enablePgVector: true,
        requireExactModelMatch: false,
        requireExactProviderMatch: false
      })
      const config = manager.getConfig()

      expect(config.similarityThreshold).toBe(0.9)
      expect(config.ttl).toBe(CacheTTL.SHORT)
      expect(config.maxResults).toBe(5)
      expect(config.enablePgVector).toBe(true)
      expect(config.requireExactModelMatch).toBe(false)
      expect(config.requireExactProviderMatch).toBe(false)
    })

    it('should create instance with custom prefix', () => {
      const manager = new SemanticCacheManager('my-prefix')
      expect(manager).toBeDefined()
    })

    it('should create instance with embedding service', () => {
      const manager = new SemanticCacheManager('test', {
        embeddingService: mockEmbeddingService
      })

      expect(manager.getEmbeddingService()).toBe(mockEmbeddingService)
    })
  })

  describe('calculateCosineSimilarity', () => {
    it('should calculate similarity for identical vectors', () => {
      const vector = [0.1, 0.2, 0.3, 0.4, 0.5]
      const similarity = SemanticCacheManager.calculateCosineSimilarity(vector, vector)

      expect(similarity).toBeCloseTo(1.0, 5)
    })

    it('should calculate similarity for orthogonal vectors', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]
      const similarity = SemanticCacheManager.calculateCosineSimilarity(a, b)

      expect(similarity).toBeCloseTo(0.0, 5)
    })

    it('should calculate similarity for opposite vectors', () => {
      const a = [1, 0, 0]
      const b = [-1, 0, 0]
      const similarity = SemanticCacheManager.calculateCosineSimilarity(a, b)

      expect(similarity).toBeCloseTo(-1.0, 5)
    })

    it('should calculate similarity for similar vectors', () => {
      const a = [0.1, 0.2, 0.3]
      const b = [0.15, 0.25, 0.35]
      const similarity = SemanticCacheManager.calculateCosineSimilarity(a, b)

      expect(similarity).toBeGreaterThan(0.9)
    })

    it('should return 0 for zero magnitude vectors', () => {
      const a = [0, 0, 0]
      const b = [1, 2, 3]
      const similarity = SemanticCacheManager.calculateCosineSimilarity(a, b)

      expect(similarity).toBe(0)
    })

    it('should throw error for mismatched dimensions', () => {
      const a = [1, 2, 3]
      const b = [1, 2]

      expect(() => {
        SemanticCacheManager.calculateCosineSimilarity(a, b)
      }).toThrow('Vectors must have the same dimensions')
    })

    it('should handle large vectors', () => {
      const a = new Array(1536).fill(0).map((_, i) => i / 1536)
      const b = new Array(1536).fill(0).map((_, i) => (i + 1) / 1536)
      const similarity = SemanticCacheManager.calculateCosineSimilarity(a, b)

      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
  })

  describe('findSimilar', () => {
    it('should return exact match when available', async () => {
      const query = {
        text: 'What is the capital of France?',
        model: 'gpt-4',
        provider: 'openai'
      }

      const cachedEntry = {
        query,
        data: 'Paris',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(cachedEntry)

      const result = await cacheManager.findSimilar(query)

      expect(result).toBeDefined()
      expect(result?.similarity).toBe(1.0)
      expect(result?.isExactMatch).toBe(true)
      expect(result?.entry.data).toBe('Paris')
    })

    it('should return null when Redis is not available', async () => {
      ;(getRedisClient as jest.Mock).mockResolvedValue(null)

      const query = { text: 'test query' }
      const result = await cacheManager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should return null when no exact match and no embedding', async () => {
      mockRedis.get.mockResolvedValue(null)

      const query = { text: 'test query' }
      const result = await cacheManager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should find similar entry using provided embedding', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3]
      const query = {
        text: 'What is the capital of France?',
        embedding: queryEmbedding
      }

      const cachedEntry = {
        query: { text: 'What is the capital of France?' },
        data: 'Paris',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:abc123']
        })
      })

      // Return cached entry for the key
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:abc123') {
          return Promise.resolve(cachedEntry)
        }
        return Promise.resolve(null)
      })

      const result = await cacheManager.findSimilar(query)

      expect(result).toBeDefined()
      expect(result?.similarity).toBeCloseTo(1.0, 5)
      expect(result?.isExactMatch).toBe(false)
    })

    it('should use embedding service to generate embedding', async () => {
      const manager = new SemanticCacheManager('test', {
        embeddingService: mockEmbeddingService
      })

      const queryEmbedding = [0.1, 0.2, 0.3]
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding)

      const query = { text: 'test query' }

      mockRedis.get.mockResolvedValue(null)

      await manager.findSimilar(query)

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query')
    })

    it('should skip expired entries', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3]
      const query = {
        text: 'test query',
        embedding: queryEmbedding
      }

      const expiredEntry = {
        query: { text: 'test query' },
        data: 'expired data',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000, // Expired 1 hour ago
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:expired']
        })
      })

      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:expired') {
          return Promise.resolve(expiredEntry)
        }
        return Promise.resolve(null)
      })

      const result = await cacheManager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should respect similarity threshold', async () => {
      const manager = new SemanticCacheManager('test', {
        similarityThreshold: 0.95
      })

      const queryEmbedding = [1, 0, 0]
      const query = {
        text: 'test query',
        embedding: queryEmbedding
      }

      const cachedEntry = {
        query: { text: 'different query' },
        data: 'cached data',
        embedding: [0.8, 0.6, 0], // Similarity will be 0.8, below threshold
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:cached']
        })
      })

      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:cached') {
          return Promise.resolve(cachedEntry)
        }
        return Promise.resolve(null)
      })

      const result = await manager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should require exact model match when configured', async () => {
      const manager = new SemanticCacheManager('test', {
        requireExactModelMatch: true,
        similarityThreshold: 0.8
      })

      const queryEmbedding = [0.1, 0.2, 0.3]
      const query = {
        text: 'test query',
        embedding: queryEmbedding,
        model: 'gpt-4'
      }

      const cachedEntry = {
        query: { text: 'test query', model: 'gpt-3.5-turbo' },
        data: 'cached data',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:cached']
        })
      })

      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:cached') {
          return Promise.resolve(cachedEntry)
        }
        return Promise.resolve(null)
      })

      const result = await manager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should require exact provider match when configured', async () => {
      const manager = new SemanticCacheManager('test', {
        requireExactProviderMatch: true,
        similarityThreshold: 0.8
      })

      const queryEmbedding = [0.1, 0.2, 0.3]
      const query = {
        text: 'test query',
        embedding: queryEmbedding,
        provider: 'openai'
      }

      const cachedEntry = {
        query: { text: 'test query', provider: 'anthropic' },
        data: 'cached data',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:cached']
        })
      })

      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:cached') {
          return Promise.resolve(cachedEntry)
        }
        return Promise.resolve(null)
      })

      const result = await manager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      const query = { text: 'test query' }
      const result = await cacheManager.findSimilar(query)

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should cache entry with provided embedding', async () => {
      const query = {
        text: 'What is the capital of France?',
        embedding: [0.1, 0.2, 0.3]
      }
      const data = 'Paris'

      const result = await cacheManager.set(query, data)

      expect(result).toBe(true)
      expect(mockRedis.set).toHaveBeenCalled()

      const setCall = mockRedis.set.mock.calls[0]
      const entry = setCall[1]

      expect(entry.query).toEqual(query)
      expect(entry.data).toBe(data)
      expect(entry.embedding).toEqual([0.1, 0.2, 0.3])
      expect(entry.hitCount).toBe(0)
    })

    it('should generate embedding using embedding service', async () => {
      const manager = new SemanticCacheManager('test', {
        embeddingService: mockEmbeddingService
      })

      const queryEmbedding = [0.1, 0.2, 0.3]
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding)

      const query = { text: 'test query' }
      const data = 'test data'

      const result = await manager.set(query, data)

      expect(result).toBe(true)
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query')
    })

    it('should return false when Redis is not available', async () => {
      ;(getRedisClient as jest.Mock).mockResolvedValue(null)

      const query = {
        text: 'test query',
        embedding: [0.1, 0.2, 0.3]
      }
      const data = 'test data'

      const result = await cacheManager.set(query, data)

      expect(result).toBe(false)
    })

    it('should return false when no embedding can be generated', async () => {
      const query = { text: 'test query' }
      const data = 'test data'

      const result = await cacheManager.set(query, data)

      expect(result).toBe(false)
    })

    it('should use custom TTL when provided', async () => {
      const query = {
        text: 'test query',
        embedding: [0.1, 0.2, 0.3]
      }
      const data = 'test data'

      await cacheManager.set(query, data, CacheTTL.SHORT)

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        CacheTTL.SHORT
      )
    })

    it('should use default TTL when not provided', async () => {
      const query = {
        text: 'test query',
        embedding: [0.1, 0.2, 0.3]
      }
      const data = 'test data'

      await cacheManager.set(query, data)

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        CacheTTL.LONG
      )
    })

    it('should handle errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'))

      const query = {
        text: 'test query',
        embedding: [0.1, 0.2, 0.3]
      }
      const data = 'test data'

      const result = await cacheManager.set(query, data)

      expect(result).toBe(false)
    })
  })

  describe('invalidate', () => {
    it('should delete cache entry', async () => {
      mockRedis.delete.mockResolvedValue(true)

      const query = {
        text: 'test query',
        model: 'gpt-4',
        provider: 'openai'
      }

      const result = await cacheManager.invalidate(query)

      expect(result).toBe(true)
      expect(mockRedis.delete).toHaveBeenCalled()
    })

    it('should return false when Redis is not available', async () => {
      ;(getRedisClient as jest.Mock).mockResolvedValue(null)

      const query = { text: 'test query' }
      const result = await cacheManager.invalidate(query)

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      mockRedis.delete.mockRejectedValue(new Error('Redis error'))

      const query = { text: 'test query' }
      const result = await cacheManager.invalidate(query)

      expect(result).toBe(false)
    })
  })

  describe('clear', () => {
    it('should delete all cache entries with prefix', async () => {
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:key1', 'test:key2', 'test:key3']
        })
      })

      mockRedis.deleteMany.mockResolvedValue(true)

      const result = await cacheManager.clear()

      expect(result).toBe(true)
      expect(mockRedis.deleteMany).toHaveBeenCalledWith(['test:key1', 'test:key2', 'test:key3'])
    })

    it('should return true when no keys to delete', async () => {
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: []
        })
      })

      const result = await cacheManager.clear()

      expect(result).toBe(true)
      expect(mockRedis.deleteMany).not.toHaveBeenCalled()
    })

    it('should return false when Redis is not available', async () => {
      ;(getRedisClient as jest.Mock).mockResolvedValue(null)

      const result = await cacheManager.clear()

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockRejectedValue(new Error('Redis error'))
      })

      const result = await cacheManager.clear()

      expect(result).toBe(false)
    })
  })

  describe('shouldSkipCache', () => {
    it('should skip for very short queries', () => {
      const query = { text: 'Hi' }

      expect(cacheManager.shouldSkipCache(query)).toBe(true)
    })

    it('should skip for empty queries', () => {
      const query = { text: '' }

      expect(cacheManager.shouldSkipCache(query)).toBe(true)
    })

    it('should skip when no embedding service and no embedding', () => {
      const query = { text: 'This is a valid query text' }

      expect(cacheManager.shouldSkipCache(query)).toBe(true)
    })

    it('should not skip when embedding is provided', () => {
      const query = {
        text: 'This is a valid query text',
        embedding: [0.1, 0.2, 0.3]
      }

      expect(cacheManager.shouldSkipCache(query)).toBe(false)
    })

    it('should not skip when embedding service is available', () => {
      const manager = new SemanticCacheManager('test', {
        embeddingService: mockEmbeddingService
      })

      const query = { text: 'This is a valid query text' }

      expect(manager.shouldSkipCache(query)).toBe(false)
    })

    it('should skip for whitespace-only queries', () => {
      const query = { text: '   \n\t  ' }

      expect(cacheManager.shouldSkipCache(query)).toBe(true)
    })
  })

  describe('statistics', () => {
    it('should track cache hits', async () => {
      cacheManager.resetStats()

      const query = { text: 'test query' }
      const cachedEntry = {
        query,
        data: 'test data',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(cachedEntry)

      await cacheManager.findSimilar(query)

      const stats = cacheManager.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(0)
    })

    it('should track cache misses', async () => {
      cacheManager.resetStats()

      mockRedis.get.mockResolvedValue(null)

      const query = { text: 'test query' }
      await cacheManager.findSimilar(query)

      const stats = cacheManager.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(1)
    })

    it('should track cache skips', () => {
      cacheManager.resetStats()

      const query = { text: 'short' }
      cacheManager.shouldSkipCache(query)

      const stats = cacheManager.getStats()
      expect(stats.skips).toBe(1)
    })

    it('should calculate hit rate correctly', async () => {
      cacheManager.resetStats()

      const query = { text: 'test query' }
      const cachedEntry = {
        query,
        data: 'test data',
        embedding: [0.1, 0.2, 0.3],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      // 2 hits
      mockRedis.get.mockResolvedValue(cachedEntry)
      await cacheManager.findSimilar(query)
      await cacheManager.findSimilar(query)

      // 1 miss
      mockRedis.get.mockResolvedValue(null)
      await cacheManager.findSimilar({ text: 'different query' })

      const stats = cacheManager.getStats()
      expect(stats.hitRate).toBeCloseTo(2 / 3, 5)
    })

    it('should reset statistics', () => {
      cacheManager.resetStats()
      cacheManager.shouldSkipCache({ text: 'short' })

      cacheManager.resetStats()

      const stats = cacheManager.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.skips).toBe(0)
      expect(stats.errors).toBe(0)
    })
  })

  describe('configuration', () => {
    it('should get current configuration', () => {
      const manager = new SemanticCacheManager('test', {
        similarityThreshold: 0.9,
        ttl: CacheTTL.SHORT
      })

      const config = manager.getConfig()

      expect(config.similarityThreshold).toBe(0.9)
      expect(config.ttl).toBe(CacheTTL.SHORT)
    })

    it('should update configuration', () => {
      const manager = new SemanticCacheManager('test', {
        similarityThreshold: 0.85
      })

      manager.updateConfig({
        similarityThreshold: 0.95,
        maxResults: 20
      })

      const config = manager.getConfig()
      expect(config.similarityThreshold).toBe(0.95)
      expect(config.maxResults).toBe(20)
    })

    it('should update embedding service via config', () => {
      const manager = new SemanticCacheManager('test')

      manager.updateConfig({
        embeddingService: mockEmbeddingService
      })

      expect(manager.getEmbeddingService()).toBe(mockEmbeddingService)
    })

    it('should set embedding service directly', () => {
      const manager = new SemanticCacheManager('test')

      manager.setEmbeddingService(mockEmbeddingService)

      expect(manager.getEmbeddingService()).toBe(mockEmbeddingService)
    })

    it('should get embedding service', () => {
      const manager = new SemanticCacheManager('test', {
        embeddingService: mockEmbeddingService
      })

      expect(manager.getEmbeddingService()).toBe(mockEmbeddingService)
    })
  })

  describe('edge cases', () => {
    it('should handle multiple similar entries', async () => {
      const queryEmbedding = [1, 0, 0]
      const query = {
        text: 'test query',
        embedding: queryEmbedding
      }

      const entry1 = {
        query: { text: 'query 1' },
        data: 'data 1',
        embedding: [0.9, 0.1, 0],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      const entry2 = {
        query: { text: 'query 2' },
        data: 'data 2',
        embedding: [0.95, 0.05, 0], // More similar
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:key1', 'test:key2']
        })
      })

      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:key1') return Promise.resolve(entry1)
        if (key === 'test:key2') return Promise.resolve(entry2)
        return Promise.resolve(null)
      })

      const result = await cacheManager.findSimilar(query)

      expect(result).toBeDefined()
      expect(result?.entry.data).toBe('data 2') // Should return most similar
    })

    it('should handle entries without embeddings', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3]
      const query = {
        text: 'test query',
        embedding: queryEmbedding
      }

      const entryWithoutEmbedding = {
        query: { text: 'query without embedding' },
        data: 'data',
        embedding: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 0
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue({
        scan: jest.fn().mockResolvedValue({
          cursor: 0,
          keys: ['test:key1']
        })
      })

      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'test:key1') return Promise.resolve(entryWithoutEmbedding)
        return Promise.resolve(null)
      })

      const result = await cacheManager.findSimilar(query)

      expect(result).toBeNull()
    })

    it('should handle pagination with SCAN cursor', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3]
      const query = {
        text: 'test query',
        embedding: queryEmbedding
      }

      mockRedis.get.mockResolvedValue(null)

      const scanMock = jest.fn()
        .mockResolvedValueOnce({ cursor: 100, keys: ['test:key1'] })
        .mockResolvedValueOnce({ cursor: 0, keys: ['test:key2'] })

      mockRedis.getClient.mockReturnValue({
        scan: scanMock
      })

      await cacheManager.findSimilar(query)

      expect(scanMock).toHaveBeenCalledTimes(2)
    })

    it('should handle null Redis client from getClient', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.getClient.mockReturnValue(null)

      const query = {
        text: 'test query',
        embedding: [0.1, 0.2, 0.3]
      }

      const result = await cacheManager.findSimilar(query)

      expect(result).toBeNull()
    })
  })
})
