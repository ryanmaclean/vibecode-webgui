/**
 * VM Instance API - Single Instance Operations
 *
 * GET /api/vm/instances/[id] - Get VM details
 * DELETE /api/vm/instances/[id] - Delete VM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolManager } from '@/lib/vm/pool/vm-pool-manager';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';

const apiRateLimit = createAPIRateLimit(60);

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-vm-instance'
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vm/instances/[id]
 * Get details of a specific VM instance
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check rate limit
    const rateLimitResult = await apiRateLimit(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pool manager and find VM
    const poolManager = getPoolManager();
    await poolManager.initialize();

    const vm = poolManager.getVM(id);

    if (!vm) {
      return NextResponse.json(
        { error: 'VM not found' },
        { status: 404 }
      );
    }

    log.info('Retrieved VM instance', {
      userId: session.user?.id,
      vmId: id
    });

    return NextResponse.json({
      instance: vm
    });
  } catch (error) {
    log.error('Failed to get VM instance', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vm/instances/[id]
 * Delete a VM instance
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check rate limit
    const rateLimitResult = await apiRateLimit(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Deleting VM instance', {
      userId: session.user?.id,
      vmId: id
    });

    // Get pool manager and delete VM
    const poolManager = getPoolManager();
    await poolManager.initialize();

    const result = await poolManager.deleteVM(id);

    if (!result.success) {
      const statusCode = result.error?.code === 'VM_NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        {
          error: result.message,
          code: result.error?.code
        },
        { status: statusCode }
      );
    }

    log.info('VM instance deleted', {
      userId: session.user?.id,
      vmId: id
    });

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    log.error('Failed to delete VM instance', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
