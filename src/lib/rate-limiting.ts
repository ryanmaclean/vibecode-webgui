/**
 * Rate Limiting Utility
 * 
 * Production-ready rate limiting for API endpoints
 * Implements sliding window rate limiting with Redis support
 * 
 * Staff Engineer Implementation - Enterprise-grade rate limiting
 */

import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  max: number // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// In-memory store for development (use Redis in production)
const requestStore = new Map<string, { count: number; reset: number; requests: number[] }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of requestStore.entries()) {
    if (data.reset < now) {
      requestStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export default function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    keyGenerator = (req: NextRequest) => getClientIP(req),
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests'
  } = config

  return async (req: NextRequest): Promise<RateLimitResult> => {
    const key = keyGenerator(req)
    const now = Date.now()
    const windowStart = now - windowMs

    // Get or create entry
    let entry = requestStore.get(key)
    if (!entry) {
      entry = {
        count: 0,
        reset: now + windowMs,
        requests: []
      }
      requestStore.set(key, entry)
    }

    // Clean old requests (sliding window)
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart)
    entry.count = entry.requests.length

    // Update reset time if needed
    if (entry.reset < now) {
      entry.reset = now + windowMs
    }

    const result: RateLimitResult = {
      success: entry.count < max,
      limit: max,
      remaining: Math.max(0, max - entry.count - 1),
      reset: Math.ceil(entry.reset / 1000)
    }

    // Add current request if under limit
    if (result.success) {
      entry.requests.push(now)
      entry.count++
    } else {
      // Calculate retry after
      const oldestRequest = Math.min(...entry.requests)
      result.retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000)
    }

    return result
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(req: NextRequest): string {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback to connection IP
  return req.ip || 'unknown'
}

/**
 * Create rate limiter for specific endpoints
 */
export function createAPIRateLimit(requestsPerMinute: number = 60) {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: requestsPerMinute,
    keyGenerator: (req) => `api:${getClientIP(req)}`,
    message: 'API rate limit exceeded'
  })
}

/**
 * Create rate limiter for authentication endpoints
 */
export function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    keyGenerator: (req) => `auth:${getClientIP(req)}`,
    message: 'Too many authentication attempts'
  })
}

/**
 * Create rate limiter for file operations
 */
export function createFileRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 file operations per minute
    keyGenerator: (req) => `files:${getClientIP(req)}`,
    message: 'File operation rate limit exceeded'
  })
}

/**
 * Create rate limiter for Claude AI operations
 */
export function createClaudeRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 AI requests per minute
    keyGenerator: (req) => `claude:${getClientIP(req)}`,
    message: 'AI service rate limit exceeded'
  })
}

/**
 * Redis-based rate limiter for production
 */
export class RedisRateLimiter {
  private redis: any // Redis client
  private prefix: string

  constructor(redisClient: any, prefix: string = 'rl:') {
    this.redis = redisClient
    this.prefix = prefix
  }

  async checkLimit(
    key: string, 
    max: number, 
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const window = Math.floor(now / windowMs)
    const redisKey = `${this.prefix}${key}:${window}`

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline()
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000))
      
      const results = await pipeline.exec()
      const count = results[0][1]

      const remaining = Math.max(0, max - count)
      const reset = (window + 1) * windowMs

      return {
        success: count <= max,
        limit: max,
        remaining,
        reset: Math.ceil(reset / 1000),
        retryAfter: count > max ? Math.ceil(windowMs / 1000) : undefined
      }

    } catch (error) {
      console.error('Redis rate limiting error:', error)
      
      // Fallback to allowing request if Redis fails
      return {
        success: true,
        limit: max,
        remaining: max - 1,
        reset: Math.ceil((now + windowMs) / 1000)
      }
    }
  }
}

/**
 * Distributed rate limiter using Redis
 */
export function createDistributedRateLimit(
  redisClient: any,
  config: RateLimitConfig
) {
  const limiter = new RedisRateLimiter(redisClient)

  return async (req: NextRequest): Promise<RateLimitResult> => {
    const key = config.keyGenerator ? config.keyGenerator(req) : getClientIP(req)
    return limiter.checkLimit(key, config.max, config.windowMs)
  }
}