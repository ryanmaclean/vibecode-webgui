/**
 * AI Model Comparison API Route
 *
 * POST /api/ai/models/compare - Compare multiple models
 */

import { NextRequest, NextResponse } from 'next/server';
import { modelRegistry } from '@/lib/ai/models/model-registry';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { z } from '@/lib/zod-compat';
import type { ComparisonCriteria, DEFAULT_COMPARISON_CRITERIA } from '@/types/model-comparison';

export const dynamic = 'force-dynamic'

// Rate limiting: 60 requests per minute for comparison operations
const apiRateLimit = createAPIRateLimit(60);

// Validation schema
const compareSchema = z.object({
  modelIds: z.array(z.string()).min(2).max(6),
  criteria: z.object({
    cost: z.number().min(0).max(1).optional(),
    speed: z.number().min(0).max(1).optional(),
    quality: z.number().min(0).max(1).optional(),
    context_size: z.number().min(0).max(1).optional(),
  }).optional(),
});

/**
 * POST /api/ai/models/compare
 * Compare multiple models with customizable criteria
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

    // Parse and validate request body
    const body = await request.json();
    const validation = compareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid comparison parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { modelIds, criteria } = validation.data;

    // Default criteria
    const comparisonCriteria: ComparisonCriteria = {
      cost: criteria?.cost ?? 0.25,
      speed: criteria?.speed ?? 0.2,
      quality: criteria?.quality ?? 0.35,
      context_size: criteria?.context_size ?? 0.2,
    };

    // Normalize criteria weights to sum to 1
    const total = comparisonCriteria.cost + comparisonCriteria.speed +
                  comparisonCriteria.quality + comparisonCriteria.context_size;
    if (total > 0) {
      comparisonCriteria.cost /= total;
      comparisonCriteria.speed /= total;
      comparisonCriteria.quality /= total;
      comparisonCriteria.context_size /= total;
    }

    // Try to load fresh data from OpenRouter (non-blocking)
    modelRegistry.loadFromOpenRouter().catch(() => {
      // Silently fail - use cached data
    });

    // Compare models
    try {
      const result = modelRegistry.compareModels(modelIds, comparisonCriteria);

      // Format response
      const formattedModels = result.models.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider.name,
        qualityTier: model.qualityTier,
        speedTier: model.performance.speedTier,
        pricing: {
          inputPer1K: model.pricing.inputPer1K,
          outputPer1K: model.pricing.outputPer1K,
          isFree: model.pricing.isFree,
        },
        limits: {
          contextWindow: model.limits.contextWindow,
          maxOutputTokens: model.limits.maxOutputTokens,
        },
        capabilities: {
          coding: model.capabilities.coding,
          reasoning: model.capabilities.reasoning,
          creative: model.capabilities.creative,
          math: model.capabilities.math,
          vision: model.capabilities.vision,
          function_calling: model.capabilities.function_calling,
        },
      }));

      return NextResponse.json({
        success: true,
        comparison: {
          models: formattedModels,
          scores: result.scores,
          recommendation: result.recommendation,
          recommendationReason: result.recommendationReason,
          criteria: result.criteria,
          generatedAt: result.generatedAt,
          summary: result.summary,
        },
      });
    } catch (compareError) {
      // Check for specific errors
      if (compareError instanceof Error && compareError.message.includes('No valid models')) {
        return NextResponse.json(
          {
            success: false,
            error: 'One or more model IDs are invalid',
            invalidIds: modelIds.filter(id => !modelRegistry.getModelById(id)),
          },
          { status: 400 }
        );
      }
      throw compareError;
    }
  } catch (error) {
    console.error('Error comparing models:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare models',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/models/compare
 * Get comparison between models specified in query params
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

    const { searchParams } = new URL(request.url);
    const modelsParam = searchParams.get('models');

    if (!modelsParam) {
      return NextResponse.json(
        { error: 'Missing required "models" query parameter. Use comma-separated model IDs.' },
        { status: 400 }
      );
    }

    const modelIds = modelsParam.split(',').map(id => decodeURIComponent(id.trim()));

    if (modelIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 model IDs are required for comparison' },
        { status: 400 }
      );
    }

    if (modelIds.length > 6) {
      return NextResponse.json(
        { error: 'Maximum 6 models can be compared at once' },
        { status: 400 }
      );
    }

    // Parse optional criteria
    const criteria: ComparisonCriteria = {
      cost: parseFloat(searchParams.get('cost') || '0.25'),
      speed: parseFloat(searchParams.get('speed') || '0.2'),
      quality: parseFloat(searchParams.get('quality') || '0.35'),
      context_size: parseFloat(searchParams.get('context_size') || '0.2'),
    };

    // Try to load fresh data from OpenRouter (non-blocking)
    modelRegistry.loadFromOpenRouter().catch(() => {
      // Silently fail - use cached data
    });

    try {
      const result = modelRegistry.compareModels(modelIds, criteria);

      return NextResponse.json({
        success: true,
        comparison: {
          models: result.models.map(m => ({
            id: m.id,
            name: m.name,
            provider: m.provider.name,
            qualityTier: m.qualityTier,
          })),
          scores: result.scores,
          recommendation: result.recommendation,
          recommendationReason: result.recommendationReason,
          summary: result.summary,
        },
      });
    } catch (compareError) {
      if (compareError instanceof Error && compareError.message.includes('No valid models')) {
        return NextResponse.json(
          {
            success: false,
            error: 'One or more model IDs are invalid',
          },
          { status: 400 }
        );
      }
      throw compareError;
    }
  } catch (error) {
    console.error('Error comparing models:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare models',
      },
      { status: 500 }
    );
  }
}
