/**
 * Next.js Middleware for rate limiting and security
 * Implements production-ready request filtering and monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting configuration
const RATE_LIMITS = {
  '/api/monitoring/metrics': { requests: 100, window: 60000 }, // 100 requests per minute
  '/api/monitoring/health': { requests: 30, window: 60000 },   // 30 requests per minute
  '/api/monitoring/alerts': { requests: 20, window: 60000 },   // 20 requests per minute
  default: { requests: 200, window: 60000 }                    // 200 requests per minute
}

// Security headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  // Apply security headers
  const response = NextResponse.next()
  
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Skip rate limiting for health checks from load balancers
  if (pathname === '/api/monitoring/health/public') {
    return response
  }
  
  // Apply rate limiting for monitoring endpoints
  if (pathname.startsWith('/api/monitoring')) {
    const rateLimitResult = await applyRateLimit(request, ip, pathname)
    
    if (rateLimitResult.limited) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimitResult.retryAfter.toString(),
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            ...SECURITY_HEADERS
          }
        }
      )
    }
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
  }
  
  // Enhanced authentication check for admin endpoints
  if (pathname.startsWith('/api/monitoring') && !pathname.includes('/health/public')) {
    const token = await getToken({ req: request })
    
    if (!token) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...SECURITY_HEADERS
          }
        }
      )
    }
    
    // Admin-only endpoints
    const adminOnlyPaths = ['/api/monitoring/metrics', '/api/monitoring/alerts']
    if (adminOnlyPaths.some(path => pathname.startsWith(path)) && token.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...SECURITY_HEADERS
          }
        }
      )
    }
  }
  
  // Log monitoring requests for audit trail
  if (pathname.startsWith('/api/monitoring')) {
    console.log(`[AUDIT] ${request.method} ${pathname} - IP: ${ip} - User: ${request.headers.get('authorization') ? 'authenticated' : 'anonymous'}`)
  }
  
  return response
}

async function applyRateLimit(request: NextRequest, ip: string, pathname: string) {
  // Determine rate limit for this endpoint
  const limit = RATE_LIMITS[pathname as keyof typeof RATE_LIMITS] || RATE_LIMITS.default
  
  // Create rate limit key (combine IP and endpoint for granular limiting)
  const key = `${ip}:${pathname}`
  const now = Date.now()
  
  // Get current rate limit status
  let current = rateLimitStore.get(key)
  
  // Reset if window has expired
  if (!current || now > current.resetTime) {
    current = {
      count: 0,
      resetTime: now + limit.window
    }
  }
  
  current.count++
  rateLimitStore.set(key, current)
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupRateLimitStore()
  }
  
  const remaining = Math.max(0, limit.requests - current.count)
  const isLimited = current.count > limit.requests
  const retryAfter = Math.ceil((current.resetTime - now) / 1000)
  
  return {
    limited: isLimited,
    remaining,
    limit: limit.requests,
    resetTime: current.resetTime,
    retryAfter
  }
}

function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

export const config = {
  matcher: [
    '/api/monitoring/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}