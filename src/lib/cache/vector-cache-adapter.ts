/**
 * Vector Cache Adapter
 * Integrates cache layer with vector database and embedding services
 */

import { queryCache, cacheUtils } from './query-cache'
import { logger } from '@/lib/logger'

export interface CachedVectorResult {
  documents: Array<{
    id: string
    content: string
    metadata: any
    similarity: number
  }>
  cached: boolean
  cacheKey: string
  timestamp: string
}

export interface CachedEmbedding {
  embedding: number[]
  model: string
  cached: boolean
  cacheKey: string
  timestamp: string
}

/**
 * Vector Cache Adapter for database queries and embeddings
 */
export class VectorCacheAdapter {
  private defaultVectorTTL = 30 * 60 * 1000 // 30 minutes for vector searches
  private defaultEmbeddingTTL = 60 * 60 * 1000 // 1 hour for embeddings

  /**
   * Cache and retrieve vector search results
   */
  async searchWithCache(
    searchFunction: () => Promise<any[]>,
    query: string,
    options: {
      collection?: string
      limit?: number
      threshold?: number
      ttl?: number
    } = {}
  ): Promise<CachedVectorResult> {
    const cacheKey = cacheUtils.vectorSearchKey(query, options.collection, options.limit)
    
    try {
      // Try to get from cache first
      const cachedResult = await queryCache.get<CachedVectorResult>(cacheKey)
      
      if (cachedResult) {
        logger.info(`📦 Vector search cache HIT for query: "${query.substring(0, 50)}..."`)
        return {
          ...cachedResult,
          cached: true
        }
      }

      // Cache miss - execute search
      logger.info(`🔍 Vector search cache MISS for query: "${query.substring(0, 50)}..."`)
      const searchResults = await searchFunction()
      
      const result: CachedVectorResult = {
        documents: searchResults,
        cached: false,
        cacheKey,
        timestamp: new Date().toISOString()
      }

      // Cache the results
      await queryCache.set(cacheKey, result, {
        ttl: options.ttl || this.defaultVectorTTL,
        tags: ['vector_search', options.collection || 'default'],
        queryType: 'vector',
        cost: 5 // Vector searches are expensive
      })

      return result

    } catch (error) {
      logger.error('Vector search cache error:', error)
      
      // Fallback to direct search if cache fails
      const searchResults = await searchFunction()
      return {
        documents: searchResults,
        cached: false,
        cacheKey,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Cache and retrieve embeddings
   */
  async generateEmbeddingWithCache(
    embeddingFunction: () => Promise<number[]>,
    text: string,
    options: {
      model?: string
      ttl?: number
    } = {}
  ): Promise<CachedEmbedding> {
    const cacheKey = cacheUtils.embeddingKey(text, options.model)
    
    try {
      // Try to get from cache first
      const cachedEmbedding = await queryCache.get<CachedEmbedding>(cacheKey)
      
      if (cachedEmbedding) {
        logger.info(`📦 Embedding cache HIT for text: "${text.substring(0, 30)}..."`)
        return {
          ...cachedEmbedding,
          cached: true
        }
      }

      // Cache miss - generate embedding
      logger.info(`🔥 Embedding cache MISS for text: "${text.substring(0, 30)}..."`)
      const embedding = await embeddingFunction()
      
      const result: CachedEmbedding = {
        embedding,
        model: options.model || 'default',
        cached: false,
        cacheKey,
        timestamp: new Date().toISOString()
      }

      // Cache the embedding
      await queryCache.set(cacheKey, result, {
        ttl: options.ttl || this.defaultEmbeddingTTL,
        tags: ['embedding', options.model || 'default'],
        queryType: 'embedding',
        cost: 10 // Embeddings are very expensive
      })

      return result

    } catch (error) {
      logger.error('Embedding cache error:', error)
      
      // Fallback to direct generation if cache fails
      const embedding = await embeddingFunction()
      return {
        embedding,
        model: options.model || 'default',
        cached: false,
        cacheKey,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Cache database query results
   */
  async queryWithCache<T>(
    queryFunction: () => Promise<T>,
    sql: string,
    params?: any[],
    options: {
      ttl?: number
      tags?: string[]
    } = {}
  ): Promise<{ data: T; cached: boolean; cacheKey: string }> {
    const cacheKey = cacheUtils.databaseQueryKey(sql, params)
    
    try {
      // Try to get from cache first
      const cachedData = await queryCache.get<T>(cacheKey)
      
      if (cachedData) {
        logger.info(`📦 Database query cache HIT`)
        return {
          data: cachedData,
          cached: true,
          cacheKey
        }
      }

      // Cache miss - execute query
      logger.info(`🗄️ Database query cache MISS`)
      const queryResult = await queryFunction()
      
      // Cache the results
      await queryCache.set(cacheKey, queryResult, {
        ttl: options.ttl || 5 * 60 * 1000, // 5 minutes for DB queries
        tags: ['database', ...(options.tags || [])],
        queryType: 'database',
        cost: 3 // Database queries have medium cost
      })

      return {
        data: queryResult,
        cached: false,
        cacheKey
      }

    } catch (error) {
      logger.error('Database query cache error:', error)
      
      // Fallback to direct query if cache fails
      const queryResult = await queryFunction()
      return {
        data: queryResult,
        cached: false,
        cacheKey
      }
    }
  }

  /**
   * Cache API responses
   */
  async apiCallWithCache<T>(
    apiFunction: () => Promise<T>,
    endpoint: string,
    params?: any,
    options: {
      ttl?: number
      tags?: string[]
    } = {}
  ): Promise<{ data: T; cached: boolean; cacheKey: string }> {
    const cacheKey = cacheUtils.apiResponseKey(endpoint, params)
    
    try {
      const cachedData = await queryCache.get<T>(cacheKey)
      
      if (cachedData) {
        logger.info(`📦 API cache HIT for ${endpoint}`)
        return {
          data: cachedData,
          cached: true,
          cacheKey
        }
      }

      logger.info(`🌐 API cache MISS for ${endpoint}`)
      const apiResult = await apiFunction()
      
      await queryCache.set(cacheKey, apiResult, {
        ttl: options.ttl || 10 * 60 * 1000, // 10 minutes for API calls
        tags: ['api', ...(options.tags || [])],
        queryType: 'api',
        cost: 2 // API calls have low-medium cost
      })

      return {
        data: apiResult,
        cached: false,
        cacheKey
      }

    } catch (error) {
      logger.error('API cache error:', error)
      
      const apiResult = await apiFunction()
      return {
        data: apiResult,
        cached: false,
        cacheKey
      }
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    logger.info(`🗑️ Invalidating cache entries with tag: ${tag}`)
    return queryCache.deleteByTag(tag)
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidate(key: string): Promise<boolean> {
    return queryCache.delete(key)
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCommonQueries(commonQueries: Array<{
    type: 'vector' | 'embedding' | 'database' | 'api'
    key: string
    data: any
    ttl?: number
  }>): Promise<void> {
    logger.info(`🔥 Warming up cache with ${commonQueries.length} common queries...`)
    
    for (const query of commonQueries) {
      try {
        await queryCache.set(query.key, query.data, {
          ttl: query.ttl || this.getDefaultTTL(query.type),
          tags: [query.type],
          queryType: query.type,
          cost: this.getCostForType(query.type)
        })
      } catch (error) {
        logger.warn(`Failed to warm up cache for key ${query.key}:`, error)
      }
    }
    
    logger.info(`✅ Cache warm-up completed`)
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return queryCache.getStats()
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return queryCache.getMetrics()
  }

  /**
   * Get default TTL for query type
   */
  private getDefaultTTL(type: string): number {
    switch (type) {
      case 'vector': return this.defaultVectorTTL
      case 'embedding': return this.defaultEmbeddingTTL
      case 'database': return 5 * 60 * 1000 // 5 minutes
      case 'api': return 10 * 60 * 1000 // 10 minutes
      default: return 15 * 60 * 1000 // 15 minutes
    }
  }

  /**
   * Get cost for query type
   */
  private getCostForType(type: string): number {
    switch (type) {
      case 'embedding': return 10 // Most expensive
      case 'vector': return 5 // Expensive
      case 'database': return 3 // Medium
      case 'api': return 2 // Low-medium
      default: return 1 // Low
    }
  }
}

// Global vector cache adapter instance
export const vectorCacheAdapter = new VectorCacheAdapter()

// Export utility functions for integration
export const cacheIntegration = {
  /**
   * Wrap any vector search function with caching
   */
  wrapVectorSearch: (searchFn: Function) => {
    return async (query: string, options: any = {}) => {
      return vectorCacheAdapter.searchWithCache(
        () => searchFn(query, options),
        query,
        options
      )
    }
  },

  /**
   * Wrap any embedding function with caching
   */
  wrapEmbeddingGeneration: (embeddingFn: Function) => {
    return async (text: string, options: any = {}) => {
      return vectorCacheAdapter.generateEmbeddingWithCache(
        () => embeddingFn(text, options),
        text,
        options
      )
    }
  },

  /**
   * Wrap any database query function with caching
   */
  wrapDatabaseQuery: (queryFn: Function) => {
    return async (sql: string, params?: any[], options: any = {}) => {
      return vectorCacheAdapter.queryWithCache(
        () => queryFn(sql, params),
        sql,
        params,
        options
      )
    }
  }
}