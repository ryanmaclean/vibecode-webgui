/**
 * Query Cache System
 * Intelligent caching layer for database queries, vector searches, and API responses
 */

import { EventEmitter } from 'events'
// import { logger } from '@/lib/logger';
export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  size: number
  metadata: {
    queryType: 'vector' | 'database' | 'api' | 'embedding'
    cost: number // Relative cost of regenerating this data
    tags: string[]
  }
}

export interface CacheMetrics {
  hitRate: number
  missRate: number
  totalHits: number
  totalMisses: number
  totalEntries: number
  totalSize: number
  memoryUsage: number
  evictionCount: number
  expiredCount: number
  averageAccessTime: number
}

export interface CacheConfiguration {
  maxSize: number // Maximum cache size in bytes
  maxEntries: number // Maximum number of entries
  defaultTTL: number // Default TTL in milliseconds
  cleanupInterval: number // Cleanup interval in milliseconds
  compressionThreshold: number // Size threshold for compression
  enableMetrics: boolean
  enableCompression: boolean
}

/**
 * Intelligent Query Cache with LRU eviction and compression
 */
export class QueryCache extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map()
  private metrics: CacheMetrics = {
    hitRate: 0,
    missRate: 0,
    totalHits: 0,
    totalMisses: 0,
    totalEntries: 0,
    totalSize: 0,
    memoryUsage: 0,
    evictionCount: 0,
    expiredCount: 0,
    averageAccessTime: 0
  }

  private config: CacheConfiguration = {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000,
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    compressionThreshold: 10 * 1024, // 10KB
    enableMetrics: true,
    enableCompression: true
  }

  private cleanupTimer?: NodeJS.Timeout
  private accessTimes: number[] = []

  constructor(config?: Partial<CacheConfiguration>) {
    super()
    
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.startCleanupTimer()
    console.info('🚀 Query cache initialized with config:', {
      maxSize: `${this.config.maxSize / 1024 / 1024}MB`,
      maxEntries: this.config.maxEntries,
      defaultTTL: `${this.config.defaultTTL / 1000}s`
    })
  }

  /**
   * Get value from cache
   */
  public async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now()
    
    try {
      const entry = this.cache.get(key)
      
      if (!entry) {
        this.recordMiss()
        return null
      }

      // Check if expired
      if (Date.now() > entry.timestamp + entry.ttl) {
        this.cache.delete(key)
        this.recordMiss()
        this.metrics.expiredCount++
        this.emit('expired', key, entry)
        return null
      }

      // Update access statistics
      entry.accessCount++
      entry.lastAccessed = Date.now()
      
      this.recordHit()
      this.recordAccessTime(Date.now() - startTime)
      
      // Decompress if needed
      let value = entry.value
      if (this.isCompressed(value)) {
        value = await this.decompress(value)
      }

      this.emit('hit', key, entry)
      return value as T

    } catch (error) {
      console.error('Cache get error:', error)
      this.recordMiss()
      return null
    }
  }

  /**
   * Set value in cache
   */
  public async set<T>(
    key: string, 
    value: T, 
    options?: {
      ttl?: number
      tags?: string[]
      queryType?: 'vector' | 'database' | 'api' | 'embedding'
      cost?: number
    }
  ): Promise<void> {
    try {
      const ttl = options?.ttl ?? this.config.defaultTTL
      const tags = options?.tags ?? []
      const queryType = options?.queryType ?? 'database'
      const cost = options?.cost ?? 1
      
      // Calculate size and compress if needed
      let processedValue = value
      let size = this.estimateSize(value)
      
      if (this.config.enableCompression && size > this.config.compressionThreshold) {
        processedValue = await this.compress(value)
        size = this.estimateSize(processedValue)
      }

      const entry: CacheEntry<T> = {
        key,
        value: processedValue,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        size,
        metadata: {
          queryType,
          cost,
          tags
        }
      }

      // Check if we need to evict entries
      await this.ensureCapacity(size)

      // Store the entry
      this.cache.set(key, entry)
      this.updateMetrics()
      
      this.emit('set', key, entry)
      
    } catch (error) {
      console.error('Cache set error:', error)
      throw error
    }
  }

  /**
   * Delete entry from cache
   */
  public delete(key: string): boolean {
    const entry = this.cache.get(key)
    const deleted = this.cache.delete(key)
    
    if (deleted && entry) {
      this.updateMetrics()
      this.emit('delete', key, entry)
    }
    
    return deleted
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    const count = this.cache.size
    this.cache.clear()
    this.updateMetrics()
    this.emit('clear', count)
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): CacheMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get entries by tag
   */
  public getByTag(tag: string): CacheEntry[] {
    const entries: CacheEntry[] = []
    
    for (const entry of this.cache.values()) {
      if (entry.metadata.tags.includes(tag)) {
        entries.push(entry)
      }
    }
    
    return entries
  }

  /**
   * Delete entries by tag
   */
  public deleteByTag(tag: string): number {
    let deletedCount = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.tags.includes(tag)) {
        this.cache.delete(key)
        deletedCount++
        this.emit('delete', key, entry)
      }
    }
    
    if (deletedCount > 0) {
      this.updateMetrics()
    }
    
    return deletedCount
  }

  /**
   * Get cache statistics for monitoring
   */
  public getStats() {
    const stats = {
      ...this.getMetrics(),
      topKeys: this.getTopKeys(10),
      sizeDistribution: this.getSizeDistribution(),
      typeDistribution: this.getTypeDistribution(),
      oldestEntry: this.getOldestEntry(),
      config: { ...this.config }
    }
    
    return stats
  }

  /**
   * Warming cache with frequently accessed data
   */
  public async warmUp(warmUpData: Array<{
    key: string
    value: any
    options?: any
  }>): Promise<void> {
    console.info(`🔥 Warming up cache with ${warmUpData.length} entries...`)
    
    for (const item of warmUpData) {
      await this.set(item.key, item.value, item.options)
    }
    
    console.info(`✅ Cache warmed up successfully`)
  }

  /**
   * Ensure cache has capacity for new entry
   */
  private async ensureCapacity(newEntrySize: number): Promise<void> {
    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLeastRecentlyUsed()
    }

    // Check size limit
    let currentSize = this.calculateTotalSize()
    while (currentSize + newEntrySize > this.config.maxSize) {
      this.evictLeastRecentlyUsed()
      currentSize = this.calculateTotalSize()
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)
      this.cache.delete(oldestKey)
      this.metrics.evictionCount++
      
      if (entry) {
        this.emit('evicted', oldestKey, entry)
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
        this.metrics.expiredCount++
        this.emit('expired', key, entry)
      }
    }

    if (cleanedCount > 0) {
      console.info(`🧹 Cleaned up ${cleanedCount} expired cache entries`)
      this.updateMetrics()
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries()
    }, this.config.cleanupInterval)
  }

  /**
   * Stop cleanup timer
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
    console.info('🛑 Query cache destroyed')
  }

  /**
   * Record cache hit
   */
  private recordHit(): void {
    this.metrics.totalHits++
    this.updateHitRates()
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.metrics.totalMisses++
    this.updateHitRates()
  }

  /**
   * Update hit/miss rates
   */
  private updateHitRates(): void {
    const total = this.metrics.totalHits + this.metrics.totalMisses
    if (total > 0) {
      this.metrics.hitRate = this.metrics.totalHits / total
      this.metrics.missRate = this.metrics.totalMisses / total
    }
  }

  /**
   * Record access time for performance monitoring
   */
  private recordAccessTime(time: number): void {
    this.accessTimes.push(time)
    
    // Keep only last 1000 access times
    if (this.accessTimes.length > 1000) {
      this.accessTimes.shift()
    }
    
    // Update average
    this.metrics.averageAccessTime = this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    this.metrics.totalEntries = this.cache.size
    this.metrics.totalSize = this.calculateTotalSize()
    this.metrics.memoryUsage = process.memoryUsage().heapUsed
  }

  /**
   * Calculate total cache size
   */
  private calculateTotalSize(): number {
    let totalSize = 0
    for (const entry of this.cache.values()) {
      totalSize += entry.size
    }
    return totalSize
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2 // Rough estimate (UTF-16)
    } catch {
      return 1024 // Default size for non-serializable objects
    }
  }

  /**
   * Compress data (placeholder - in production use a real compression library)
   */
  private async compress(data: any): Promise<any> {
    // In production, use a library like 'lz-string' or 'pako'
    return {
      __compressed: true,
      data: JSON.stringify(data)
    }
  }

  /**
   * Decompress data
   */
  private async decompress(compressedData: any): Promise<any> {
    if (this.isCompressed(compressedData)) {
      return JSON.parse(compressedData.data)
    }
    return compressedData
  }

  /**
   * Check if data is compressed
   */
  private isCompressed(data: any): boolean {
    return data && typeof data === 'object' && data.__compressed === true
  }

  /**
   * Get top accessed keys
   */
  private getTopKeys(limit: number): Array<{ key: string, accessCount: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
    
    return entries
  }

  /**
   * Get size distribution
   */
  private getSizeDistribution() {
    const buckets = {
      small: 0,    // < 1KB
      medium: 0,   // 1KB - 10KB
      large: 0,    // 10KB - 100KB
      xlarge: 0    // > 100KB
    }

    for (const entry of this.cache.values()) {
      if (entry.size < 1024) buckets.small++
      else if (entry.size < 10240) buckets.medium++
      else if (entry.size < 102400) buckets.large++
      else buckets.xlarge++
    }

    return buckets
  }

  /**
   * Get query type distribution
   */
  private getTypeDistribution() {
    const types: Record<string, number> = {}

    for (const entry of this.cache.values()) {
      const type = entry.metadata.queryType
      types[type] = (types[type] || 0) + 1
    }

    return types
  }

  /**
   * Get oldest entry info
   */
  private getOldestEntry() {
    let oldestEntry: CacheEntry | null = null
    let oldestTime = Date.now()

    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestEntry = entry
      }
    }

    return oldestEntry ? {
      key: oldestEntry.key,
      age: Date.now() - oldestEntry.timestamp,
      accessCount: oldestEntry.accessCount
    } : null
  }
}

// Global query cache instance
export const queryCache = new QueryCache({
  maxSize: 50 * 1024 * 1024, // 50MB for production
  maxEntries: 5000,
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  cleanupInterval: 2 * 60 * 1000, // 2 minutes
  enableMetrics: true,
  enableCompression: true
})

// Export cache utility functions
export const cacheUtils = {
  /**
   * Generate cache key for vector searches
   */
  vectorSearchKey: (query: string, collection?: string, limit?: number) => {
    const params = [query, collection || 'default', limit || 5].join(':')
    return `vector_search:${Buffer.from(params).toString('base64')}`
  },

  /**
   * Generate cache key for database queries
   */
  databaseQueryKey: (sql: string, params?: any[]) => {
    const paramStr = params ? JSON.stringify(params) : ''
    return `db_query:${Buffer.from(sql + paramStr).toString('base64')}`
  },

  /**
   * Generate cache key for embeddings
   */
  embeddingKey: (text: string, model?: string) => {
    const key = `${text}:${model || 'default'}`
    return `embedding:${Buffer.from(key).toString('base64')}`
  },

  /**
   * Generate cache key for API responses
   */
  apiResponseKey: (endpoint: string, params?: any) => {
    const paramStr = params ? JSON.stringify(params) : ''
    return `api:${Buffer.from(endpoint + paramStr).toString('base64')}`
  }
}