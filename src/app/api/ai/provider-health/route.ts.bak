/**
 * AI Provider Health Check API Endpoint
 * Tests availability and latency of different AI providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedAI, AIProvider } from '@/lib/ai/enhanced-model-client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await request.json();

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Validate provider
    const validProviders: AIProvider[] = ['openrouter', 'azure-openai', 'anthropic', 'ollama', 'gemini', 'bedrock'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Check provider health
    const healthCheck = await enhancedAI.checkProviderHealth(provider);

    return NextResponse.json({
      provider,
      available: healthCheck.available,
      latency: healthCheck.latency,
      error: healthCheck.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Provider health check error:', error);
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
    console.error('Provider health check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get provider status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 