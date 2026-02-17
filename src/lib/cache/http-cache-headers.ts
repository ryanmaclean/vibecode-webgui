/**
 * HTTP Cache Headers Utility
 *
 * Provides helper functions for generating consistent HTTP Cache-Control headers
 * using stale-while-revalidate patterns for semi-static API responses.
 *
 * Patterns:
 * - Public cache: CDN and browser caching for non-sensitive data
 * - Private cache: Browser-only caching for user/admin-specific data
 * - SWR (stale-while-revalidate): Serve stale content while fetching fresh data
 * - No-cache: Prevent caching entirely for dynamic or sensitive responses
 */

import { CacheTTL } from './cache-constants';

/**
 * Options for Cache-Control header generation
 */
export interface CacheHeaderOptions {
  /** Primary max-age in seconds (fresh window) */
  maxAge: number;
  /** Stale-while-revalidate window in seconds */
  staleWhileRevalidate?: number;
  /** Stale-if-error window in seconds */
  staleIfError?: number;
}

/**
 * Cache status values for X-Cache-Status header
 */
export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS' | 'REVALIDATING';

/**
 * Generate public Cache-Control headers (CDN + browser cacheable)
 *
 * Use for: model lists, marketplace data, non-sensitive configuration
 *
 * @param maxAge - Fresh window in seconds (s-maxage for CDN, max-age for browser)
 * @param staleWhileRevalidate - How long to serve stale content while revalidating
 * @returns Record of HTTP headers
 */
export function getPublicCacheHeaders(
  maxAge: number,
  staleWhileRevalidate?: number
): Record<string, string> {
  const parts: string[] = ['public', `s-maxage=${maxAge}`, `max-age=${maxAge}`];

  if (staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  return {
    'Cache-Control': parts.join(', '),
  };
}

/**
 * Generate private Cache-Control headers (browser-only, no CDN)
 *
 * Use for: admin data, user-specific configuration, authenticated responses
 *
 * @param maxAge - Fresh window in seconds
 * @param staleWhileRevalidate - How long to serve stale content while revalidating
 * @returns Record of HTTP headers
 */
export function getPrivateCacheHeaders(
  maxAge: number,
  staleWhileRevalidate?: number
): Record<string, string> {
  const parts: string[] = ['private', `max-age=${maxAge}`];

  if (staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  return {
    'Cache-Control': parts.join(', '),
  };
}

/**
 * Generate stale-while-revalidate Cache-Control headers with explicit stale window
 *
 * Use for: data that can tolerate brief staleness for performance gains
 *
 * @param maxAge - Fresh window in seconds
 * @param staleTime - How long stale content may be served while revalidating
 * @returns Record of HTTP headers
 */
export function getSWRCacheHeaders(
  maxAge: number,
  staleTime: number
): Record<string, string> {
  return {
    'Cache-Control': `public, s-maxage=${maxAge}, max-age=${maxAge}, stale-while-revalidate=${staleTime}`,
  };
}

/**
 * Add X-Cache-Status header to an existing headers record
 *
 * @param headers - Existing headers record to extend
 * @param status - Cache status ('HIT' | 'MISS' | 'BYPASS' | 'REVALIDATING')
 * @returns Headers record with X-Cache-Status added
 */
export function withCacheStatus(
  headers: Record<string, string>,
  status: CacheStatus
): Record<string, string> {
  return {
    ...headers,
    'X-Cache-Status': status,
  };
}

/**
 * No-cache headers constant — prevents all caching
 *
 * Use for: real-time data, streaming responses, sensitive authenticated data,
 * health checks that require fresh results
 */
export const NO_CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
} as const;

/**
 * Pre-configured header sets for common API caching scenarios
 */
export const CACHE_HEADER_PRESETS = {
  /** AI model list: 5 min fresh, 1 hr stale (models rarely change) */
  AI_MODELS: getPublicCacheHeaders(CacheTTL.SHORT, CacheTTL.LONG),

  /** Template list: 5 min fresh, 2 hr stale (templates are semi-static) */
  TEMPLATES: getPublicCacheHeaders(CacheTTL.SHORT, CacheTTL.LONG * 2),

  /** Experiment/feature flags: 2 min fresh, 5 min stale (admin-only, private) */
  EXPERIMENTS_CONFIG: getPrivateCacheHeaders(120, 300),

  /** SAML metadata: 1 hr fresh (certificates and config rarely change) */
  SAML_METADATA: getPublicCacheHeaders(CacheTTL.LONG),

  /** No caching: streaming, health, dynamic endpoints */
  NO_CACHE: NO_CACHE_HEADERS,
} as const;
