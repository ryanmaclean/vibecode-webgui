import { NextRequest, NextResponse } from 'next/server'
import { apiSecurityMiddleware, addSecurityHeaders } from '@/middleware/security-middleware'

// Public routes that never require authentication
const PUBLIC_PATHS = new Set([
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/error',
  '/auth/verify-request',
  '/auth/reset-password',
  '/auth/forgot-password'
])

const PUBLIC_PREFIXES = ['/auth/magic-link', '/docs', '/public', '/assets']
const STATIC_PREFIXES = ['/_next/static', '/_next/image', '/favicon.ico', '/fonts', '/images']

function shouldBypassForTests(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.CI === 'true' ||
    process.env.PLAYWRIGHT_TEST === '1'
  )
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true
  }

  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function hasSessionCookie(request: NextRequest): boolean {
  const sessionCookies = [
    '__Secure-next-auth.session-token',
    'next-auth.session-token',
    'next-auth.sess'
  ]

  for (const name of sessionCookies) {
    const cookie = request.cookies.get(name)?.value
    if (cookie && cookie.length > 0) {
      return true
    }
  }

  // Fallback to raw cookie header for environments where Request cookies API is unavailable
  const rawCookieHeader = request.headers.get('cookie')
  if (!rawCookieHeader) {
    return false
  }

  return sessionCookies.some(name => rawCookieHeader.includes(`${name}=`))
}

function buildSignInRedirect(request: NextRequest): NextResponse {
  const signInUrl = new URL('/auth/signin', request.url)
  signInUrl.searchParams.set('from', request.nextUrl.pathname)
  signInUrl.searchParams.set('reason', 'auth_required')

  const response = NextResponse.redirect(signInUrl)
  return addSecurityHeaders(response)
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (shouldBypassForTests() || isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // Let API-specific security middleware handle API routes first
  if (pathname.startsWith('/api/')) {
    const securityResponse = await apiSecurityMiddleware(request)
    if (securityResponse) {
      return addSecurityHeaders(securityResponse)
    }

    // Continue to the API route handler
    return addSecurityHeaders(NextResponse.next())
  }

  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next())
  }

  if (!hasSessionCookie(request)) {
    return buildSignInRedirect(request)
  }

  const response = NextResponse.next()
  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts/|images/|public/).*)'
  ]
}
