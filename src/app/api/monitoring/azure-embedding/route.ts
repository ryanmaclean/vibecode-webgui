/**
 * Azure Embedding Service Monitoring API
 * Provides monitoring endpoints for Azure OpenAI embedding service and connection pool metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { azureEmbeddingMetrics } from '@/lib/monitoring/azure-embedding-metrics';
import { connectionPoolMonitor } from '@/lib/monitoring/connection-pool-monitor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// import { logger } from '@/lib/logger';
export const dynamic = 'force-dynamic'; // No caching for monitoring data

/**
 * GET /api/monitoring/azure-embedding
 * Returns metrics for Azure embedding operations
 */
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