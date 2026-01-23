/**
 * Tests for PgVector Search
 */

import { PgVectorSearch } from '@/lib/cache/pgvector-search'
import { VectorCacheManager } from '@/lib/cache/vector-cache-strategy'

// Mock the cache manager
jest.mock('@/lib/cache/vector-cache-strategy', () => ({
  VectorCacheManager: {
    getCachedResults: jest.fn(),
    setCachedResults: jest.fn()
  }
}))

describe('PgVectorSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findSimilarCode', () => {
    it('should return empty results for mock implementation', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5]
      const results = await PgVectorSearch.findSimilarCode(embedding)

      expect(results).toEqual([])
    })

    it('should accept embedding array', async () => {
      const embedding = new Array(1536).fill(0).map((_, i) => i / 1536)
      const results = await PgVectorSearch.findSimilarCode(embedding)

      expect(Array.isArray(results)).toBe(true)
    })

    it('should accept options parameter', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const options = {
        limit: 10,
        minSimilarity: 0.7,
        workspace: 'test-workspace'
      }

      const results = await PgVectorSearch.findSimilarCode(embedding, options)

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle limit option', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const results = await PgVectorSearch.findSimilarCode(embedding, { limit: 5 })

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle minSimilarity option', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const results = await PgVectorSearch.findSimilarCode(embedding, {
        minSimilarity: 0.8
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle workspace option', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const results = await PgVectorSearch.findSimilarCode(embedding, {
        workspace: 'production'
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle contentTypes option', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const results = await PgVectorSearch.findSimilarCode(embedding, {
        contentTypes: ['code', 'documentation']
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle empty options', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const results = await PgVectorSearch.findSimilarCode(embedding, {})

      expect(Array.isArray(results)).toBe(true)
    })

    describe('caching behavior', () => {
      it('should not use cache when useCache is false', async () => {
        const embedding = [0.1, 0.2, 0.3]
        await PgVectorSearch.findSimilarCode(embedding, { useCache: false })

        expect(VectorCacheManager.getCachedResults).not.toHaveBeenCalled()
      })

      it('should not use cache when useCache is undefined', async () => {
        const embedding = [0.1, 0.2, 0.3]
        await PgVectorSearch.findSimilarCode(embedding, {})

        expect(VectorCacheManager.getCachedResults).not.toHaveBeenCalled()
      })

      it('should check cache when useCache is true', async () => {
        ;(VectorCacheManager.getCachedResults as jest.Mock).mockResolvedValue(null)

        const embedding = [0.1, 0.2, 0.3]
        await PgVectorSearch.findSimilarCode(embedding, { useCache: true })

        expect(VectorCacheManager.getCachedResults).toHaveBeenCalled()
      })

      it('should return cached results when available', async () => {
        const cachedResults = [
          {
            id: '1',
            content: 'function test() {}',
            similarity: 0.9,
            metadata: { language: 'typescript' }
          }
        ]
        ;(VectorCacheManager.getCachedResults as jest.Mock).mockResolvedValue(cachedResults)

        const embedding = [0.1, 0.2, 0.3]
        const results = await PgVectorSearch.findSimilarCode(embedding, {
          useCache: true
        })

        expect(results).toEqual(cachedResults)
      })

      it('should truncate embedding for cache key', async () => {
        ;(VectorCacheManager.getCachedResults as jest.Mock).mockResolvedValue(null)

        const embedding = new Array(100).fill(0.5)
        await PgVectorSearch.findSimilarCode(embedding, {
          useCache: true,
          workspace: 'test'
        })

        expect(VectorCacheManager.getCachedResults).toHaveBeenCalledWith(
          expect.objectContaining({
            embedding: embedding.slice(0, 10)
          }),
          'test'
        )
      })

      it('should pass workspace to cache manager', async () => {
        ;(VectorCacheManager.getCachedResults as jest.Mock).mockResolvedValue(null)

        const embedding = [0.1, 0.2, 0.3]
        const workspace = 'my-workspace'
        await PgVectorSearch.findSimilarCode(embedding, {
          useCache: true,
          workspace
        })

        expect(VectorCacheManager.getCachedResults).toHaveBeenCalledWith(
          expect.any(Object),
          workspace
        )
      })

      it('should include options in cache key', async () => {
        ;(VectorCacheManager.getCachedResults as jest.Mock).mockResolvedValue(null)

        const embedding = [0.1, 0.2, 0.3]
        const options = {
          useCache: true,
          limit: 10,
          minSimilarity: 0.7
        }
        await PgVectorSearch.findSimilarCode(embedding, options)

        expect(VectorCacheManager.getCachedResults).toHaveBeenCalledWith(
          expect.objectContaining({
            embedding: embedding,
            limit: 10,
            minSimilarity: 0.7,
            table: 'code_chunks'
          }),
          undefined
        )
      })
    })

    describe('edge cases', () => {
      it('should handle empty embedding array', async () => {
        const results = await PgVectorSearch.findSimilarCode([])

        expect(results).toEqual([])
      })

      it('should handle single element embedding', async () => {
        const results = await PgVectorSearch.findSimilarCode([0.5])

        expect(results).toEqual([])
      })

      it('should handle very large embeddings', async () => {
        const largeEmbedding = new Array(4096).fill(0).map((_, i) => Math.random())
        const results = await PgVectorSearch.findSimilarCode(largeEmbedding)

        expect(results).toEqual([])
      })

      it('should handle negative values in embedding', async () => {
        const embedding = [-0.5, -0.3, 0.1, 0.8]
        const results = await PgVectorSearch.findSimilarCode(embedding)

        expect(results).toEqual([])
      })

      it('should handle zero values in embedding', async () => {
        const embedding = [0, 0, 0, 0, 0]
        const results = await PgVectorSearch.findSimilarCode(embedding)

        expect(results).toEqual([])
      })
    })
  })

  describe('getCacheStats', () => {
    it('should return stats object', () => {
      const stats = PgVectorSearch.getCacheStats()

      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('size')
    })

    it('should return zero values for mock implementation', () => {
      const stats = PgVectorSearch.getCacheStats()

      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.size).toBe(0)
    })

    it('should return numeric values', () => {
      const stats = PgVectorSearch.getCacheStats()

      expect(typeof stats.hits).toBe('number')
      expect(typeof stats.misses).toBe('number')
      expect(typeof stats.size).toBe('number')
    })

    it('should be callable multiple times', () => {
      const stats1 = PgVectorSearch.getCacheStats()
      const stats2 = PgVectorSearch.getCacheStats()

      expect(stats1).toEqual(stats2)
    })
  })
})
