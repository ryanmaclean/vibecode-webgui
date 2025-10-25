/**
 * RAG Semantic Search API
 * POST /api/rag/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { ragSystem } from '@/lib/rag';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, threshold = 0.7, useCache = true } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: query string required' },
        { status: 400 }
      );
    }

    // Initialize RAG system if needed
    await ragSystem.initialize();

    // Search
    const results = await ragSystem.search(query, {
      limit,
      threshold,
      useCache
    });

    logger.info('Search completed via API', {
      query: query.substring(0, 50),
      resultCount: results.length
    });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error('Search API error', { error });
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
