/**
 * Vector Search API Route for VibeCode Platform
 * Provides semantic search capabilities for AI project generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { VectorSearchService } from '@/lib/vector-search';
import { EmbeddingGenerator } from '@/lib/embedding-generator';
import { z } from 'zod';
import { logger } from '@/lib/logger';
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
  metadata: z.record(z.any()).optional()
});

const batchSearchSchema = z.object({
  queries: z.array(z.string()).min(1).max(10),
  content_type: z.enum(['code', 'documentation', 'chat']).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action') || 'search';

    switch (action) {
      case 'search':
        return await handleSearch(body);
      case 'store':
        return await handleStore(body);
      case 'batch-search':
        return await handleBatchSearch(body);
      case 'hybrid-search':
        return await handleHybridSearch(body);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: search, store, batch-search, hybrid-search' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Vector search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleSearch(body: any) {
  const { query, content_type, language, framework, limit, similarity_threshold } = 
    searchRequestSchema.parse(body);

  const embeddingGenerator = new EmbeddingGenerator();
  const vectorSearch = new VectorSearchService();

  try {
    // Generate embedding for the query
    const { embedding } = await embeddingGenerator.getOrGenerateEmbedding(
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

    return NextResponse.json({
      success: true,
      query,
      results,
      total_results: results.length,
      search_params: { content_type, language, framework, limit, similarity_threshold }
    });
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

    for (const query of queries) {
      const { embedding } = await embeddingGenerator.getOrGenerateEmbedding(
        query,
        content_type || 'code'
      );

      const results = await vectorSearch.similaritySearch(embedding, {
        content_type,
        language,
        framework,
        limit
      });

      batchResults.push({
        query,
        results,
        total_results: results.length
      });
    }

    return NextResponse.json({
      success: true,
      batch_results: batchResults,
      total_queries: queries.length
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
  const action = request.nextUrl.searchParams.get('action');

  if (action === 'stats') {
    const vectorSearch = new VectorSearchService();
    try {
      const stats = await vectorSearch.getStats();
      return NextResponse.json({
        success: true,
        stats
      });
    } finally {
      await vectorSearch.close();
    }
  }

  return NextResponse.json({
    success: true,
    message: 'VibeCode Vector Search API',
    endpoints: {
      'POST /api/vector-search?action=search': 'Semantic similarity search',
      'POST /api/vector-search?action=store': 'Store new embedding',
      'POST /api/vector-search?action=batch-search': 'Batch similarity search',
      'POST /api/vector-search?action=hybrid-search': 'Advanced hybrid search',
      'GET /api/vector-search?action=stats': 'Get database statistics'
    },
    version: '1.0.0'
  });
}
