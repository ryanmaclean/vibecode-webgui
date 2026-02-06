/**
 * Restore Snapshot API Route
 *
 * POST /api/vm/snapshots/[id]/restore - Restore VM from snapshot
 */

import { NextResponse, NextRequest } from 'next/server';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getSnapshotManager } from '@/lib/vm/snapshots';
import type { SnapshotAPIResponse, RestoreResult } from '@/types/vm-snapshot';

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(10); // Lower limit for restore operations

const restoreSchema = z.object({
  vmId: z.string().optional(),
  createNewVM: z.boolean().optional(),
}).strict();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vm/snapshots/[id]/restore
 * Restore VM from snapshot
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<SnapshotAPIResponse<RestoreResult>>> {
  const { id } = await params;

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const validated = restoreSchema.parse(body);

    const manager = getSnapshotManager();
    await manager.initialize();

    // Check if snapshot exists
    const snapshot = await manager.getSnapshot(id);
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: `Snapshot not found: ${id}` },
        { status: 404 }
      );
    }

    // Check snapshot state
    if (snapshot.state !== 'ready') {
      return NextResponse.json(
        { success: false, error: `Snapshot is not ready (current state: ${snapshot.state})` },
        { status: 400 }
      );
    }

    const result = await manager.restoreSnapshot(id, validated.vmId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to restore snapshot',
          details: result.errorDetails,
        },
        { status: 500 }
      );
    }

    console.info('Snapshot restored', {
      snapshotId: id,
      name: snapshot.name,
      vmId: validated.vmId || snapshot.vmId,
      duration: result.duration,
      warnings: result.warnings,
    });

    return NextResponse.json({
      success: true,
      data: result,
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

    console.error('Error restoring snapshot', {
      snapshotId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restore snapshot',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
