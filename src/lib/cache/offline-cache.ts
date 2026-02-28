/**
 * Offline Cache Manager
 * Manages caching of static resources for offline/air-gapped operation
 * Supports verification, invalidation, and size reporting
 */

import { CacheTTL } from './cache-constants';

/**
 * Cached resource metadata
 */
interface CachedResource {
  /** Resource key/identifier */
  key: string;
  /** Cached data */
  data: unknown;
  /** Size in bytes */
  size: number;
  /** Timestamp when cached */
  cachedAt: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Resource type (docs, templates, etc.) */
  type: ResourceType;
  /** Source URL or path */
  source?: string;
  /** ETag or version for validation */
  version?: string;
}

/**
 * Resource types supported by offline cache
 */
export type ResourceType = 'docs-index' | 'templates' | 'static-json' | 'other';

/**
 * Cache verification result
 */
export interface CacheVerificationResult {
  /** Whether cache is valid */
  valid: boolean;
  /** List of cached resources */
  resources: Array<{
    key: string;
    type: ResourceType;
    size: number;
    age: number;
    expired: boolean;
  }>;
  /** Total cache size in bytes */
  totalSize: number;
  /** Number of cached resources */
  count: number;
  /** Number of expired resources */
  expiredCount: number;
  /** Timestamp of verification */
  verifiedAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total resources cached */
  totalResources: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Total size in MB */
  totalSizeMB: number;
  /** Resources by type */
  byType: Record<ResourceType, number>;
  /** Size by type in bytes */
  sizeByType: Record<ResourceType, number>;
  /** Oldest resource timestamp */
  oldestResource: number | null;
  /** Newest resource timestamp */
  newestResource: number | null;
}

/**
 * Options for caching resources
 */
export interface OfflineCacheOptions {
  /** TTL in seconds (default: 24 hours) */
  ttl?: number;
  /** Resource type */
  type?: ResourceType;
  /** Source URL/path */
  source?: string;
  /** Version/ETag for validation */
  version?: string;
  /** Whether to force refresh even if cached */
  forceRefresh?: boolean;
}

/**
 * Offline cache manager for static resources
 * Uses localStorage/memory for browser environments
 * Uses in-memory cache for server environments
 */
class OfflineCacheManager {
  private memoryCache: Map<string, CachedResource> = new Map();
  private readonly storageKey = 'offline-cache';
  private readonly maxCacheSizeMB = 50; // 50MB max cache size
  private readonly maxCacheSizeBytes = this.maxCacheSizeMB * 1024 * 1024;

  /**
   * Check if running in browser environment with localStorage
   */
  private get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Load cache from localStorage (browser only)
   */
  private loadFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored) as Record<string, CachedResource>;
      this.memoryCache = new Map(Object.entries(data));
    } catch (error) {
      console.warn('Failed to load offline cache from localStorage:', error);
      this.memoryCache.clear();
    }
  }

  /**
   * Save cache to localStorage (browser only)
   */
  private saveToStorage(): void {
    if (!this.isBrowser) return;

    try {
      const data = Object.fromEntries(this.memoryCache.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save offline cache to localStorage:', error);
      // If quota exceeded, try to free up space
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.evictOldest();
        try {
          const data = Object.fromEntries(this.memoryCache.entries());
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch {
          console.error('Failed to save cache even after eviction');
        }
      }
    }
  }

  /**
   * Calculate size of a value in bytes
   */
  private calculateSize(data: unknown): number {
    const str = JSON.stringify(data);
    return new Blob([str]).size;
  }

  /**
   * Get current cache size in bytes
   */
  private getCurrentSize(): number {
    let total = 0;
    for (const resource of this.memoryCache.values()) {
      total += resource.size;
    }
    return total;
  }

  /**
   * Evict oldest cached resources until under size limit
   */
  private evictOldest(): void {
    const resources = Array.from(this.memoryCache.values())
      .sort((a, b) => a.cachedAt - b.cachedAt);

    const targetSize = this.maxCacheSizeBytes * 0.8; // Free up to 80% of max
    let currentSize = this.getCurrentSize();

    for (const resource of resources) {
      if (currentSize <= targetSize) break;
      this.memoryCache.delete(resource.key);
      currentSize -= resource.size;
    }
  }

  /**
   * Ensure cache is loaded
   */
  private ensureLoaded(): void {
    if (this.memoryCache.size === 0 && this.isBrowser) {
      this.loadFromStorage();
    }
  }

  /**
   * Get cached resource
   */
  get<T = unknown>(key: string): T | null {
    this.ensureLoaded();

    const resource = this.memoryCache.get(key);
    if (!resource) return null;

    // Check expiration
    if (Date.now() > resource.expiresAt) {
      this.memoryCache.delete(key);
      this.saveToStorage();
      return null;
    }

    return resource.data as T;
  }

  /**
   * Set cached resource
   */
  set<T = unknown>(key: string, data: T, options: OfflineCacheOptions = {}): boolean {
    this.ensureLoaded();

    const {
      ttl = CacheTTL.VERY_LONG, // Default to 24 hours
      type = 'other',
      source,
      version,
    } = options;

    const size = this.calculateSize(data);
    const now = Date.now();

    // Check if adding this would exceed max size
    const currentSize = this.getCurrentSize();
    if (currentSize + size > this.maxCacheSizeBytes) {
      this.evictOldest();
    }

    const resource: CachedResource = {
      key,
      data,
      size,
      cachedAt: now,
      expiresAt: now + (ttl * 1000),
      type,
      source,
      version,
    };

    this.memoryCache.set(key, resource);
    this.saveToStorage();

    return true;
  }

  /**
   * Check if resource is cached and valid
   */
  has(key: string): boolean {
    this.ensureLoaded();

    const resource = this.memoryCache.get(key);
    if (!resource) return false;

    // Check expiration
    if (Date.now() > resource.expiresAt) {
      this.memoryCache.delete(key);
      this.saveToStorage();
      return false;
    }

    return true;
  }

  /**
   * Delete cached resource
   */
  delete(key: string): boolean {
    this.ensureLoaded();

    const deleted = this.memoryCache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Clear all cached resources
   */
  clear(): void {
    this.memoryCache.clear();
    if (this.isBrowser) {
      localStorage.removeItem(this.storageKey);
    }
  }

  /**
   * Clear cached resources by type
   */
  clearByType(type: ResourceType): number {
    this.ensureLoaded();

    let deleted = 0;
    for (const [key, resource] of this.memoryCache.entries()) {
      if (resource.type === type) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.saveToStorage();
    }

    return deleted;
  }

  /**
   * Verify cache integrity and freshness
   */
  verify(): CacheVerificationResult {
    this.ensureLoaded();

    const now = Date.now();
    const resources: CacheVerificationResult['resources'] = [];
    let totalSize = 0;
    let expiredCount = 0;

    for (const resource of this.memoryCache.values()) {
      const expired = now > resource.expiresAt;
      if (expired) expiredCount++;

      resources.push({
        key: resource.key,
        type: resource.type,
        size: resource.size,
        age: Math.floor((now - resource.cachedAt) / 1000), // Age in seconds
        expired,
      });

      totalSize += resource.size;
    }

    return {
      valid: expiredCount === 0,
      resources,
      totalSize,
      count: resources.length,
      expiredCount,
      verifiedAt: now,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.ensureLoaded();

    const byType: Record<ResourceType, number> = {
      'docs-index': 0,
      'templates': 0,
      'static-json': 0,
      'other': 0,
    };

    const sizeByType: Record<ResourceType, number> = {
      'docs-index': 0,
      'templates': 0,
      'static-json': 0,
      'other': 0,
    };

    let totalSize = 0;
    let oldestResource: number | null = null;
    let newestResource: number | null = null;

    for (const resource of this.memoryCache.values()) {
      byType[resource.type]++;
      sizeByType[resource.type] += resource.size;
      totalSize += resource.size;

      if (oldestResource === null || resource.cachedAt < oldestResource) {
        oldestResource = resource.cachedAt;
      }
      if (newestResource === null || resource.cachedAt > newestResource) {
        newestResource = resource.cachedAt;
      }
    }

    return {
      totalResources: this.memoryCache.size,
      totalSizeBytes: totalSize,
      totalSizeMB: totalSize / (1024 * 1024),
      byType,
      sizeByType,
      oldestResource,
      newestResource,
    };
  }

  /**
   * Clean up expired resources
   */
  cleanup(): number {
    this.ensureLoaded();

    const now = Date.now();
    let deleted = 0;

    for (const [key, resource] of this.memoryCache.entries()) {
      if (now > resource.expiresAt) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.saveToStorage();
    }

    return deleted;
  }

  /**
   * Get or set with factory function (cache-aside pattern)
   */
  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    options: OfflineCacheOptions = {}
  ): Promise<T> {
    // Check if we should force refresh
    if (options.forceRefresh) {
      const value = await factory();
      this.set(key, value, options);
      return value;
    }

    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute factory function
    const value = await factory();

    // Cache the result
    this.set(key, value, options);

    return value;
  }
}

// Singleton instance
const offlineCache = new OfflineCacheManager();

/**
 * Cache key generators for common resources
 */
export const OfflineCacheKeys = {
  /** Documentation index */
  docsIndex: () => 'offline:docs-index',

  /** Templates list */
  templates: () => 'offline:templates',

  /** Documentation page by slug */
  docsPage: (slug: string) => `offline:docs:${slug}`,

  /** Static JSON file */
  staticJson: (filename: string) => `offline:static:${filename}`,

  /** Custom resource */
  custom: (key: string) => `offline:custom:${key}`,
};

/**
 * Cache invalidation helpers
 */
export const OfflineCacheInvalidators = {
  /** Invalidate documentation index */
  invalidateDocsIndex: (): boolean => {
    return offlineCache.delete(OfflineCacheKeys.docsIndex());
  },

  /** Invalidate templates cache */
  invalidateTemplates: (): boolean => {
    return offlineCache.delete(OfflineCacheKeys.templates());
  },

  /** Invalidate all documentation */
  invalidateAllDocs: (): number => {
    return offlineCache.clearByType('docs-index');
  },

  /** Invalidate all cached resources */
  invalidateAll: (): void => {
    offlineCache.clear();
  },

  /** Clean up expired resources */
  cleanupExpired: (): number => {
    return offlineCache.cleanup();
  },
};

/**
 * TTL presets for offline resources
 */
export const OfflineTTL = {
  /** Very long TTL for static resources (7 days) */
  STATIC: 604800,

  /** Long TTL for documentation (24 hours) */
  DOCS: CacheTTL.VERY_LONG,

  /** Medium TTL for templates (12 hours) */
  TEMPLATES: 43200,

  /** Short TTL for dynamic content (1 hour) */
  DYNAMIC: CacheTTL.LONG,
};

/**
 * Helper functions for common caching patterns
 */

/**
 * Cache documentation index
 */
export async function cacheDocsIndex(
  index: unknown,
  options: Omit<OfflineCacheOptions, 'type'> = {}
): Promise<boolean> {
  return offlineCache.set(
    OfflineCacheKeys.docsIndex(),
    index,
    {
      ...options,
      type: 'docs-index',
      ttl: options.ttl ?? OfflineTTL.DOCS,
    }
  );
}

/**
 * Get cached documentation index
 */
export function getCachedDocsIndex<T = unknown>(): T | null {
  return offlineCache.get<T>(OfflineCacheKeys.docsIndex());
}

/**
 * Cache templates
 */
export async function cacheTemplates(
  templates: unknown,
  options: Omit<OfflineCacheOptions, 'type'> = {}
): Promise<boolean> {
  return offlineCache.set(
    OfflineCacheKeys.templates(),
    templates,
    {
      ...options,
      type: 'templates',
      ttl: options.ttl ?? OfflineTTL.TEMPLATES,
    }
  );
}

/**
 * Get cached templates
 */
export function getCachedTemplates<T = unknown>(): T | null {
  return offlineCache.get<T>(OfflineCacheKeys.templates());
}

/**
 * Verify offline cache readiness
 */
export interface OfflineReadiness {
  /** Whether offline mode is ready */
  ready: boolean;
  /** Cache verification result */
  cache: CacheVerificationResult;
  /** Missing critical resources */
  missing: string[];
  /** Recommendations for setup */
  recommendations: string[];
}

/**
 * Check offline readiness
 */
export function checkOfflineReadiness(): OfflineReadiness {
  const verification = offlineCache.verify();
  const missing: string[] = [];
  const recommendations: string[] = [];

  // Check for critical resources
  if (!offlineCache.has(OfflineCacheKeys.docsIndex())) {
    missing.push('Documentation Index');
    recommendations.push('Load documentation index by visiting docs page while online');
  }

  if (!offlineCache.has(OfflineCacheKeys.templates())) {
    missing.push('Templates');
    recommendations.push('Load templates by visiting templates page while online');
  }

  // Check for expired resources
  if (verification.expiredCount > 0) {
    recommendations.push(`${verification.expiredCount} cached resources are expired - refresh while online`);
  }

  // Check cache size
  const stats = offlineCache.getStats();
  if (stats.totalSizeMB < 0.1) {
    recommendations.push('Cache is nearly empty - visit key pages while online to populate cache');
  }

  return {
    ready: missing.length === 0 && verification.expiredCount === 0,
    cache: verification,
    missing,
    recommendations,
  };
}

// Export singleton instance and core functions
export { offlineCache };

/**
 * Get cached resource
 */
export function getOfflineCache<T = unknown>(key: string): T | null {
  return offlineCache.get<T>(key);
}

/**
 * Set cached resource
 */
export function setOfflineCache<T = unknown>(
  key: string,
  data: T,
  options?: OfflineCacheOptions
): boolean {
  return offlineCache.set(key, data, options);
}

/**
 * Get cache statistics
 */
export function getOfflineCacheStats(): CacheStats {
  return offlineCache.getStats();
}

/**
 * Verify offline cache
 */
export function verifyOfflineCache(): CacheVerificationResult {
  return offlineCache.verify();
}

/**
 * Clear offline cache
 */
export function clearOfflineCache(): void {
  offlineCache.clear();
}
