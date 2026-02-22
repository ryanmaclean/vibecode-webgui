/**
 * Container Monitoring API Endpoint
 * Provides real-time container resource metrics (CPU, memory, network, storage)
 *
 * SECURITY: Authentication and rate limiting enforced
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth';
import { containerMetricsService, ContainerMetrics } from '@/lib/monitoring/container-metrics';
import { cache, CacheTTL } from '@/lib/cache/unified-cache-client';
import { createAPIRateLimit } from '@/lib/rate-limiting';

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(120); // 120 requests per minute - monitoring data

/**
 * GET /api/monitoring/containers
 *
 * Query Parameters:
 * - name: Filter by specific container name (optional)
 * - timeRange: Not used for real-time endpoint, but accepted for API consistency
 * - skip_cache: Skip cache and fetch fresh data (optional, default: false)
 *
 * Response:
 * {
 *   containers: ContainerMetrics[],
 *   timestamp: string,
 *   total: number,
 *   from_cache: boolean
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
    const containerName = searchParams.get('name');
    const skipCache = searchParams.get('skip_cache') === 'true';

    // Cache key for container data
    const cacheKey = containerName
      ? `monitoring:containers:${containerName}`
      : 'monitoring:containers:all';

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
    let containers: ContainerMetrics[];

    // Fetch metrics - either for specific container or all containers
    if (containerName) {
      const containerMetric = await containerMetricsService.getContainerMetricsByName(containerName);
      containers = containerMetric ? [containerMetric] : [];
    } else {
      containers = await containerMetricsService.getContainerMetrics();
    }

    const processingTime = Date.now() - startTime;

    // Calculate resource alerts (containers approaching limits)
    const alerts = containers
      .filter(c => c.cpuPercent > 80 || c.memoryPercent > 80)
      .map(c => ({
        container: c.name,
        severity: (c.cpuPercent > 90 || c.memoryPercent > 90) ? 'critical' : 'warning',
        metrics: {
          cpu: c.cpuPercent > 80 ? { current: c.cpuPercent, threshold: 80 } : undefined,
          memory: c.memoryPercent > 80 ? { current: c.memoryPercent, threshold: 80 } : undefined,
        }
      }));

    // Calculate summary statistics
    const summary = {
      total: containers.length,
      running: containers.filter(c => c.state === 'running').length,
      avgCpuPercent: containers.length > 0
        ? Math.round(containers.reduce((sum, c) => sum + c.cpuPercent, 0) / containers.length)
        : 0,
      avgMemoryPercent: containers.length > 0
        ? Math.round(containers.reduce((sum, c) => sum + c.memoryPercent, 0) / containers.length)
        : 0,
      totalMemoryUsage: containers.reduce((sum, c) => sum + c.memoryUsage, 0),
      totalNetworkRx: containers.reduce((sum, c) => sum + c.networkRxBytes, 0),
      totalNetworkTx: containers.reduce((sum, c) => sum + c.networkTxBytes, 0),
    };

    // Build response
    const response = {
      containers: containers.map(c => ({
        ...c,
        // Convert bytes to human-readable format in metadata
        _metadata: {
          memoryUsageMB: Math.round(c.memoryUsage / 1024 / 1024),
          memoryLimitMB: Math.round(c.memoryLimit / 1024 / 1024),
          networkRxKBps: Math.round(c.networkRxBytes / 1024),
          networkTxKBps: Math.round(c.networkTxBytes / 1024),
          storageUsageMB: Math.round(c.storageUsage / 1024 / 1024),
        }
      })),
      timestamp: new Date().toISOString(),
      total: containers.length,
      summary,
      alerts,
      from_cache: false,
      cache_hit: false,
      performance: {
        processing_time_ms: processingTime,
        cache_enabled: !skipCache,
      }
    };

    // Cache the response for 30 seconds (balance between freshness and performance)
    if (!skipCache && containers.length > 0) {
      await cache.set(cacheKey, response, CacheTTL.SHORT / 2); // 30 seconds
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to fetch container metrics:', error);

    return NextResponse.json({
      error: 'Failed to fetch container metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      containers: [],
      total: 0,
    }, { status: 500 });
  }
}

/**
 * HEAD /api/monitoring/containers
 * Health check endpoint for container metrics service
 */
export async function HEAD() {
  try {
    // Perform health check on container metrics service
    const health = await containerMetricsService.healthCheck();

    if (health.healthy) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 });
    }
  } catch (error) {
    console.error('Container metrics health check failed:', error);
    return new NextResponse(null, { status: 503 });
  }
}
