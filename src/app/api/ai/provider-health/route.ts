/**
 * AI Provider Health Check API Endpoint
 * Tests availability and latency of different AI providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedAI, AIProvider } from '@/lib/ai/enhanced-model-client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateRequestBody } from '@/lib/api/validation/middleware';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute - health checks

// Define inline schema since schemas-phase4-batch2 doesn't exist
const providerHealthCheckSchema = z.object({
  provider: z.enum(['openrouter', 'azure-openai', 'anthropic', 'ollama', 'gemini', 'bedrock'])
});

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
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const validation = await validateRequestBody(request, providerHealthCheckSchema);
    if (!validation.success) {
      return validation.error as NextResponse;
    }

    const { provider } = validation.data;

    // Check provider health
    const healthCheck = await enhancedAI.checkProviderHealth(provider as AIProvider);

    return NextResponse.json({
      provider,
      available: healthCheck.available,
      latency: healthCheck.latency,
      error: healthCheck.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { 
        error: 'Failed to check provider health',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
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
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all provider statistics
    const stats = enhancedAI.getProviderStats();

    // Check health for all configured providers
    const healthChecks = await Promise.allSettled(
      Object.keys(stats).map(async (provider) => {
        if (stats[provider as AIProvider].configured) {
          const health = await enhancedAI.checkProviderHealth(provider as AIProvider);
          return health;
        }
        return {
          available: false,
          error: 'Not configured'
        };
      })
    );

    const results = healthChecks.map((result, index) => {
      const provider = Object.keys(stats)[index] as AIProvider;
      return {
        provider,
        configured: stats[provider].configured,
        models: stats[provider].models,
        estimatedCostPer1kTokens: stats[provider].estimatedCostPer1kTokens,
        ...(result.status === 'fulfilled' ? result.value : { available: false, error: 'Health check failed' })
      };
    });

    return NextResponse.json({
      providers: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { 
        error: 'Failed to get provider status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 