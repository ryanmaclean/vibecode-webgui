/**
 * VM Snapshot by ID API Route
 *
 * GET /api/vm/snapshots/[id] - Get snapshot details
 * DELETE /api/vm/snapshots/[id] - Delete snapshot
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getSnapshotManager } from '@/lib/vm/snapshots';
import type { SnapshotAPIResponse, SnapshotInfo } from '@/types/vm-snapshot';

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vm/snapshots/[id]
 * Get snapshot details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<SnapshotAPIResponse<SnapshotInfo>>> {
  const { id } = await params;

  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 }
    );
  }

  try {
    const manager = getSnapshotManager();
    await manager.initialize();

    const snapshot = await manager.getSnapshot(id);

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: `Snapshot not found: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Error getting snapshot', {
      snapshotId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get snapshot',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vm/snapshots/[id]
 * Delete a snapshot
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<SnapshotAPIResponse>> {
  const { id } = await params;

  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 }
    );
  }

  try {
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

    const result = await manager.deleteSnapshot(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to delete snapshot' },
        { status: 500 }
      );
    }

    console.info('Snapshot deleted', {
      snapshotId: id,
      name: snapshot.name,
      vmId: snapshot.vmId,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting snapshot', {
      snapshotId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete snapshot',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
