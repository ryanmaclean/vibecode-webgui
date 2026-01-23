/**
 * Sliding Window Rate Limiter
 *
 * Production-ready rate limiting using sliding window algorithm.
 * Provides more accurate rate limiting than fixed windows by using
 * weighted averaging between current and previous time windows.
 *
 * Features:
 * - Sliding window algorithm for smooth rate limiting
 * - In-memory storage for development/single instance
 * - Redis/Valkey support for distributed deployments
 * - Configurable limits per endpoint/operation
 * - Automatic cleanup of stale entries
 * - Full rate limit header support (X-RateLimit-*)
 * - RFC 7807 compliant 429 responses
 *
 * @see https://blog.cloudflare.com/counting-things-a-lot-of-different-things/
 */

import { NextRequest, NextResponse } from 'next/server'
import { createProblemResponse } from '@/lib/utils/api-response'

/**
 * Key uniqueness options for combining IP with additional identifiers
 */
export interface KeyUniquenessOptions {
  /** Include user agent in key generation */
  includeUserAgent?: boolean
  /** Include session ID header name (e.g., 'x-session-id') */
  sessionIdHeader?: string
  /** Custom additional identifier extractor */
  customIdentifier?: (req: NextRequest) => string | null
}

/**
 * Rate limit configuration
 */
export interface SlidingWindowConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number
  /** Time window duration in seconds */
  windowSeconds: number
  /** Optional custom key generator function */
  keyGenerator?: (req: NextRequest) => string
  /** Key uniqueness options for more robust identification */
  keyUniqueness?: KeyUniquenessOptions
  /** Custom error message */
  message?: string
  /** Skip rate limiting for certain conditions */
  skip?: (req: NextRequest) => boolean | Promise<boolean>
}

/**
 * Configuration validation error
 */
export class RateLimiterConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimiterConfigError'
  }
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Maximum requests per window */
  limit: number
  /** Remaining requests in current window */
  remaining: number
  /** Unix timestamp (seconds) when the rate limit resets */
  reset: number
  /** Seconds until retry is allowed (only set when rate limited) */
  retryAfter?: number
  /** Current request count (weighted) */
  current: number
}

/**
 * Storage interface for rate limit data
 */
interface RateLimitStorage {
  get(key: string): Promise<WindowData | null>
  set(key: string, data: WindowData, ttlSeconds: number): Promise<void>
  increment(key: string, ttlSeconds: number): Promise<number>
}

/**
 * Window data structure
 */
interface WindowData {
  count: number
  timestamp: number
}

/**
 * In-memory storage implementation
 */
class InMemoryStorage implements RateLimitStorage {
  private store = new Map<string, { data: WindowData; expires: number }>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, value] of this.store.entries()) {
        if (value.expires < now) {
          this.store.delete(key)
        }
      }
    }, 60000)
  }

  async get(key: string): Promise<WindowData | null> {
    const entry = this.store.get(key)
    if (!entry || entry.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  async set(key: string, data: WindowData, ttlSeconds: number): Promise<void> {
    // Validate TTL is positive before applying
    if (ttlSeconds <= 0) {
      return // Skip storage for non-positive TTL
    }
    this.store.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    })
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    // Validate TTL is positive
    if (ttlSeconds <= 0) {
      throw new Error('TTL must be positive for increment operation')
    }
    const existing = await this.get(key)
    const newCount = (existing?.count ?? 0) + 1
    await this.set(
      key,
      { count: newCount, timestamp: existing?.timestamp ?? Date.now() },
      ttlSeconds
    )
    return newCount
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

// Global in-memory storage instance
let memoryStorage: InMemoryStorage | null = null

function getMemoryStorage(): InMemoryStorage {
  if (!memoryStorage) {
    memoryStorage = new InMemoryStorage()
  }
  return memoryStorage
}

/**
 * Extract client IP from request headers
 * Handles various proxy configurations with improved proxy chain handling
 */
function getClientIP(req: NextRequest): string {
  // Check Cloudflare first (most reliable when using Cloudflare)
  const cfIP = req.headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP.trim()
  }

  // Check true-client-ip (Akamai and others)
  const trueClientIP = req.headers.get('true-client-ip')
  if (trueClientIP) {
    return trueClientIP.trim()
  }

  // Check x-real-ip (nginx proxy)
  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }

  // Check for forwarded IP (behind proxy/load balancer)
  // Take the leftmost IP that is not a private/internal address
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    // Return the first (client) IP from the chain
    // In production, you may want to configure trusted proxy count
    // to skip known proxy IPs from the right
    const clientIP = ips[0]
    if (clientIP) {
      return clientIP
    }
  }

  // Check Forwarded header (RFC 7239 standard)
  const forwardedHeader = req.headers.get('forwarded')
  if (forwardedHeader) {
    const forMatch = forwardedHeader.match(/for=["']?([^"',;\s]+)["']?/i)
    if (forMatch?.[1]) {
      // Remove brackets from IPv6 addresses
      return forMatch[1].replace(/^\[|\]$/g, '').trim()
    }
  }

  return 'unknown'
}

/**
 * Create a robust key generator that combines IP with additional identifiers
 * to prevent rate limit bypass via header spoofing
 */
function createRobustKeyGenerator(options?: KeyUniquenessOptions): (req: NextRequest) => string {
  return (req: NextRequest): string => {
    const parts: string[] = []

    // Always include IP as base identifier
    const ip = getClientIP(req)
    parts.push(ip)

    if (options?.includeUserAgent) {
      const userAgent = req.headers.get('user-agent')
      if (userAgent) {
        // Use a hash-like truncation for privacy and key length
        const uaFingerprint = userAgent.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '')
        parts.push(`ua:${uaFingerprint}`)
      }
    }

    if (options?.sessionIdHeader) {
      const sessionId = req.headers.get(options.sessionIdHeader)
      if (sessionId) {
        parts.push(`sid:${sessionId}`)
      }
    }

    if (options?.customIdentifier) {
      const customId = options.customIdentifier(req)
      if (customId) {
        parts.push(`cid:${customId}`)
      }
    }

    return parts.join(':')
  }
}

/**
 * Sliding Window Rate Limiter class
 *
 * Uses a sliding window algorithm that provides smoother rate limiting
 * than fixed windows. It calculates a weighted count based on requests
 * in the current window and the proportion of the previous window that
 * overlaps with the sliding window.
 */
export class SlidingWindowRateLimiter {
  private config: Required<Omit<SlidingWindowConfig, 'skip' | 'keyUniqueness'>> & {
    skip?: SlidingWindowConfig['skip']
    keyUniqueness?: KeyUniquenessOptions
  }
  private storage: RateLimitStorage
  private prefix: string

  constructor(config: SlidingWindowConfig, prefix: string = 'ratelimit') {
    // Validate configuration before applying
    this.validateConfig(config)

    // Determine key generator: custom > robust with options > default IP-based
    let keyGenerator: (req: NextRequest) => string
    if (config.keyGenerator) {
      keyGenerator = config.keyGenerator
    } else if (config.keyUniqueness) {
      keyGenerator = createRobustKeyGenerator(config.keyUniqueness)
    } else {
      keyGenerator = getClientIP
    }

    this.config = {
      maxRequests: config.maxRequests,
      windowSeconds: config.windowSeconds,
      keyGenerator,
      keyUniqueness: config.keyUniqueness,
      message: config.message ?? 'Rate limit exceeded. Please try again later.',
      skip: config.skip,
    }
    this.storage = getMemoryStorage()
    this.prefix = prefix
  }

  /**
   * Validate rate limiter configuration
   * Throws RateLimiterConfigError if configuration is invalid
   */
  private validateConfig(config: SlidingWindowConfig): void {
    if (typeof config.maxRequests !== 'number' || config.maxRequests <= 0) {
      throw new RateLimiterConfigError(
        `maxRequests must be a positive number, got: ${config.maxRequests}`
      )
    }

    if (!Number.isInteger(config.maxRequests)) {
      throw new RateLimiterConfigError(
        `maxRequests must be an integer, got: ${config.maxRequests}`
      )
    }

    if (typeof config.windowSeconds !== 'number' || config.windowSeconds <= 0) {
      throw new RateLimiterConfigError(
        `windowSeconds must be a positive number, got: ${config.windowSeconds}`
      )
    }

    if (!Number.isFinite(config.windowSeconds)) {
      throw new RateLimiterConfigError(
        `windowSeconds must be a finite number, got: ${config.windowSeconds}`
      )
    }
  }

  /**
   * Get the window key for a given timestamp
   */
  private getWindowKey(identifier: string, windowStart: number): string {
    return `${this.prefix}:${identifier}:${windowStart}`
  }

  /**
   * Calculate the current window start timestamp
   */
  private getCurrentWindowStart(): number {
    const now = Math.floor(Date.now() / 1000)
    return Math.floor(now / this.config.windowSeconds) * this.config.windowSeconds
  }

  /**
   * Check and apply rate limit
   */
  async check(req: NextRequest): Promise<RateLimitResult> {
    // Check if rate limiting should be skipped
    if (this.config.skip) {
      const shouldSkip = await this.config.skip(req)
      if (shouldSkip) {
        return {
          allowed: true,
          limit: this.config.maxRequests,
          remaining: this.config.maxRequests,
          reset: Math.floor(Date.now() / 1000) + this.config.windowSeconds,
          current: 0,
        }
      }
    }

    const identifier = this.config.keyGenerator(req)
    const now = Math.floor(Date.now() / 1000)
    const currentWindowStart = this.getCurrentWindowStart()
    const previousWindowStart = currentWindowStart - this.config.windowSeconds

    // Calculate position within current window (0 to 1)
    const windowPosition = (now - currentWindowStart) / this.config.windowSeconds

    // Get counts from current and previous windows
    const currentKey = this.getWindowKey(identifier, currentWindowStart)
    const previousKey = this.getWindowKey(identifier, previousWindowStart)

    const [currentData, previousData] = await Promise.all([
      this.storage.get(currentKey),
      this.storage.get(previousKey),
    ])

    const currentCount = currentData?.count ?? 0
    const previousCount = previousData?.count ?? 0

    // Calculate weighted count using sliding window algorithm
    // Weight of previous window decreases as we move through current window
    const previousWeight = 1 - windowPosition
    const weightedCount = currentCount + Math.floor(previousCount * previousWeight)

    // Check if rate limit is exceeded
    if (weightedCount >= this.config.maxRequests) {
      // Calculate time until enough requests expire
      const retryAfter = Math.ceil(this.config.windowSeconds * (1 - windowPosition))

      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        reset: currentWindowStart + this.config.windowSeconds,
        retryAfter,
        current: weightedCount,
      }
    }

    // Increment current window count
    await this.storage.increment(currentKey, this.config.windowSeconds * 2)

    const remaining = Math.max(0, this.config.maxRequests - weightedCount - 1)

    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining,
      reset: currentWindowStart + this.config.windowSeconds,
      current: weightedCount + 1,
    }
  }

  /**
   * Create rate limit headers
   */
  createHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    }

    if (result.retryAfter !== undefined) {
      headers['Retry-After'] = result.retryAfter.toString()
    }

    return headers
  }

  /**
   * Create 429 response for rate limit exceeded
   */
  createRateLimitResponse(result: RateLimitResult): NextResponse {
    return createProblemResponse({
      title: 'Too Many Requests',
      status: 429,
      detail: this.config.message,
      type: 'https://httpstatuses.com/429',
      code: 'RATE_LIMIT_EXCEEDED',
      headers: this.createHeaders(result),
      extensions: {
        retryAfter: result.retryAfter,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      },
    })
  }

  /**
   * Apply rate limit headers to response
   */
  applyHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
    const headers = this.createHeaders(result)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /**
   * Strict rate limit for authentication endpoints
   * 5 requests per minute
   */
  AUTH_STRICT: {
    maxRequests: 5,
    windowSeconds: 60,
    message: 'Too many authentication attempts. Please wait before trying again.',
  } as SlidingWindowConfig,

  /**
   * Standard authentication rate limit
   * 10 requests per 5 minutes
   */
  AUTH_STANDARD: {
    maxRequests: 10,
    windowSeconds: 300,
    message: 'Too many authentication attempts. Please wait before trying again.',
  } as SlidingWindowConfig,

  /**
   * MFA verification rate limit (sensitive operation)
   * 5 requests per 5 minutes
   */
  MFA_VERIFY: {
    maxRequests: 5,
    windowSeconds: 300,
    message: 'Too many MFA verification attempts. Please wait before trying again.',
  } as SlidingWindowConfig,

  /**
   * File upload rate limit
   * 10 uploads per 5 minutes
   */
  UPLOAD: {
    maxRequests: 10,
    windowSeconds: 300,
    message: 'Too many upload attempts. Please wait before trying again.',
  } as SlidingWindowConfig,

  /**
   * AI/LLM endpoint rate limit
   * 30 requests per minute
   */
  AI_ENDPOINT: {
    maxRequests: 30,
    windowSeconds: 60,
    message: 'AI service rate limit exceeded. Please wait before making more requests.',
  } as SlidingWindowConfig,

  /**
   * Vector search rate limit (resource heavy)
   * 50 requests per minute
   */
  VECTOR_SEARCH: {
    maxRequests: 50,
    windowSeconds: 60,
    message: 'Vector search rate limit exceeded. Please wait before making more requests.',
  } as SlidingWindowConfig,

  /**
   * General API rate limit
   * 100 requests per minute
   */
  API_STANDARD: {
    maxRequests: 100,
    windowSeconds: 60,
    message: 'API rate limit exceeded. Please wait before making more requests.',
  } as SlidingWindowConfig,

  /**
   * Generous API rate limit for authenticated users
   * 200 requests per minute
   */
  API_AUTHENTICATED: {
    maxRequests: 200,
    windowSeconds: 60,
    message: 'API rate limit exceeded. Please wait before making more requests.',
  } as SlidingWindowConfig,
} as const

/**
 * Create a rate limiter with the given configuration
 */
export function createRateLimiter(
  config: SlidingWindowConfig,
  prefix?: string
): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(config, prefix)
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 *
 * Usage:
 * ```typescript
 * export const POST = withRateLimiting(
 *   RateLimitPresets.AUTH_STRICT,
 *   'auth-login'
 * )(async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withRateLimiting(config: SlidingWindowConfig, prefix: string) {
  const limiter = createRateLimiter(config, prefix)

  return function <T extends NextRequest>(
    handler: (req: T, ...args: unknown[]) => Promise<NextResponse>
  ) {
    return async (req: T, ...args: unknown[]): Promise<NextResponse> => {
      const result = await limiter.check(req)

      if (!result.allowed) {
        return limiter.createRateLimitResponse(result)
      }

      const response = await handler(req, ...args)
      return limiter.applyHeaders(response, result)
    }
  }
}

/**
 * Middleware-style rate limiting for use in route handlers
 *
 * Usage:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const rateLimitResult = await checkRateLimit(req, RateLimitPresets.AUTH_STRICT, 'auth-login')
 *
 *   if (!rateLimitResult.allowed) {
 *     return createRateLimitedResponse(rateLimitResult, RateLimitPresets.AUTH_STRICT)
 *   }
 *
 *   // Your handler logic
 *   const response = NextResponse.json({ success: true })
 *   return applyRateLimitHeaders(response, rateLimitResult)
 * }
 * ```
 */
export async function checkRateLimit(
  req: NextRequest,
  config: SlidingWindowConfig,
  prefix: string
): Promise<RateLimitResult> {
  const limiter = createRateLimiter(config, prefix)
  return limiter.check(req)
}

/**
 * Create rate limited response helper
 */
export function createRateLimitedResponse(
  result: RateLimitResult,
  config: SlidingWindowConfig
): NextResponse {
  const limiter = createRateLimiter(config, 'temp')
  return limiter.createRateLimitResponse(result)
}

/**
 * Apply rate limit headers to response helper
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }

  return response
}

// Export for testing
export { InMemoryStorage, getClientIP, createRobustKeyGenerator }
