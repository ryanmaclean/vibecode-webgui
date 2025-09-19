import { NextRequest, NextResponse } from 'next/server';

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.CI === 'true' ||
    process.env.PLAYWRIGHT_TEST === 'true'
  );
}

const sessionCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'authjs.session-token',
];

const BOT_RULES = {
  suspicious: [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /automated/i,
    /python-requests/i,
    /curl/i,
    /wget/i,
    /postman/i,
    /httpie/i,
    /axios/i,
  ],
  allowlisted: [
    /googlebot/i,
    /bingbot/i,
    /slackbot/i,
    /twitterbot/i,
    /facebookexternalhit/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i,
    /discord/i,
  ],
};

const RATE_LIMIT_ENABLED =
  process.env.MIDDLEWARE_RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_MAX = Number(process.env.MIDDLEWARE_RATE_LIMIT_MAX ?? '100');
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.MIDDLEWARE_RATE_LIMIT_WINDOW_MS ?? '60000',
);

type RateLimitSnapshot = {
  count: number;
  reset: number;
};

const rateBuckets = new Map<string, RateLimitSnapshot>();

function applyRateLimit(ip: string) {
  if (!RATE_LIMIT_ENABLED || RATE_LIMIT_MAX <= 0) {
    return { success: true } as const;
  }

  const now = Date.now();
  const limit = RATE_LIMIT_MAX;
  const windowMs = RATE_LIMIT_WINDOW_MS;
  const existing = rateBuckets.get(ip);

  const bucket: RateLimitSnapshot = existing && existing.reset > now
    ? existing
    : { count: 0, reset: now + windowMs };

  bucket.count += 1;
  rateBuckets.set(ip, bucket);

  const remaining = Math.max(limit - bucket.count, 0);
  const success = bucket.count <= limit;

  if (!success) {
    bucket.count = limit + 1; // cap to stop overflow
  }

  return {
    success,
    limit,
    remaining,
    reset: Math.floor(bucket.reset / 1000),
  };
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    pathname.includes('/assets/')
  );
}

function detectBot(userAgent: string | null): {
  isBot: boolean;
  allowlisted: boolean;
  confidence: number;
  reasons: string[];
} {
  if (!userAgent) {
    return { isBot: false, allowlisted: false, confidence: 0, reasons: [] };
  }

  for (const pattern of BOT_RULES.allowlisted) {
    if (pattern.test(userAgent)) {
      return { isBot: true, allowlisted: true, confidence: 0, reasons: ['allowlisted'] };
    }
  }

  const reasons: string[] = [];
  let confidence = 0;

  for (const pattern of BOT_RULES.suspicious) {
    if (pattern.test(userAgent)) {
      confidence += 30;
      reasons.push(pattern.toString());
    }
  }

  return {
    isBot: confidence > 0,
    allowlisted: false,
    confidence,
    reasons,
  };
}

function deriveClientIp(request: NextRequest): string {
  const chain = request.headers.get('x-forwarded-for');
  if (chain) {
    const [first] = chain.split(',');
    if (first) {
      return first.trim();
    }
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    '127.0.0.1'
  );
}

function hasSessionCookie(request: NextRequest): boolean {
  return sessionCookieNames.some((name) => request.cookies.has(name));
}

function logEvent(eventType: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      ddsource: 'nextjs-middleware',
      service: 'vibecode-webgui',
      eventType,
      ...payload,
    }),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname) || isTestEnvironment()) {
    return NextResponse.next();
  }

  const isAuthRoute = pathname.startsWith('/auth/');
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute = pathname === '/' || pathname.startsWith('/docs');

  const authenticated = hasSessionCookie(request);

  if (!authenticated && !isAuthRoute && !isPublicRoute && !isApiRoute) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (authenticated && isAuthRoute && pathname !== '/auth/logout') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const userAgent = request.headers.get('user-agent');
  const botCheck = detectBot(userAgent);

  if (botCheck.isBot && !botCheck.allowlisted && !isApiRoute) {
    logEvent('bot_detected', {
      pathname,
      confidence: botCheck.confidence,
      reasons: botCheck.reasons,
      action: 'blocked',
    });
    return new NextResponse('Bot detected', { status: 403 });
  }

  if (RATE_LIMIT_ENABLED && !isApiRoute && !isTestEnvironment()) {
    const ip = deriveClientIp(request);
    const result = applyRateLimit(ip);

    if (!result.success) {
      logEvent('rate_limited', {
        pathname,
        ip,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      });

      const retry = Math.max(result.reset - Math.floor(Date.now() / 1000), 0);
      const response = new NextResponse('Too many requests', { status: 429 });
      response.headers.set('Retry-After', retry.toString());
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.reset.toString());
      return response;
    }
  }

  if (botCheck.isBot && !botCheck.allowlisted) {
    logEvent('bot_suspected', {
      pathname,
      confidence: botCheck.confidence,
      reasons: botCheck.reasons,
      action: 'monitored',
    });
  }

  if (!isApiRoute) {
    logEvent('page_visit', {
      pathname,
      bot: botCheck.isBot,
      allowlisted: botCheck.allowlisted,
    });
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
