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
  EMBEDDING: 'embedding:',
  LLM_RESPONSE: 'llm:response:'
} as const;

export const DEFAULT_CACHE_CONFIG = {
  ttl: CacheTTL.MEDIUM,
  maxSize: 1000,
  checkPeriod: 600 // 10 minutes
} as const;

/**
 * LLM Response Cache Configuration
 * Semantic cache for LLM responses with similarity-based matching
 */
export const LLM_CACHE_CONFIG = {
  ttl: CacheTTL.LONG, // 1 hour - LLM responses can be cached longer
  similarityThreshold: 0.90, // 90% similarity required for cache hit
  maxSize: 500, // Limit cache size for LLM responses
  checkPeriod: 600 // 10 minutes
} as const;
