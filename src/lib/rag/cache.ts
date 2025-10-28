/**
 * Valkey Cache Implementation
 * High-performance caching for RAG system
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '@/lib/logger';

export interface CacheEntry {
  query: string;
  embedding: number[];
  results: any[];
  timestamp: number;
}

export class ValkeyCache {
  private client: RedisClientType | null = null;
  private readonly prefix = 'rag:';
  private readonly defaultTTL = 3600; // 1 hour
  
  /**
   * Connect to Valkey
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.VALKEY_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Max Valkey reconnection attempts reached');
              return new Error('Max reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });
      
      this.client.on('error', (err) => {
        logger.error('Valkey client error', { error: err });
      });
      
      this.client.on('connect', () => {
        logger.info('Connected to Valkey');
      });
      
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Valkey', { error });
      throw error;
    }
  }
  
  /**
   * Disconnect from Valkey
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Disconnected from Valkey');
    }
  }
  
  /**
   * Generate cache key from query
   */
  private getCacheKey(query: string): string {
    const hash = this.hashString(query);
    return `${this.prefix}query:${hash}`;
  }
  
  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Get cached results for a query
   */
  async get(query: string): Promise<CacheEntry | null> {
    if (!this.client) {
      throw new Error('Valkey client not connected');
    }
    
    try {
      const key = this.getCacheKey(query);
      const cached = await this.client.get(key);
      
      if (!cached) {
        logger.debug('Cache miss', { query: query.substring(0, 50) });
        return null;
      }
      
      const entry: CacheEntry = JSON.parse(cached);
      
      // Check if entry is still valid
      const age = Date.now() - entry.timestamp;
      if (age > this.defaultTTL * 1000) {
        logger.debug('Cache entry expired', { age });
        await this.delete(query);
        return null;
      }
      
      logger.debug('Cache hit', { 
        query: query.substring(0, 50),
        age: `${Math.round(age / 1000)}s`
      });
      
      return entry;
    } catch (error) {
      logger.error('Cache get failed', { error });
      return null; // Fail gracefully
    }
  }
  
  /**
   * Set cache entry
   */
  async set(
    query: string,
    embedding: number[],
    results: any[],
    ttl: number = this.defaultTTL
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Valkey client not connected');
    }
    
    try {
      const key = this.getCacheKey(query);
      const entry: CacheEntry = {
        query,
        embedding,
        results,
        timestamp: Date.now()
      };
      
      await this.client.setEx(key, ttl, JSON.stringify(entry));
      
      logger.debug('Cache set', { 
        query: query.substring(0, 50),
        ttl,
        resultCount: results.length
      });
    } catch (error) {
      logger.error('Cache set failed', { error });
      // Don't throw - caching is optional
    }
  }
  
  /**
   * Delete cache entry
   */
  async delete(query: string): Promise<void> {
    if (!this.client) {
      throw new Error('Valkey client not connected');
    }
    
    try {
      const key = this.getCacheKey(query);
      await this.client.del(key);
      
      logger.debug('Cache entry deleted', { query: query.substring(0, 50) });
    } catch (error) {
      logger.error('Cache delete failed', { error });
    }
  }
  
  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.client) {
      throw new Error('Valkey client not connected');
    }
    
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info('Cache cleared', { keyCount: keys.length });
      }
    } catch (error) {
      logger.error('Cache clear failed', { error });
      throw error;
    }
  }
  
  /**
   * Warm cache with common queries
   */
  async warm(queries: Array<{ query: string; embedding: number[]; results: any[] }>): Promise<void> {
    logger.info('Warming cache...', { queryCount: queries.length });
    
    for (const { query, embedding, results } of queries) {
      await this.set(query, embedding, results);
    }
    
    logger.info('Cache warmed successfully');
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keyCount: number;
    memoryUsed: string;
    hitRate: string;
  }> {
    if (!this.client) {
      throw new Error('Valkey client not connected');
    }
    
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      const info = await this.client.info('stats');
      
      // Parse info string for stats
      const stats: Record<string, string> = {};
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });
      
      const hits = parseInt(stats.keyspace_hits || '0');
      const misses = parseInt(stats.keyspace_misses || '0');
      const total = hits + misses;
      const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0';
      
      return {
        keyCount: keys.length,
        memoryUsed: stats.used_memory_human || 'unknown',
        hitRate: `${hitRate}%`
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      throw error;
    }
  }
  
  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Valkey ping failed', { error });
      return false;
    }
  }
}

// Singleton instance
export const valkeyCache = new ValkeyCache();
