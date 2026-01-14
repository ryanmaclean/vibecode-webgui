/**
 * Next.js Middleware
 * Handles authentication, security headers, and request routing
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  if (process.env.NODE_ENV !== 'test') {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // In test environment, pass through without additional processing
  if (process.env.NODE_ENV === 'test') {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const isProtectedRoute = !pathname.startsWith('/api/') &&
                          !pathname.startsWith('/auth/') &&
                          !pathname.startsWith('/_next/') &&
                          pathname !== '/';

  if (isProtectedRoute) {
    const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                        request.cookies.get('__Secure-next-auth.session-token')?.value;

    if (!sessionToken) {
      // Redirect to sign in page
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl, { status: 307 });
    }
  }

  // Continue with security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
