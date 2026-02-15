/**
 * Plugins API Route
 * Handles plugin CRUD operations and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import {
  listAllPlugins,
  findPlugins,
  enablePlugin,
  disablePlugin,
  getPluginManager,
} from '@/lib/plugins/plugin-manager';
import type { PluginSearchCriteria, PluginStatus } from '@/types/plugin';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugins' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

/**
 * GET /api/plugins
 * List all plugins with optional filtering
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const criteria: PluginSearchCriteria = {};

    if (searchParams.has('type')) {
      criteria.type = searchParams.get('type') || undefined;
    }
    if (searchParams.has('status')) {
      criteria.status = searchParams.get('status') as PluginStatus;
    }
    if (searchParams.has('keyword')) {
      criteria.keyword = searchParams.get('keyword') || undefined;
    }
    if (searchParams.has('author')) {
      criteria.author = searchParams.get('author') || undefined;
    }

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    // Get plugins
    const plugins = Object.keys(criteria).length > 0
      ? await findPlugins(criteria)
      : await listAllPlugins();

    // Transform plugins for API response
    const pluginList = plugins.map(plugin => ({
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
    }));

    return NextResponse.json({
      success: true,
      plugins: pluginList,
      total: pluginList.length,
    });
  } catch (error) {
    logger.error('Plugins API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plugins
 * Perform actions on plugins (enable, disable)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action, pluginId } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Missing pluginId parameter' },
        { status: 400 }
      );
    }

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    switch (action) {
      case 'enable': {
        const result = await enablePlugin(pluginId);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to enable plugin' },
            { status: 400 }
          );
        }

        logger.info('Plugin enabled', {
          pluginId,
          userId: session.user.id || session.user.email,
        });

        return NextResponse.json({
          success: true,
          message: `Plugin '${pluginId}' enabled successfully`,
        });
      }

      case 'disable': {
        const result = await disablePlugin(pluginId);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to disable plugin' },
            { status: 400 }
          );
        }

        logger.info('Plugin disabled', {
          pluginId,
          userId: session.user.id || session.user.email,
        });

        return NextResponse.json({
          success: true,
          message: `Plugin '${pluginId}' disabled successfully`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: enable, disable' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Plugins API POST error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plugins
 * Uninstall a plugin
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Missing pluginId parameter' },
        { status: 400 }
      );
    }

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    const result = await manager.uninstall(pluginId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to uninstall plugin' },
        { status: 400 }
      );
    }

    logger.info('Plugin uninstalled', {
      pluginId,
      userId: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Plugin '${pluginId}' uninstalled successfully`,
    });
  } catch (error) {
    logger.error('Plugins API DELETE error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
