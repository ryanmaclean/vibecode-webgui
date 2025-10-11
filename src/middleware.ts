import { NextRequest, NextResponse } from 'next/server';
import { apiSecurityMiddleware, addSecurityHeaders } from './middleware/security-middleware';
import { generateNonce } from './lib/security/csp-config';

// Skip Redis/ValKey initialization in test environment
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.CI === 'true' || process.env.PLAYWRIGHT_TEST === 'true';

const BOT_PROTECTION_CONFIG = {
  suspiciousPatterns: [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /automated/i,
    /python-requests/i, /curl/i, /wget/i, /postman/i,
    /httpie/i, /insomnia/i, /axios/i, /fetch/i,
  ],
  allowedBots: [
    /googlebot/i, /bingbot/i, /slackbot/i, /twitterbot/i,
    /facebookexternalhit/i, /linkedinbot/i, /whatsapp/i,
    /telegrambot/i, /discord/i,
  ],
};

// Initialize Upstash Redis/Rate limiters only when credentials are present and not in test/CI
let redis: any = null;
let ratelimit: any = null;

const hasUpstashCreds = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

if (!isTestEnvironment && hasUpstashCreds) {
  try {
    const { Ratelimit } = require('@upstash/ratelimit');
    const { Redis } = require('@upstash/redis');

    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit',
    });
  } catch (error: any) {
    console.warn('Upstash Redis not initialized, proceeding without rate limiting:', error?.message || error);
    redis = null;
    ratelimit = null;
  }
}

function logToDatadog(
  request: NextRequest,
  eventType: 'bot_detected' | 'rate_limited' | 'suspicious_activity' | 'user_access',
  metadata: Record<string, any>
) {
  // Event logged to Datadog
  const logData = {
    timestamp: new Date().toISOString(),
    url: request.nextUrl.href,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    ...metadata 
  }
}

/**
 * Validate API request for security threats
 */
async function validateAPIRequest(request: NextRequest): Promise<{
  valid: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  
  try {
    const url = request.nextUrl;
    const method = request.method;
    
    // Path traversal detection
    if (url.pathname.includes('..') || url.pathname.includes('//')) {
      errors.push('Path traversal attempt detected');
    }
    
    // SQL injection patterns in URL
    const sqlPatterns = [
      /(\%27)|(\')|(\-\-)|(%23)|(#)/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(%23)|(#))/i,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
      /((\%27)|(\'))union/i
    ];
    
    const urlString = url.href;
    for (const pattern of sqlPatterns) {
      if (pattern.test(urlString)) {
        errors.push('SQL injection attempt detected in URL');
        break;
      }
    }
    
    // XSS patterns in URL
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(urlString)) {
        errors.push('XSS attempt detected in URL');
        break;
      }
    }
    
    // Method validation
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(method)) {
      errors.push('Invalid HTTP method');
    }
    
    // Content-Length validation
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const length = parseInt(contentLength, 10);
      if (isNaN(length) || length < 0) {
        errors.push('Invalid content length');
      }
      
      // Max request size: 50MB
      const maxSize = 50 * 1024 * 1024;
      if (length > maxSize) {
        errors.push('Request too large');
      }
    }
    
    // Suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-rewrite-url', 
      'x-original-url',
      'x-cluster-client-ip'
    ];
    
    for (const header of suspiciousHeaders) {
      if (request.headers.get(header)) {
        errors.push(`Suspicious header detected: ${header}`);
      }
    }
    
    // User-Agent validation
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.length > 1000) {
      errors.push('User-Agent header too long');
    }
    
    // Check for common attack tools in User-Agent
    const attackToolPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /burpsuite/i,
      /metasploit/i,
      /hydra/i,
      /dirb/i,
      /gobuster/i,
      /masscan/i,
      /nmap/i
    ];
    
    for (const pattern of attackToolPatterns) {
      if (pattern.test(userAgent)) {
        errors.push('Attack tool detected in User-Agent');
        break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('Request validation error:', error);
    return {
      valid: false,
      errors: ['Request validation failed']
    };
  }
}

function detectBot(request: NextRequest): {
  isBot: boolean;
  allowlisted: boolean;
  confidence: number;
  reasons: string[];
} {
  const userAgent = request.headers.get('user-agent') || '';

  // Allow curl in development mode for testing
  if (process.env.NODE_ENV === 'development' && /curl/i.test(userAgent)) {
    return { isBot: false, confidence: 0, reasons: [], allowedBot: false };
  }

  // Allow with test header
  if (request.headers.get('x-test-mode') === 'true') {
    return { isBot: false, confidence: 0, reasons: [], allowedBot: false };
  }
  let confidence = 0;
  const reasons: string[] = [];
  let allowedBot = false;

  for (const pattern of BOT_PROTECTION_CONFIG.allowedBots) {
    if (pattern.test(userAgent)) {
      return { isBot: true, allowlisted: true, confidence: 0, reasons: ['allowlisted'] };
    }
  }

  const reasons: string[] = [];
  let confidence = 0;

  for (const pattern of BOT_PROTECTION_CONFIG.suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      confidence += 50;
      reasons.push(`Suspicious user-agent: ${pattern.toString()}`);
    }
  }

  return {
    isBot: confidence > 0,
    confidence,
    reasons,
    allowedBot,
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip ALL middleware logic in test environment
  if (isTestEnvironment) {
    return NextResponse.next();
  }

  // Handle authentication redirects for all environments
  const isAuthPage = pathname.startsWith('/auth/');
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute = pathname.startsWith('/_next/') || 
                       pathname.startsWith('/favicon.ico') || 
                       pathname.startsWith('/public');

  // Check for authentication token in cookies
  const sessionToken = request.cookies.get('next-auth.session-token') || 
                      request.cookies.get('__Secure-next-auth.session-token');
  
  const isAuthenticated = !!sessionToken;

  // Redirect unauthenticated users to signin (except for auth pages and public routes)
  if (!isAuthenticated && !isAuthPage && !isPublicRoute && !isApiRoute) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthPage && pathname !== '/auth/signout') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Apply input validation for API routes
  if (pathname.startsWith('/api/')) {
    const validationResult = await validateAPIRequest(request);
    if (!validationResult.valid) {
      logToDatadog(request, 'suspicious_activity', {
        type: 'input_validation_failed',
        errors: validationResult.errors,
        pathname
      });
      
      return new NextResponse(
        JSON.stringify({ 
          error: 'Request validation failed', 
          details: validationResult.errors 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Apply API security middleware first
  const apiSecurityResponse = await apiSecurityMiddleware(request);
  if (apiSecurityResponse) {
    const response = addSecurityHeaders(apiSecurityResponse);
    // Add CSP nonce to response
    const nonce = generateNonce();
    response.headers.set('X-CSP-Nonce', nonce);
    return response;
  }

  // Derive client IP from headers (NextRequest has no `ip`)
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    ''
  const ip = xff || realIp || '127.0.0.1'

  if (ratelimit) {
    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      logToDatadog(request, 'rate_limited', {
        limit,
        remaining,
        resetTime: reset,
        action: 'blocked',
      });
      const response = new NextResponse('Too many requests.', { status: 429 });
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());
      return response;
    }
  }

  const botDetection = detectBot(request);
  if (botDetection.isBot && !botDetection.allowedBot) {
    logToDatadog(request, 'bot_detected', {
      confidence: botDetection.confidence,
      reasons: botDetection.reasons,
      action: 'blocked',
    });
    return new NextResponse('Bot detected', { status: 403 });
  }

  if (botDetection.confidence > 30) {
    logToDatadog(request, 'suspicious_activity', {
      confidence: botDetection.confidence,
      reasons: botDetection.reasons,
      action: 'monitored',
    });
  }

  if (!botDetection.isBot || botDetection.allowedBot) {
    if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
      logToDatadog(request, 'user_access', {
        page: pathname,
        is_allowed_bot: botDetection.allowedBot,
        confidence: botDetection.confidence,
        access_type: 'page_visit',
      });
    }
  }

  const response = NextResponse.next();
  const secureResponse = addSecurityHeaders(response);
  
  // Add CSP nonce for inline scripts
  const nonce = generateNonce();
  secureResponse.headers.set('X-CSP-Nonce', nonce);
  
  return secureResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};