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
import { validateRequestBody } from '@/lib/api/validation/middleware';
import { z } from '@/lib/zod-compat';

// Define inline schema since schemas-phase4-batch2 doesn't exist
const dockerActionSchema = z.object({
  action: z.enum(['start-colima', 'status', 'info'])
});
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

      console.log('Docker status report generated', {
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

    console.log('Docker runtime detected', {
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
  try {
    // Validate request body
    const validation = await validateRequestBody(request, dockerActionSchema);
    if (!validation.success) {
      return validation.error as NextResponse;
    }

    const { action } = validation.data;

    // Log action attempt
    console.log('Docker action requested', {
      action,
      timestamp: new Date().toISOString()
    });

    if (action === 'start-colima') {
      const result = await startColima();

      if (result.success) {
        console.log('Colima started successfully');

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
    }

    // action 'status' or 'info' - return current status
    const status = await detectDockerRuntime();
    return NextResponse.json({
      success: true,
      action,
      data: status
    });

  } catch (error) {
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
