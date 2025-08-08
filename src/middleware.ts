import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
    prefix: '@upstash/ratelimit',
  });
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
  confidence: number;
  reasons: string[];
  allowedBot: boolean;
} {
  const userAgent = request.headers.get('user-agent') || '';
  let confidence = 0;
  const reasons: string[] = [];
  let allowedBot = false;

  for (const pattern of BOT_PROTECTION_CONFIG.allowedBots) {
    if (pattern.test(userAgent)) {
      allowedBot = true;
      break;
    }
  }

  if (allowedBot) {
    return { isBot: true, confidence: 0, reasons: ['Allowed bot'], allowedBot: true };
  }

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

  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};