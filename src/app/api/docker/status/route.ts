/**
 * Docker Status API Route
 *
 * Provides Docker/Colima detection and status information
 * GET /api/docker/status - Get current Docker runtime status
 * POST /api/docker/status/start - Start Colima if available
 */

import { NextResponse, NextRequest } from 'next/server';
import {
detectDockerRuntime,
  getDockerStatusReport,
  startColima,
  DockerType,
} from '@/lib/docker/detection';
// import { logger } from '@/lib/logger';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting'
export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60) // 60 requests per minute - status checks

const dockerActionSchema = z.object({
  action: z.enum(['start-colima', 'status', 'info']),
}).strict();

/**
 * GET /api/docker/status
 * Returns comprehensive Docker runtime status
 */
export async function GET(request: Request) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
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
    )
  }

  try {
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';

    if (detailed) {
      const report = await getDockerStatusReport();

      console.info('Docker status report generated', {
        runtime: report.runtime.dockerType,
        running: report.runtime.running,
        version: report.runtime.version,
      });

      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    const status = await detectDockerRuntime();

    console.info('Docker runtime detected', {
      type: status.dockerType,
      running: status.running,
      version: status.version,
    });

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error detecting Docker runtime', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect Docker runtime',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/docker/status
 * Attempts to start Colima if installed or perform Docker actions
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
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
    )
  }

  try {
    const body = await request.json();
    const { action } = dockerActionSchema.parse(body);

    // Handle different actions
    if (action === 'start-colima') {
      const result = await startColima();

      if (result.success) {
        console.info('Colima started successfully');

        return NextResponse.json({
          success: true,
          message: result.message,
        });
      }

      console.error('Failed to start Colima', { message: result.message });

      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 500 }
      );
    } else if (action === 'status') {
      // Return Docker status
      const status = await detectDockerRuntime();
      return NextResponse.json({
        success: true,
        data: status,
      });
    } else if (action === 'info') {
      // Return detailed Docker info
      const report = await getDockerStatusReport();
      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: error.issues
        },
        { status: 400 }
      );
    }

    console.error('Error processing Docker action', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process action',
      },
      { status: 500 }
    );
  }
}
