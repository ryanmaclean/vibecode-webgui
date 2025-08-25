/**
 * Vector Cache Invalidator (Mock)
 * This is a placeholder implementation to satisfy imports in the vector database adapter pattern
 */

import { VectorCacheManager } from './vector-cache-strategy';

/**
 * Vector Cache Invalidator
 * Handles cache invalidation for vector database queries
 */
export class VectorCacheInvalidator {
  private static instance: VectorCacheInvalidator | null = null;
  
  /**
   * Get singleton instance
   */
  public static getInstance(): VectorCacheInvalidator {
    if (!VectorCacheInvalidator.instance) {
      VectorCacheInvalidator.instance = new VectorCacheInvalidator();
    }
    return VectorCacheInvalidator.instance;
  }
  
  /**
   * Initialize the cache invalidator
   */
  public async initialize(): Promise<void> {
    // Nothing to initialize in this mock implementation
    return Promise.resolve();
  }
  
  /**
   * Manually invalidate cache for a specific table
   */
  public async manuallyInvalidateCache(
    table: 'rag_chunks' | 'ai_embeddings',
    contentType?: string
  ): Promise<number> {
    const pattern = contentType ? `${table}:${contentType}` : table;
    return await VectorCacheManager.clearCache(pattern);
  }
}