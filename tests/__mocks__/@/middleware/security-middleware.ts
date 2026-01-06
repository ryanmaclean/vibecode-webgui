/**
 * Mock for security-middleware module
 * Used in tests to bypass security checks
 */

import type { NextRequest, NextResponse } from 'next/server';

// Global bypass flag
let bypassSecurityChecks = false;

/**
 * Test utility to enable/disable security bypass
 */
export function __TEST__bypassSecurityChecks(bypass: boolean): void {
  bypassSecurityChecks = bypass;
}

/**
 * Mock security middleware - bypasses checks in test environment
 */
export async function apiSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // Skip all security checks in test environment or when bypass is enabled
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true' || bypassSecurityChecks) {
    return null;
  }

  // For non-test environments, implement basic validation
  const pathname = request.nextUrl?.pathname || '';

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  // Skip NextAuth and monitoring routes
  if (pathname.startsWith('/api/auth/') || pathname === '/api/monitoring/health') {
    return null;
  }

  // Allow all other requests in test mode
  return null;
}

/**
 * Mock function to add security headers
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  if (response.headers && typeof response.headers.set === 'function') {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  return response;
}

/**
 * Mock function to block IP
 */
export function blockIP(ip: string, reason?: string): void {
  // No-op in tests
}

/**
 * Mock function to unblock IP
 */
export function unblockIP(ip: string): void {
  // No-op in tests
}

/**
 * Mock function to get security stats
 */
export function getSecurityStats(): {
  blockedIPs: number;
  allowedOrigins: number;
  endpointCount: number;
} {
  return {
    blockedIPs: 0,
    allowedOrigins: 2,
    endpointCount: 6
  };
}
