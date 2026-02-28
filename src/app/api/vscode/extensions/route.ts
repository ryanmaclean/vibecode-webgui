/**
 * VS Code Extensions API Route
 * Handles VS Code extension search and discovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { z } from '@/lib/zod-compat';
import { OpenVSCodeExtensionManager } from '@/lib/ide/openvscode-extensions';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'vscode-extensions' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

const extensionQuerySchema = z.object({
  query: z.string().trim().optional(),
  category: z.string().trim().optional(),
  sortBy: z.enum(['installs', 'rating', 'name', 'publishedDate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  pageNumber: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/vscode/extensions
 * Search for VS Code extensions with optional filtering
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
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      pageNumber: searchParams.get('pageNumber') || undefined,
    };

    const parsedQuery = extensionQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsedQuery.error.issues,
        },
        { status: 400 }
      );
    }

    // Initialize extension manager
    const extensionManager = new OpenVSCodeExtensionManager();

    // Search extensions
    const result = await extensionManager.searchExtensions(parsedQuery.data);

    logger.info('VS Code extensions searched', {
      query: parsedQuery.data.query,
      total: result.total,
      userId: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      extensions: result.extensions,
      total: result.total,
      pageSize: result.pageSize,
      pageNumber: result.pageNumber,
    });
  } catch (error) {
    logger.error('VS Code Extensions API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
