import { NextRequest, NextResponse } from 'next/server';

// Bot protection configuration using Datadog's monitoring capabilities
const BOT_PROTECTION_CONFIG = {
  // Rate limits for different endpoints (in-memory tracking)
  rateLimits: {
    ai_chat: { requests: 10, windowMs: 10000 }, // 10 requests per 10 seconds
    voice_transcription: { requests: 5, windowMs: 60000 }, // 5 requests per minute
    file_upload: { requests: 20, windowMs: 60000 }, // 20 requests per minute
    api_general: { requests: 100, windowMs: 60000 }, // 100 requests per minute
  },
  
  // Suspicious patterns to monitor
  suspiciousPatterns: [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /automated/i,
    /python-requests/i, /curl/i, /wget/i, /postman/i,
    /httpie/i, /insomnia/i, /axios/i, /fetch/i,
  ],
  
  // Known good bot patterns (allow these)
  allowedBots: [
    /googlebot/i, /bingbot/i, /slackbot/i, /twitterbot/i,
    /facebookexternalhit/i, /linkedinbot/i, /whatsapp/i,
    /telegrambot/i, /discord/i,
  ],
};

// In-memory rate limiting store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Enhanced bot detection using multiple signals
function detectBot(request: NextRequest): {
  isBot: boolean;
  confidence: number;
  reasons: string[];
  allowedBot: boolean;
} {
  const userAgent = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  
  let confidence = 0;
  const reasons: string[] = [];
  let allowedBot = false;

  // Check for allowed bots first
  for (const pattern of BOT_PROTECTION_CONFIG.allowedBots) {
    if (pattern.test(userAgent)) {
      allowedBot = true;
      break;
    }
  }

  if (allowedBot) {
    return { isBot: true, confidence: 0, reasons: ['Allowed bot'], allowedBot: true };
  }

  // Suspicious user agent patterns
  for (const pattern of BOT_PROTECTION_CONFIG.suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      confidence += 30;
      reasons.push(`Suspicious user agent pattern: ${pattern.source}`);
    }
  }

  // Missing or suspicious headers (common bot indicators)
  if (!userAgent) {
    confidence += 40;
    reasons.push('Missing user agent');
  }

  if (!accept) {
    confidence += 20;
    reasons.push('Missing accept header');
  }

  if (!acceptLanguage) {
    confidence += 15;
    reasons.push('Missing accept-language header');
  }

  if (!acceptEncoding) {
    confidence += 15;
    reasons.push('Missing accept-encoding header');
  }

  // Unusual accept headers
  if (accept && !accept.includes('text/html') && !accept.includes('application/json') && !accept.includes('*/*')) {
    confidence += 20;
    reasons.push('Unusual accept header');
  }

  // Very short user agent (automation indicators)
  if (userAgent && userAgent.length < 10) {
    confidence += 25;
    reasons.push('Suspiciously short user agent');
  }

  // Common automation libraries
  if (userAgent.toLowerCase().includes('python') && !userAgent.toLowerCase().includes('mozilla')) {
    confidence += 35;
    reasons.push('Python automation library detected');
  }

  return {
    isBot: confidence >= 50,
    confidence,
    reasons,
    allowedBot: false
  };
}

// Get client identifier
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown';
}

// Log security events to Datadog using existing integration
function logToDatadog(
  request: NextRequest,
  event: 'bot_detected' | 'rate_limited' | 'suspicious_activity' | 'blocked_request' | 'user_access',
  metadata: Record<string, any>
) {
  const clientIP = getClientIP(request);
  
  // Datadog automatically picks up console.log from Node.js processes
  // Structure logs for automatic geographic enrichment
  const logData = {
    // Datadog standard fields
    '@timestamp': new Date().toISOString(),
    service: 'vibecode-webgui',
    source: 'bot-protection-middleware',
    ddsource: 'nodejs',
    ddtags: `env:${process.env.NODE_ENV || 'development'},service:vibecode-webgui,source:bot-protection`,
    level: event === 'blocked_request' ? 'error' : event === 'user_access' ? 'info' : 'warn',
    
    // Message for searchability
    message: `[SECURITY] ${event}`,
    
    // Event classification
    event: {
      category: 'security',
      type: event,
      outcome: event === 'blocked_request' ? 'failure' : 'success',
    },
    
    // HTTP request details
    http: {
      method: request.method,
      url: request.url,
      url_details: {
        path: new URL(request.url).pathname,
        queryString: new URL(request.url).search,
      },
      useragent: request.headers.get('user-agent') || 'unknown',
      referer: request.headers.get('referer') || null,
      version: request.headers.get('http-version') || '1.1',
    },
    
    // Network details for geographic mapping
    network: {
      client: {
        ip: clientIP,
        // Datadog will automatically enrich with geo data if IP is valid
      },
      forwarded_ip: request.headers.get('x-forwarded-for') || null,
      real_ip: request.headers.get('x-real-ip') || null,
      cf_connecting_ip: request.headers.get('cf-connecting-ip') || null,
    },
    
    // User agent parsing for better analytics
    user_agent: {
      original: request.headers.get('user-agent') || 'unknown',
      device: {
        name: extractDeviceInfo(request.headers.get('user-agent') || ''),
      },
      os: {
        name: extractOSInfo(request.headers.get('user-agent') || ''),
      },
      browser: {
        name: extractBrowserInfo(request.headers.get('user-agent') || ''),
      },
    },
    
    // Security-specific data
    security: {
      event_type: event,
      ...metadata,
    },
    
    // Custom fields for Datadog dashboards and geomaps
    vibecode: {
      component: 'middleware',
      protection_type: 'bot_detection',
      ...metadata,
    },
    
    // Datadog trace correlation
    dd: {
      trace_id: request.headers.get('x-datadog-trace-id'),
      span_id: request.headers.get('x-datadog-span-id'),
      service: 'vibecode-webgui',
      env: process.env.NODE_ENV || 'development',
    },
  };

  // Output structured JSON for Datadog Log Agent
  console.log(JSON.stringify(logData));
}

// Helper functions for user agent parsing
function extractDeviceInfo(userAgent: string): string {
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile';
  if (/Tablet|iPad/.test(userAgent)) return 'tablet';
  return 'desktop';
}

function extractOSInfo(userAgent: string): string {
  if (/Windows NT/.test(userAgent)) return 'Windows';
  if (/Mac OS X/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  if (/Android/.test(userAgent)) return 'Android';
  if (/iPhone OS|iOS/.test(userAgent)) return 'iOS';
  return 'unknown';
}

function extractBrowserInfo(userAgent: string): string {
  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Edg\//.test(userAgent)) return 'Edge';
  return 'unknown';
}

// Simple rate limiting using in-memory store
function checkRateLimit(
  identifier: string, 
  endpoint: keyof typeof BOT_PROTECTION_CONFIG.rateLimits
): { allowed: boolean; limit: number; remaining: number; resetTime: number } {
  const config = BOT_PROTECTION_CONFIG.rateLimits[endpoint];
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // New window or expired
    const newRecord = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newRecord);
    
    return {
      allowed: true,
      limit: config.requests,
      remaining: config.requests - 1,
      resetTime: newRecord.resetTime,
    };
  }
  
  if (record.count >= config.requests) {
    return {
      allowed: false,
      limit: config.requests,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  return {
    allowed: true,
    limit: config.requests,
    remaining: config.requests - record.count,
    resetTime: record.resetTime,
  };
}

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Main middleware function
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static assets and internal Next.js routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Get client identifier
  const clientIP = getClientIP(request);

  // Detect bots using Datadog monitoring patterns
  const botDetection = detectBot(request);
  
  if (botDetection.isBot && !botDetection.allowedBot) {
    logToDatadog(request, 'bot_detected', {
      confidence: botDetection.confidence,
      reasons: botDetection.reasons,
      user_agent: request.headers.get('user-agent'),
    });

    // High confidence bot detection - block immediately
    if (botDetection.confidence >= 80) {
      logToDatadog(request, 'blocked_request', {
        reason: 'High confidence bot detection',
        confidence: botDetection.confidence,
        block_type: 'immediate',
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Access denied',
          message: 'Automated access is not permitted',
          timestamp: new Date().toISOString(),
          request_id: request.headers.get('x-request-id') || 'unknown',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Bot-Protection': 'blocked',
            'X-Block-Reason': 'bot-detection',
          },
        }
      );
    }
  }

  // Apply rate limiting based on endpoint
  let endpoint: keyof typeof BOT_PROTECTION_CONFIG.rateLimits | null = null;

  if (pathname.startsWith('/api/ai/') || pathname.includes('chat')) {
    endpoint = 'ai_chat';
  } else if (pathname.includes('transcribe') || pathname.includes('voice')) {
    endpoint = 'voice_transcription';
  } else if (pathname.includes('upload') || pathname.includes('file')) {
    endpoint = 'file_upload';
  } else if (pathname.startsWith('/api/')) {
    endpoint = 'api_general';
  }

  if (endpoint) {
    const rateLimit = checkRateLimit(clientIP, endpoint);
    
    if (!rateLimit.allowed) {
      logToDatadog(request, 'rate_limited', {
        endpoint,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset_time: new Date(rateLimit.resetTime).toISOString(),
        client_ip_partial: clientIP.substring(0, 8) + '***', // Privacy
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          reset: Math.round((rateLimit.resetTime - Date.now()) / 1000),
          timestamp: new Date().toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': Math.round(rateLimit.resetTime / 1000).toString(),
            'Retry-After': Math.round((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.round(rateLimit.resetTime / 1000).toString());
    
    return response;
  }

  // Log suspicious activity for Datadog monitoring dashboards
  if (botDetection.confidence > 30) {
    logToDatadog(request, 'suspicious_activity', {
      confidence: botDetection.confidence,
      reasons: botDetection.reasons,
      action: 'monitored',
    });
  }

  // Log legitimate user access for geographic mapping
  if (!botDetection.isBot || botDetection.allowedBot) {
    // Only log page visits, not API calls for cleaner geomap data
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

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
