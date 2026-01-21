/**
 * Vector Search API Route for VibeCode Platform
 * Provides semantic search capabilities for AI project generation
 *
 * Rate Limited: 50 requests per minute (resource-heavy operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VectorSearchService } from '@/lib/vector-search';
import { EmbeddingGenerator } from '@/lib/embedding-generator';
import { z } from '@/lib/zod-compat';
// import { logger } from '@/lib/logger';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache/unified-cache-client';
import crypto from 'crypto';
import {
  checkRateLimit,
  createRateLimitedResponse,
  applyRateLimitHeaders,
  RateLimitPresets,
  type RateLimitResult,
} from '@/lib/rate-limiter';

const RATE_LIMIT_PREFIX = 'vector-search';
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  content_type: z.enum(['code', 'documentation', 'chat']).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  similarity_threshold: z.number().min(0).max(1).default(0.8)
});

const storeEmbeddingSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  content_type: z.enum(['code', 'documentation', 'chat']),
  metadata: z.record(z.string(), z.any()).optional()
});

const batchSearchSchema = z.object({
  queries: z.array(z.string()).min(1).max(10),
  content_type: z.enum(['code', 'documentation', 'chat']).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export async function POST(request: NextRequest) {
  // Apply rate limiting for vector search (resource-heavy)
  const rateLimitResult = await checkRateLimit(request, RateLimitPresets.VECTOR_SEARCH, RATE_LIMIT_PREFIX);
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.VECTOR_SEARCH);
  }

  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return applyRateLimitHeaders(
        NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required for vector search' },
          { status: 401 }
        ),
        rateLimitResult
      );
    }

    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action') || 'search';

    let response: NextResponse;
    switch (action) {
      case 'search':
        response = await handleSearch(body);
        break;
      case 'store':
        response = await handleStore(body);
        break;
      case 'batch-search':
        response = await handleBatchSearch(body);
        break;
      case 'hybrid-search':
        response = await handleHybridSearch(body);
        break;
      default:
        response = NextResponse.json(
          { error: 'Invalid action. Supported: search, store, batch-search, hybrid-search' },
          { status: 400 }
        );
    }
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('Vector search API error:', error);
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      ),
      rateLimitResult
    );
  }
}

async function handleSearch(body: any) {
  const { query, content_type, language, framework, limit, similarity_threshold } = 
    searchRequestSchema.parse(body);

  // Generate cache key for the search request
  const searchParams = { content_type, language, framework, limit, similarity_threshold };
  const cacheKey = generateVectorSearchCacheKey(query, searchParams);
  
  // Try cache first - provides 70-90% reduction in latency for repeated queries
  const cached = await cache.get(cacheKey);
  if (cached) {
    console.info('Vector search cache hit', { query: query.substring(0, 50), cache_key: cacheKey });
    return NextResponse.json({
      ...cached,
      from_cache: true,
      cache_hit: true
    });
  }

  const embeddingGenerator = new EmbeddingGenerator();
  const vectorSearch = new VectorSearchService();

  try {
    // Generate embedding for the query with caching
    const { embedding, from_cache: embedding_cached } = await embeddingGenerator.getOrGenerateEmbedding(
      query,
      content_type || 'code'
    );

    // Perform similarity search
    const results = await vectorSearch.similaritySearch(embedding, {
      content_type,
      language,
      framework,
      limit,
      similarity_threshold
    });

    const response = {
      success: true,
      query,
      results,
      total_results: results.length,
      search_params: searchParams,
      embedding_from_cache: embedding_cached,
      from_cache: false,
      cache_hit: false
    };

    // Cache the search results for 30 minutes (longer for expensive vector operations)
    await cache.set(cacheKey, response, CacheTTL.LONG);
    console.info('Vector search cached', { query: query.substring(0, 50), results_count: results.length });

    return NextResponse.json(response);
  } finally {
    await embeddingGenerator.close();
    await vectorSearch.close();
  }
}

async function handleStore(body: any) {
  const { content, content_type, metadata } = storeEmbeddingSchema.parse(body);

  const embeddingGenerator = new EmbeddingGenerator();

  try {
    const result = await embeddingGenerator.generateEmbedding({
      content,
      content_type,
      metadata
    });

    return NextResponse.json({
      success: true,
      content_hash: result.content_hash,
      token_count: result.token_count,
      message: 'Embedding stored successfully'
    });
  } finally {
    await embeddingGenerator.close();
  }
}

async function handleBatchSearch(body: any) {
  const { queries, content_type, language, framework, limit } = 
    batchSearchSchema.parse(body);

  const embeddingGenerator = new EmbeddingGenerator();
  const vectorSearch = new VectorSearchService();

  try {
    const batchResults = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    // Check cache for each query first
    for (const query of queries) {
      const searchParams = { content_type, language, framework, limit };
      const cacheKey = generateVectorSearchCacheKey(query, searchParams);
      
      const cached = await cache.get<{ results: unknown[]; total_results: number }>(cacheKey);
      if (cached) {
        batchResults.push({
          query,
          results: cached.results,
          total_results: cached.total_results,
          from_cache: true
        });
        cacheHits++;
        continue;
      }

      // Generate embedding and perform search for cache miss
      const { embedding, from_cache: embedding_cached } = await embeddingGenerator.getOrGenerateEmbedding(
        query,
        content_type || 'code'
      );

      const results = await vectorSearch.similaritySearch(embedding, {
        content_type,
        language,
        framework,
        limit
      });

      const queryResult = {
        query,
        results,
        total_results: results.length,
        embedding_from_cache: embedding_cached,
        from_cache: false
      };

      batchResults.push(queryResult);
      cacheMisses++;
      
      // Cache individual query result
      await cache.set(cacheKey, {
        success: true,
        query,
        results,
        total_results: results.length,
        search_params: searchParams
      }, CacheTTL.LONG);
    }

    console.info('Batch vector search completed', { 
      total_queries: queries.length,
      cache_hits: cacheHits, 
      cache_misses: cacheMisses,
      cache_hit_rate: (cacheHits / queries.length * 100).toFixed(1) + '%'
    });

    return NextResponse.json({
      success: true,
      batch_results: batchResults,
      total_queries: queries.length,
      cache_performance: {
        cache_hits: cacheHits,
        cache_misses: cacheMisses,
        cache_hit_rate: (cacheHits / queries.length * 100).toFixed(1) + '%'
      }
    });
  } finally {
    await embeddingGenerator.close();
    await vectorSearch.close();
  }
}

async function handleHybridSearch(body: any) {
  const hybridSearchSchema = z.object({
    query: z.string().min(1, 'Query cannot be empty'),
    filters: z.object({
      content_types: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      frameworks: z.array(z.string()).optional(),
      date_range: z.object({
        start: z.string().datetime(),
        end: z.string().datetime()
      }).optional()
    }).optional(),
    limit: z.number().int().min(1).max(50).default(10)
  });

  const { query, filters, limit } = hybridSearchSchema.parse(body);

  const embeddingGenerator = new EmbeddingGenerator();
  const vectorSearch = new VectorSearchService();

  try {
    const { embedding } = await embeddingGenerator.getOrGenerateEmbedding(
      query,
      'code' // Default for hybrid search
    );

    const processedFilters = {
      ...filters,
      date_range: filters?.date_range ? {
        start: new Date(filters.date_range.start),
        end: new Date(filters.date_range.end)
      } : undefined
    };

    const results = await vectorSearch.hybridSearch(embedding, processedFilters, limit);

    return NextResponse.json({
      success: true,
      query,
      results,
      total_results: results.length,
      filters: processedFilters
    });
  } finally {
    await embeddingGenerator.close();
    await vectorSearch.close();
  }
}

export async function GET(request: NextRequest) {
  // Apply rate limiting for vector search GET operations
  const rateLimitResult = await checkRateLimit(request, RateLimitPresets.VECTOR_SEARCH, RATE_LIMIT_PREFIX);
  if (!rateLimitResult.allowed) {
    return createRateLimitedResponse(rateLimitResult, RateLimitPresets.VECTOR_SEARCH);
  }

  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required for vector search' },
        { status: 401 }
      ),
      rateLimitResult
    );
  }

  const action = request.nextUrl.searchParams.get('action');

  if (action === 'stats') {
    // Cache statistics for 60 seconds to reduce database load
    const statsCacheKey = 'vector-search:stats';
    const cached = await cache.get(statsCacheKey);

    if (cached) {
      return applyRateLimitHeaders(
        NextResponse.json({
          success: true,
          stats: cached,
          from_cache: true
        }),
        rateLimitResult
      );
    }

    const vectorSearch = new VectorSearchService();
    try {
      const stats = await vectorSearch.getStats();

      // Include cache statistics
      const cacheStats = await cache.getStats();
      const enhancedStats = {
        ...stats,
        cache_performance: {
          cache_connected: cacheStats.connected,
          cache_keys: cacheStats.keyCount,
          cache_memory_usage: cacheStats.memoryUsage,
          estimated_cache_hit_rate: cacheStats.hitRate
        }
      };

      await cache.set(statsCacheKey, enhancedStats, CacheTTL.SHORT);

      return applyRateLimitHeaders(
        NextResponse.json({
          success: true,
          stats: enhancedStats,
          from_cache: false
        }),
        rateLimitResult
      );
    } finally {
      await vectorSearch.close();
    }
  }

  if (action === 'cache-clear') {
    // Clear vector search cache (admin function)
    const keys = await cache.keys('vector:search:*');
    if (keys.length > 0) {
      await cache.del(keys);
    }

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        message: `Cleared ${keys.length} vector search cache entries`,
        cleared_keys: keys.length
      }),
      rateLimitResult
    );
  }

  return applyRateLimitHeaders(
    NextResponse.json({
      success: true,
      message: 'VibeCode Vector Search API with Advanced Caching',
      endpoints: {
        'POST /api/vector-search?action=search': 'Semantic similarity search (cached)',
        'POST /api/vector-search?action=store': 'Store new embedding',
        'POST /api/vector-search?action=batch-search': 'Batch similarity search (cached)',
        'POST /api/vector-search?action=hybrid-search': 'Advanced hybrid search',
        'GET /api/vector-search?action=stats': 'Get database statistics (cached)',
        'GET /api/vector-search?action=cache-clear': 'Clear vector search cache'
      },
      cache_features: {
        'search_caching': 'Individual and batch searches cached for 30 minutes',
        'embedding_caching': 'Generated embeddings cached to avoid OpenAI API calls',
        'stats_caching': 'Statistics cached for 60 seconds',
        'performance_gain': 'Expected 70-90% latency reduction for repeated queries'
      },
      version: '1.1.0',
      rate_limiting: {
        'limit': `${RateLimitPresets.VECTOR_SEARCH.maxRequests} requests per ${RateLimitPresets.VECTOR_SEARCH.windowSeconds} seconds`,
        'algorithm': 'sliding window'
      }
    }),
    rateLimitResult
  );
}

// Helper function to generate consistent cache keys for vector searches
function generateVectorSearchCacheKey(
  query: string, 
  params: { content_type?: string; language?: string; framework?: string; limit?: number; similarity_threshold?: number }
): string {
  const keyData = {
    query,
    ...params
  };
  
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex')
    .substring(0, 16);
    
  return `vector:search:${hash}`;
}
