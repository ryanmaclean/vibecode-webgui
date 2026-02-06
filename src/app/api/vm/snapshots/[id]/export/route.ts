/**
 * Export Snapshot API Route
 *
 * GET /api/vm/snapshots/[id]/export - Download snapshot as archive
 */

import { NextResponse, NextRequest } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getSnapshotManager, getSnapshotStorage } from '@/lib/vm/snapshots';
import type { SnapshotAPIResponse } from '@/types/vm-snapshot';

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(5); // Very low limit for exports

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vm/snapshots/[id]/export
 * Export snapshot as downloadable archive
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Export is resource-intensive.' },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '120',
        },
      }
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

    // Check snapshot state
    if (snapshot.state !== 'ready') {
      return NextResponse.json(
        { success: false, error: `Snapshot is not ready (current state: ${snapshot.state})` },
        { status: 400 }
      );
    }

    // Create temporary export file
    const tempDir = os.tmpdir();
    const exportFileName = `${snapshot.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-${id.slice(0, 8)}.tar.gz`;
    const exportPath = path.join(tempDir, exportFileName);

    // Export snapshot
    const result = await manager.exportSnapshot(id, exportPath);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to export snapshot' },
        { status: 500 }
      );
    }

    // Read the file and create response
    const fileBuffer = await fs.readFile(exportPath);

    // Clean up temp file
    fs.unlink(exportPath).catch(() => {
      // Ignore cleanup errors
    });

    console.info('Snapshot exported', {
      snapshotId: id,
      name: snapshot.name,
      size: fileBuffer.length,
    });

    // Return file as download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${exportFileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting snapshot', {
      snapshotId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export snapshot',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
