/**
 * AI Context Metrics API endpoint for VibeCode
 *
 * Handles context window metrics and quality tracking:
 * - GET /api/ai/context/metrics - Get aggregated metrics for all sessions or specific session
 * - GET /api/ai/context/metrics?sessionId=xxx - Get metrics for specific session
 * - GET /api/ai/context/metrics?action=summary - Get global metrics summary
 * - GET /api/ai/context/metrics?action=export&sessionId=xxx - Export all metrics for session
 *
 * @module app/api/ai/context/metrics/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  getAggregatedMetrics,
  getLatestSnapshot,
  getContextEvents,
  getContextSnapshots,
  getGlobalMetricsSummary,
  exportMetrics,
  getAllSessionIds,
  getMetricsThresholds,
} from '@/lib/ai/context/context-metrics';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const metricsQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
  action: z.enum(['summary', 'export', 'latest', 'events', 'snapshots']).optional(),
  since: z.string().datetime().optional().transform((v) => v ? new Date(v) : undefined),
  limit: z.coerce.number().min(1).max(1000).optional(),
  type: z.enum([
    'context_built',
    'context_optimized',
    'item_added',
    'item_removed',
    'item_evicted',
    'rerank_performed',
    'strategy_changed',
    'model_switched'
  ]).optional(),
});

// ============================================================================
// Response Types
// ============================================================================

interface ContextMetricsApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  timestamp: string;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const rawParams = {
      sessionId: searchParams.get('sessionId'),
      action: searchParams.get('action'),
      since: searchParams.get('since'),
      limit: searchParams.get('limit'),
      type: searchParams.get('type'),
    };

    const validation = metricsQuerySchema.safeParse(rawParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { sessionId, action, since, limit, type } = validation.data;

    // Log request
    logger.info('Context Metrics API GET request', {
      action,
      sessionId,
      requestId,
      endpoint: '/api/ai/context/metrics',
    });

    // Handle global summary action
    if (action === 'summary') {
      const summary = getGlobalMetricsSummary();

      const response: ContextMetricsApiResponse = {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      };

      logger.info('Global metrics summary retrieved', {
        requestId,
        totalSessions: summary.totalSessions,
        totalEvents: summary.totalEvents,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Handle export action
    if (action === 'export') {
      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Session ID required for export action',
          },
          { status: 400 }
        );
      }

      const exported = exportMetrics(sessionId);

      const response: ContextMetricsApiResponse = {
        success: true,
        data: exported,
        timestamp: new Date().toISOString(),
      };

      logger.info('Metrics exported', {
        requestId,
        sessionId,
        eventCount: exported.events.length,
        snapshotCount: exported.snapshots.length,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Handle latest snapshot action
    if (action === 'latest') {
      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Session ID required for latest action',
          },
          { status: 400 }
        );
      }

      const latestSnapshot = getLatestSnapshot(sessionId);

      if (!latestSnapshot) {
        return NextResponse.json(
          {
            success: false,
            error: 'No snapshots found for session',
            message: `Session '${sessionId}' has no recorded snapshots`,
          },
          { status: 404 }
        );
      }

      const response: ContextMetricsApiResponse = {
        success: true,
        data: latestSnapshot,
        timestamp: new Date().toISOString(),
      };

      logger.info('Latest snapshot retrieved', {
        requestId,
        sessionId,
        totalTokens: latestSnapshot.totalTokens,
        utilizationPercent: latestSnapshot.utilizationPercent,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Handle events action
    if (action === 'events') {
      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Session ID required for events action',
          },
          { status: 400 }
        );
      }

      const events = getContextEvents(sessionId, {
        type,
        since,
        limit,
      });

      const response: ContextMetricsApiResponse = {
        success: true,
        data: {
          events,
          count: events.length,
          sessionId,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Context events retrieved', {
        requestId,
        sessionId,
        eventCount: events.length,
        eventType: type,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Handle snapshots action
    if (action === 'snapshots') {
      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Session ID required for snapshots action',
          },
          { status: 400 }
        );
      }

      const snapshots = getContextSnapshots(sessionId, {
        since,
        limit,
      });

      const response: ContextMetricsApiResponse = {
        success: true,
        data: {
          snapshots,
          count: snapshots.length,
          sessionId,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Context snapshots retrieved', {
        requestId,
        sessionId,
        snapshotCount: snapshots.length,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }

    // Default: Return aggregated metrics for session or all sessions
    if (sessionId) {
      // Get metrics for specific session
      const aggregated = getAggregatedMetrics(sessionId, { since });

      if (!aggregated) {
        return NextResponse.json(
          {
            success: false,
            error: 'No metrics found for session',
            message: `Session '${sessionId}' has no recorded metrics`,
          },
          { status: 404 }
        );
      }

      const response: ContextMetricsApiResponse = {
        success: true,
        data: {
          aggregated,
          thresholds: getMetricsThresholds(),
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Session metrics retrieved', {
        requestId,
        sessionId,
        contextBuilds: aggregated.contextBuilds,
        averageUtilization: aggregated.averageUtilization.toFixed(2),
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    } else {
      // Get metrics for all sessions
      const allSessionIds = getAllSessionIds();
      const allMetrics = allSessionIds
        .map((id) => getAggregatedMetrics(id, { since }))
        .filter((m) => m !== null);

      const response: ContextMetricsApiResponse = {
        success: true,
        data: {
          metrics: allMetrics,
          sessionCount: allMetrics.length,
          thresholds: getMetricsThresholds(),
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('All session metrics retrieved', {
        requestId,
        sessionCount: allMetrics.length,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(response);
    }
  } catch (error) {
    logger.error('Context Metrics API GET error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process metrics request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
