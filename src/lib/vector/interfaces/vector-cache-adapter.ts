/**
 * Vector Cache Adapter Interface
 * Defines the contract that all vector cache adapters must implement
 */

import { CacheStats, VectorSimilarityQuery, VectorSimilarityResults } from './vector-types';

export interface IVectorCacheAdapter {
  /**
   * Get cached results for a vector similarity query
   * @param query The vector similarity query
   * @param workspace Optional workspace ID for isolation
   * @returns Promise resolving to cached results or null if not found
   */
  getCachedResults(query: VectorSimilarityQuery, workspace?: string): Promise<VectorSimilarityResults | null>;
  
  /**
   * Cache results from a vector similarity query
   * @param query The vector similarity query
   * @param results The vector similarity results to cache
   * @param workspace Optional workspace ID for isolation
   * @param ttl Optional custom TTL (time-to-live) in seconds
   * @returns Promise resolving to true if caching was successful
   */
  cacheResults(
    query: VectorSimilarityQuery, 
    results: VectorSimilarityResults, 
    workspace?: string, 
    ttl?: number
  ): Promise<boolean>;
  
  /**
   * Invalidate cache entries for a specific table and content type
   * @param table The database table name
   * @param contentType Optional content type filter
   * @returns Promise resolving to the number of cache entries invalidated
   */
  invalidate(table: string, contentType?: string): Promise<number>;
  
  /**
   * Get cache effectiveness statistics
   * @returns Cache statistics including hit rate, hit count, miss count
   */
  getCacheStats(): CacheStats;
}