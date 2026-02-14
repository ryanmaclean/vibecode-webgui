/**
 * AI Model Detail API Route
 *
 * GET /api/ai/models/[id] - Get details for a specific model
 */

import { NextRequest, NextResponse } from 'next/server';
import { modelRegistry } from '@/lib/ai/models/model-registry';
import { createAPIRateLimit } from '@/lib/rate-limiting';

export const dynamic = 'force-dynamic'

// Rate limiting: 120 requests per minute
const apiRateLimit = createAPIRateLimit(120);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ai/models/[id]
 * Get details for a specific model by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get model ID from route params
    const resolvedParams = await params;
    const modelId = decodeURIComponent(resolvedParams.id);

    // Try to load fresh data from OpenRouter (non-blocking)
    modelRegistry.loadFromOpenRouter().catch(() => {
      // Silently fail - use cached data
    });

    // Get model by ID
    const model = modelRegistry.getModelById(modelId);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: 'Model not found',
          modelId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      model: {
        id: model.id,
        name: model.name,
        description: model.description,
        family: model.family,
        provider: {
          id: model.provider.id,
          name: model.provider.name,
          tier: model.provider.tier,
          available: model.provider.available,
        },
        capabilities: model.capabilities,
        pricing: model.pricing,
        performance: model.performance,
        limits: model.limits,
        benchmarks: model.benchmarks,
        qualityTier: model.qualityTier,
        tags: model.tags,
        releaseDate: model.releaseDate,
        deprecated: model.deprecated,
        replacementModelId: model.replacementModelId,
      },
    });
  } catch (error) {
    console.error('Error fetching model details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch model details',
      },
      { status: 500 }
    );
  }
}
