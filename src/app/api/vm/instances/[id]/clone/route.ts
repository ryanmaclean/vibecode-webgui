/**
 * VM Instance Clone API
 *
 * POST /api/vm/instances/[id]/clone - Clone a VM instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolManager } from '@/lib/vm/pool/vm-pool-manager';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import type { CloneVMOptions } from '@/types/multi-vm';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(20);

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-vm-clone'
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vm/instances/[id]/clone
 * Clone an existing VM instance
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

    // Parse request body for clone options
    let options: CloneVMOptions = {};
    try {
      const body = await req.json();
      options = {
        name: body.name,
        includeVolumes: body.includeVolumes,
        autoStart: body.autoStart,
        tags: body.tags
      };
    } catch {
      // Body is optional, use defaults
    }

    log.info('Cloning VM instance', {
      userId: session.user?.id,
      sourceVmId: id,
      cloneName: options.name
    });

    // Get pool manager
    const poolManager = getPoolManager();
    await poolManager.initialize();

    // Check if source VM exists
    const sourceVm = poolManager.getVM(id);
    if (!sourceVm) {
      return NextResponse.json(
        { error: 'Source VM not found' },
        { status: 404 }
      );
    }

    // Clone the VM
    const result = await poolManager.cloneVM(id, options);

    if (!result.success) {
      log.warn('Failed to clone VM', {
        userId: session.user?.id,
        sourceVmId: id,
        error: result.error
      });

      const statusCode = result.error?.code === 'RESOURCE_LIMIT_EXCEEDED' ? 409 : 500;
      return NextResponse.json(
        {
          error: result.message,
          code: result.error?.code,
          details: result.error?.details
        },
        { status: statusCode }
      );
    }

    log.info('VM instance cloned', {
      userId: session.user?.id,
      sourceVmId: id,
      newVmId: result.vm?.id,
      newVmName: result.vm?.name
    });

    return NextResponse.json({
      success: true,
      instance: result.vm,
      message: result.message
    }, { status: 201 });
  } catch (error) {
    log.error('Failed to clone VM instance', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
