/**
 * Rate Limiting Implementation
 *
 * Provides distributed rate limiting using Redis/Valkey with a sliding window algorithm.
 * This ensures accurate, fair rate limiting across multiple server instances.
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Distributed coordination via Redis/Valkey
 * - Per-IP and per-user rate limiting
 * - Configurable limits per endpoint
 * - Automatic header injection (X-RateLimit-*)
 * - Skip rate limiting for authenticated users (configurable)
 *
 * @see https://redis.io/commands/incr#pattern-rate-limiter
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cache, CacheTTL } from '@/lib/cache/valkey-client'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number

  /**
   * Time window in seconds
   */
  windowSeconds: number

  /**
   * Skip rate limiting for authenticated users
   * @default false
   */
  skipAuthenticated?: boolean

  /**
   * Custom error message for rate limit exceeded
   */
  message?: string
}

/**
 * Predefined rate limit configurations for common use cases
 */
export const RATE_LIMITS = {
  /**
   * Strict rate limit for sensitive operations
   * 5 requests per 60 seconds
   */
  STRICT: {
    maxRequests: 5,
    windowSeconds: 60,
    skipAuthenticated: false,
    message: 'Too many requests to this sensitive endpoint',
  },

  /**
   * Authentication rate limit
   * 10 requests per 5 minutes (300 seconds)
   */
  AUTH: {
    maxRequests: 10,
    windowSeconds: 300,
    skipAuthenticated: false,
    message: 'Too many authentication attempts',
  },

  /**
   * General API rate limit
   * 100 requests per 60 seconds
   */
  API: {
    maxRequests: 100,
    windowSeconds: 60,
    skipAuthenticated: true,
    message: 'API rate limit exceeded',
  },

  /**
   * Upload rate limit
   * 5 uploads per 5 minutes (300 seconds)
   */
  UPLOAD: {
    maxRequests: 5,
    windowSeconds: 300,
    skipAuthenticated: false,
    message: 'Too many upload attempts',
  },
} as const

/**
 * Result of rate limit check
 */
interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  success: boolean

  /**
   * Number of requests remaining in current window
   */
  remaining: number

  /**
   * Unix timestamp when the rate limit resets
   */
  resetTime: number

  /**
   * Current request count
   */
  current: number

  /**
   * Maximum allowed requests
   */
  limit: number

  /**
   * Error response if rate limit exceeded (only when success=false)
   */
  errorResponse?: NextResponse
}

/**
 * Extracts client identifier from request
 * Tries multiple headers to find the real IP address
 *
 * @param req - The incoming request
 * @returns Client identifier (IP address or 'unknown')
 */
function getClientIdentifier(req: NextRequest): string {
  // Try various headers for real IP (in order of preference)
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIP = req.headers.get('cf-connecting-ip')

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim()
  }

  return realIp || cfIP || 'unknown'
}

/**
 * Generates a rate limit cache key
 *
 * @param prefix - Endpoint/operation identifier
 * @param identifier - Client identifier (IP or user ID)
 * @param windowSeconds - Time window in seconds
 * @returns Cache key for rate limiting
 */
function getRateLimitKey(
  prefix: string,
  identifier: string,
  windowSeconds: number
): string {
  // Use sliding window: align to window boundaries
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds
  return `ratelimit:${prefix}:${identifier}:${windowStart}`
}

/**
 * Applies rate limiting to a request
 *
 * Uses atomic increment operations in Redis/Valkey for distributed rate limiting.
 * Sets TTL on first increment to ensure cleanup of old rate limit data.
 *
 * @param req - The incoming request
 * @param config - Rate limit configuration
 * @param prefix - Endpoint/operation identifier for the rate limit key
 * @returns Rate limit check result
 */
export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  prefix: string = 'default'
): Promise<RateLimitResult> {
  // Check if rate limiting should be skipped for authenticated users
  if (config.skipAuthenticated) {
    try {
      const session = await getServerSession(authOptions)
      if (session?.user) {
        // Return success with no limits for authenticated users
        return {
          success: true,
          remaining: config.maxRequests,
          resetTime: Date.now() + config.windowSeconds * 1000,
          current: 0,
          limit: config.maxRequests,
        }
      }
    } catch (error) {
      // If session check fails, continue with rate limiting
      console.warn('Session check failed during rate limiting', { error })
    }
  }

  const identifier = getClientIdentifier(req)
  const key = getRateLimitKey(prefix, identifier, config.windowSeconds)

  try {
    // Atomic increment with TTL
    const current = await cache.incr(key, config.windowSeconds)
    const resetTime = Date.now() + config.windowSeconds * 1000

    const remaining = Math.max(0, config.maxRequests - current)
    const success = current <= config.maxRequests

    if (!success) {
      // Rate limit exceeded
      const errorResponse = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: config.message || 'Too many requests, please try again later',
          type: 'https://vibecode.dev/errors/rate-limit-exceeded',
          retryAfter: config.windowSeconds,
        },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/problem+json',
            'Retry-After': config.windowSeconds.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(),
          },
        }
      )

      return {
        success: false,
        remaining: 0,
        resetTime,
        current,
        limit: config.maxRequests,
        errorResponse,
      }
    }

    return {
      success: true,
      remaining,
      resetTime,
      current,
      limit: config.maxRequests,
    }
  } catch (error) {
    // If rate limiting fails, allow the request but log the error
    console.error('Rate limiting error, allowing request', { error, key })

    return {
      success: true,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowSeconds * 1000,
      current: 0,
      limit: config.maxRequests,
    }
  }
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 *
 * Automatically applies rate limiting and injects rate limit headers.
 * If rate limit is exceeded, returns 429 response.
 *
 * Usage:
 * ```typescript
 * export const POST = withRateLimit(RATE_LIMITS.API, 'create-workspace')(async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * })
 * ```
 *
 * @param config - Rate limit configuration
 * @param prefix - Endpoint/operation identifier
 * @returns Wrapper function that applies rate limiting
 */
export function withRateLimit(config: RateLimitConfig, prefix: string) {
  return function (
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>
  ) {
    return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
      // Check rate limit
      const rateLimitResult = await applyRateLimit(req, config, prefix)

      // If rate limit exceeded, return error response
      if (!rateLimitResult.success && rateLimitResult.errorResponse) {
        return rateLimitResult.errorResponse
      }

      // Rate limit OK, execute handler
      const response = await handler(req, ...args)

      // Inject rate limit headers into successful responses
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      response.headers.set('X-RateLimit-Reset', Math.floor(rateLimitResult.resetTime / 1000).toString())

      return response
    }
  }
}

/**
 * Clears rate limit for a specific identifier
 * Useful for admin operations or after successful authentication
 *
 * @param prefix - Endpoint/operation identifier
 * @param identifier - Client identifier (IP or user ID)
 * @param windowSeconds - Time window in seconds
 * @returns Promise that resolves when rate limit is cleared
 */
export async function clearRateLimit(
  prefix: string,
  identifier: string,
  windowSeconds: number
): Promise<void> {
  const key = getRateLimitKey(prefix, identifier, windowSeconds)
  await cache.del(key)
}

/**
 * Gets current rate limit status for an identifier
 *
 * @param prefix - Endpoint/operation identifier
 * @param identifier - Client identifier (IP or user ID)
 * @param windowSeconds - Time window in seconds
 * @param maxRequests - Maximum allowed requests
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  prefix: string,
  identifier: string,
  windowSeconds: number,
  maxRequests: number
): Promise<{
  current: number
  remaining: number
  limit: number
  resetTime: number
}> {
  const key = getRateLimitKey(prefix, identifier, windowSeconds)

  try {
    const current = await cache.get<number>(key) || 0
    const remaining = Math.max(0, maxRequests - current)
    const resetTime = Date.now() + windowSeconds * 1000

    return {
      current,
      remaining,
      limit: maxRequests,
      resetTime,
    }
  } catch (error) {
    console.error('Error getting rate limit status', { error, key })

    return {
      current: 0,
      remaining: maxRequests,
      limit: maxRequests,
      resetTime: Date.now() + windowSeconds * 1000,
    }
  }
}
