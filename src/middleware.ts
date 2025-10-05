import { NextRequest, NextResponse } from 'next/server';
import { apiSecurityMiddleware, addSecurityHeaders } from './middleware/security-middleware';

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
  console.log(JSON.stringify({ ddsource: 'next-js', eventType, ...metadata }));
}

function detectBot(request: NextRequest): {
  isBot: boolean;
  allowlisted: boolean;
  confidence: number;
  reasons: string[];
} {
  const userAgent = request.headers.get('user-agent') || '';
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

  // Apply API security middleware first
  const apiSecurityResponse = await apiSecurityMiddleware(request);
  if (apiSecurityResponse) {
    return addSecurityHeaders(apiSecurityResponse);
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
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};