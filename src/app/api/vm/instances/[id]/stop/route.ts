/**
 * VM Instance Stop API
 *
 * POST /api/vm/instances/[id]/stop - Stop a VM instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolManager } from '@/lib/vm/pool/vm-pool-manager';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30);

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-vm-stop'
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vm/instances/[id]/stop
 * Stop a running VM instance
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check rate limit
    const rateLimitResult = await apiRateLimit(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      );
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Stopping VM instance', {
      userId: session.user?.id,
      vmId: id
    });

    // Get pool manager and stop VM
    const poolManager = getPoolManager();
    await poolManager.initialize();

    // Check if VM exists
    const vm = poolManager.getVM(id);
    if (!vm) {
      return NextResponse.json(
        { error: 'VM not found' },
        { status: 404 }
      );
    }

    // Check if already stopped
    if (vm.status.status === 'stopped') {
      return NextResponse.json(
        { error: 'VM is already stopped' },
        { status: 409 }
      );
    }

    // Check if in transition state
    if (vm.status.status === 'creating' || vm.status.status === 'stopping') {
      return NextResponse.json(
        { error: `VM is currently ${vm.status.status}` },
        { status: 409 }
      );
    }

    const result = await poolManager.stopVM(id);

    if (!result.success) {
      log.warn('Failed to stop VM', {
        userId: session.user?.id,
        vmId: id,
        error: result.error
      });

      return NextResponse.json(
        {
          error: result.message,
          code: result.error?.code
        },
        { status: 500 }
      );
    }

    log.info('VM instance stopped', {
      userId: session.user?.id,
      vmId: id
    });

    return NextResponse.json({
      success: true,
      instance: result.vm,
      message: result.message
    });
  } catch (error) {
    log.error('Failed to stop VM instance', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
