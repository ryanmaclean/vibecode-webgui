/**
 * CSRF Protection Implementation
 * Provides Cross-Site Request Forgery protection for state-changing operations
 */

import { NextRequest } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_SECRET_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

interface CSRFTokenData {
  token: string;
  timestamp: number;
  secret: string;
}

// In-memory store for CSRF tokens (use Redis in production)
const csrfTokenStore = new Map<string, CSRFTokenData>();

/**
 * Generate a CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
  const secret = randomBytes(CSRF_SECRET_LENGTH).toString('hex');
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  
  const tokenData: CSRFTokenData = {
    token,
    timestamp: Date.now(),
    secret
  };
  
  csrfTokenStore.set(sessionId, tokenData);
  
  // Clean up expired tokens
  cleanExpiredTokens();
  
  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(sessionId: string, providedToken: string): boolean {
  const tokenData = csrfTokenStore.get(sessionId);
  
  if (!tokenData) {
    return false;
  }
  
  // Check if token is expired
  if (Date.now() - tokenData.timestamp > CSRF_TOKEN_EXPIRY) {
    csrfTokenStore.delete(sessionId);
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  const expectedToken = Buffer.from(tokenData.token, 'hex');
  const providedBuffer = Buffer.from(providedToken, 'hex');
  
  if (expectedToken.length !== providedBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(expectedToken, providedBuffer);
}

/**
 * Clean up expired CSRF tokens
 */
function cleanExpiredTokens(): void {
  const now = Date.now();
  for (const [sessionId, tokenData] of csrfTokenStore.entries()) {
    if (now - tokenData.timestamp > CSRF_TOKEN_EXPIRY) {
      csrfTokenStore.delete(sessionId);
    }
  }
}

/**
 * Extract CSRF token from request
 */
export function extractCSRFToken(request: NextRequest): string | null {
  // Check header first
  const headerToken = request.headers.get('X-CSRF-Token') || request.headers.get('x-csrf-token');
  if (headerToken) {
    return headerToken;
  }
  
  // Check form data for POST requests
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // This would need to be handled differently in actual implementation
      // as we can't read the body here without consuming it
    }
  }
  
  return null;
}

/**
 * Check if request needs CSRF protection
 */
export function needsCSRFProtection(request: NextRequest): boolean {
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  
  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false;
  }
  
  // Skip CSRF for certain API endpoints that use other authentication
  const skipCSRF = [
    '/api/auth/', // NextAuth handles its own CSRF
    '/api/monitoring/health', // Health checks
    '/api/webhooks/' // Webhooks use different authentication
  ];
  
  return !skipCSRF.some(path => pathname.startsWith(path));
}

/**
 * Generate session ID from request
 */
export function getSessionId(request: NextRequest): string {
  // Try to get session from cookie or create a temporary ID
  const sessionToken = request.cookies.get('__Secure-next-auth.session-token')?.value ||
                      request.cookies.get('next-auth.session-token')?.value;
  
  if (sessionToken) {
    return createHash('sha256').update(sessionToken).digest('hex');
  }
  
  // Fallback to IP-based session for non-authenticated requests
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            '127.0.0.1';
  
  return createHash('sha256').update(`ip:${ip}`).digest('hex');
}

/**
 * Validate Origin header for additional CSRF protection
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  if (!host) {
    return false;
  }
  
  const allowedOrigins = [
    `https://${host}`,
    `http://${host}`, // Only for development
  ];
  
  // For development, allow localhost origins
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:8080');
  }
  
  // Check origin header
  if (origin && !allowedOrigins.includes(origin)) {
    return false;
  }
  
  // Check referer header as fallback
  if (!origin && referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    return allowedOrigins.includes(refererOrigin);
  }
  
  return true;
}

/**
 * Get CSRF protection statistics
 */
export function getCSRFStats(): {
  activeTokens: number;
  cleanupCount: number;
} {
  cleanExpiredTokens();
  return {
    activeTokens: csrfTokenStore.size,
    cleanupCount: 0 // Would track cleanup operations in production
  };
}