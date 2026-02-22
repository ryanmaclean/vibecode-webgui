/**
 * Plugins API Route
 * Handles plugin CRUD operations and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { z } from '@/lib/zod-compat';
import {
  listAllPlugins,
  findPlugins,
  enablePlugin,
  disablePlugin,
  getPluginManager,
} from '@/lib/plugins/plugin-manager';
import type { PluginSearchCriteria, PluginStatus, PluginType } from '@/types/plugin';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugins' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute
const VALID_PLUGIN_TYPES: PluginType[] = [
  'ai-model',
  'integration',
  'workflow',
  'ui-extension',
  'code-generator',
  'linter',
  'formatter',
  'other',
];
const VALID_PLUGIN_STATUSES: PluginStatus[] = [
  'active',
  'inactive',
  'error',
  'installing',
  'uninstalling',
];

const pluginQuerySchema = z.object({
  type: z.enum(VALID_PLUGIN_TYPES as [PluginType, ...PluginType[]]).optional(),
  status: z.enum(VALID_PLUGIN_STATUSES as [PluginStatus, ...PluginStatus[]]).optional(),
  keyword: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
});

const pluginActionSchema = z.object({
  action: z.enum(['enable', 'disable']),
  pluginId: z.string().trim().min(1),
});

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
    const rawQuery = {
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      author: searchParams.get('author') || undefined,
    };
    const parsedQuery = pluginQuerySchema.safeParse(rawQuery);
    const criteria: PluginSearchCriteria = parsedQuery.success ? parsedQuery.data : {};

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    // Get plugins
    const plugins = Object.keys(criteria).length > 0
      ? await findPlugins(criteria)
      : await listAllPlugins();

    // Return plugin shape expected by plugin manager UI
    const pluginList = plugins.map((plugin) => ({
      manifest: plugin.manifest,
      capabilities: plugin.capabilities,
      status: plugin.status,
      installedAt: plugin.installedAt,
      updatedAt: plugin.updatedAt,
      enabledAt: plugin.enabledAt,
      lastError: plugin.lastError,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parsedBody = pluginActionSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsedBody.error.issues,
        },
        { status: 400 }
      );
    }

    const { action, pluginId } = parsedBody.data;

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
