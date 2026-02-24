/**
 * Plugin Marketplace API Route
 * Handles marketplace plugin discovery, search, and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { z } from '@/lib/zod-compat';
import {
  searchPlugins,
  getPluginCategories,
  type PluginRepositorySearchCriteria,
} from '@/lib/plugins/plugin-repository';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'marketplace' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

const VALID_SORT_BY = ['downloads', 'rating', 'created', 'updated'] as const;
const VALID_SORT_ORDER = ['asc', 'desc'] as const;

const marketplaceQuerySchema = z.object({
  query: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  tags: z.string().transform((val) => val.split(',').map((t) => t.trim()).filter(Boolean)).optional(),
  featured: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  verified: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  minRating: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(1).max(5)).optional(),
  sortBy: z.enum(VALID_SORT_BY).optional(),
  sortOrder: z.enum(VALID_SORT_ORDER).optional(),
  limit: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(0)).optional(),
});

/**
 * GET /api/plugins/marketplace
 * Search and browse marketplace plugins
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
      tags: searchParams.get('tags') || undefined,
      featured: searchParams.get('featured') || undefined,
      verified: searchParams.get('verified') || undefined,
      minRating: searchParams.get('minRating') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    };

    const parsedQuery = marketplaceQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsedQuery.error.issues,
        },
        { status: 400 }
      );
    }

    // Build search criteria
    const criteria: PluginRepositorySearchCriteria = {
      query: parsedQuery.data.query,
      category: parsedQuery.data.category,
      tags: parsedQuery.data.tags,
      featured: parsedQuery.data.featured,
      verified: parsedQuery.data.verified,
      minRating: parsedQuery.data.minRating,
      sortBy: parsedQuery.data.sortBy ?? 'downloads',
      sortOrder: parsedQuery.data.sortOrder ?? 'desc',
      limit: parsedQuery.data.limit ?? 20,
      offset: parsedQuery.data.offset ?? 0,
    };

    // Search plugins
    const searchResult = await searchPlugins(criteria);

    // Get categories for filter suggestions
    const categories = await getPluginCategories();

    return NextResponse.json({
      success: true,
      plugins: searchResult.plugins,
      total: searchResult.total,
      limit: searchResult.limit,
      offset: searchResult.offset,
      categories,
    });
  } catch (error) {
    logger.error('Marketplace API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
