/**
 * AI Quality Tracking API Route
 * Handles tracking of AI suggestion events for quality metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQualityTracker } from '@/lib/ai/quality-tracker';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { appLogger } from '@/lib/server-monitoring';
import { z } from 'zod';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'ai-quality' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

// ============================================================================
// Validation Schemas
// ============================================================================

const baseSuggestionSchema = z.object({
  suggestionId: z.string().min(1),
  modelId: z.string().min(1),
  language: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const suggestionGeneratedSchema = z.object({
  event: z.literal('suggestion_generated'),
  modelId: z.string().min(1),
  suggestion: z.string().min(1),
  language: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const suggestionAcceptedSchema = baseSuggestionSchema.extend({
  event: z.literal('suggestion_accepted'),
  finalCode: z.string().min(1),
  timeToAccept: z.number().min(0),
  wasModified: z.boolean().optional(),
});

const suggestionRejectedSchema = baseSuggestionSchema.extend({
  event: z.literal('suggestion_rejected'),
  timeToReject: z.number().min(0),
  reason: z.enum(['irrelevant', 'incorrect', 'incomplete', 'style', 'other']).optional(),
});

const ratingSubmittedSchema = baseSuggestionSchema.extend({
  event: z.literal('rating_submitted'),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  comment: z.string().optional(),
});

const trackEventSchema = z.discriminatedUnion('event', [
  suggestionGeneratedSchema,
  suggestionAcceptedSchema,
  suggestionRejectedSchema,
  ratingSubmittedSchema,
]);

// ============================================================================
// POST Handler
// ============================================================================

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
    const validation = trackEventSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid tracking request', {
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

    const data = validation.data;
    const tracker = getQualityTracker();
    const userId = session.user.id || session.user.email || 'unknown';

    // Handle different event types
    switch (data.event) {
      case 'suggestion_generated': {
        const suggestionId = await tracker.trackSuggestion({
          modelId: data.modelId,
          suggestion: data.suggestion,
          language: data.language,
          userId,
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          context: data.metadata,
        });

        appLogger.logBusiness('ai_suggestion_tracked', {
          feature: 'ai-quality',
          userId,
          metadata: {
            suggestionId,
            modelId: data.modelId,
            language: data.language,
          },
        });

        logger.info('Suggestion tracked', {
          requestId,
          suggestionId,
          modelId: data.modelId,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            success: true,
            suggestionId,
            timestamp: new Date().toISOString(),
          },
          { status: 201 }
        );
      }

      case 'suggestion_accepted': {
        await tracker.trackAcceptance(data.suggestionId, {
          finalCode: data.finalCode,
          timeToAccept: data.timeToAccept,
          wasModified: data.wasModified,
        });

        appLogger.logBusiness('ai_suggestion_accepted', {
          feature: 'ai-quality',
          userId,
          metadata: {
            suggestionId: data.suggestionId,
            modelId: data.modelId,
            timeToAccept: data.timeToAccept,
          },
        });

        logger.info('Acceptance tracked', {
          requestId,
          suggestionId: data.suggestionId,
          modelId: data.modelId,
          timeToAccept: data.timeToAccept,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            success: true,
            timestamp: new Date().toISOString(),
          },
          { status: 201 }
        );
      }

      case 'suggestion_rejected': {
        await tracker.trackRejection(data.suggestionId, {
          timeToReject: data.timeToReject,
          reason: data.reason,
        });

        appLogger.logBusiness('ai_suggestion_rejected', {
          feature: 'ai-quality',
          userId,
          metadata: {
            suggestionId: data.suggestionId,
            modelId: data.modelId,
            reason: data.reason,
            timeToReject: data.timeToReject,
          },
        });

        logger.info('Rejection tracked', {
          requestId,
          suggestionId: data.suggestionId,
          modelId: data.modelId,
          reason: data.reason,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            success: true,
            timestamp: new Date().toISOString(),
          },
          { status: 201 }
        );
      }

      case 'rating_submitted': {
        await tracker.trackRating(data.suggestionId, {
          rating: data.rating,
          comment: data.comment,
          userId,
        });

        appLogger.logBusiness('ai_suggestion_rated', {
          feature: 'ai-quality',
          userId,
          metadata: {
            suggestionId: data.suggestionId,
            modelId: data.modelId,
            rating: data.rating,
          },
        });

        logger.info('Rating tracked', {
          requestId,
          suggestionId: data.suggestionId,
          modelId: data.modelId,
          rating: data.rating,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            success: true,
            timestamp: new Date().toISOString(),
          },
          { status: 201 }
        );
      }

      default: {
        // This should never happen due to discriminated union
        return NextResponse.json(
          { error: 'Invalid event type' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    logger.error('Quality tracking API POST error', {
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
