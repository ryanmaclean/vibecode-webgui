import { getDatabaseLogger } from '../../db/database-logger';
import { LogCategory } from '../../db/db-types';
import { getDatabaseMetricsCollector } from '../../db/db-metrics';

// Mock Redis client interface - you would use a real Redis client in production
interface ScanOptions {
  match?: string;
  count?: number;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, flag?: string, expiration?: number): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  scan(cursor: string, options?: ScanOptions): Promise<[string, string[]]>;
}

// Metadata stored alongside cached vectors
export interface VectorMetadata {
  ttl?: number;
  last_accessed?: string;
  access_count?: number;
  volatility?: 'high' | 'low' | 'medium' | string;
  compressed?: boolean;
  cached_at?: string;
  [key: string]: unknown;
}

/**
 * TTL (Time-To-Live) strategy for cached vectors
 */
export interface TTLStrategy {
  /**
   * Calculate TTL for a vector based on its metadata
   * @param metadata Vector metadata
   * @returns TTL in seconds
   */
  calculateTTL(metadata: VectorMetadata): number;
}

/**
 * Default TTL strategy based on vector metadata
 */
export class DefaultTTLStrategy implements TTLStrategy {
  private defaultTTL: number;
  private minTTL: number;
  private maxTTL: number;
  
  constructor(options: { 
    defaultTTL?: number;
    minTTL?: number;
    maxTTL?: number;
  } = {}) {
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour
    this.minTTL = options.minTTL || 60; // 1 minute
    this.maxTTL = options.maxTTL || 86400; // 1 day
  }
  
  /**
   * Calculate TTL based on metadata
   */
  public calculateTTL(metadata: VectorMetadata): number {
    if (!metadata) {
      return this.defaultTTL;
    }
    
    // Use explicit ttl if provided
    if (typeof metadata.ttl === 'number') {
      return Math.max(this.minTTL, Math.min(metadata.ttl, this.maxTTL));
    }
    
    // Use last_accessed to adjust TTL
    if (metadata.last_accessed) {
      const lastAccessed = new Date(metadata.last_accessed).getTime();
      const now = Date.now();
      const age = (now - lastAccessed) / 1000; // in seconds
      
      // For frequently accessed items (accessed in last hour), give longer TTL
      if (age < 3600) {
        return this.maxTTL;
      }
      
      // For items not accessed in the last day, give shorter TTL
      if (age > 86400) {
        return this.minTTL;
      }
    }
    
    // Use frequency to adjust TTL if available
    if (typeof metadata.access_count === 'number') {
      if (metadata.access_count > 100) {
        return this.maxTTL;
      }
      if (metadata.access_count > 10) {
        return this.defaultTTL * 2;
      }
    }
    
    // For embeddings that change frequently (if marked)
    if (metadata.volatility === 'high') {
      return this.minTTL;
    }
    
    return this.defaultTTL;
  }
}

/**
 * Options for vector cache
 */
export interface VectorCacheOptions {
  redisClient: RedisClient;
  ttlStrategy?: TTLStrategy;
  namespace?: string;
  metricsEnabled?: boolean;
  logEnabled?: boolean;
  maxVectorDimension?: number;
  compressionEnabled?: boolean;
  revalidationEnabled?: boolean;
  revalidationInterval?: number;
}

/**
 * Cache for frequently accessed vectors
 */
export class VectorCache {
  private cache: RedisClient;
  private ttlStrategy: TTLStrategy;
  private namespace: string;
  private metricsEnabled: boolean;
  private logger = getDatabaseLogger({ defaultCategory: LogCategory.VECTOR });
  private metricsCollector = getDatabaseMetricsCollector();
  private maxVectorDimension: number;
  private compressionEnabled: boolean;
  private revalidationEnabled: boolean;
  private revalidationInterval: number;
  private revalidationTimer: NodeJS.Timeout | null = null;
  
  /**
   * Create a new vector cache
   */
  constructor(options: VectorCacheOptions) {
    this.cache = options.redisClient;
    this.ttlStrategy = options.ttlStrategy || new DefaultTTLStrategy();
    this.namespace = options.namespace || 'vector';
    this.metricsEnabled = options.metricsEnabled !== false;
    this.maxVectorDimension = options.maxVectorDimension || 1536;
    this.compressionEnabled = options.compressionEnabled !== false;
    this.revalidationEnabled = options.revalidationEnabled !== false;
    this.revalidationInterval = options.revalidationInterval || 300000; // 5 minutes

    console.log(`Initialized vector cache with namespace ${this.namespace}`);
    
    if (this.revalidationEnabled) {
      this.startRevalidation();
    }
  }
  
  /**
   * Build a cache key for a vector
   */
  private buildCacheKey(id: string): string {
    return `${this.namespace}:${id}`;
  }
  
  /**
   * Build a metadata key for a vector
   */
  private buildMetadataKey(id: string): string {
    return `${this.namespace}:meta:${id}`;
  }
  
  /**
   * Build a collection key pattern
   */
  private buildCollectionKeyPattern(collectionId: string): string {
    return `${this.namespace}:${collectionId}:*`;
  }
  
  /**
   * Compress a vector to save space
   * This is a simple quantization method that could be improved
   */
  private compressVector(vector: number[]): number[] {
    if (!this.compressionEnabled) {
      return vector;
    }
    
    // Simple 8-bit quantization for floating point values
    return vector.map(val => {
      // Convert to range 0-255
      const quantized = Math.round((val + 1) * 127.5);
      // Clamp to valid range
      return Math.max(0, Math.min(255, quantized));
    });
  }
  
  /**
   * Decompress a vector
   */
  private decompressVector(compressedVector: number[]): number[] {
    if (!this.compressionEnabled) {
      return compressedVector;
    }
    
    // Convert 8-bit values back to original range
    return compressedVector.map(val => {
      return (val / 127.5) - 1;
    });
  }
  
  /**
   * Store a vector in the cache
   */
  public async cacheVector(
    id: string,
    vector: number[],
    metadata: VectorMetadata = {}
  ): Promise<void> {
    try {
      const key = this.buildCacheKey(id);
      const metaKey = this.buildMetadataKey(id);
      
      // Calculate TTL based on metadata
      const ttl = this.ttlStrategy.calculateTTL(metadata);
      
      // Compress vector if enabled
      const compressedVector = this.compressVector(vector);
      
      // Store vector
      await this.cache.set(
        key,
        JSON.stringify(compressedVector),
        'EX',
        ttl
      );
      
      // Store metadata separately
      const metadataWithTimestamp: VectorMetadata = {
        ...metadata,
        cached_at: new Date().toISOString(),
        ttl: ttl,
        compressed: this.compressionEnabled
      };
      
      await this.cache.set(
        metaKey,
        JSON.stringify(metadataWithTimestamp),
        'EX',
        ttl
      );
      
      // Record metrics
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_set',
          0,
          true,
          { type: 'CACHE', table: this.namespace }
        );
      }
    } catch (error) {
      console.error(`Error caching vector ${id}: ${(error as Error).message}`);
      
      // Record error
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_set',
          0,
          false,
          { type: 'CACHE', table: this.namespace, error: (error as Error).message }
        );
      }
    }
  }
  
  /**
   * Get a vector from the cache
   */
  public async getVector(id: string): Promise<{
    vector: number[] | null;
    metadata: VectorMetadata;
    fromCache: boolean;
  }> {
    try {
      const startTime = Date.now();
      const key = this.buildCacheKey(id);
      const metaKey = this.buildMetadataKey(id);
      
      // Try to get vector and metadata
      const [vectorStr, metadataStr] = await Promise.all([
        this.cache.get(key),
        this.cache.get(metaKey)
      ]);
      
      // If not found, return null
      if (!vectorStr || !metadataStr) {
        return {
          vector: null,
          metadata: {},
          fromCache: false
        };
      }
      
      // Parse vector and metadata
      const compressedVector = JSON.parse(vectorStr);
      const metadata = JSON.parse(metadataStr);
      
      // Decompress if needed
      const vector = metadata.compressed ? 
        this.decompressVector(compressedVector) : 
        compressedVector;
      
      // Update metadata with access info
      const updatedMetadata: VectorMetadata = {
        ...metadata,
        last_accessed: new Date().toISOString(),
        access_count: (metadata.access_count || 0) + 1
      };
      
      // Update metadata asynchronously
      this.updateVectorMetadata(id, updatedMetadata).catch(error => {
        console.error(`Error updating vector metadata ${id}: ${error.message}`);
      });
      
      // Record metrics
      if (this.metricsEnabled) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordQuery(
          'vector_cache_get',
          duration,
          true,
          { type: 'CACHE', table: this.namespace }
        );
      }
      
      return {
        vector,
        metadata: updatedMetadata,
        fromCache: true
      };
    } catch (error) {
      console.error(`Error getting vector ${id}: ${(error as Error).message}`);
      
      // Record error
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_get',
          0,
          false,
          { type: 'CACHE', table: this.namespace, error: (error as Error).message }
        );
      }
      
      return {
        vector: null,
        metadata: {},
        fromCache: false
      };
    }
  }
  
  /**
   * Update vector metadata without changing the vector itself
   */
  private async updateVectorMetadata(id: string, metadata: VectorMetadata): Promise<void> {
    try {
      const metaKey = this.buildMetadataKey(id);
      
      // Calculate TTL based on metadata
      const ttl = this.ttlStrategy.calculateTTL(metadata);
      
      // Update metadata with new TTL
      const updatedMetadata = {
        ...metadata,
        ttl: ttl
      };
      
      // Store metadata
      await this.cache.set(
        metaKey,
        JSON.stringify(updatedMetadata),
        'EX',
        ttl
      );
      
      // Refresh vector TTL as well
      const key = this.buildCacheKey(id);
      await this.cache.expire(key, ttl);
    } catch (error) {
      console.error(`Error updating vector metadata ${id}: ${(error as Error).message}`);
    }
  }
  
  /**
   * Invalidate a vector in the cache
   */
  public async invalidateVector(id: string): Promise<boolean> {
    try {
      const key = this.buildCacheKey(id);
      const metaKey = this.buildMetadataKey(id);
      
      // Delete vector and metadata
      const [vectorResult, metaResult] = await Promise.all([
        this.cache.del(key),
        this.cache.del(metaKey)
      ]);
      
      const deleted = vectorResult > 0 || metaResult > 0;
      
      // Record metrics
      if (this.metricsEnabled && deleted) {
        this.metricsCollector.recordQuery(
          'vector_cache_invalidate',
          0,
          true,
          { type: 'CACHE', table: this.namespace }
        );
      }

      return deleted;
    } catch (error) {
      console.error(`Error invalidating vector ${id}: ${(error as Error).message}`);
      
      // Record error
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_invalidate',
          0,
          false,
          { type: 'CACHE', table: this.namespace, error: (error as Error).message }
        );
      }
      
      return false;
    }
  }
  
  /**
   * Invalidate vectors based on a collection ID
   */
  public async invalidateCollection(collectionId: string): Promise<number> {
    try {
      const pattern = this.buildCollectionKeyPattern(collectionId);
      const keys = await this.cache.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Also invalidate metadata
      const metaKeys = keys.map(key => {
        return key.replace(`${this.namespace}:`, `${this.namespace}:meta:`);
      });
      
      // Delete all keys
      const allKeys = [...keys, ...metaKeys];
      const deleted = await this.cache.del(...allKeys);
      
      // Record metrics
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_invalidate_collection',
          0,
          true,
          { type: 'CACHE', table: this.namespace }
        );
      }

      console.log(`Invalidated ${deleted} vectors for collection ${collectionId}`);

      return deleted;
    } catch (error) {
      console.error(`Error invalidating collection ${collectionId}: ${(error as Error).message}`);
      
      // Record error
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_invalidate_collection',
          0,
          false,
          { type: 'CACHE', table: this.namespace, error: (error as Error).message }
        );
      }
      
      return 0;
    }
  }
  
  /**
   * Start cache revalidation process
   */
  private startRevalidation(): void {
    if (this.revalidationTimer) {
      clearInterval(this.revalidationTimer);
    }
    
    this.revalidationTimer = setInterval(() => {
      this.revalidateCache().catch(error => {
        console.error(`Error during cache revalidation: ${error.message}`);
      });
    }, this.revalidationInterval);

    console.log(`Started cache revalidation with interval ${this.revalidationInterval}ms`);
  }
  
  /**
   * Stop cache revalidation
   */
  public stopRevalidation(): void {
    if (this.revalidationTimer) {
      clearInterval(this.revalidationTimer);
      this.revalidationTimer = null;
      console.log('Stopped cache revalidation');
    }
  }
  
  /**
   * Revalidate the cache
   */
  private async revalidateCache(): Promise<void> {
    try {
      console.log('Starting cache revalidation');
      
      let cursor = '0';
      let keysProcessed = 0;
      let keysInvalidated = 0;
      
      // Scan the cache for expired or invalid items
      do {
        const [nextCursor, keys] = await this.cache.scan(cursor, {
          match: `${this.namespace}:meta:*`,
          count: 100
        });
        
        // Update cursor
        cursor = nextCursor;
        keysProcessed += keys.length;
        
        // Process each key
        for (const metaKey of keys) {
          try {
            const metadataStr = await this.cache.get(metaKey);
            if (!metadataStr) {
              continue;
            }
            
            const metadata = JSON.parse(metadataStr);
            const id = metaKey.replace(`${this.namespace}:meta:`, '');
            const key = this.buildCacheKey(id);
            
            // Check for orphaned metadata (no vector)
            const vectorExists = await this.cache.get(key);
            if (!vectorExists) {
              await this.cache.del(metaKey);
              keysInvalidated++;
              continue;
            }
            
            // Check for outdated TTL
            const newTTL = this.ttlStrategy.calculateTTL(metadata);
            if (newTTL !== metadata.ttl) {
              // Update TTL
              await Promise.all([
                this.cache.expire(key, newTTL),
                this.cache.expire(metaKey, newTTL)
              ]);
              
              // Update metadata
              const updatedMetadata = {
                ...metadata,
                ttl: newTTL,
                revalidated_at: new Date().toISOString()
              };
              
              await this.cache.set(
                metaKey,
                JSON.stringify(updatedMetadata),
                'EX',
                newTTL
              );
            }
          } catch (error) {
            console.error(`Error processing metadata key ${metaKey}: ${(error as Error).message}`);
            // Try to delete the problematic key
            await this.cache.del(metaKey);
            keysInvalidated++;
          }
        }
      } while (cursor !== '0');

      console.log(`Cache revalidation complete: processed ${keysProcessed} keys, invalidated ${keysInvalidated} keys`);
      
      // Record metrics
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_revalidation',
          0,
          true,
          { type: 'CACHE', table: this.namespace }
        );
      }
    } catch (error) {
      console.error(`Error during cache revalidation: ${(error as Error).message}`);
      
      // Record error
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_revalidation',
          0,
          false,
          { type: 'CACHE', table: this.namespace, error: (error as Error).message }
        );
      }
    }
  }
  
  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    totalKeys: number;
    totalVectors: number;
    totalMetadata: number;
    sizeEstimate: string;
    collections: string[];
  }> {
    try {
      // Get vector and metadata keys
      const [vectorKeys, metaKeys] = await Promise.all([
        this.cache.keys(`${this.namespace}:*`),
        this.cache.keys(`${this.namespace}:meta:*`)
      ]);
      
      // Filter out metadata keys from vector keys
      const actualVectorKeys = vectorKeys.filter(key => !key.includes(':meta:'));
      
      // Get unique collections
      const collections = new Set<string>();
      for (const key of actualVectorKeys) {
        const parts = key.split(':');
        if (parts.length >= 3) {
          collections.add(parts[1]);
        }
      }
      
      // Estimate size (very rough approximation)
      const vectorSize = actualVectorKeys.length * this.maxVectorDimension * 4; // 4 bytes per float
      const metaSize = metaKeys.length * 200; // Rough estimate of 200 bytes per metadata
      const totalSize = vectorSize + metaSize;
      
      // Format size
      let sizeEstimate = '';
      if (totalSize < 1024) {
        sizeEstimate = `${totalSize} B`;
      } else if (totalSize < 1024 * 1024) {
        sizeEstimate = `${(totalSize / 1024).toFixed(2)} KB`;
      } else if (totalSize < 1024 * 1024 * 1024) {
        sizeEstimate = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
      } else {
        sizeEstimate = `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      }
      
      return {
        totalKeys: vectorKeys.length + metaKeys.length,
        totalVectors: actualVectorKeys.length,
        totalMetadata: metaKeys.length,
        sizeEstimate,
        collections: Array.from(collections)
      };
    } catch (error) {
      console.error(`Error getting cache stats: ${(error as Error).message}`);
      
      return {
        totalKeys: 0,
        totalVectors: 0,
        totalMetadata: 0,
        sizeEstimate: '0 B',
        collections: []
      };
    }
  }
  
  /**
   * Clear the entire cache
   */
  public async clear(): Promise<number> {
    try {
      // Get all keys in the namespace
      const keys = await this.cache.keys(`${this.namespace}:*`);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete all keys
      const deleted = await this.cache.del(...keys);

      console.log(`Cleared cache: deleted ${deleted} keys`);
      
      // Record metrics
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_clear',
          0,
          true,
          { type: 'CACHE', table: this.namespace }
        );
      }

      return deleted;
    } catch (error) {
      console.error(`Error clearing cache: ${(error as Error).message}`);
      
      // Record error
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_cache_clear',
          0,
          false,
          { type: 'CACHE', table: this.namespace, error: (error as Error).message }
        );
      }
      
      return 0;
    }
  }
  
  /**
   * Close the cache and clean up resources
   */
  public dispose(): void {
    this.stopRevalidation();
    console.log('Vector cache disposed');
  }
}