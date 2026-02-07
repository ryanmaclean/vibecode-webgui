// STUB: Returns mock data
import { NextRequest, NextResponse } from 'next/server';
import { createAPIRateLimit } from '@/lib/rate-limiting';

const apiRateLimit = createAPIRateLimit(30); // 30 req/min

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await apiRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      message: 'Claude chat endpoint is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
