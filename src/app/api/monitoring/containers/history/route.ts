/**
 * Container History API Endpoint
 * Provides historical time-series data for container resource metrics
 *
 * SECURITY: Authentication and rate limiting enforced
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth';
import { containerMetricsService } from '@/lib/monitoring/container-metrics';
import { cache, CacheTTL } from '@/lib/cache/unified-cache-client';
import { createAPIRateLimit } from '@/lib/rate-limiting';

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(120); // 120 requests per minute - monitoring data

/**
 * GET /api/monitoring/containers/history
 *
 * Query Parameters:
 * - container: Container name (required)
 * - metric: Metric type - cpu, memory, network_rx, network_tx, storage (required)
 * - duration: Time range - e.g., "1h", "30m", "1d" (optional, default: "1h")
 * - step: Data point interval - e.g., "1m", "5m" (optional, default: "1m")
 * - skip_cache: Skip cache and fetch fresh data (optional, default: false)
 *
 * Response:
 * {
 *   container: string,
 *   metric: string,
 *   datapoints: Array<{ timestamp: number, value: number }>,
 *   startTime: number,
 *   endTime: number,
 *   duration: string,
 *   step: string,
 *   total_datapoints: number,
 *   from_cache: boolean,
 *   timestamp: string
 * }
 */
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

  // Check authentication - only admins can view container metrics
  const auth = await checkMonitoringAuth(request);
  if (!auth.isAuthorized) {
    return getUnauthorizedResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const containerName = searchParams.get('container');
    const metric = searchParams.get('metric');
    const duration = searchParams.get('duration') || '1h';
    const step = searchParams.get('step') || '1m';
    const skipCache = searchParams.get('skip_cache') === 'true';

    // Validate required parameters
    if (!containerName) {
      return NextResponse.json({
        error: 'Missing required parameter: container',
        message: 'Container name must be specified',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (!metric) {
      return NextResponse.json({
        error: 'Missing required parameter: metric',
        message: 'Metric type must be specified (cpu, memory, network_rx, network_tx, storage)',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Validate metric type
    const validMetrics = ['cpu', 'memory', 'network_rx', 'network_tx', 'storage'];
    if (!validMetrics.includes(metric)) {
      return NextResponse.json({
        error: 'Invalid metric type',
        message: `Metric must be one of: ${validMetrics.join(', ')}`,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Cache key for historical data
    const cacheKey = `monitoring:containers:history:${containerName}:${metric}:${duration}:${step}`;

    // Try cache first for faster response times
    if (!skipCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached,
          from_cache: true,
          cache_hit: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    const startTime = Date.now();

    // Fetch historical metrics
    const history = await containerMetricsService.getContainerHistory(
      containerName,
      metric as 'cpu' | 'memory' | 'network_rx' | 'network_tx' | 'storage',
      duration,
      step
    );

    const processingTime = Date.now() - startTime;

    // Calculate statistics for the datapoints
    const values = history.datapoints.map(dp => dp.value);
    const statistics = values.length > 0 ? {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      current: values[values.length - 1] || 0,
    } : {
      min: 0,
      max: 0,
      avg: 0,
      current: 0,
    };

    // Build response
    const response = {
      container: history.container,
      metric: history.metric,
      datapoints: history.datapoints,
      startTime: history.startTime,
      endTime: history.endTime,
      duration,
      step,
      total_datapoints: history.datapoints.length,
      statistics: {
        min: Math.round(statistics.min * 100) / 100,
        max: Math.round(statistics.max * 100) / 100,
        avg: Math.round(statistics.avg * 100) / 100,
        current: Math.round(statistics.current * 100) / 100,
      },
      from_cache: false,
      cache_hit: false,
      timestamp: new Date().toISOString(),
      performance: {
        processing_time_ms: processingTime,
        cache_enabled: !skipCache,
      }
    };

    // Cache the response for 30 seconds (balance between freshness and performance)
    if (!skipCache && history.datapoints.length > 0) {
      await cache.set(cacheKey, response, CacheTTL.SHORT / 2); // 30 seconds
    }

    return NextResponse.json(response);

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch container history',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
