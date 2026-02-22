import { NextRequest, NextResponse } from 'next/server';
import { validateQueryParams, validateRequestBody } from '@/lib/api/validation/middleware';
import { docsSearchQuerySchema, docsSearchBodySchema } from '@/lib/api/validation/schemas';
import { sanitizeSearchQuery } from '@/lib/api/validation/sanitize';
import { createErrorResponse } from '@/lib/utils/api-response';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getCachedDocsIndex, cacheDocsIndex, OfflineTTL } from '@/lib/cache/offline-cache';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30); // 30 requests per minute

// Documentation index type
interface DocsIndex {
  documents: any[];
  metadata: {
    categories: string[];
    totalDocuments: number;
    generated?: string;
    totalWords?: number;
  };
}

/**
 * Load documentation index from file system or cache
 * Uses offline cache for performance and offline mode support
 */
async function loadDocsIndex(): Promise<DocsIndex> {
  // Try to get from cache first
  const cached = getCachedDocsIndex<DocsIndex>();
  if (cached) {
    return cached;
  }

  // Load from file system
  try {
    const docsIndexPath = path.join(process.cwd(), 'public', 'docs-index.json');
    const fileContent = await fs.readFile(docsIndexPath, 'utf-8');
    const index = JSON.parse(fileContent) as DocsIndex;

    // Cache for offline use
    await cacheDocsIndex(index, {
      ttl: OfflineTTL.DOCS,
      source: '/docs-index.json',
    });

    return index;
  } catch (error) {
    // Failed to load docs-index.json, return empty index as fallback
    return {
      documents: [],
      metadata: {
        categories: [],
        totalDocuments: 0,
      },
    };
  }
}

// Response type definitions
interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  content: string;
  score: number;
  headings: Array<{
    level: number;
    text: string;
    id: string;
  }>;
}

interface DocsSearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  categories: string[];
  metadata: {
    searchTime: number;
    totalDocuments: number;
  };
}

export async function GET(request: NextRequest) {
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

  try {
    // Validate query parameters with zod schema
    const validation = validateQueryParams(request, docsSearchQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { q, category, limit } = validation.data;

    // Sanitize the search query
    const query = sanitizeSearchQuery(q);

    if (!query || query.length === 0) {
      return createErrorResponse('Query parameter "q" is required', 400, {
        code: 'INVALID_QUERY',
        detail: 'Search query cannot be empty after sanitization'
      });
    }

    // Load documentation index (from cache or file system)
    const docsIndex = await loadDocsIndex();

    // Check if docs index is available
    if (!docsIndex.documents || docsIndex.documents.length === 0) {
      return createErrorResponse('Documentation index not available', 503, {
        code: 'DOCS_UNAVAILABLE',
        detail: 'Documentation index could not be loaded. Please try again later.'
      });
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const results: SearchResult[] = [];

    for (const doc of docsIndex.documents) {
      // Filter by category if specified
      if (category && doc.category.toLowerCase() !== category.toLowerCase()) {
        continue;
      }

      let score = 0;
      const keywords = doc.keywords.toLowerCase();

      // Calculate relevance score
      for (const term of queryTerms) {
        // Exact title match (highest weight)
        if (doc.title.toLowerCase() === term) score += 20;
        else if (doc.title.toLowerCase().includes(term)) score += 10;

        // Category match (high weight)
        if (doc.category.toLowerCase().includes(term)) score += 8;

        // Description match (medium-high weight)
        if (doc.description.toLowerCase().includes(term)) score += 6;

        // Heading match (medium weight)
        const headingMatch = doc.headings.find((h: { level: number; text: string; id: string }) =>
          h.text.toLowerCase().includes(term)
        );
        if (headingMatch) {
          score += 4;
        }

        // Content match (low weight, but consider frequency)
        const termRegex = new RegExp(`\\b${term}\\b`, 'gi');
        const termCount = (keywords.match(termRegex) || []).length;
        score += Math.min(termCount, 5); // Cap at 5 points per term

        // Boost score for exact phrase matches
        if (doc.content.toLowerCase().includes(query.toLowerCase())) {
          score += 5;
        }
      }

      // Boost newer documents slightly
      const daysSinceModified = (Date.now() - new Date(doc.lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 30) score += 1;

      if (score > 0) {
        results.push({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          url: doc.url,
          content: doc.content,
          headings: doc.headings,
          score
        });
      }
    }

    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    const response: DocsSearchResponse = {
      query,
      total: results.length,
      results: limitedResults,
      categories: docsIndex.metadata.categories,
      metadata: {
        searchTime: Date.now(),
        totalDocuments: docsIndex.metadata.totalDocuments
      }
    };

    // Add offline mode support headers
    return NextResponse.json(response, {
      headers: {
        'X-Offline-Capable': 'true',
        'X-Cache-Source': getCachedDocsIndex() ? 'cache' : 'filesystem',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    // Error occurred during search operation
    return createErrorResponse('Failed to perform search', 500, {
      code: 'SEARCH_ERROR',
      detail: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

// POST support for more complex search queries with structured body
export async function POST(request: NextRequest) {
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

  try {
    // Validate request body with zod schema
    const validation = await validateRequestBody(request, docsSearchBodySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { query: rawQuery, filters, options } = validation.data;

    // Sanitize the search query
    const query = sanitizeSearchQuery(rawQuery);

    if (!query || query.length === 0) {
      return createErrorResponse('Query is required', 400, {
        code: 'INVALID_QUERY',
        detail: 'Search query cannot be empty after sanitization'
      });
    }

    // Build search params and delegate to GET handler
    const searchParams = new URLSearchParams({
      q: query,
      ...(filters?.category && { category: filters.category }),
      limit: (options?.limit || 10).toString()
    });

    const url = new URL(`/api/docs/search?${searchParams}`, request.url);
    return GET(new NextRequest(url));

  } catch (error) {
    // Error occurred during POST request processing
    return createErrorResponse('Failed to process search request', 400, {
      code: 'INVALID_REQUEST',
      detail: error instanceof Error ? error.message : 'Invalid request body'
    });
  }
}
