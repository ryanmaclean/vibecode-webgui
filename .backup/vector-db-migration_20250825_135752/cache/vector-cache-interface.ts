/**
 * Vector Cache Adapter Interface
 * Defines a standard interface for caching vector database results
 */

import { SearchResult } from '../vector-types';

/**
 * Configuration options for vector cache adapters
 */
export interface VectorCacheConfig {
  /**
   * Time-to-live in seconds for cache entries
   * Default: 3600 (1 hour)
   */
  ttl?: number;

  /**
   * Maximum number of entries to store in the cache
   * Default: 1000
   */
  maxSize?: number;

  /**
   * Enable automatic pruning of expired entries
   * Default: true
   */
  autoPrune?: boolean;

  /**
   * Interval in seconds to check for expired entries
   * Only used if autoPrune is true
   * Default: 300 (5 minutes)
   */
  pruneInterval?: number;

  /**
   * Enable metrics collection for cache operations
   * Default: true
   */
  enableMetrics?: boolean;

  /**
   * Enable detailed logging for cache operations
   * Default: false
   */
  enableLogging?: boolean;
}

/**
 * Interface for vector cache adapters
 */
export interface IVectorCacheAdapter {
  /**
   * Initialize the cache adapter
   */
  initialize(): Promise<void>;

  /**
   * Store search results in the cache
   * @param key The cache key (typically a hash of the query and options)
   * @param results The search results to cache
   * @param namespace Optional namespace for organizing cache entries
   * @returns True if successfully stored, false otherwise
   */
  set(key: string, results: SearchResult[], namespace?: string): Promise<boolean>;

  /**
   * Get search results from the cache
   * @param key The cache key to lookup
   * @param namespace Optional namespace for organizing cache entries
   * @returns The cached search results or null if not found or expired
   */
  get(key: string, namespace?: string): Promise<SearchResult[] | null>;

  /**
   * Check if a key exists in the cache
   * @param key The cache key to check
   * @param namespace Optional namespace for organizing cache entries
   * @returns True if the key exists and is not expired, false otherwise
   */
  has(key: string, namespace?: string): Promise<boolean>;

  /**
   * Delete a specific entry from the cache
   * @param key The cache key to delete
   * @param namespace Optional namespace for organizing cache entries
   * @returns True if successfully deleted, false if not found
   */
  delete(key: string, namespace?: string): Promise<boolean>;

  /**
   * Invalidate all entries in a namespace
   * @param namespace The namespace to invalidate
   * @returns The number of entries invalidated
   */
  invalidateNamespace(namespace: string): Promise<number>;

  /**
   * Clear all entries from the cache
   * @returns The number of entries cleared
   */
  clear(): Promise<number>;

  /**
   * Get statistics about the cache
   * @returns Statistics about the cache usage
   */
  getStats(): Promise<{
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    avgResponseTime: number;
  }>;

  /**
   * Close the cache adapter and release resources
   */
  close(): Promise<void>;
}