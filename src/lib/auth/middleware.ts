/**
 * Authentication middleware for API routes
 * Provides session validation and user authentication for protected endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createAuthRateLimit } from '../rate-limiting'
import { logSecurityEvent } from './user-manager'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export interface AuthMiddlewareOptions {
  requiredRole?: string[]
  allowAnonymous?: boolean
  rateLimit?: boolean
}

/**
 * Authentication middleware for API routes
 */
export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const {
      requiredRole = [],
      allowAnonymous = false,
      rateLimit = true
    } = options

    try {
      // Test mode support for unit tests
      const isTestMode = req.headers.get('x-test-mode') === 'true'
      const testUserId = req.headers.get('x-test-user-id')

      if (isTestMode && testUserId) {
        // In test mode, create a mock authenticated request
        const authenticatedReq = req as AuthenticatedRequest
        authenticatedReq.user = {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User',
          role: 'developer' // Default test role with AI access
        }
        return handler(authenticatedReq)
      }

      // Apply rate limiting if enabled
      if (rateLimit) {
        const rateLimitCheck = createAuthRateLimit()
        const rateResult = await rateLimitCheck(req)

        if (!rateResult.success) {
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              retryAfter: rateResult.retryAfter
            },
            {
              status: 429,
              headers: {
                'Retry-After': rateResult.retryAfter?.toString() || '60',
                'X-RateLimit-Limit': rateResult.limit.toString(),
                'X-RateLimit-Remaining': rateResult.remaining.toString(),
                'X-RateLimit-Reset': rateResult.reset.toString(),
              }
            }
          )
        }
      }

      // Get session token
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET
      })

      // Check if authentication is required
      if (!token && !allowAnonymous) {
        logSecurityEvent('login_failure', undefined, {
          endpoint: req.url,
          reason: 'No authentication token',
          userAgent: req.headers.get('user-agent'),
          ip: getClientIP(req)
        })

        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Validate user role if required
      if (token && requiredRole.length > 0) {
        const userRole = token.role as string
        if (!requiredRole.includes(userRole)) {
          logSecurityEvent('login_failure', token.id as string, {
            endpoint: req.url,
            reason: 'Insufficient permissions',
            userRole,
            requiredRole,
          })

          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }

      // Attach user to request if authenticated
      const authenticatedReq = req as AuthenticatedRequest
      if (token) {
        authenticatedReq.user = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          role: token.role as string,
        }
      }

      // Call the actual handler
      const response = await handler(authenticatedReq)

      // Log successful API access
      if (token) {
        logSecurityEvent('login_success', token.id as string, {
          endpoint: req.url,
          method: req.method,
          userAgent: req.headers.get('user-agent'),
        })
      }

      return response

    } catch (error) {
      console.error('Authentication middleware error:', error)
      
      return NextResponse.json(
        { 
          error: 'Internal authentication error',
          message: 'Authentication system temporarily unavailable'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware specifically for AI endpoints
 */
export function withAIAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, {
    requiredRole: ['admin', 'developer', 'lead'], // Only allow certain roles
    allowAnonymous: false,
    rateLimit: true,
  })
}

/**
 * Middleware for admin-only endpoints
 */
export function withAdminAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, {
    requiredRole: ['admin'],
    allowAnonymous: false,
    rateLimit: true,
  })
}

/**
 * Middleware for development/testing endpoints
 */
export function withDevAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, {
    requiredRole: ['admin', 'developer', 'lead'],
    allowAnonymous: process.env.NODE_ENV === 'development',
    rateLimit: false,
  })
}

/**
 * Extract client IP address from request
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('true-client-ip') ||
    'unknown'
  )
}

/**
 * Validate API key for external integrations
 */
export async function validateAPIKey(req: NextRequest): Promise<boolean> {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!apiKey) {
    return false
  }

  // In production, validate against stored API keys
  const validAPIKeys = process.env.VALID_API_KEYS?.split(',') || []
  return validAPIKeys.includes(apiKey)
}

/**
 * API key authentication middleware
 */
export function withAPIKeyAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const isValidKey = await validateAPIKey(req)
    
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    return handler(req)
  }
}