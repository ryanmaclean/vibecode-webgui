/**
 * Docker Status API Route
 *
 * Provides Docker/Colima detection and status information
 * GET /api/docker/status - Get current Docker runtime status
 * POST /api/docker/status/start - Start Colima if available
 */

import { NextResponse } from 'next/server';
import {
detectDockerRuntime,
  getDockerStatusReport,
  startColima,
  DockerType,
} from '@/lib/docker/detection';
import { logger } from '@/lib/logger';
export const dynamic = 'force-dynamic';

/**
 * GET /api/docker/status
 * Returns comprehensive Docker runtime status
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';

    if (detailed) {
      const report = await getDockerStatusReport();

      logger.info('Docker status report generated', {
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

    logger.info('Docker runtime detected', {
      type: status.dockerType,
      running: status.running,
      version: status.version,
    });

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error detecting Docker runtime', {
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
 * POST /api/docker/status/start
 * Attempts to start Colima if installed
 */
export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'start-colima') {
      const result = await startColima();

      if (result.success) {
        logger.info('Colima started successfully');

        return NextResponse.json({
          success: true,
          message: result.message,
        });
      }

      logger.error('Failed to start Colima', { message: result.message });

      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error processing Docker action', {
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
