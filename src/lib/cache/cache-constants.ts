/**
 * Cache Constants
 * Defines TTL (Time To Live) values for different cache types
 */

export enum CacheTTL {
  SHORT = 300,      // 5 minutes
  MEDIUM = 1800,    // 30 minutes
  LONG = 3600,      // 1 hour
  VERY_LONG = 86400 // 24 hours
}

export const CACHE_PREFIXES = {
  VECTOR: 'vector:',
  QUERY: 'query:',
  SESSION: 'session:',
  USER: 'user:',
  EMBEDDING: 'embedding:'
} as const;

export const DEFAULT_CACHE_CONFIG = {
  ttl: CacheTTL.MEDIUM,
  maxSize: 1000,
  checkPeriod: 600 // 10 minutes
} as const;
