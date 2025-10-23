/**
 * Comprehensive API Security Middleware
 * Protects against common security vulnerabilities and attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { validateAIQuery, aiRateLimiter, AISecurityLogger } from '../lib/security/input-validator';
// import { logger } from '@/lib/logger';
import { 
  needsCSRFProtection, 
  validateCSRFToken, 
  extractCSRFToken, 
  getSessionId, 
  validateOrigin 
} from '../lib/security/csrf-protection';
// Security configuration
const SECURITY_CONFIG = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxHeaderSize: 8192, // 8KB
  suspiciousUserAgents: [
    /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zap/i,
    /burp/i, /havij/i, /acunetix/i, /nessus/i, /openvas/i
  ],
  blockedIPs: new Set<string>(), // Can be populated from external threat feed
  allowedOrigins: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:8080']
    : ['https://vibecode.dev', 'https://www.vibecode.dev'],
};

// API endpoint security levels
const ENDPOINT_SECURITY = {
  '/api/auth/*': 'low',      // NextAuth handles this
  '/api/monitoring/*': 'medium',
  '/api/ai/*': 'high',       // AI endpoints need strict protection
  '/api/files/*': 'high',    // File operations are sensitive
  '/api/workspace/*': 'high', // Workspace operations
  '/api/admin/*': 'critical', // Admin functions
} as const;

type SecurityLevel = 'low' | 'medium' | 'high' | 'critical';

interface AuthToken {
  sub?: string | null;
  id?: string | null;
  role?: string | null;
  email?: string | null;
  name?: string | null;
}

/**
 * Request size limiter
 */
function checkRequestSize(request: NextRequest): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > SECURITY_CONFIG.maxRequestSize) {
    return false;
  }
  return true;
}

/**
 * Header validation
 */
function validateHeaders(request: NextRequest): { valid: boolean; reason?: string } {
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-originating-ip', 'x-cluster-client-ip'];
  
  for (const header of suspiciousHeaders) {
    const value = request.headers.get(header);
    if (value && value.includes('..')) {
      return { valid: false, reason: `Suspicious header: ${header}` };
    }
  }

  // Validate User-Agent
  const userAgent = request.headers.get('user-agent') || '';
  for (const pattern of SECURITY_CONFIG.suspiciousUserAgents) {
    if (pattern.test(userAgent)) {
      return { valid: false, reason: `Suspicious User-Agent: ${userAgent}` };
    }
  }

  return { valid: true };
}

/**
 * IP-based security checks
 */
function checkIPSecurity(request: NextRequest): { allowed: boolean; reason?: string } {
  const ip = getClientIP(request);
  
  if (SECURITY_CONFIG.blockedIPs.has(ip)) {
    return { allowed: false, reason: `Blocked IP: ${ip}` };
  }

  // Check for private IP ranges trying to access from external
  if (isPrivateIP(ip) && !isLocalRequest(request)) {
    return { allowed: false, reason: `Invalid private IP access: ${ip}` };
  }

  return { allowed: true };
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIP = request.headers.get('x-real-ip');
  const cfIP = request.headers.get('cf-connecting-ip');
  
  return xff || realIP || cfIP || '127.0.0.1';
}

/**
 * Check if IP is in private range
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  return privateRanges.some(range => range.test(ip));
}

/**
 * Check if request is from local environment
 */
function isLocalRequest(request: NextRequest): boolean {
  const host = request.headers.get('host') || '';
  return host.includes('localhost') || host.includes('127.0.0.1');
}

/**
 * Determine security level for endpoint
 */
function getSecurityLevel(pathname: string): SecurityLevel {
  for (const [pattern, level] of Object.entries(ENDPOINT_SECURITY)) {
    if (pathname.startsWith(pattern.replace('/*', ''))) {
      return level;
    }
  }
  return 'medium'; // Default security level
}

/**
 * Validate request based on security level
 */
async function validateRequestSecurity(
  request: NextRequest,
  securityLevel: SecurityLevel
): Promise<{ valid: boolean; response?: NextResponse }> {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const ip = getClientIP(request);

  // Check request size
  if (!checkRequestSize(request)) {
    AISecurityLogger.logSuspiciousActivity('unknown', 'request_too_large', {
      pathname,
      contentLength: request.headers.get('content-length'),
      ip
    });
    return {
      valid: false,
      response: new NextResponse('Request too large', { status: 413 })
    };
  }

  // Validate headers
  const headerValidation = validateHeaders(request);
  if (!headerValidation.valid) {
    AISecurityLogger.logSuspiciousActivity('unknown', 'invalid_headers', {
      pathname,
      reason: headerValidation.reason,
      ip
    });
    return {
      valid: false,
      response: new NextResponse('Invalid request headers', { status: 400 })
    };
  }

  // Check IP security
  const ipCheck = checkIPSecurity(request);
  if (!ipCheck.allowed) {
    AISecurityLogger.logSuspiciousActivity('unknown', 'blocked_ip', {
      pathname,
      reason: ipCheck.reason,
      ip
    });
    return {
      valid: false,
      response: new NextResponse('Access denied', { status: 403 })
    };
  }

  // CSRF Protection for state-changing operations
  if (needsCSRFProtection(request)) {
    // Validate Origin/Referer headers first
    if (!validateOrigin(request)) {
      AISecurityLogger.logSuspiciousActivity('unknown', 'csrf_origin_mismatch', {
        pathname,
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        ip
      });
      return {
        valid: false,
        response: new NextResponse('Invalid origin', { status: 403 })
      };
    }

    // Validate CSRF token
    const sessionId = getSessionId(request);
    const csrfToken = extractCSRFToken(request);
    
    if (!csrfToken || !validateCSRFToken(sessionId, csrfToken)) {
      AISecurityLogger.logSuspiciousActivity('unknown', 'csrf_token_invalid', {
        pathname,
        hasToken: !!csrfToken,
        sessionId: sessionId.substring(0, 8) + '...', // Log partial session ID
        ip
      });
      return {
        valid: false,
        response: new NextResponse('Invalid CSRF token', { status: 403 })
      };
    }
  }

  // High and critical security levels require authentication
  if (securityLevel === 'high' || securityLevel === 'critical') {
    // SECURITY: Removed development authentication bypass to prevent production vulnerabilities
    // All authentication must go through proper NextAuth channels
    const token: AuthToken | null = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token) {
      return {
        valid: false,
        response: new NextResponse('Authentication required', { status: 401 })
      };
    }

    // Critical endpoints require admin privileges
    if (securityLevel === 'critical' && token.role !== 'admin') {
      AISecurityLogger.logSuspiciousActivity(token.sub || 'unknown', 'unauthorized_admin_access', {
        pathname,
        userRole: token.role,
        ip
      });
      return {
        valid: false,
        response: new NextResponse('Admin privileges required', { status: 403 })
      };
    }

    // AI endpoint specific validation
    if (pathname.startsWith('/api/ai/') && method === 'POST') {
      if (!aiRateLimiter.checkRateLimit(token.sub || 'anonymous')) {
        AISecurityLogger.logSuspiciousActivity(token.sub || 'unknown', 'ai_rate_limit_exceeded', {
          pathname,
          ip
        });
        return {
          valid: false,
          response: new NextResponse('Too many AI requests', { status: 429 })
        };
      }

      // Skip JSON validation for file upload endpoints
      const isUploadEndpoint = pathname.includes('/upload') || 
                              request.headers.get('content-type')?.includes('multipart/form-data');
      
      // Validate request body for AI queries (but not uploads)
      if (!isUploadEndpoint) {
        try {
          if (request.body) {
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            validateAIQuery(body);
          
          // Reconstruct request with validated body
          const newRequest = new NextRequest(request.url, {
            method: request.method,
            headers: request.headers,
            body: bodyText
          });
          
            return { valid: true };
          }
        } catch (error) {
          AISecurityLogger.logValidationFailure(
            token.sub || 'unknown',
            'Invalid AI query format',
            error instanceof Error ? error.message : 'Unknown error'
          );
          return {
            valid: false,
            response: new NextResponse('Invalid request format', { status: 400 })
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * CORS validation
 */
function validateCORS(request: NextRequest): { valid: boolean; headers?: Record<string, string> } {
  const origin = request.headers.get('origin');
  
  if (!origin) {
    return { valid: true }; // Same-origin requests don't have origin header
  }

  if (SECURITY_CONFIG.allowedOrigins.includes(origin)) {
    return {
      valid: true,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
      }
    };
  }

  return { valid: false };
}

/**
 * Main API security middleware
 */
export async function apiSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Skip security checks for non-API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  // Skip security checks for NextAuth and monitoring health endpoints
  if (pathname.startsWith('/api/auth/') || pathname === '/api/monitoring/health') {
    return null;
  }

  const securityLevel = getSecurityLevel(pathname);

  // Validate CORS
  const corsValidation = validateCORS(request);
  if (!corsValidation.valid) {
    AISecurityLogger.logSuspiciousActivity('unknown', 'cors_violation', {
      pathname,
      origin: request.headers.get('origin'),
      ip: getClientIP(request)
    });
    return new NextResponse('CORS policy violation', { status: 403 });
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': corsValidation.headers?.['Access-Control-Allow-Origin'] || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        ...(corsValidation.headers?.['Access-Control-Allow-Credentials'] && {
          'Access-Control-Allow-Credentials': 'true'
        })
      }
    });
  }

  // Validate request security
  const securityValidation = await validateRequestSecurity(request, securityLevel);
  if (!securityValidation.valid) {
    return securityValidation.response!;
  }

  // Add security headers to response
  return null; // Continue to next middleware/handler
}

/**
 * Security headers for API responses
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  return response;
}

/**
 * Block malicious IP addresses (can be called from external threat feeds)
 */
export function blockIP(ip: string, reason?: string): void {
  SECURITY_CONFIG.blockedIPs.add(ip);
  AISecurityLogger.logSuspiciousActivity('system', 'ip_blocked', {
    ip,
    reason: reason || 'Manual block',
    timestamp: new Date().toISOString()
  });
}

/**
 * Unblock IP addresses
 */
export function unblockIP(ip: string): void {
  SECURITY_CONFIG.blockedIPs.delete(ip);
  AISecurityLogger.logSuspiciousActivity('system', 'ip_unblocked', {
    ip,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get security statistics
 */
export function getSecurityStats(): {
  blockedIPs: number;
  allowedOrigins: number;
  endpointCount: number;
} {
  return {
    blockedIPs: SECURITY_CONFIG.blockedIPs.size,
    allowedOrigins: SECURITY_CONFIG.allowedOrigins.length,
    endpointCount: Object.keys(ENDPOINT_SECURITY).length
  };
}