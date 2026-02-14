/**
 * VM Instances API
 *
 * GET /api/vm/instances - List all VM instances
 * POST /api/vm/instances - Create a new VM instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolManager } from '@/lib/vm/pool/vm-pool-manager';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import type { CreateVMOptions, VMListOptions } from '@/types/multi-vm';
import type { VMStatus } from '@/lib/vm/types';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(60);

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-vm-instances'
});

/**
 * GET /api/vm/instances
 * List all VM instances with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await apiRateLimit(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
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

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const options: VMListOptions = {};

    const status = searchParams.get('status');
    if (status) {
      options.status = status as VMStatus;
    }

    const projectId = searchParams.get('projectId');
    if (projectId) {
      options.projectId = projectId;
    }

    const tags = searchParams.get('tags');
    if (tags) {
      options.tags = tags.split(',');
    }

    const sortBy = searchParams.get('sortBy');
    if (sortBy) {
      options.sortBy = sortBy as VMListOptions['sortBy'];
    }

    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder === 'asc' || sortOrder === 'desc') {
      options.sortOrder = sortOrder;
    }

    const limit = searchParams.get('limit');
    if (limit) {
      options.limit = parseInt(limit, 10);
    }

    const offset = searchParams.get('offset');
    if (offset) {
      options.offset = parseInt(offset, 10);
    }

    // Get pool manager and list VMs
    const poolManager = getPoolManager();
    await poolManager.initialize();

    const vms = poolManager.listVMs(options);
    const resourceUsage = poolManager.getResourceUsage();
    const limits = poolManager.getLimits();

    log.info('Listed VM instances', {
      userId: session.user?.id,
      count: vms.length,
      filters: options
    });

    return NextResponse.json({
      instances: vms,
      total: vms.length,
      resourceUsage,
      limits
    });
  } catch (error) {
    log.error('Failed to list VM instances', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vm/instances
 * Create a new VM instance
 */
export async function POST(req: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await apiRateLimit(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
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

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const options: CreateVMOptions = {
      name: body.name,
      profileId: body.profileId,
      config: body.config,
      resources: body.resources,
      ports: body.ports,
      project: body.project,
      tags: body.tags,
      metadata: body.metadata,
      autoStart: body.autoStart
    };

    // Validate required fields
    if (!options.profileId && !options.config) {
      return NextResponse.json(
        { error: 'Either profileId or config is required' },
        { status: 400 }
      );
    }

    log.info('Creating VM instance', {
      userId: session.user?.id,
      name: options.name,
      profileId: options.profileId
    });

    // Get pool manager and create VM
    const poolManager = getPoolManager();
    await poolManager.initialize();

    const result = await poolManager.createVM(options);

    if (!result.success) {
      log.warn('Failed to create VM', {
        userId: session.user?.id,
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

    log.info('VM instance created', {
      userId: session.user?.id,
      vmId: result.vm?.id,
      vmName: result.vm?.name
    });

    return NextResponse.json({
      success: true,
      instance: result.vm,
      message: result.message
    }, { status: 201 });
  } catch (error) {
    log.error('Failed to create VM instance', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
