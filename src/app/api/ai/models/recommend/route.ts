/**
 * AI Model Recommendation API Route
 *
 * POST /api/ai/models/recommend - Get model recommendations based on task
 * GET /api/ai/models/recommend - Quick recommendations via query params
 */

import { NextRequest, NextResponse } from 'next/server';
import { modelRegistry } from '@/lib/ai/models/model-registry';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { z } from '@/lib/zod-compat';
import type { RecommendationRequest, TaskType } from '@/types/model-comparison';

export const dynamic = 'force-dynamic'

// Rate limiting: 60 requests per minute
const apiRateLimit = createAPIRateLimit(60);

// Validation schema
const recommendationSchema = z.object({
  taskType: z.enum([
    'code_generation', 'code_review', 'debugging', 'chat', 'analysis',
    'creative_writing', 'summarization', 'translation', 'math', 'research', 'general'
  ]),
  estimatedInputTokens: z.number().int().positive().optional(),
  estimatedOutputTokens: z.number().int().positive().optional(),
  budget: z.object({
    maxCostPerRequest: z.number().optional(),
    maxMonthlyCost: z.number().optional(),
  }).optional(),
  speedRequirement: z.enum(['any', 'fast', 'very_fast']).optional(),
  qualityRequirement: z.enum(['any', 'good', 'excellent', 'state_of_art']).optional(),
  needsVision: z.boolean().optional(),
  needsFunctionCalling: z.boolean().optional(),
  preferredProviders: z.array(z.string()).optional(),
  excludeModels: z.array(z.string()).optional(),
});

/**
 * POST /api/ai/models/recommend
 * Get model recommendations based on detailed requirements
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
    const validation = recommendationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid recommendation parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Try to load fresh data from OpenRouter (non-blocking)
    modelRegistry.loadFromOpenRouter().catch(() => {
      // Silently fail - use cached data
    });

    // Get recommendation
    const recommendation = modelRegistry.getRecommendation(validation.data as RecommendationRequest);

    return NextResponse.json({
      success: true,
      recommendation: {
        model: {
          id: recommendation.model.id,
          name: recommendation.model.name,
          description: recommendation.model.description,
          provider: {
            id: recommendation.model.provider.id,
            name: recommendation.model.provider.name,
            tier: recommendation.model.provider.tier,
          },
          qualityTier: recommendation.model.qualityTier,
          speedTier: recommendation.model.performance.speedTier,
          pricing: {
            inputPer1K: recommendation.model.pricing.inputPer1K,
            outputPer1K: recommendation.model.pricing.outputPer1K,
            isFree: recommendation.model.pricing.isFree,
          },
          limits: {
            contextWindow: recommendation.model.limits.contextWindow,
            maxOutputTokens: recommendation.model.limits.maxOutputTokens,
          },
          capabilities: {
            coding: recommendation.model.capabilities.coding,
            reasoning: recommendation.model.capabilities.reasoning,
            creative: recommendation.model.capabilities.creative,
            math: recommendation.model.capabilities.math,
            vision: recommendation.model.capabilities.vision,
            function_calling: recommendation.model.capabilities.function_calling,
            streaming: recommendation.model.capabilities.streaming,
          },
        },
        confidence: recommendation.confidence,
        reason: recommendation.reason,
        estimatedCost: recommendation.estimatedCost,
        alternatives: recommendation.alternatives.map(alt => ({
          model: {
            id: alt.model.id,
            name: alt.model.name,
            provider: alt.model.provider.name,
            qualityTier: alt.model.qualityTier,
            pricing: {
              inputPer1K: alt.model.pricing.inputPer1K,
              outputPer1K: alt.model.pricing.outputPer1K,
            },
          },
          reason: alt.reason,
          tradeoffs: alt.tradeoffs,
        })),
      },
      meta: {
        taskType: validation.data.taskType,
        totalModelsEvaluated: modelRegistry.getModelCount(),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating recommendation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendation',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/models/recommend
 * Quick recommendations via query parameters
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

    // Parse query parameters
    const taskType = searchParams.get('task') || 'general';
    const validTaskTypes = [
      'code_generation', 'code_review', 'debugging', 'chat', 'analysis',
      'creative_writing', 'summarization', 'translation', 'math', 'research', 'general'
    ];

    if (!validTaskTypes.includes(taskType)) {
      return NextResponse.json(
        {
          error: 'Invalid task type',
          validTaskTypes,
        },
        { status: 400 }
      );
    }

    // Build recommendation request from query params
    const recommendationRequest: RecommendationRequest = {
      taskType: taskType as TaskType,
    };

    if (searchParams.has('tokens')) {
      const tokens = parseInt(searchParams.get('tokens') || '1000', 10);
      recommendationRequest.estimatedInputTokens = tokens;
      recommendationRequest.estimatedOutputTokens = Math.round(tokens / 2);
    }

    if (searchParams.has('speed')) {
      const speed = searchParams.get('speed');
      if (speed === 'fast' || speed === 'very_fast') {
        recommendationRequest.speedRequirement = speed;
      }
    }

    if (searchParams.has('quality')) {
      const quality = searchParams.get('quality');
      if (['good', 'excellent', 'state_of_art'].includes(quality || '')) {
        recommendationRequest.qualityRequirement = quality as 'good' | 'excellent' | 'state_of_art';
      }
    }

    if (searchParams.get('vision') === 'true') {
      recommendationRequest.needsVision = true;
    }

    if (searchParams.get('functions') === 'true') {
      recommendationRequest.needsFunctionCalling = true;
    }

    if (searchParams.has('maxCost')) {
      recommendationRequest.budget = {
        maxCostPerRequest: parseFloat(searchParams.get('maxCost') || '0.1'),
      };
    }

    if (searchParams.has('providers')) {
      recommendationRequest.preferredProviders = searchParams.get('providers')?.split(',');
    }

    // Try to load fresh data from OpenRouter (non-blocking)
    modelRegistry.loadFromOpenRouter().catch(() => {
      // Silently fail - use cached data
    });

    // Get recommendation
    const recommendation = modelRegistry.getRecommendation(recommendationRequest);

    // Return simplified response for GET
    return NextResponse.json({
      success: true,
      recommendation: {
        modelId: recommendation.model.id,
        modelName: recommendation.model.name,
        provider: recommendation.model.provider.name,
        confidence: recommendation.confidence,
        reason: recommendation.reason,
        estimatedCost: recommendation.estimatedCost,
        alternatives: recommendation.alternatives.slice(0, 3).map(alt => ({
          modelId: alt.model.id,
          modelName: alt.model.name,
          reason: alt.reason,
        })),
      },
    });
  } catch (error) {
    console.error('Error generating quick recommendation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendation',
      },
      { status: 500 }
    );
  }
}
