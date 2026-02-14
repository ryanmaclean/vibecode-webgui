/**
 * Rate Limiting Utility
 *
 * Production-ready rate limiting for API endpoints
 * Implements token bucket rate limiting with Redis support
 *
 * Staff Engineer Implementation - Enterprise-grade rate limiting
 *
 * Security: Uses validated IP extraction to prevent IP spoofing attacks
 */

import { NextRequest } from 'next/server'
import {
  getClientIpString,
  logSuspiciousPattern,
  isPrivateIp,
  sanitizeIpAddress,
} from './security/ip-validator'

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

interface TokenBucketState {
  tokens: number
  lastRefill: number
  refillPerMs: number
  capacity: number
}

// In-memory store for development (use Redis in production)
const requestStore = new Map<string, TokenBucketState>()

// Cleanup old entries every 5 minutes (only at runtime, not during build)
if (typeof setInterval !== 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of requestStore.entries()) {
      if (bucket.refillPerMs <= 0) continue

      const bucketWindowMs = bucket.capacity / bucket.refillPerMs
      const idleDuration = now - bucket.lastRefill
      // Drop inactive buckets once they have been full for 2 windows
      if (bucket.tokens >= bucket.capacity && idleDuration > bucketWindowMs * 2) {
        requestStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Clear the request store (for testing purposes)
 */
export function __clearStore(): void {
  requestStore.clear()
}

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
    const refillPerMs = max / Math.max(windowMs, 1)

    // Get or create entry
    let entry = requestStore.get(key)
    if (!entry) {
      entry = {
        tokens: max,
        lastRefill: now,
        refillPerMs,
        capacity: max
      }
      requestStore.set(key, entry)
    } else {
      entry.capacity = max
      entry.refillPerMs = refillPerMs
      entry.tokens = Math.min(entry.tokens, entry.capacity)
    }

    // Refill tokens based on elapsed time
    if (now > entry.lastRefill && entry.refillPerMs > 0) {
      const elapsed = now - entry.lastRefill
      entry.tokens = Math.min(entry.capacity, entry.tokens + elapsed * entry.refillPerMs)
      entry.lastRefill = now
    }

    const hasTokens = entry.tokens >= 1
    let retryAfter: number | undefined

    if (hasTokens) {
      entry.tokens -= 1
    } else if (entry.refillPerMs > 0) {
      const msUntilNextToken = (1 - entry.tokens) / entry.refillPerMs
      retryAfter = Math.max(1, Math.ceil(msUntilNextToken / 1000))
    }

    const remaining = Math.max(0, Math.floor(entry.tokens))
    const msToFull = entry.refillPerMs > 0
      ? (entry.capacity - entry.tokens) / entry.refillPerMs
      : windowMs

    const result: RateLimitResult = {
      success: hasTokens,
      limit: max,
      remaining,
      reset: Math.max(1, Math.ceil((now + msToFull) / 1000))
    }

    if (!hasTokens) {
      result.retryAfter = retryAfter ?? Math.ceil(windowMs / 1000)
    }

    return result
  }
}

/**
 * Get client IP address from request with validation
 *
 * Uses the secure IP validator to prevent IP spoofing attacks.
 * Logs suspicious patterns for security monitoring.
 */
function getClientIP(req: NextRequest): string {
  // Use the secure IP validator
  const ip = getClientIpString(req)

  // Log suspicious patterns (e.g., private IPs claiming to be public)
  const xForwardedFor = req.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const claimedIps = xForwardedFor.split(',').map(s => s.trim())
    const validatedIp = sanitizeIpAddress(claimedIps[0])

    // Check for potential spoofing: private IP in XFF but different resolved IP
    if (validatedIp && isPrivateIp(validatedIp) && ip !== validatedIp && ip !== 'unknown') {
      logSuspiciousPattern('xff_private_mismatch', ip, {
        claimedIp: validatedIp,
        resolvedIp: ip,
        xForwardedFor,
        reason: 'Private IP in XFF does not match resolved IP',
      })
    }

    // Check for multiple IPs in XFF (potential proxy chain manipulation)
    if (claimedIps.length > 5) {
      logSuspiciousPattern('excessive_xff_chain', ip, {
        chainLength: claimedIps.length,
        xForwardedFor: xForwardedFor.substring(0, 200), // Truncate for logging
        reason: 'Unusually long X-Forwarded-For chain',
      })
    }
  }

  return ip
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

const REDIS_TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'timestamp')
local tokens = bucket[1]
local timestamp = bucket[2]

if tokens == false or tokens == nil then
  tokens = capacity
  timestamp = now
else
  tokens = tonumber(tokens)
  timestamp = tonumber(timestamp)
  if tokens == nil then
    tokens = capacity
  end
  if timestamp == nil then
    timestamp = now
  end
  local delta = math.max(0, now - timestamp)
  local refill = delta * refillRate
  tokens = math.min(capacity, tokens + refill)
  timestamp = now
end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'timestamp', timestamp)
redis.call('PEXPIRE', key, ttl)

return { allowed, tokens, timestamp }
`

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
    const redisKey = `${this.prefix}${key}`
    const refillPerMs = max / Math.max(windowMs, 1)
    const ttlMs = Math.ceil(windowMs * 2)

    try {
      const result = await this.redis.eval(
        REDIS_TOKEN_BUCKET_SCRIPT,
        1,
        redisKey,
        max,
        refillPerMs,
        now,
        ttlMs
      )

      const allowed = Array.isArray(result) ? Number(result[0]) === 1 : true
      const rawTokens = Array.isArray(result) ? Number(result[1]) : max - 1
      const tokens = Math.max(0, Math.min(rawTokens, max))
      const remaining = Math.max(0, Math.floor(tokens))
      const safeRate = refillPerMs > 0 ? refillPerMs : 1 / Math.max(windowMs, 1)
      const msToFull = (max - tokens) / safeRate

      return {
        success: allowed,
        limit: max,
        remaining,
        reset: Math.max(1, Math.ceil((now + msToFull) / 1000)),
        retryAfter: allowed
          ? undefined
          : Math.max(1, Math.ceil(((1 - tokens) / safeRate) / 1000))
      }

    } catch (error) {
      console.error('Redis rate limiting error:', error)

      // Fallback to allowing request if Redis fails
      return {
        success: true,
        limit: max,
        remaining: Math.max(0, max - 1),
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
