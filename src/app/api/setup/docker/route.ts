/**
 * Docker Setup Check API Route
 *
 * Provides Docker detection and status for the setup wizard
 * GET /api/setup/docker - Check Docker installation and runtime status
 */

import { NextResponse, NextRequest } from 'next/server';
import { checkDocker } from '@/lib/setup/checks';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'setup-docker' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute - setup checks

/**
 * GET /api/setup/docker
 * Returns Docker installation and runtime status for setup wizard
 */
export async function GET(request: NextRequest) {
  // Rate limiting
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

  try {
    const result = await checkDocker();

    logger.info('Docker setup check completed', {
      status: result.status,
      running: result.running,
      version: result.version,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error checking Docker setup', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check Docker setup',
      },
      { status: 500 }
    );
  }
}
