/**
 * Validation Helper Functions
 * 
 * Common validation and utility functions for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema, z } from 'zod'
import { validateRequestBody, validateQueryParams } from './middleware'
import {
  createErrorResponse as createSharedErrorResponse,
  createProblemResponse,
} from '@/lib/utils/api-response'

// Re-export validation functions for convenience
export { validateRequestBody, validateQueryParams }
export { createErrorResponse, createSuccessResponse } from '@/lib/utils/api-response'

/**
 * Rate limiting check function
 * Simple in-memory rate limiting (for development/testing)
 * In production, this should use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Overload signatures
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number }
export function checkRateLimit(
  request: NextRequest,
  options?: {
    maxRequests?: number
    windowMs?: number
    keyGenerator?: (req: NextRequest) => string
  }
): { allowed: boolean; remaining: number; resetTime: number }

// Implementation
export function checkRateLimit(
  requestOrIdentifier: NextRequest | string,
  optionsOrMaxRequests?: {
    maxRequests?: number
    windowMs?: number
    keyGenerator?: (req: NextRequest) => string
  } | number,
  windowMsParam?: number
): { allowed: boolean; remaining: number; resetTime: number } {
  // Handle simple string-based rate limiting (for testing)
  if (typeof requestOrIdentifier === 'string') {
    const identifier = requestOrIdentifier
    const maxRequests = typeof optionsOrMaxRequests === 'number' ? optionsOrMaxRequests : 100
    const windowMs = typeof windowMsParam === 'number' ? windowMsParam : 60 * 1000
    const now = Date.now()

    const current = rateLimitStore.get(identifier)

    if (!current || current.resetTime < now) {
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      })
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs
      }
    }

    if (current.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      }
    }

    current.count++
    rateLimitStore.set(identifier, current)

    return {
      allowed: true,
      remaining: maxRequests - current.count,
      resetTime: current.resetTime
    }
  }

  // Handle NextRequest-based rate limiting
  const request = requestOrIdentifier
  const options = (optionsOrMaxRequests || {}) as {
    maxRequests?: number
    windowMs?: number
    keyGenerator?: (req: NextRequest) => string
  }
  const {
    maxRequests = 100,
    windowMs = 60 * 1000, // 1 minute
    keyGenerator = (req) => req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
  } = options

  const key = keyGenerator(request)
  const now = Date.now()
  const windowStart = now - windowMs

  // Clean up expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k)
    }
  }

  const current = rateLimitStore.get(key)
  
  if (!current || current.resetTime < now) {
    // New window or expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs
    }
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime
    }
  }

  // Increment count
  current.count++
  rateLimitStore.set(key, current)

  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetTime: current.resetTime
  }
}

/**
 * Create a rate-limited response
 */
export function createRateLimitResponse(resetTime: number): NextResponse {
  const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000)
  return createProblemResponse({
    title: 'Rate limit exceeded',
    status: 429,
    detail: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    extensions: {
      retryAfter: retryAfterSeconds,
    },
    headers: {
      'Retry-After': retryAfterSeconds.toString(),
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': resetTime.toString(),
    },
  })
}

/**
 * Validate request body with error handling
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: NextResponse }> {
  try {
    const result = await validateRequestBody(request, schema)
    return result
  } catch (error) {
    return {
      success: false,
      error: createSharedErrorResponse('Invalid request body', 400, {
        code: 'INVALID_REQUEST_BODY',
        detail: error instanceof Error ? error.message : 'Unknown validation error',
      })
    }
  }
}

/**
 * Validate query parameters with error handling
 */
export function validateQuery<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  try {
    const result = validateQueryParams(request, schema)
    return result
  } catch (error) {
    return {
      success: false,
      error: createSharedErrorResponse('Invalid query parameters', 400, {
        code: 'INVALID_QUERY_PARAMS',
        detail: error instanceof Error ? error.message : 'Unknown validation error',
      })
    }
  }
}

/**
 * Extract user ID from request (for authenticated routes)
 */
export function getUserId(request: NextRequest): string | null {
  // This would typically extract from JWT token or session
  // For now, return a placeholder
  return request.headers.get('x-user-id') || null
}

/**
 * Extract workspace ID from request
 */
export function getWorkspaceId(request: NextRequest): string | null {
  return request.headers.get('x-workspace-id') || 
         new URL(request.url).searchParams.get('workspaceId') ||
         null
}

/**
 * Check if request is from an authenticated user
 */
export function isAuthenticated(request: NextRequest): boolean {
  return getUserId(request) !== null
}

/**
 * Get request IP address
 */
export function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         'unknown'
}

/**
 * Log API request for monitoring
 */
export function logAPIRequest(
  request: NextRequest,
  response: NextResponse,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const logData = {
    method: request.method,
    url: request.url,
    status: response.status,
    duration,
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent'),
    userId: getUserId(request),
    workspaceId: getWorkspaceId(request),
    ...metadata
  }

  // In production, this would send to a logging service
  console.log('[API Request]', logData)
}
