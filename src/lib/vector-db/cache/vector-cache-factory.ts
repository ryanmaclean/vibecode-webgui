/**
 * Vector Cache Adapter Factory
 * Factory for creating and managing vector cache adapter instances
 */

// import { logger } from '../../logger';
import { IVectorCacheAdapter, VectorCacheConfig } from './vector-cache-interface';
import { MemoryVectorCacheAdapter } from './memory-vector-cache-adapter';
import { CacheInvalidationIntegration } from '../../cache/cache-invalidation-integration';

/**
 * Available cache adapter types
 */
export enum CacheAdapterType {
  MEMORY = 'memory',
  REDIS = 'redis',
  NONE = 'none'
}

/**
 * Cache adapter configuration with type
 */
export interface CacheAdapterConfig extends VectorCacheConfig {
  /**
   * Type of cache adapter to create
   */
  type: CacheAdapterType;

  /**
   * Redis connection string (required for Redis adapter)
   */
  redisConnectionString?: string;
}

/**
 * Factory for creating and managing vector cache adapters
 */
export class VectorCacheFactory {
  private static instance: IVectorCacheAdapter | null = null;
  private static isInitializing = false;
  private static cacheInvalidator: CacheInvalidationIntegration | null = null;

  /**
   * Create a vector cache adapter based on configuration
   * @param config Cache adapter configuration
   * @returns Initialized cache adapter instance
   */
  public static async create(config: CacheAdapterConfig): Promise<IVectorCacheAdapter | null> {
    try {
      // If explicitly set to NONE, return null (no caching)
      if (config.type === CacheAdapterType.NONE) {
        console.log('Vector cache disabled (NONE)');
        return null;
      }

      let adapter: IVectorCacheAdapter;

      switch (config.type) {
        case CacheAdapterType.MEMORY:
          adapter = new MemoryVectorCacheAdapter(config);
          break;

        case CacheAdapterType.REDIS:
          // Placeholder for Redis adapter
          // We would implement or import a Redis adapter here
          throw new Error('Redis cache adapter not yet implemented');

        default:
          throw new Error(`Unsupported cache adapter type: ${config.type}`);
      }

      // Initialize the adapter
      await adapter.initialize();

      console.log(`Vector cache adapter (${config.type}) initialized successfully`);
      return adapter;
    } catch (error) {
      console.error(`Failed to create vector cache adapter: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fall back to in-memory cache if the requested adapter fails
      if (config.type !== CacheAdapterType.MEMORY) {
        console.warn(`Falling back to memory cache adapter due to error`);
        try {
          const fallbackAdapter = new MemoryVectorCacheAdapter({
            ttl: config.ttl,
            maxSize: config.maxSize,
            enableLogging: true
          });
          await fallbackAdapter.initialize();
          return fallbackAdapter;
        } catch (fallbackError) {
          console.error(`Failed to create fallback memory cache adapter: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
      
      return null;
    }
  }

  /**
   * Get the singleton instance of the vector cache adapter
   * Creates it if it doesn't exist using environment variables
   * @returns Initialized vector cache adapter instance or null if disabled
   */
  public static async getInstance(): Promise<IVectorCacheAdapter | null> {
    if (VectorCacheFactory.instance) {
      return VectorCacheFactory.instance;
    }

    if (VectorCacheFactory.isInitializing) {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getInstance();
    }

    try {
      VectorCacheFactory.isInitializing = true;
      
      // Get adapter type from environment variable or default to memory
      const typeStr = process.env.VECTOR_CACHE_TYPE || 'memory';
      let type: CacheAdapterType;

      // Map string to adapter type enum
      switch (typeStr.toLowerCase()) {
        case 'memory':
          type = CacheAdapterType.MEMORY;
          break;
        case 'redis':
          type = CacheAdapterType.REDIS;
          break;
        case 'none':
        case 'disabled':
        case 'false':
          type = CacheAdapterType.NONE;
          break;
        default:
          type = CacheAdapterType.MEMORY;
      }

      // Create base configuration from environment variables
      const config: CacheAdapterConfig = {
        type,
        ttl: process.env.VECTOR_CACHE_TTL ? parseInt(process.env.VECTOR_CACHE_TTL) : 3600,
        maxSize: process.env.VECTOR_CACHE_MAX_SIZE ? parseInt(process.env.VECTOR_CACHE_MAX_SIZE) : 1000,
        autoPrune: process.env.VECTOR_CACHE_AUTO_PRUNE !== 'false',
        pruneInterval: process.env.VECTOR_CACHE_PRUNE_INTERVAL ? parseInt(process.env.VECTOR_CACHE_PRUNE_INTERVAL) : 300,
        enableMetrics: process.env.VECTOR_CACHE_METRICS_ENABLED !== 'false',
        enableLogging: process.env.VECTOR_CACHE_LOGGING_ENABLED === 'true',
        redisConnectionString: process.env.VECTOR_CACHE_REDIS_CONNECTION_STRING
      };

      // Add Redis-specific configuration if needed
      if (type === CacheAdapterType.REDIS && !config.redisConnectionString) {
        console.warn('Redis cache adapter selected but no connection string provided, falling back to memory cache');
        config.type = CacheAdapterType.MEMORY;
      }

      // Create the appropriate adapter
      VectorCacheFactory.instance = await VectorCacheFactory.create(config);
      
      return VectorCacheFactory.instance;
    } catch (error) {
      VectorCacheFactory.isInitializing = false;
      console.error(`Failed to initialize vector cache adapter: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      VectorCacheFactory.isInitializing = false;
    }
  }

  /**
   * Close the singleton instance if it exists
   */
  public static async closeInstance(): Promise<void> {
    if (VectorCacheFactory.instance) {
      await VectorCacheFactory.instance.close();
      VectorCacheFactory.instance = null;
    }
  }

  /**
   * Get cache statistics from the singleton instance
   * @returns Cache statistics or null if cache is not available
   */
  public static async getStats(): Promise<{
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    avgResponseTime: number;
  } | null> {
    if (!VectorCacheFactory.instance) {
      return null;
    }

    try {
      return await VectorCacheFactory.instance.getStats();
    } catch (error) {
      console.error(`Failed to get cache stats: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Clear the cache
   * @returns Number of entries cleared or null if cache is not available
   */
  public static async clearCache(): Promise<number | null> {
    if (!VectorCacheFactory.instance) {
      return null;
    }

    try {
      return await VectorCacheFactory.instance.clear();
    } catch (error) {
      console.error(`Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get or create the cache invalidation integration instance
   * @returns Cache invalidation integration instance
   */
  public static getCacheInvalidator(): CacheInvalidationIntegration {
    if (!VectorCacheFactory.cacheInvalidator) {
      VectorCacheFactory.cacheInvalidator = new CacheInvalidationIntegration({
        strategy: process.env.NODE_ENV === 'production' ? 'production' : 'basic',
        performanceMode: process.env.CACHE_PERFORMANCE_MODE as 'low' | 'balanced' | 'high' || 'balanced',
        fallbackEnabled: true,
        monitoringEnabled: process.env.VECTOR_CACHE_METRICS_ENABLED !== 'false'
      });
    }
    return VectorCacheFactory.cacheInvalidator;
  }

  /**
   * Invalidate cache entries by keys
   * @param keys Cache keys to invalidate
   * @param options Invalidation options
   */
  public static async invalidateKeys(keys: string[], options: {
    priority?: 'high' | 'medium' | 'low';
    source?: string;
    workspaceId?: string;
  } = {}): Promise<void> {
    try {
      const invalidator = VectorCacheFactory.getCacheInvalidator();
      await invalidator.invalidate(keys, options);
    } catch (error) {
      console.error(`Failed to invalidate cache keys: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Invalidate cache entries by content type
   * @param contentType Content type to invalidate
   * @param workspaceId Optional workspace ID
   * @param options Invalidation options
   */
  public static async invalidateByContentType(contentType: string, workspaceId?: string, options: {
    priority?: 'high' | 'medium' | 'low';
    cascadeInvalidation?: boolean;
  } = {}): Promise<void> {
    try {
      const invalidator = VectorCacheFactory.getCacheInvalidator();
      await invalidator.invalidateByContentType(contentType, workspaceId, options);
    } catch (error) {
      console.error(`Failed to invalidate cache by content type: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close all cache resources including invalidation system
   */
  public static async closeAll(): Promise<void> {
    await VectorCacheFactory.closeInstance();
    VectorCacheFactory.cacheInvalidator = null;
  }
}