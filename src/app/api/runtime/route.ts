/**
 * Container Runtime API
 * 
 * API endpoint for managing container runtimes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  detectRuntime, 
  getRuntimeWithFallback,
  createRuntime 
} from '@/lib/container/runtime-factory';
import { 
  getRuntimeConfig, 
  saveRuntimeConfig 
} from '@/lib/container/runtime-config';
import type { ContainerRuntimeType } from '@/lib/container/runtime-interface';

/**
 * GET /api/runtime
 * Get current runtime status and configuration
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current configuration
    const config = await getRuntimeConfig();

    // Get runtime status
    const runtime = await getRuntimeWithFallback(config.runtime);
    const status = await runtime.getStatus();

    // Detect all available runtimes
    const available: Record<string, boolean> = {};
    for (const runtimeType of ['docker', 'podman', 'kubernetes', 'apple'] as ContainerRuntimeType[]) {
      try {
        const rt = await createRuntime({ runtime: runtimeType });
        available[runtimeType] = await rt.isAvailable();
      } catch {
        available[runtimeType] = false;
      }
    }

    return NextResponse.json({
      current: {
        runtime: config.runtime,
        status,
      },
      available,
      config,
    });
  } catch (error) {
    console.error('Error getting runtime status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/runtime
 * Switch container runtime
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { runtime } = body as { runtime: ContainerRuntimeType };

    if (!runtime || !['docker', 'podman', 'kubernetes', 'apple'].includes(runtime)) {
      return NextResponse.json(
        { error: 'Invalid runtime type' },
        { status: 400 }
      );
    }

    // Check if runtime is available
    const rt = await createRuntime({ runtime });
    const isAvailable = await rt.isAvailable();

    if (!isAvailable) {
      return NextResponse.json(
        { error: `Runtime ${runtime} is not available` },
        { status: 400 }
      );
    }

    // Update configuration
    const config = await getRuntimeConfig();
    config.runtime = runtime;
    await saveRuntimeConfig(config);

    return NextResponse.json({
      success: true,
      runtime,
      message: `Switched to ${runtime} runtime`,
    });
  } catch (error) {
    console.error('Error switching runtime:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/runtime
 * Detect and switch to best available runtime
 */
export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Auto-detect runtime
    const detectedRuntime = await detectRuntime();

    if (!detectedRuntime) {
      return NextResponse.json(
        { error: 'No container runtime available' },
        { status: 503 }
      );
    }

    // Update configuration
    const config = await getRuntimeConfig();
    config.runtime = detectedRuntime;
    await saveRuntimeConfig(config);

    return NextResponse.json({
      success: true,
      runtime: detectedRuntime,
      message: `Auto-detected and switched to ${detectedRuntime} runtime`,
    });
  } catch (error) {
    console.error('Error auto-detecting runtime:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
