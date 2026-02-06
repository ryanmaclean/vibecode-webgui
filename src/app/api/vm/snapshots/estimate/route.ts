/**
 * Snapshot Size Estimate API Route
 *
 * POST /api/vm/snapshots/estimate - Estimate snapshot size before creation
 */

import { NextResponse, NextRequest } from 'next/server';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getSnapshotManager } from '@/lib/vm/snapshots';
import type { SnapshotAPIResponse, SnapshotSizeEstimate } from '@/types/vm-snapshot';

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60);

const estimateSchema = z.object({
  vmId: z.string().min(1, 'VM ID is required'),
  options: z.object({
    includeDisk: z.boolean().optional(),
    includeMemory: z.boolean().optional(),
    compress: z.boolean().optional(),
    compressionAlgorithm: z.enum(['zstd', 'gzip', 'lz4']).optional(),
  }).optional(),
}).strict();

/**
 * POST /api/vm/snapshots/estimate
 * Estimate size for a new snapshot
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SnapshotAPIResponse<SnapshotSizeEstimate>>> {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const validated = estimateSchema.parse(body);

    const manager = getSnapshotManager();
    await manager.initialize();

    const estimate = await manager.estimateSnapshotSize(validated.vmId, validated.options);

    return NextResponse.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
        },
        { status: 400 }
      );
    }

    console.error('Error estimating snapshot size', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to estimate snapshot size',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
