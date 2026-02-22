/**
 * AI Models API Route
 *
 * GET /api/ai/models - List all models with optional filtering
 * POST /api/ai/models/recommend - Get model recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { modelRegistry } from '@/lib/ai/models/model-registry';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { ollamaClient } from '@/lib/ollama-client';
import { z } from '@/lib/zod-compat';
import type {
  ModelSearchOptions,
  ModelFilterOptions,
  RecommendationRequest,
  QualityTier,
  SpeedTier,
  CapabilityCategory,
  TaskType,
} from '@/types/model-comparison';
import { cacheGetOrSet, CacheKeyGenerators, TTLPresets } from '@/lib/cache/cache-utils';
import { CACHE_HEADER_PRESETS } from '@/lib/cache/http-cache-headers';
import { createServiceLogger } from '@/lib/logging';

export const dynamic = 'force-dynamic'

// Rate limiting: 120 requests per minute for read-heavy operations
const apiRateLimit = createAPIRateLimit(120);
const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'ai-models' });

// Validation schemas
const filterSchema = z.object({
  providers: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  minQualityTier: z.enum(['basic', 'good', 'excellent', 'state_of_art']).optional(),
  minSpeedTier: z.enum(['slow', 'medium', 'fast', 'very_fast']).optional(),
  maxInputCost: z.number().optional(),
  maxOutputCost: z.number().optional(),
  minContextSize: z.number().optional(),
  requiresVision: z.boolean().optional(),
  requiresFunctionCalling: z.boolean().optional(),
  requiresStreaming: z.boolean().optional(),
  includeDeprecated: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const searchSchema = filterSchema.extend({
  query: z.string().optional(),
  sortBy: z.enum(['name', 'price', 'contextSize', 'quality', 'speed', 'relevance']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

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
 * GET /api/ai/models
 * List all models with optional filtering and pagination
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    // Check if provider is ollama - handle separately
    const provider = searchParams.get('provider');
    if (provider === 'ollama') {
      return handleOllamaModels();
    }

    const options: ModelSearchOptions = {};

    // Parse basic options
    if (searchParams.has('query')) {
      options.query = searchParams.get('query') || undefined;
    }
    if (searchParams.has('sortBy')) {
      options.sortBy = searchParams.get('sortBy') as ModelSearchOptions['sortBy'];
    }
    if (searchParams.has('sortDirection')) {
      options.sortDirection = searchParams.get('sortDirection') as ModelSearchOptions['sortDirection'];
    }
    if (searchParams.has('page')) {
      options.page = parseInt(searchParams.get('page') || '1', 10);
    }
    if (searchParams.has('pageSize')) {
      options.pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    }

    // Parse filter options
    if (searchParams.has('providers')) {
      options.providers = searchParams.get('providers')?.split(',');
    }
    if (searchParams.has('capabilities')) {
      options.capabilities = searchParams.get('capabilities')?.split(',') as CapabilityCategory[];
    }
    if (searchParams.has('minQualityTier')) {
      options.minQualityTier = searchParams.get('minQualityTier') as QualityTier;
    }
    if (searchParams.has('minSpeedTier')) {
      options.minSpeedTier = searchParams.get('minSpeedTier') as SpeedTier;
    }
    if (searchParams.has('maxInputCost')) {
      options.maxInputCost = parseFloat(searchParams.get('maxInputCost') || '0');
    }
    if (searchParams.has('maxOutputCost')) {
      options.maxOutputCost = parseFloat(searchParams.get('maxOutputCost') || '0');
    }
    if (searchParams.has('minContextSize')) {
      options.minContextSize = parseInt(searchParams.get('minContextSize') || '0', 10);
    }
    if (searchParams.has('requiresVision')) {
      options.requiresVision = searchParams.get('requiresVision') === 'true';
    }
    if (searchParams.has('requiresFunctionCalling')) {
      options.requiresFunctionCalling = searchParams.get('requiresFunctionCalling') === 'true';
    }
    if (searchParams.has('requiresStreaming')) {
      options.requiresStreaming = searchParams.get('requiresStreaming') === 'true';
    }
    if (searchParams.has('includeDeprecated')) {
      options.includeDeprecated = searchParams.get('includeDeprecated') === 'true';
    }
    if (searchParams.has('tags')) {
      options.tags = searchParams.get('tags')?.split(',');
    }

    // Validate options
    const validation = searchSchema.safeParse(options);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Determine cache key based on search parameters
    const paramsString = searchParams.toString();
    const cacheKey = paramsString
      ? CacheKeyGenerators.aiModelsWithParams(paramsString)
      : CacheKeyGenerators.aiModels();

    // Get from cache or compute fresh result
    const responseData = await cacheGetOrSet(
      cacheKey,
      async () => {
        // Try to load fresh data from OpenRouter (non-blocking)
        modelRegistry.loadFromOpenRouter().catch((error) => {
          logger.debug('modelRegistry.loadFromOpenRouter failed', { error });
        });

        // Search models
        const result = modelRegistry.searchModels(options);

        return {
          success: true,
          data: result,
          meta: {
            totalModels: modelRegistry.getModelCount(),
            providers: modelRegistry.getProviders().map(p => ({
              id: p.id,
              name: p.name,
              tier: p.tier,
              available: p.available,
            })),
            availableTags: modelRegistry.getAllTags(),
          },
        };
      },
      { ttl: TTLPresets.AI_MODELS }
    );

    return NextResponse.json(responseData, {
      headers: CACHE_HEADER_PRESETS.AI_MODELS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch Ollama models for registry
 */
async function handleOllamaModels() {
  try {
    const isAvailable = await ollamaClient.isAvailable();

    if (!isAvailable) {
      return NextResponse.json({
        success: true,
        data: {
          models: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        },
        meta: {
          provider: 'ollama',
          available: false,
          message: 'Ollama is not running',
        },
      });
    }

    const models = await ollamaClient.listModels();

    const formattedModels = models.map(model => ({
      id: `ollama:${model.name}`,
      name: model.name,
      provider: {
        id: 'ollama',
        name: 'Ollama',
        tier: 'local' as const,
        available: true,
      },
      modelId: model.model,
      size: model.size,
      sizeFormatted: ollamaClient.formatModelSize(model.size),
      family: model.details.family,
      format: model.details.format,
      parameterSize: model.details.parameter_size,
      quantization: model.details.quantization_level,
      modified: model.modified_at,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: false,
        vision: model.details.family?.includes('vision') || false,
      },
      performance: {
        speedTier: 'fast' as const,
        estimatedSpeed: ollamaClient.estimateInferenceTime(model.size, 100),
      },
      pricing: {
        inputCostPer1M: 0,
        outputCostPer1M: 0,
      },
      limits: {
        maxContextTokens: 4096,
        maxOutputTokens: 2048,
      },
      qualityTier: 'good' as const,
      tags: ['local', 'ollama', model.details.family].filter(Boolean),
    }));

    return NextResponse.json({
      success: true,
      data: {
        models: formattedModels,
        total: models.length,
        page: 1,
        pageSize: models.length,
        totalPages: 1,
      },
      meta: {
        provider: 'ollama',
        available: true,
        totalModels: models.length,
        totalSize: models.reduce((sum, model) => sum + model.size, 0),
        totalSizeFormatted: ollamaClient.formatModelSize(
          models.reduce((sum, model) => sum + model.size, 0)
        ),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Ollama models',
      data: {
        models: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      },
      meta: {
        provider: 'ollama',
        available: false,
      },
    });
  }
}

/**
 * POST /api/ai/models
 * Get model recommendations based on task requirements
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
    const action = body.action;

    if (action === 'recommend') {
      const validation = recommendationSchema.safeParse(body.params);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid recommendation parameters', details: validation.error.issues },
          { status: 400 }
        );
      }

      const recommendation = modelRegistry.getRecommendation(validation.data as RecommendationRequest);

      return NextResponse.json({
        success: true,
        recommendation: {
          model: {
            id: recommendation.model.id,
            name: recommendation.model.name,
            provider: recommendation.model.provider.name,
            qualityTier: recommendation.model.qualityTier,
            speedTier: recommendation.model.performance.speedTier,
            pricing: recommendation.model.pricing,
            limits: recommendation.model.limits,
          },
          confidence: recommendation.confidence,
          reason: recommendation.reason,
          estimatedCost: recommendation.estimatedCost,
          alternatives: recommendation.alternatives.map(alt => ({
            model: {
              id: alt.model.id,
              name: alt.model.name,
              provider: alt.model.provider.name,
            },
            reason: alt.reason,
            tradeoffs: alt.tradeoffs,
          })),
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "recommend" for recommendations.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing model request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    );
  }
}
