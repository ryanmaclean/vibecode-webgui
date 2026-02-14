/**
 * VM Snapshots API Route
 *
 * GET /api/vm/snapshots - List snapshots
 * POST /api/vm/snapshots - Create snapshot
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getSnapshotManager } from '@/lib/vm/snapshots';
import type {
  SnapshotAPIResponse,
  SnapshotListResponse,
  SnapshotResult,
  CreateSnapshotRequest,
} from '@/types/vm-snapshot';

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(30); // 30 requests per minute

// Validation schemas
const listQuerySchema = z.object({
  vmId: z.string().optional(),
}).strict();

const createSnapshotSchema = z.object({
  vmId: z.string().min(1, 'VM ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  options: z.object({
    includeDisk: z.boolean().optional(),
    includeMemory: z.boolean().optional(),
    compress: z.boolean().optional(),
    compressionAlgorithm: z.enum(['zstd', 'gzip', 'lz4']).optional(),
    compressionLevel: z.number().min(1).max(22).optional(),
    verifyIntegrity: z.boolean().optional(),
    pauseVM: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
}).strict();

/**
 * GET /api/vm/snapshots
 * List all snapshots or filter by VM ID
 */
export async function GET(request: NextRequest): Promise<NextResponse<SnapshotAPIResponse<SnapshotListResponse>>> {
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
    const url = new URL(request.url);
    const vmId = url.searchParams.get('vmId');

    const manager = getSnapshotManager();
    await manager.initialize();

    let response: SnapshotListResponse;

    if (vmId) {
      const snapshots = await manager.listSnapshotsForVM(vmId);
      const totalSize = snapshots.reduce((sum, s) => sum + s.size, 0);
      response = {
        snapshots,
        total: snapshots.length,
        totalSize,
      };
    } else {
      response = await manager.listSnapshots();
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error listing snapshots', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list snapshots',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vm/snapshots
 * Create a new snapshot
 */
export async function POST(request: NextRequest): Promise<NextResponse<SnapshotAPIResponse<SnapshotResult>>> {
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
    const body = await request.json();
    const validated = createSnapshotSchema.parse(body) as CreateSnapshotRequest;

    const manager = getSnapshotManager();
    await manager.initialize();

    const result = await manager.createSnapshot(
      validated.vmId,
      validated.name,
      validated.description,
      validated.options
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to create snapshot',
          details: result.errorDetails,
        },
        { status: 500 }
      );
    }

    console.info('Snapshot created', {
      snapshotId: result.snapshot?.id,
      vmId: validated.vmId,
      name: validated.name,
      size: result.snapshot?.size,
      duration: result.duration,
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

    console.error('Error creating snapshot', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create snapshot',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
