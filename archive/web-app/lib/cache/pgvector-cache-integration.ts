/**
 * Integration layer between VectorCacheManager and pgvector services
 * Provides caching for our production pgvector deployment
 */

import { VectorSearchService } from '../vector-search';
import { VectorCacheManager, VectorSimilarityQuery, VectorSimilarityResults } from './vector-cache-strategy';
import { metrics } from '../server-monitoring';

export interface CachedVectorSearchOptions {
  content_type?: string;
  language?: string;
  framework?: string;
  limit?: number;
  similarity_threshold?: number;
  workspace?: string;
  force_refresh?: boolean;
}

/**
 * Enhanced Vector Search Service with caching
 */
export class CachedVectorSearchService extends VectorSearchService {
  
  /**
   * Cached similarity search with pgvector integration
   */
  async cachedSimilaritySearch(
    queryEmbedding: number[],
    options: CachedVectorSearchOptions = {}
  ): Promise<{
    results: any[];
    from_cache: boolean;
    cache_key?: string;
    processing_time_ms: number;
  }> {
    const startTime = performance.now();

    // Convert to cache query format
    const cacheQuery: VectorSimilarityQuery = {
      embedding: queryEmbedding,
      table: 'embeddings',
      limit: options.limit || 10,
      minSimilarity: options.similarity_threshold || 0.7,
      contentTypes: options.content_type ? [options.content_type] : undefined,
      filter: {
        ...(options.language && { language: options.language }),
        ...(options.framework && { framework: options.framework })
      }
    };

    // Check cache first (unless force refresh)
    if (!options.force_refresh) {
      try {
        const cachedResults = await VectorCacheManager.getCachedResults(
          cacheQuery,
          options.workspace
        );

        if (cachedResults) {
          const processingTime = performance.now() - startTime;
          metrics.histogram('vector_search.cached.duration', processingTime);

          return {
            results: cachedResults,
            from_cache: true,
            cache_key: VectorCacheManager.calculateCacheKey(cacheQuery, options.workspace),
            processing_time_ms: processingTime
          };
        }
      } catch (err) {
        // Cache read error - fall through to database query
        metrics.increment('vector_cache.read_error');
      }
    }

    // Cache miss - query pgvector directly
    const searchResults = await this.similaritySearch(queryEmbedding, {
      content_type: options.content_type,
      language: options.language,
      framework: options.framework,
      limit: options.limit,
      similarity_threshold: options.similarity_threshold
    });

    // Convert results to cache format
    const cacheResults: VectorSimilarityResults = searchResults.map(result => ({
      id: result.id,
      similarity: result.similarity,
      metadata: result.metadata,
      content: result.content_hash,
      table: 'embeddings',
      contentType: result.content_type
    }));

    // Cache the results (don't fail if caching fails)
    try {
      await VectorCacheManager.cacheResults(
        cacheQuery,
        cacheResults,
        options.workspace
      );
    } catch (err) {
      // Cache write error - log but don't fail the request
      metrics.increment('vector_cache.write_error');
    }

    const processingTime = performance.now() - startTime;
    metrics.histogram('vector_search.uncached.duration', processingTime);

    return {
      results: searchResults,
      from_cache: false,
      cache_key: VectorCacheManager.calculateCacheKey(cacheQuery, options.workspace),
      processing_time_ms: processingTime
    };
  }

  /**
   * Cached code similarity search
   */
  async cachedFindSimilarCode(
    queryEmbedding: number[],
    language?: string,
    framework?: string,
    limit: number = 5,
    workspace?: string
  ) {
    // Build options without workspace for similaritySearch call
    const searchOptions: any = {
      content_type: 'code',
      language,
      framework,
      limit,
      similarity_threshold: 0.8
    };

    // Add workspace to search options
    if (workspace) {
      searchOptions.workspace = workspace;
    }

    return this.cachedSimilaritySearch(queryEmbedding, searchOptions);
  }

  /**
   * Cached documentation search
   */
  async cachedFindRelevantDocs(
    queryEmbedding: number[],
    limit: number = 3,
    workspace?: string
  ) {
    // Build options without workspace for similaritySearch call
    const searchOptions: any = {
      content_type: 'documentation',
      limit,
      similarity_threshold: 0.7
    };

    // Add workspace to search options
    if (workspace) {
      searchOptions.workspace = workspace;
    }

    return this.cachedSimilaritySearch(queryEmbedding, searchOptions);
  }

  /**
   * Invalidate cache when embeddings are updated
   */
  async invalidateEmbeddingCache(
    content_type?: string,
    workspace?: string
  ): Promise<number> {
    const invalidatedCount = await VectorCacheManager.invalidateForTable(
      'embeddings',
      content_type
    );

    metrics.increment('vector_cache.manual_invalidation', { count: invalidatedCount.toString() });

    return invalidatedCount;
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats() {
    return VectorCacheManager.getCacheStats();
  }

  /**
   * Warm up cache with common queries
   */
  async warmupCache(
    commonQueries: Array<{
      embedding: number[];
      options: CachedVectorSearchOptions;
    }>
  ): Promise<{
    warmed_queries: number;
    cache_hits: number;
    processing_time_ms: number;
  }> {
    const startTime = performance.now();
    let cacheHits = 0;

    for (const query of commonQueries) {
      const result = await this.cachedSimilaritySearch(
        query.embedding,
        query.options
      );

      if (result.from_cache) {
        cacheHits++;
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      warmed_queries: commonQueries.length,
      cache_hits: cacheHits,
      processing_time_ms: processingTime
    };
  }
}
