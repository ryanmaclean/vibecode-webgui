/**
 * Current Context State API Route
 *
 * GET /api/ai/context/current - Get current context window state
 */

import { NextRequest, NextResponse } from 'next/server';
import { getContextManager } from '@/lib/ai/context';
import { createAPIRateLimit } from '@/lib/rate-limiting';

export const dynamic = 'force-dynamic'

// Rate limiting: 120 requests per minute for read operations
const apiRateLimit = createAPIRateLimit(120);

/**
 * GET /api/ai/context/current
 * Get the current context window state and statistics
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

    // Get context manager instance
    const contextManager = getContextManager();

    // Get current window and stats
    const currentWindow = contextManager.getWindow();
    const stats = contextManager.getStats();

    // If no window exists, return empty state
    if (!currentWindow) {
      return NextResponse.json({
        success: true,
        data: {
          hasWindow: false,
          window: null,
          stats: {
            totalItems: 0,
            activeItems: 0,
            excludedItems: 0,
            totalTokens: 0,
            cacheHitRate: 0,
            averageRankingTimeMs: 0,
            updateCount: 0,
            lastUpdate: new Date()
          }
        }
      });
    }

    // Return current state
    return NextResponse.json({
      success: true,
      data: {
        hasWindow: true,
        window: {
          id: currentWindow.id,
          model: currentWindow.modelConfig.model,
          modelFamily: currentWindow.modelConfig.family,
          strategy: currentWindow.strategy,
          totalTokens: currentWindow.totalTokens,
          availableTokens: currentWindow.availableTokens,
          utilizationPercent: currentWindow.utilizationPercent,
          isAtCapacity: currentWindow.isAtCapacity,
          maxContextTokens: currentWindow.modelConfig.maxContextTokens,
          itemCount: currentWindow.items.length,
          excludedItemCount: currentWindow.excludedItems.length,
          estimatedCost: currentWindow.estimatedCost,
          createdAt: currentWindow.createdAt,
          updatedAt: currentWindow.updatedAt,
          rankingCriteria: currentWindow.rankingCriteria,
          items: currentWindow.items.map(item => ({
            id: item.id,
            type: item.type,
            tokenCount: item.tokenCount,
            priority: item.priority,
            relevanceScore: item.relevanceScore,
            recencyScore: item.recencyScore,
            combinedScore: item.combinedScore,
            isRequired: item.isRequired,
            addedAt: item.addedAt,
            metadata: {
              source: item.metadata.source,
              language: item.metadata.language,
              lineRange: item.metadata.lineRange,
              symbol: item.metadata.symbol,
              tags: item.metadata.tags
            }
          })),
          excludedItems: currentWindow.excludedItems.map(item => ({
            id: item.id,
            type: item.type,
            tokenCount: item.tokenCount,
            priority: item.priority,
            combinedScore: item.combinedScore,
            metadata: {
              source: item.metadata.source,
              language: item.metadata.language
            }
          }))
        },
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching current context state:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch current context state',
      },
      { status: 500 }
    );
  }
}
