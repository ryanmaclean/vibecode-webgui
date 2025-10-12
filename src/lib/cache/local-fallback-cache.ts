/**
 * Local Fallback Cache for VibeCode WebGUI
 * Provides in-memory caching when Redis is unavailable
 */

import { metrics } from '../server-monitoring';
import { logger } from '@/lib/logger';

interface CacheItem<T> {
  value: T;
  expiry: number;
}

export class LocalFallbackCache {
  private cache: Map<string, CacheItem<any>>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    
    // Setup periodic cleanup if in a browser or Node.js environment
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }
  }

  /**
   * Set a value in the cache with expiry
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
    metrics.increment('cache.local.set');
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      metrics.increment('cache.local.miss');
      return null;
    }
    
    if (item.expiry < Date.now()) {
      // Item has expired
      this.cache.delete(key);
      metrics.increment('cache.local.expired');
      return null;
    }
    
    metrics.increment('cache.local.hit');
    return item.value as T;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      metrics.increment('cache.local.delete');
    }
    return result;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    if (item.expiry < Date.now()) {
      // Item has expired
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get multiple values from the cache
   */
  mget<T>(keys: string[]): (T | null)[] {
    const now = Date.now();
    return keys.map(key => {
      const item = this.cache.get(key);
      
      if (!item || item.expiry < now) {
        metrics.increment('cache.local.mget.miss');
        return null;
      }
      
      metrics.increment('cache.local.mget.hit');
      return item.value as T;
    });
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    this.cleanup(); // Clean expired keys before returning
    return Array.from(this.cache.keys());
  }

  /**
   * Get all keys matching a pattern (basic implementation)
   */
  keysMatching(pattern: string): string[] {
    this.cleanup(); // Clean expired keys before matching
    
    try {
      // Convert Redis pattern to JS regex
      const regexPattern = pattern
        .replace(/\*/g, '.*')  // * becomes .*
        .replace(/\?/g, '.')   // ? becomes .
        .replace(/\[([^\]]*)\]/g, '[$1]'); // Keep character classes as is
      
      const regex = new RegExp(`^${regexPattern}$`);
      
      return Array.from(this.cache.keys()).filter(key => regex.test(key));
    } catch (error) {
      logger.error('Error matching pattern in local cache:', error);
      return [];
    }
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
    metrics.increment('cache.local.clear');
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    this.cleanup(); // Clean expired keys before returning size
    return this.cache.size;
  }

  /**
   * Cleanup expired items
   */
  cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      metrics.gauge('cache.local.expired.count', expiredCount);
    }
  }

  /**
   * Dispose the cleanup interval
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}