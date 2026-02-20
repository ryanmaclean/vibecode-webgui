/**
 * AI Quality Rating API Route
 * Handles thumbs up/down user ratings for AI suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQualityTracker } from '@/lib/ai/quality-tracker';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { appLogger } from '@/lib/server-monitoring';
import { z } from 'zod';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'ai-quality-rating' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(30); // 30 requests per minute

// ============================================================================
// Validation Schema
// ============================================================================

const ratingSchema = z.object({
  suggestionId: z.string().min(1, 'Suggestion ID is required'),
  rating: z.enum(['up', 'down'], {
    errorMap: () => ({ message: 'Rating must be "up" or "down"' }),
  }),
  comment: z.string().optional(),
  modelId: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type RatingRequest = z.infer<typeof ratingSchema>;

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/ai/quality/rate
 * Submit a thumbs up/down rating for an AI suggestion
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

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

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ratingSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid rating request', {
        requestId,
        errors: validation.error.issues,
      });

      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const data: RatingRequest = validation.data;
    const tracker = getQualityTracker();
    const userId = session.user.id || session.user.email || 'unknown';

    // Convert thumbs up/down to 1-5 scale for storage
    // up = 5 (excellent), down = 1 (poor)
    const numericRating = data.rating === 'up' ? 5 : 1;

    // Track the rating
    await tracker.trackRating(data.suggestionId, {
      rating: numericRating,
      comment: data.comment,
      userId,
    });

    // Log business event
    appLogger.logBusiness('ai_suggestion_thumbs_rated', {
      feature: 'ai-quality',
      userId,
      metadata: {
        suggestionId: data.suggestionId,
        rating: data.rating,
        numericRating,
        modelId: data.modelId,
        hasComment: !!data.comment,
      },
    });

    logger.info('Thumbs rating tracked', {
      requestId,
      suggestionId: data.suggestionId,
      rating: data.rating,
      numericRating,
      userId,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        suggestionId: data.suggestionId,
        rating: data.rating,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Quality rating API POST error', {
      requestId,
      error,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
