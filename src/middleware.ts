/**
 * Next.js Middleware
 * Handles authentication, security headers, request routing, and trace context propagation
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractAndInjectTraceContext } from './lib/monitoring/trace-context';

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

  // Extract and inject trace context from incoming request for all requests
  // This enables distributed tracing across services
  const { traceContext } = extractAndInjectTraceContext(request.headers);

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
    const response = NextResponse.next();
    // Add trace context to response headers for testing
    if (traceContext) {
      response.headers.set('X-Trace-Id', traceContext.trace_id);
      response.headers.set('X-Span-Id', traceContext.span_id);
    }
    return response;
  }

  // For health endpoints, skip auth but still propagate trace context
  const isHealthEndpoint = pathname.startsWith('/api/health') ||
                          pathname === '/api/healthz' ||
                          pathname === '/api/readyz';

  if (isHealthEndpoint) {
    const response = NextResponse.next();
    // Add trace context to response headers
    if (traceContext) {
      response.headers.set('X-Trace-Id', traceContext.trace_id);
      response.headers.set('X-Span-Id', traceContext.span_id);
    }
    return addSecurityHeaders(response);
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

  // Continue with security headers and trace context propagation
  const response = NextResponse.next();

  // Add trace context to response headers for propagation
  if (traceContext) {
    response.headers.set('X-Trace-Id', traceContext.trace_id);
    response.headers.set('X-Span-Id', traceContext.span_id);
  }

  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    // Exclude static assets, health checks, and internal Next.js routes
    '/((?!_next/static|_next/image|favicon.ico|public/|api/health|api/healthz|api/readyz).*)',
  ],
};
