/**
 * VM Profiles API
 *
 * GET /api/vm/profiles - List all available VM profiles
 * GET /api/vm/profiles?id=standard - Get a specific profile by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import type { VMProfile } from '@/types/multi-vm';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(60);

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-vm-profiles'
});

const builtInProfiles: VMProfile[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Lightweight VM with minimal resources',
    config: {},
    resources: { cpuCores: 1, memoryMB: 512, diskMB: 4096 },
    defaultPorts: [],
    services: ['ssh'],
    category: 'minimal',
    isBuiltIn: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Full development environment with common tools',
    config: {},
    resources: { cpuCores: 2, memoryMB: 2048, diskMB: 20480 },
    defaultPorts: [
      { host: 0, guest: 3000, protocol: 'tcp', service: 'dev-server', autoAllocated: true },
      { host: 0, guest: 8080, protocol: 'tcp', service: 'alt-server', autoAllocated: true },
    ],
    services: ['ssh', 'node', 'python', 'git'],
    category: 'development',
    isBuiltIn: true,
    estimatedSetupTime: 120,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'VM configured for running tests and CI',
    config: {},
    resources: { cpuCores: 2, memoryMB: 4096, diskMB: 20480 },
    defaultPorts: [],
    services: ['ssh', 'docker'],
    category: 'testing',
    isBuiltIn: true,
    estimatedSetupTime: 180,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'High-resource VM for demanding workloads',
    config: {},
    resources: { cpuCores: 4, memoryMB: 8192, diskMB: 40960 },
    defaultPorts: [
      { host: 0, guest: 3000, protocol: 'tcp', service: 'dev-server', autoAllocated: true },
    ],
    services: ['ssh', 'node', 'python', 'docker', 'git'],
    category: 'development',
    isBuiltIn: true,
    estimatedSetupTime: 240,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];

/**
 * GET /api/vm/profiles
 * List all available VM profiles or get a specific profile by ID
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const profile = builtInProfiles.find(p => p.id === id);
      if (!profile) {
        return NextResponse.json(
          { error: `Profile '${id}' not found` },
          { status: 404 }
        );
      }

      log.info('Fetched VM profile', {
        userId: session.user?.id,
        profileId: id
      });

      return NextResponse.json({ profile });
    }

    log.info('Listed VM profiles', {
      userId: session.user?.id,
      count: builtInProfiles.length
    });

    return NextResponse.json({
      profiles: builtInProfiles,
      total: builtInProfiles.length
    });
  } catch (error) {
    log.error('Failed to fetch VM profiles', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
