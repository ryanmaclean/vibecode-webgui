/**
 * @description Azure Embedding Service Monitoring API - Provides comprehensive monitoring for Azure OpenAI embedding operations including rate limits, connection pool health, and API metrics. Supports both JSON and text output formats.
 * @route GET /api/monitoring/azure-embedding
 * @access Private (requires authentication, optionally admin-only)
 *
 * @param {NextRequest} req - Next.js request with query parameters:
 *   - format: 'json' | 'text' - Response format (default: 'json')
 *   - include: 'all' | 'pools' | 'api' | 'rate_limits' - Data to include (default: 'all')
 *
 * @returns {Response} Returns Azure embedding service metrics:
 *   - timestamp: string - Current timestamp
 *   - status: 'ok' | 'warning' - Service status
 *   - service: 'azure_embedding' - Service identifier
 *   - rateLimits: { remaining, max, utilizationPercentage, isApproachingLimit, resetTimestamp } - Rate limit info
 *   - connectionPools: { total, healthy, warning, critical, overallStatus, pools } - Pool health
 *
 * @example
 * // GET Request - All metrics (JSON)
 * GET /api/monitoring/azure-embedding?include=all&format=json
 * Headers: { Authorization: "Bearer <token>" }
 *
 * // Response
 * {
 *   "timestamp": "2025-10-01T00:00:00.000Z",
 *   "status": "ok",
 *   "service": "azure_embedding",
 *   "rateLimits": {
 *     "remaining": 8500,
 *     "max": 10000,
 *     "utilizationPercentage": 15,
 *     "isApproachingLimit": false
 *   },
 *   "connectionPools": {
 *     "total": 3,
 *     "healthy": 3,
 *     "overallStatus": "healthy",
 *     "pools": [...]
 *   }
 * }
 *
 * // GET Request - Text format
 * GET /api/monitoring/azure-embedding?format=text
 *
 * // Response (text/plain)
 * Azure Embedding Service Monitor - OK
 * ------------------------------------------------------------------
 * Timestamp: 2025-10-01T00:00:00.000Z
 * Status: ok
 *
 * Rate Limits:
 * - Remaining: 8500/10000 (15.0% used)
 * - Resets At: 2025-10-01T01:00:00.000Z
 * - Status: OK
 *
 * @throws {401} Unauthorized - Authentication required
 * @throws {403} Forbidden - Admin access required (when RESTRICT_METRICS_TO_ADMIN=true)
 * @throws {500} Internal server error - Failed to retrieve monitoring data
 */

import { NextRequest, NextResponse } from 'next/server';
import { azureEmbeddingMetrics } from '@/lib/monitoring/azure-embedding-metrics';
import { connectionPoolMonitor } from '@/lib/monitoring/connection-pool-monitor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic'; // No caching for monitoring data

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role (optional, based on your auth setup)
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && process.env.RESTRICT_METRICS_TO_ADMIN === 'true') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get parameters
    const format = req.nextUrl.searchParams.get('format') || 'json';
    const include = req.nextUrl.searchParams.get('include') || 'all'; // all, pools, api, rate_limits
    
    // Get rate limit information
    const rateLimitInfo = azureEmbeddingMetrics.getRateLimitInfo();
    
    // Get connection pool information from the monitor's current API
    const metrics = connectionPoolMonitor.getAllPoolMetrics();
    const pools = metrics.filter(m => m.pool_name.toLowerCase().includes('azure'));
    const overview = connectionPoolMonitor.getSystemOverview();
    const overallStatus: 'healthy' | 'warning' | 'critical' =
      overview.critical_pools > 0 ? 'critical' : (overview.warning_pools > 0 ? 'warning' : 'healthy');
    
    // Check if rate limit is approaching critical
    const isRateLimitCritical = azureEmbeddingMetrics.isRateLimitCritical(80);
    
    // Build response data
    const responseData: any = {
      timestamp: new Date().toISOString(),
      status: isRateLimitCritical || overallStatus !== 'healthy' ? 'warning' : 'ok',
      service: 'azure_embedding',
    };
    
    // Include rate limit information if requested
    if (include === 'all' || include === 'rate_limits') {
      responseData.rateLimits = {
        ...rateLimitInfo,
        isApproachingLimit: isRateLimitCritical,
        resetTimestamp: rateLimitInfo.resetDate.toISOString(),
      };
    }
    
    // Include connection pool information if requested
    if (include === 'all' || include === 'pools') {
      responseData.connectionPools = {
        total: pools.length,
        healthy: pools.filter(p => p.health_status === 'healthy').length,
        warning: pools.filter(p => p.health_status === 'warning').length,
        critical: pools.filter(p => p.health_status === 'critical').length,
        overallStatus,
        pools: pools.map(pool => ({
          id: pool.pool_name,
          activeConnections: pool.active_connections,
          idleConnections: pool.idle_connections,
          totalConnections: pool.total_connections,
          waitingRequests: pool.waiting_count,
          utilization: pool.utilization_percent,
          status: pool.health_status,
          lastError: null
        }))
      };
    }
    
    // Format as text if requested
    if (format === 'text') {
      let textResponse = `
Azure Embedding Service Monitor - ${responseData.status.toUpperCase()}
------------------------------------------------------------------
Timestamp: ${responseData.timestamp}
Status: ${responseData.status}
`;

      if (responseData.rateLimits) {
        textResponse += `
Rate Limits:
- Remaining: ${responseData.rateLimits.remaining}/${responseData.rateLimits.max} (${(responseData.rateLimits.utilizationPercentage).toFixed(1)}% used)
- Resets At: ${responseData.rateLimits.resetTimestamp}
- Status: ${responseData.rateLimits.isApproachingLimit ? 'WARNING: Approaching limit' : 'OK'}
`;
      }

      if (responseData.connectionPools) {
        textResponse += `
Connection Pools:
- Total: ${responseData.connectionPools.total}
- Healthy: ${responseData.connectionPools.healthy}
- Warning: ${responseData.connectionPools.warning}
- Critical: ${responseData.connectionPools.critical}
- Overall Status: ${responseData.connectionPools.overallStatus.toUpperCase()}

Pool Details:
`;

        responseData.connectionPools.pools.forEach((pool: any) => {
          textResponse += `
- ${pool.id}:
  Connections: ${pool.activeConnections}/${pool.totalConnections} (${pool.utilization.toFixed(1)}% utilization)
  Idle: ${pool.idleConnections}, Waiting: ${pool.waitingRequests}
  Status: ${pool.status.toUpperCase()}
  ${pool.lastError ? `Last Error: ${pool.lastError.message} (${pool.lastError.time}, count: ${pool.lastError.count})` : ''}
`;
        });
      }
      
      return new NextResponse(textResponse, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Azure embedding monitoring API error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to retrieve monitoring data',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}