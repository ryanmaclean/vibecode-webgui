/**
 * Mock for middleware module
 * Used in tests to bypass middleware checks
 */

import type { NextRequest, NextResponse } from 'next/server';

/**
 * Mock middleware function - allows all requests in test environment
 */
export async function middleware(request: NextRequest): Promise<NextResponse | undefined> {
  // In test environment, allow all requests through without modification
  return undefined;
}

/**
 * Mock middleware configuration
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
