/**
 * Kubernetes Status API Route
 *
 * Provides Kubernetes cluster connection and status information
 * GET /api/setup/kubernetes - Get current Kubernetes cluster status
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkKubernetes } from '@/lib/setup/checks';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'kubernetes-status' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute - status checks

/**
 * GET /api/setup/kubernetes
 * Returns Kubernetes cluster connection status
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    const status = await checkKubernetes();

    logger.info('Kubernetes cluster status checked', {
      connected: status.connected,
      clusterName: status.clusterName,
      version: status.version,
      status: status.status,
    });

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error checking Kubernetes cluster', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check Kubernetes cluster',
      },
      { status: 500 }
    );
  }
}
