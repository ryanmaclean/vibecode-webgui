/**
 * Cached Azure Embedding Service
 * Extends the Azure Embedding Service with intelligent caching capabilities
 */

import { AzureEmbeddingService } from './azureEmbeddingService'
import { vectorCacheAdapter } from '../cache/vector-cache-adapter'
import { PrismaClient } from '@prisma/client'

interface CachedEmbeddingOptions {
  dimensions?: number
  user?: string
  ttl?: number
  skipCache?: boolean
}

/**
 * Azure Embedding Service with intelligent caching
 */
export class CachedAzureEmbeddingService extends AzureEmbeddingService {
  private cacheEnabled: boolean = true

  constructor(
    apiKey: string,
    endpoint: string,
    deploymentName: string,
    apiVersion: string = '2023-05-15',
    prisma: PrismaClient | null = null,
    useManagedIdentity: boolean = false,
    useConnectionPool: boolean = false,
    enableCache: boolean = true
  ) {
    super(apiKey, endpoint, deploymentName, apiVersion, prisma, useManagedIdentity, useConnectionPool)
    this.cacheEnabled = enableCache
    
    if (enableCache) {
      console.log('🚀 Cached Azure Embedding Service initialized with caching enabled')
    }
  }

  /**
   * Generate embedding with caching support
   * 
   * @param text - Text to generate embedding for
   * @param options - Optional parameters including cache options
   * @returns Promise<number[]> - Vector embedding
   */
  public async generateEmbedding(text: string, options: CachedEmbeddingOptions = {}): Promise<number[]> {
    // If caching is disabled or explicitly skipped, use parent method
    if (!this.cacheEnabled || options.skipCache) {
      return super.generateEmbedding(text, options)
    }

    try {
      // Use cache adapter to handle caching logic
      const result = await vectorCacheAdapter.generateEmbeddingWithCache(
        () => super.generateEmbedding(text, options),
        text,
        {
          model: 'azure-embedding',
          ttl: options.ttl
        }
      )

      // Log cache performance for monitoring
      if (result.cached) {
        console.log(`📦 Embedding cache hit - saved API call for "${text.substring(0, 30)}..."`)
      } else {
        console.log(`🔥 Embedding generated and cached for "${text.substring(0, 30)}..."`)
      }

      return result.embedding

    } catch (error) {
      console.error('Cached embedding generation error:', error)
      
      // Fallback to direct generation if cache fails
      console.log('🔄 Falling back to direct embedding generation')
      return super.generateEmbedding(text, options)
    }
  }

  /**
   * Generate embeddings for multiple texts with batch caching
   */
  public async generateEmbeddingsBatch(
    texts: string[], 
    options: CachedEmbeddingOptions = {}
  ): Promise<{ text: string; embedding: number[]; cached: boolean }[]> {
    // Process texts in parallel for better performance
    const promises = texts.map(async (text) => {
      try {
        if (!this.cacheEnabled || options.skipCache) {
          const embedding = await super.generateEmbedding(text, options)
          return { text, embedding, cached: false }
        }

        const result = await vectorCacheAdapter.generateEmbeddingWithCache(
          () => super.generateEmbedding(text, options),
          text,
          {
            model: 'azure-embedding',
            ttl: options.ttl
          }
        )

        return { 
          text, 
          embedding: result.embedding, 
          cached: result.cached 
        }

      } catch (error) {
        console.error(`Error generating embedding for text "${text.substring(0, 30)}...":`, error)
        
        // Fallback to direct generation
        const embedding = await super.generateEmbedding(text, options)
        return { text, embedding, cached: false }
      }
    })

    const batchResults = await Promise.all(promises)
    
    // Log batch statistics
    const cachedCount = batchResults.filter(r => r.cached).length
    const totalCount = batchResults.length
    console.log(`📊 Batch embedding generation: ${cachedCount}/${totalCount} from cache (${Math.round((cachedCount/totalCount) * 100)}% hit rate)`)

    return batchResults
  }

  /**
   * Preload embeddings into cache
   */
  public async preloadEmbeddings(
    commonTexts: string[], 
    options: CachedEmbeddingOptions = {}
  ): Promise<void> {
    console.log(`🔥 Preloading ${commonTexts.length} common embeddings into cache...`)
    
    const batchResults = await this.generateEmbeddingsBatch(commonTexts, {
      ...options,
      ttl: options.ttl || 60 * 60 * 1000 // 1 hour default for preloaded embeddings
    })
    
    const newlyGenerated = batchResults.filter(r => !r.cached).length
    console.log(`✅ Preload complete: ${newlyGenerated} new embeddings generated and cached`)
  }

  /**
   * Clear embedding cache for this service
   */
  public async clearEmbeddingCache(): Promise<number> {
    console.log('🗑️ Clearing embedding cache for Azure service...')
    return vectorCacheAdapter.invalidateByTag('azure-embedding')
  }

  /**
   * Get embedding cache statistics
   */
  public getCacheStats() {
    return vectorCacheAdapter.getCacheStats()
  }

  /**
   * Enable or disable caching
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
    console.log(`Cache ${enabled ? 'enabled' : 'disabled'} for Azure Embedding Service`)
  }

  /**
   * Get cache status
   */
  public isCacheEnabled(): boolean {
    return this.cacheEnabled
  }

  /**
   * Generate embedding with detailed cache metrics
   */
  public async generateEmbeddingWithMetrics(text: string, options: CachedEmbeddingOptions = {}) {
    const startTime = Date.now()
    
    const embedding = await this.generateEmbedding(text, options)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    return {
      embedding,
      metrics: {
        duration,
        textLength: text.length,
        cacheEnabled: this.cacheEnabled,
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * Factory function to create cached embedding service
 */
export function createCachedAzureEmbeddingService(
  config: {
    apiKey?: string
    endpoint?: string
    deploymentName?: string
    apiVersion?: string
    useManagedIdentity?: boolean
    useConnectionPool?: boolean
    enableCache?: boolean
  }
): CachedAzureEmbeddingService {
  const {
    apiKey = process.env.AZURE_OPENAI_API_KEY || '',
    endpoint = process.env.AZURE_OPENAI_ENDPOINT || '',
    deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
    apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
    useManagedIdentity = process.env.USE_AZURE_MANAGED_IDENTITY === 'true',
    useConnectionPool = process.env.USE_CONNECTION_POOL === 'true',
    enableCache = true
  } = config

  return new CachedAzureEmbeddingService(
    apiKey,
    endpoint,
    deploymentName,
    apiVersion,
    null, // Prisma client handled by connection pool if needed
    useManagedIdentity,
    useConnectionPool,
    enableCache
  )
}