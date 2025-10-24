/**
 * Memory Vector Cache Adapter
 * In-memory implementation of the vector cache adapter interface
 */

// import { logger } from '../../logger';
import { SearchResult } from '../vector-types';
import { IVectorCacheAdapter, VectorCacheConfig } from './vector-cache-interface';

/**
 * Cache entry with metadata for expiration and tracking
 */
interface CacheEntry {
  results: SearchResult[];
  expires: number; // Timestamp when this entry expires
  createdAt: number; // Timestamp when this entry was created
  lastAccessed: number; // Timestamp when this entry was last accessed
  accessCount: number; // Number of times this entry has been accessed
}

/**
 * In-memory implementation of the vector cache adapter
 * Provides a fast, memory-based cache with optional TTL and size limits
 */
export class MemoryVectorCacheAdapter implements IVectorCacheAdapter {
  private cache: Map<string, CacheEntry> = new Map();
  private namespaces: Map<string, Set<string>> = new Map();
  private pruneTimer: NodeJS.Timeout | null = null;
  private hits = 0;
  private misses = 0;
  private totalResponseTime = 0;
  private requestCount = 0;
  private config: Required<VectorCacheConfig>;
  private isInitialized = false;

  /**
   * Default configuration values
   */
  private static readonly DEFAULT_CONFIG: Required<VectorCacheConfig> = {
    ttl: 3600, // 1 hour
    maxSize: 1000,
    autoPrune: true,
    pruneInterval: 300, // 5 minutes
    enableMetrics: true,
    enableLogging: false
  };

  /**
   * Create a new memory vector cache adapter
   * @param config Configuration options
   */
  constructor(config: VectorCacheConfig = {}) {
    this.config = {
      ...MemoryVectorCacheAdapter.DEFAULT_CONFIG,
      ...config
    };
  }

  /**
   * Initialize the cache adapter
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Start automatic pruning if enabled
    if (this.config.autoPrune) {
      this.startPruneTimer();
    }

    this.isInitialized = true;
    
    if (this.config.enableLogging) {
      console.info('Memory vector cache adapter initialized', {
        ttl: this.config.ttl,
        maxSize: this.config.maxSize,
        autoPrune: this.config.autoPrune,
        pruneInterval: this.config.pruneInterval
      });
    }
  }

  /**
   * Store search results in the cache
   * @param key The cache key
   * @param results The search results to cache
   * @param namespace Optional namespace for organization
   */
  public async set(key: string, results: SearchResult[], namespace?: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check if we need to enforce size limit
      if (this.cache.size >= this.config.maxSize) {
        this.enforceSizeLimit();
      }

      // Create cache entry with expiration
      const entry: CacheEntry = {
        results,
        expires: Date.now() + (this.config.ttl * 1000),
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0
      };

      // Add to cache
      this.cache.set(key, entry);

      // Track namespace association if provided
      if (namespace) {
        if (!this.namespaces.has(namespace)) {
          this.namespaces.set(namespace, new Set());
        }
        this.namespaces.get(namespace)?.add(key);
      }

      if (this.config.enableLogging) {
        console.debug(`Cache set: ${key}`, {
          namespace,
          resultCount: results.length,
          duration: Date.now() - startTime
        });
      }

      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error storing in memory cache', { error, key, namespace });
      }
      
      return false;
    }
  }

  /**
   * Get search results from the cache
   * @param key The cache key
   * @param namespace Optional namespace
   */
  public async get(key: string, namespace?: string): Promise<SearchResult[] | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      // Check if entry exists and is not expired
      if (entry && entry.expires > Date.now()) {
        // Update access metadata
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        
        this.hits++;
        
        if (this.config.enableLogging) {
          console.debug(`Cache hit: ${key}`, {
            namespace,
            accessCount: entry.accessCount,
            duration: Date.now() - startTime
          });
        }
        
        this.updateResponseMetrics(startTime);
        return entry.results;
      }
      
      // If entry doesn't exist or is expired
      if (entry) {
        // Entry expired, remove it
        this.cache.delete(key);
        
        // Remove from namespace tracking
        if (namespace && this.namespaces.has(namespace)) {
          this.namespaces.get(namespace)?.delete(key);
        }
      }
      
      this.misses++;
      
      if (this.config.enableLogging) {
        console.debug(`Cache miss: ${key}`, {
          namespace,
          expired: !!entry,
          duration: Date.now() - startTime
        });
      }
      
      this.updateResponseMetrics(startTime);
      return null;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error retrieving from memory cache', { error, key, namespace });
      }
      
      this.updateResponseMetrics(startTime);
      return null;
    }
  }

  /**
   * Check if a key exists in the cache
   * @param key The cache key
   * @param namespace Optional namespace
   */
  public async has(key: string, namespace?: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      const exists = !!entry && entry.expires > Date.now();
      
      if (this.config.enableLogging) {
        console.debug(`Cache check: ${key}`, {
          namespace,
          exists,
          duration: Date.now() - startTime
        });
      }
      
      return exists;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error checking memory cache', { error, key, namespace });
      }
      
      return false;
    }
  }

  /**
   * Delete a specific entry from the cache
   * @param key The cache key
   * @param namespace Optional namespace
   */
  public async delete(key: string, namespace?: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const existed = this.cache.has(key);
      this.cache.delete(key);
      
      // Remove from namespace if specified
      if (namespace && this.namespaces.has(namespace)) {
        this.namespaces.get(namespace)?.delete(key);
      }
      
      if (this.config.enableLogging) {
        console.debug(`Cache delete: ${key}`, {
          namespace,
          existed,
          duration: Date.now() - startTime
        });
      }
      
      return existed;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error deleting from memory cache', { error, key, namespace });
      }
      
      return false;
    }
  }

  /**
   * Invalidate all entries in a namespace
   * @param namespace The namespace to invalidate
   */
  public async invalidateNamespace(namespace: string): Promise<number> {
    const startTime = Date.now();
    
    try {
      const keys = this.namespaces.get(namespace);
      
      if (!keys || keys.size === 0) {
        return 0;
      }
      
      let count = 0;
      
      // Delete all keys in the namespace
      keys.forEach(key => {
        this.cache.delete(key);
        count++;
      });
      
      // Clear the namespace
      this.namespaces.delete(namespace);
      
      if (this.config.enableLogging && count > 0) {
        console.info(`Invalidated ${count} entries in namespace: ${namespace}`, {
          duration: Date.now() - startTime
        });
      }
      
      return count;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error invalidating namespace', { error, namespace });
      }
      
      return 0;
    }
  }

  /**
   * Clear all entries from the cache
   */
  public async clear(): Promise<number> {
    const startTime = Date.now();
    
    try {
      const count = this.cache.size;
      
      this.cache.clear();
      this.namespaces.clear();
      
      if (this.config.enableLogging) {
        console.info(`Cleared ${count} entries from memory cache`, {
          duration: Date.now() - startTime
        });
      }
      
      return count;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error clearing memory cache', { error });
      }
      
      return 0;
    }
  }

  /**
   * Get statistics about the cache
   */
  public async getStats(): Promise<{
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    avgResponseTime: number;
  }> {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const avgResponseTime = this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;
    
    return {
      size: this.cache.size,
      hitCount: this.hits,
      missCount: this.misses,
      hitRate,
      avgResponseTime
    };
  }

  /**
   * Close the cache adapter and release resources
   */
  public async close(): Promise<void> {
    // Stop the prune timer if it's running
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    
    // Clear the cache
    await this.clear();
    
    this.isInitialized = false;
    
    if (this.config.enableLogging) {
      console.info('Memory vector cache adapter closed');
    }
  }

  /**
   * Start the automatic pruning timer
   */
  private startPruneTimer(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }
    
    this.pruneTimer = setInterval(() => {
      this.pruneExpiredEntries();
    }, this.config.pruneInterval * 1000);
    
    // Ensure the timer doesn't prevent the process from exiting
    if (this.pruneTimer.unref) {
      this.pruneTimer.unref();
    }
  }

  /**
   * Prune expired entries from the cache
   */
  private pruneExpiredEntries(): void {
    const startTime = Date.now();
    const now = Date.now();
    let prunedCount = 0;
    
    this.cache.forEach((entry, key) => {
      if (entry.expires <= now) {
        this.cache.delete(key);
        prunedCount++;
        
        // Remove from all namespaces
        this.namespaces.forEach((keys, namespace) => {
          if (keys.has(key)) {
            keys.delete(key);
            
            // Clean up empty namespace sets
            if (keys.size === 0) {
              this.namespaces.delete(namespace);
            }
          }
        });
      }
    });
    
    if (prunedCount > 0 && this.config.enableLogging) {
      console.debug(`Pruned ${prunedCount} expired entries from memory cache`, {
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Enforce the maximum size limit by removing least recently used entries
   */
  private enforceSizeLimit(): void {
    if (this.cache.size < this.config.maxSize) {
      return;
    }
    
    // Need to remove at least 10% of entries to avoid constant pruning
    const removeCount = Math.ceil(this.config.maxSize * 0.1);
    
    // Convert to array for sorting
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest entries
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      
      // Remove from all namespaces
      this.namespaces.forEach((keys, namespace) => {
        if (keys.has(key)) {
          keys.delete(key);
          
          // Clean up empty namespace sets
          if (keys.size === 0) {
            this.namespaces.delete(namespace);
          }
        }
      });
    }
    
    if (this.config.enableLogging) {
      console.debug(`Removed ${removeCount} LRU entries from memory cache to enforce size limit`);
    }
  }

  /**
   * Update response time metrics
   */
  private updateResponseMetrics(startTime: number): void {
    const duration = Date.now() - startTime;
    this.totalResponseTime += duration;
    this.requestCount++;
  }
}