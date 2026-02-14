/**
 * Import Snapshot API Route
 *
 * POST /api/vm/snapshots/import - Import snapshot from uploaded archive
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getSnapshotManager } from '@/lib/vm/snapshots';
import type { SnapshotAPIResponse, SnapshotInfo } from '@/types/vm-snapshot';

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(5); // Low limit for imports

// Maximum file size (1GB)
const MAX_FILE_SIZE = 1024 * 1024 * 1024;

/**
 * POST /api/vm/snapshots/import
 * Import snapshot from uploaded archive
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SnapshotAPIResponse<{ snapshotId: string; snapshot?: SnapshotInfo }>>> {
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
      { success: false, error: 'Too many requests. Import is resource-intensive.' },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '120',
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const overwrite = formData.get('overwrite') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.tar.gz') && !file.name.endsWith('.tgz')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Expected .tar.gz or .tgz archive.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.` },
        { status: 400 }
      );
    }

    // Save to temporary file
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `import-${Date.now()}-${file.name}`);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, fileBuffer);

    try {
      const manager = getSnapshotManager();
      await manager.initialize();

      const result = await manager.importSnapshot(tempPath, overwrite);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to import snapshot' },
          { status: 500 }
        );
      }

      // Get the imported snapshot info
      let snapshot: SnapshotInfo | undefined;
      if (result.snapshotId) {
        snapshot = await manager.getSnapshot(result.snapshotId) || undefined;
      }

      console.info('Snapshot imported', {
        snapshotId: result.snapshotId,
        fileName: file.name,
        size: file.size,
      });

      return NextResponse.json({
        success: true,
        data: {
          snapshotId: result.snapshotId!,
          snapshot,
        },
      });
    } finally {
      // Clean up temp file
      fs.unlink(tempPath).catch(() => {
        // Ignore cleanup errors
      });
    }
  } catch (error) {
    console.error('Error importing snapshot', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import snapshot',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
