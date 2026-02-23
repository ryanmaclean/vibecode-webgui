/**
 * Quality Dashboard Metrics API Endpoint
 * Provides comprehensive AI quality metrics and statistics
 *
 * Protected with monitoring authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth';
import { getQualityTracker } from '@/lib/ai/quality-tracker';
import { QualityReportGenerator } from '@/lib/ai/quality-reports';
import { prisma } from '@/lib/prisma';
import { cache, CacheTTL } from '@/lib/cache/unified-cache-client';
import { z, type ZodIssue } from 'zod';
import { createServiceLogger } from '@/lib/logging';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'quality-dashboard' });

export const dynamic = 'force-dynamic';

// ============================================================================
// Query Parameter Validation
// ============================================================================

const querySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
  modelIds: z.string().optional(), // Comma-separated model IDs
  includeAlerts: z.string().optional().transform(val => val === 'true').default('true'),
  includeTrends: z.string().optional().transform(val => val === 'true').default('true'),
  skipCache: z.string().optional().transform(val => val === 'true'),
});

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await checkMonitoringAuth(request);
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error);
  }

  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const params = querySchema.parse({
      period: searchParams.get('period') || undefined,
      modelIds: searchParams.get('modelIds') || undefined,
      includeAlerts: searchParams.get('includeAlerts') || undefined,
      includeTrends: searchParams.get('includeTrends') || undefined,
      skipCache: searchParams.get('skipCache') || undefined,
    });

    logger.info('[QualityDashboard] Fetching quality metrics', {
      params,
    });

    // Cache key for dashboard data
    const cacheKey = `monitoring:quality-dashboard:${params.period}:${params.modelIds || 'all'}:${params.includeAlerts}:${params.includeTrends}`;

    // Try cache first for faster dashboard load times
    if (!params.skipCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached,
          from_cache: true,
          cache_hit: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Parallel execution for optimal performance
    const startTime = Date.now();

    // Calculate time period
    const { start, end } = calculateTimePeriod(params.period);

    // Parse model IDs if provided
    const modelIds = params.modelIds
      ? params.modelIds.split(',').map(id => id.trim()).filter(Boolean)
      : undefined;

    // Fetch all data in parallel
    const [overallMetrics, modelStatistics, activeAlerts, recentActivity] = await Promise.allSettled([
      getOverallMetrics(start, end, modelIds),
      getModelStatistics(start, end, modelIds),
      params.includeAlerts ? getActiveAlerts(modelIds) : Promise.resolve([]),
      getRecentActivity(start, end, modelIds),
    ]);

    const processingTime = Date.now() - startTime;

    // Build response
    const response = {
      timestamp: new Date().toISOString(),
      period: params.period,
      time_period: { start, end },
      processing_time_ms: processingTime,
      from_cache: false,
      cache_hit: false,

      // Overall quality metrics
      overall: overallMetrics.status === 'fulfilled'
        ? overallMetrics.value
        : {
            total_suggestions: 0,
            accepted: 0,
            rejected: 0,
            pending: 0,
            acceptance_rate: 0,
            average_edit_distance: 0,
            average_similarity: 0,
            average_rating: 0,
            error: overallMetrics.reason?.message,
          },

      // Per-model statistics
      models: modelStatistics.status === 'fulfilled'
        ? modelStatistics.value
        : { error: modelStatistics.reason?.message },

      // Active quality alerts
      alerts: params.includeAlerts && activeAlerts.status === 'fulfilled'
        ? {
            active_count: activeAlerts.value.length,
            critical_count: activeAlerts.value.filter((a: any) => a.severity === 'critical').length,
            warning_count: activeAlerts.value.filter((a: any) => a.severity === 'warning').length,
            alerts: activeAlerts.value,
          }
        : { active_count: 0, critical_count: 0, warning_count: 0, alerts: [] },

      // Recent activity summary
      activity: recentActivity.status === 'fulfilled'
        ? recentActivity.value
        : {
            recent_suggestions_count: 0,
            recent_acceptances_count: 0,
            recent_rejections_count: 0,
            recent_ratings_count: 0,
            error: recentActivity.reason?.message,
          },

      // Performance metrics
      performance: {
        processing_time_ms: processingTime,
        parallel_execution: true,
        cache_enabled: !params.skipCache,
        queries_executed: 4,
      },
    };

    // Cache the response for 60 seconds (balance between freshness and performance)
    if (!params.skipCache) {
      await cache.set(cacheKey, response, CacheTTL.SHORT); // 60 seconds
    }

    logger.info('[QualityDashboard] Quality metrics fetched successfully', {
      totalSuggestions: response.overall.total_suggestions,
      activeAlerts: response.alerts.active_count,
      processingTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[QualityDashboard] Failed to fetch quality metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', '),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch quality metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate time period based on period type
 */
function calculateTimePeriod(
  period: 'day' | 'week' | 'month'
): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);

  switch (period) {
    case 'day':
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
  }

  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

/**
 * Get overall quality metrics
 */
async function getOverallMetrics(
  start: string,
  end: string,
  modelIds?: string[]
): Promise<{
  total_suggestions: number;
  accepted: number;
  rejected: number;
  pending: number;
  acceptance_rate: number;
  average_edit_distance: number;
  average_similarity: number;
  average_rating: number;
}> {
  const where: any = {
    timestamp: {
      gte: new Date(start),
      lte: new Date(end),
    },
  };

  if (modelIds && modelIds.length > 0) {
    where.model_id = { in: modelIds };
  }

  // Get counts by outcome
  const [total, accepted, rejected, pending, avgMetrics] = await Promise.all([
    prisma.aISuggestion.count({ where }),
    prisma.aISuggestion.count({ where: { ...where, outcome: 'accepted' } }),
    prisma.aISuggestion.count({ where: { ...where, outcome: 'rejected' } }),
    prisma.aISuggestion.count({ where: { ...where, outcome: 'pending' } }),
    prisma.aISuggestion.aggregate({
      where: { ...where, outcome: 'accepted' },
      _avg: {
        edit_distance: true,
        similarity: true,
        rating: true,
      },
    }),
  ]);

  const acceptanceRate = total > 0 ? (accepted / (accepted + rejected)) : 0;

  return {
    total_suggestions: total,
    accepted,
    rejected,
    pending,
    acceptance_rate: Math.round(acceptanceRate * 100) / 100,
    average_edit_distance: Math.round((avgMetrics._avg.edit_distance || 0) * 100) / 100,
    average_similarity: Math.round((avgMetrics._avg.similarity || 0) * 100) / 100,
    average_rating: Math.round((avgMetrics._avg.rating || 0) * 100) / 100,
  };
}

/**
 * Get per-model statistics
 */
async function getModelStatistics(
  start: string,
  end: string,
  modelIds?: string[]
): Promise<Record<string, any>> {
  const where: any = {
    timestamp: {
      gte: new Date(start),
      lte: new Date(end),
    },
  };

  if (modelIds && modelIds.length > 0) {
    where.model_id = { in: modelIds };
  }

  // Get all suggestions grouped by model
  const suggestions = await prisma.aISuggestion.groupBy({
    by: ['model_id', 'outcome'],
    where,
    _count: true,
    _avg: {
      edit_distance: true,
      similarity: true,
      rating: true,
      time_to_accept: true,
    },
  });

  // Aggregate by model
  const modelStats: Record<string, any> = {};

  for (const row of suggestions) {
    if (!modelStats[row.model_id]) {
      modelStats[row.model_id] = {
        model_id: row.model_id,
        total: 0,
        accepted: 0,
        rejected: 0,
        pending: 0,
        acceptance_rate: 0,
        avg_edit_distance: 0,
        avg_similarity: 0,
        avg_rating: 0,
        avg_time_to_accept: 0,
      };
    }

    const stats = modelStats[row.model_id];
    stats.total += row._count;

    if (row.outcome === 'accepted') {
      stats.accepted = row._count;
      stats.avg_edit_distance = Math.round((row._avg.edit_distance || 0) * 100) / 100;
      stats.avg_similarity = Math.round((row._avg.similarity || 0) * 100) / 100;
      stats.avg_rating = Math.round((row._avg.rating || 0) * 100) / 100;
      stats.avg_time_to_accept = Math.round((row._avg.time_to_accept || 0));
    } else if (row.outcome === 'rejected') {
      stats.rejected = row._count;
    } else if (row.outcome === 'pending') {
      stats.pending = row._count;
    }
  }

  // Calculate acceptance rates
  for (const modelId in modelStats) {
    const stats = modelStats[modelId];
    const decided = stats.accepted + stats.rejected;
    stats.acceptance_rate = decided > 0 ? Math.round((stats.accepted / decided) * 100) / 100 : 0;
  }

  return modelStats;
}

/**
 * Get active quality alerts
 */
async function getActiveAlerts(modelIds?: string[]): Promise<any[]> {
  try {
    const tracker = getQualityTracker();
    const alerts = await tracker.getActiveAlerts(
      modelIds && modelIds.length > 0 ? modelIds[0] : undefined
    );

    return alerts.map((alert: any) => ({
      id: alert.id,
      model_id: alert.model_id,
      alert_type: alert.alert_type,
      severity: alert.severity,
      message: alert.message,
      current_value: alert.current_value,
      threshold: alert.threshold,
      detected_at: alert.detected_at,
    }));
  } catch (error) {
    logger.error('[QualityDashboard] Failed to fetch active alerts', { error });
    return [];
  }
}

/**
 * Get recent activity summary
 */
async function getRecentActivity(
  start: string,
  end: string,
  modelIds?: string[]
): Promise<{
  recent_suggestions_count: number;
  recent_acceptances_count: number;
  recent_rejections_count: number;
  recent_ratings_count: number;
  last_24h_trend: string;
}> {
  const where: any = {
    timestamp: {
      gte: new Date(start),
      lte: new Date(end),
    },
  };

  if (modelIds && modelIds.length > 0) {
    where.model_id = { in: modelIds };
  }

  // Get recent activity
  const [totalCount, acceptedCount, rejectedCount, ratedCount] = await Promise.all([
    prisma.aISuggestion.count({ where }),
    prisma.aISuggestion.count({ where: { ...where, outcome: 'accepted' } }),
    prisma.aISuggestion.count({ where: { ...where, outcome: 'rejected' } }),
    prisma.aISuggestion.count({
      where: { ...where, rating: { not: null } },
    }),
  ]);

  // Get 24h trend comparison
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayCount = await prisma.aISuggestion.count({
    where: {
      ...where,
      timestamp: {
        gte: yesterday,
        lte: now,
      },
    },
  });

  const twoDaysAgo = new Date(yesterday);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);

  const previousDayCount = await prisma.aISuggestion.count({
    where: {
      ...where,
      timestamp: {
        gte: twoDaysAgo,
        lte: yesterday,
      },
    },
  });

  const trend =
    yesterdayCount > previousDayCount
      ? 'up'
      : yesterdayCount < previousDayCount
      ? 'down'
      : 'stable';

  return {
    recent_suggestions_count: totalCount,
    recent_acceptances_count: acceptedCount,
    recent_rejections_count: rejectedCount,
    recent_ratings_count: ratedCount,
    last_24h_trend: trend,
  };
}
