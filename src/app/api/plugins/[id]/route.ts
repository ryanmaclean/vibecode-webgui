/**
 * Plugin Detail API Route
 * Handles operations on individual plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import {
  getPluginById,
  getPluginManager,
} from '@/lib/plugins/plugin-manager';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugins' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/plugins/[id]
 * Get details for a specific plugin
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request);
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
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get plugin ID from route params
    const resolvedParams = await params;
    const pluginId = decodeURIComponent(resolvedParams.id);

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    // Get plugin by ID
    const plugin = await getPluginById(pluginId);

    if (!plugin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plugin not found',
          pluginId,
        },
        { status: 404 }
      );
    }

    // Transform plugin for API response
    return NextResponse.json({
      success: true,
      plugin: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        status: plugin.status,
        capabilities: plugin.capabilities,
        permissions: plugin.permissions,
        icon: plugin.icon,
        homepage: plugin.homepage,
        repository: plugin.repository,
        metadata: plugin.metadata,
      },
    });
  } catch (error) {
    logger.error('Plugin detail API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plugins/[id]
 * Uninstall a specific plugin
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request);
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
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get plugin ID from route params
    const resolvedParams = await params;
    const pluginId = decodeURIComponent(resolvedParams.id);

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    // Check if plugin exists
    const plugin = await getPluginById(pluginId);
    if (!plugin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plugin not found',
          pluginId,
        },
        { status: 404 }
      );
    }

    // Uninstall the plugin
    const result = await manager.uninstall(pluginId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to uninstall plugin' },
        { status: 400 }
      );
    }

    logger.info('Plugin uninstalled via detail endpoint', {
      pluginId,
      userId: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Plugin '${pluginId}' uninstalled successfully`,
    });
  } catch (error) {
    logger.error('Plugin detail API DELETE error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
