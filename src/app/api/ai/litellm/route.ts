// LiteLLM API Routes for VibeCode
// ===============================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLiteLLMClient } from '@/lib/ai-clients/litellm-instance';
import rateLimit from '@/lib/rate-limiting';

// Create rate limiter for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each user to 100 requests per windowMs
});

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

// Rate limiting configuration
const _ratelimit = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// GET: Health check and system status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'health':
        const health = await getLiteLLMClient().checkHealth();
        return NextResponse.json({
          status: 'healthy',
          litellm: health,
          timestamp: new Date().toISOString()
        });

      case 'models':
        const models = await getLiteLLMClient().listModels();
        return NextResponse.json(models);

      case 'stats':
        const stats = await getLiteLLMClient().getUsageStats();
        return NextResponse.json(stats);

      case 'budget':
        const budget = await getLiteLLMClient().getBudgetInfo();
        return NextResponse.json(budget);

      case 'config':
        const config = getLiteLLMClient().getConfig();
        // Remove sensitive information
        const { apiKey: _apiKey, ...safeConfig } = config;
        return NextResponse.json(safeConfig);

      default:
        return NextResponse.json({
          service: 'LiteLLM Integration',
          version: '1.0.0',
          endpoints: [
            'POST /api/ai/litellm - Chat completions',
            'GET /api/ai/litellm?action=health - Health check',
            'GET /api/ai/litellm?action=models - List models',
            'GET /api/ai/litellm?action=stats - Usage statistics',
            'GET /api/ai/litellm?action=budget - Budget information'
          ]
        });
    }
  } catch (error) {
    console.error('[LiteLLM API] GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST: Chat completions and embeddings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await aiRateLimit(request);
    
    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetTime: rateLimitResult.reset
      }, { status: 429 });
    }

    const body = await request.json();
    const { action, ...requestData } = body;

    switch (action) {
      case 'chat':
        return await handleChatCompletion(requestData, session);

      case 'embedding':
        return await handleEmbedding(requestData, session);

      case 'stream':
        return await handleStreamingChat(requestData, session);

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['chat', 'embedding', 'stream']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[LiteLLM API] POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT: Update configuration
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json({
        error: 'Configuration object required'
      }, { status: 400 });
    }

    // Update client configuration (excluding sensitive fields)
    const safeConfig = {
      defaultModel: config.defaultModel,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      enableCaching: config.enableCaching,
      enableLogging: config.enableLogging
    };

    getLiteLLMClient().updateConfig(safeConfig);

    return NextResponse.json({
      message: 'Configuration updated successfully',
      config: getLiteLLMClient().getConfig()
    });

  } catch (error) {
    console.error('[LiteLLM API] PUT error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper Functions
// ===============

async function handleChatCompletion(requestData: any, session: any) {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      max_tokens,
      stream = false,
      ...otherParams
    } = requestData;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({
        error: 'Messages array is required'
      }, { status: 400 });
    }

    const chatRequest = {
      model,
      messages,
      temperature,
      max_tokens,
      stream,
      user: session.user?.email || 'anonymous',
      metadata: {
        session_id: session.user?.id,
        timestamp: new Date().toISOString(),
        source: 'vibecode-api'
      },
      ...otherParams
    };

    const response = await getLiteLLMClient().createChatCompletion(chatRequest);

    return NextResponse.json({
      ...response,
      vibecode_metadata: {
        processed_at: new Date().toISOString(),
        user_id: session.user?.id,
        request_id: generateRequestId()
      }
    });

  } catch (error) {
    console.error('[LiteLLM] Chat completion error:', error);
    throw error;
  }
}

async function handleEmbedding(requestData: any, session: any) {
  try {
    const {
      input,
      model = 'text-embedding-ada-002',
      encoding_format = 'float',
      dimensions
    } = requestData;

    if (!input) {
      return NextResponse.json({
        error: 'Input text is required'
      }, { status: 400 });
    }

    const embeddingRequest = {
      model,
      input,
      encoding_format,
      dimensions,
      user: session.user?.email || 'anonymous'
    };

    const response = await getLiteLLMClient().createEmbedding(embeddingRequest);

    return NextResponse.json({
      ...response,
      vibecode_metadata: {
        processed_at: new Date().toISOString(),
        user_id: session.user?.id,
        input_length: Array.isArray(input) ? input.length : 1
      }
    });

  } catch (error) {
    console.error('[LiteLLM] Embedding error:', error);
    throw error;
  }
}

async function handleStreamingChat(requestData: any, session: any) {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      max_tokens,
      ...otherParams
    } = requestData;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({
        error: 'Messages array is required'
      }, { status: 400 });
    }

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const chatRequest = {
          model,
          messages,
          temperature,
          max_tokens,
          stream: true,
          user: session.user?.email || 'anonymous',
          metadata: {
            session_id: session.user?.id,
            timestamp: new Date().toISOString(),
            source: 'vibecode-api-stream'
          },
          ...otherParams
        };

        getLiteLLMClient().createChatCompletionStream(
          chatRequest,
          (chunk) => {
            // Send chunk as Server-Sent Event
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
        ).then(() => {
          // Send completion signal
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }).catch((error) => {
          console.error('[LiteLLM] Streaming error:', error);
          const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      }
    });

  } catch (error) {
    console.error('[LiteLLM] Streaming setup error:', error);
    throw error;
  }
}

// Utility functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
} 
