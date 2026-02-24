/**
 * Plugin Publish API Route
 * Handles publishing new plugins or new versions of existing plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { z } from '@/lib/zod-compat';
import { publishPlugin } from '@/lib/plugins/plugin-repository';
import type { PluginPublishRequest } from '@/lib/plugins/plugin-repository';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugin-publish' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(10); // 10 requests per minute (stricter for publishing)

const VALID_CATEGORIES = [
  'ai-model',
  'integration',
  'workflow',
  'ui-extension',
  'code-generator',
  'linter',
  'formatter',
  'other',
];

const pluginPublishSchema = z.object({
  name: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  category: z.enum(VALID_CATEGORIES as [string, ...string[]]),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  repositoryUrl: z.string().url().optional(),
  homepageUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  version: z.string().trim().min(1).max(50),
  changelog: z.string().trim().max(5000).optional(),
  packageUrl: z.string().url(),
  packageChecksum: z.string().trim().min(1).max(128),
  compatibleVersions: z.array(z.string().trim().min(1).max(50)).optional(),
});

/**
 * POST /api/plugins/publish
 * Publish a new plugin or new version of existing plugin
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

    const parsedBody = pluginPublishSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsedBody.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      name,
      displayName,
      description,
      category,
      tags,
      repositoryUrl,
      homepageUrl,
      iconUrl,
      version,
      changelog,
      packageUrl,
      packageChecksum,
      compatibleVersions,
    } = parsedBody.data;

    // Get user ID from session
    const authorId = session.user.id ? parseInt(session.user.id) : undefined;
    if (!authorId) {
      return NextResponse.json(
        { error: 'User ID not found in session' },
        { status: 400 }
      );
    }

    // Prepare publish request
    const publishRequest: PluginPublishRequest = {
      name,
      displayName,
      description,
      authorId,
      category,
      tags,
      repositoryUrl,
      homepageUrl,
      iconUrl,
      version,
      changelog,
      packageUrl,
      packageChecksum,
      compatibleVersions,
    };

    // Publish the plugin
    const plugin = await publishPlugin(publishRequest);

    logger.info('Plugin published', {
      pluginId: plugin.id,
      name: plugin.name,
      version,
      authorId,
      userId: session.user.email,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Plugin '${plugin.name}' version ${version} published successfully`,
        plugin: {
          id: plugin.id,
          name: plugin.name,
          displayName: plugin.displayName,
          version: plugin.latestVersion,
          status: plugin.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Plugin publish API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
