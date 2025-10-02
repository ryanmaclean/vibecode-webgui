import { NextRequest, NextResponse } from 'next/server';
import { VectorConnectionPoolFactory } from '@/lib/db/vector-connection-pool';
import { ConnectionPoolMonitor, AlertLevel, AlertType } from '@/lib/db/connection-pool-monitor';

// Create a singleton monitor instance
let monitor: ConnectionPoolMonitor | null = null;

function getMonitor(): ConnectionPoolMonitor {
  if (!monitor) {
    monitor = new ConnectionPoolMonitor({
      poolUtilizationThresholds: {
        warning: 70,
        critical: 85
      },
      waitingClientsThresholds: {
        warning: 5,
        critical: 15
      },
      enableCapacityPlanning: true
    });

    // Start monitoring all existing pools
    const pools = VectorConnectionPoolFactory.getAllPools();
    for (const [name, pool] of pools.entries()) {
      monitor.monitorPool(name, pool);
    }

    // Start the monitor
    monitor.start();
    console.log('Connection pool monitor started');
  }
  return monitor;
}

/**
 * @description Connection Pool Monitoring API - Provides real-time monitoring data for database connection pools including metrics, alerts, recommendations, and pool status. Supports both JSON and text output formats.
 * @route GET /api/monitoring/pool
 * @route POST /api/monitoring/pool
 * @access Public
 *
 * @param {NextRequest} request - Next.js request with query parameters:
 *   - format: 'json' | 'text' - Response format (default: 'json')
 *   - all_alerts: 'true' | 'false' - Include acknowledged alerts (default: false)
 *
 * @returns {Response} GET returns connection pool monitoring data:
 *   - timestamp: string - Current timestamp
 *   - pools: { count, status } - Pool summary and detailed status
 *   - metrics: Map<poolName, PoolMetrics> - Per-pool metrics
 *   - alerts: { count, critical, warning, info, items } - Active alerts
 *   - recommendations: { count, items } - Optimization recommendations
 *
 * @returns {Response} POST performs pool actions with query parameters:
 *   - action: 'acknowledge' | 'implement' - Action to perform
 *   - id: string - Alert or recommendation ID
 *   - user: string - User performing action (for acknowledge)
 *
 * @example
 * // GET Request - Pool monitoring (JSON)
 * GET /api/monitoring/pool?format=json
 *
 * // Response
 * {
 *   "timestamp": "2025-10-01T00:00:00.000Z",
 *   "pools": {
 *     "count": 3,
 *     "status": {
 *       "pool1": { "size": 10, "inUse": 5, "available": 5, "waitingClients": 0 }
 *     }
 *   },
 *   "metrics": {...},
 *   "alerts": {
 *     "count": 2,
 *     "critical": 0,
 *     "warning": 2,
 *     "items": [...]
 *   },
 *   "recommendations": {
 *     "count": 3,
 *     "items": [...]
 *   }
 * }
 *
 * // GET Request - Text format
 * GET /api/monitoring/pool?format=text
 *
 * // Response (text/plain)
 * Connection Pool Monitoring Report
 * ================================
 * Timestamp: 2025-10-01T00:00:00.000Z
 * Total Pools: 3
 * ...
 *
 * // POST Request - Acknowledge alert
 * POST /api/monitoring/pool?action=acknowledge&id=alert_123&user=admin
 *
 * // Response
 * {
 *   "success": true,
 *   "message": "Alert alert_123 acknowledged by admin"
 * }
 *
 * @throws {400} Invalid action or missing required parameters
 * @throws {404} Alert or recommendation not found
 * @throws {500} Internal server error - Failed to get connection pool monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    const monitor = getMonitor();
    const format = request.nextUrl.searchParams.get('format') || 'json';
    const showAllAlerts = request.nextUrl.searchParams.get('all_alerts') === 'true';
    
    // Get monitoring data
    const metrics = Object.fromEntries(monitor.getMetrics());
    const alerts = monitor.getAlerts(showAllAlerts);
    const recommendations = monitor.getRecommendations();
    const poolStatus = Object.fromEntries(monitor.getPoolStatus());
    
    // Create the response data
    const responseData = {
      timestamp: new Date().toISOString(),
      pools: {
        count: Object.keys(poolStatus).length,
        status: poolStatus
      },
      metrics,
      alerts: {
        count: alerts.length,
        critical: alerts.filter(a => a.level === AlertLevel.CRITICAL).length,
        warning: alerts.filter(a => a.level === AlertLevel.WARNING).length,
        info: alerts.filter(a => a.level === AlertLevel.INFO).length,
        items: alerts
      },
      recommendations: {
        count: recommendations.length,
        items: recommendations
      }
    };
    
    // Return as text if requested
    if (format === 'text') {
      const textResponse = `
Connection Pool Monitoring Report
================================
Timestamp: ${responseData.timestamp}

Pool Status Summary
------------------
Total Pools: ${responseData.pools.count}

${Object.entries(poolStatus).map(([name, status]) => `
Pool: ${name}
- Size: ${status.size}
- In Use: ${status.inUse}
- Available: ${status.available}
- Max Size: ${status.maxSize}
- Waiting Clients: ${status.waitingClients}
- Utilization: ${status.inUse && status.maxSize ? ((status.inUse / status.maxSize) * 100).toFixed(1) + '%' : 'N/A'}
`).join('')}

Alerts Summary
-------------
Total Alerts: ${responseData.alerts.count}
- Critical: ${responseData.alerts.critical}
- Warning: ${responseData.alerts.warning}
- Info: ${responseData.alerts.info}

${responseData.alerts.items.length > 0 ? `
Alert Details:
${responseData.alerts.items.map(alert => `
[${alert.level.toUpperCase()}] ${alert.type} - ${alert.poolName}
Time: ${alert.timestamp.toISOString()}
Message: ${alert.message}
Acknowledged: ${alert.acknowledged ? 'Yes' : 'No'}
`).join('')}` : 'No active alerts.'}

Recommendations
--------------
Total Recommendations: ${responseData.recommendations.count}

${responseData.recommendations.items.length > 0 ? `
Recommendation Details:
${responseData.recommendations.items.map(rec => `
${rec.type} - ${rec.poolName}
Time: ${rec.timestamp.toISOString()}
Message: ${rec.message}
Confidence: ${(rec.confidence * 100).toFixed(0)}%
Implemented: ${rec.implemented ? 'Yes' : 'No'}
`).join('')}` : 'No recommendations available.'}
`;

      return new NextResponse(textResponse, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    // Return as JSON
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error getting connection pool monitoring data:', error);
    
    return NextResponse.json({
      error: 'Failed to get connection pool monitoring data',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/pool/alerts/:id/acknowledge
 * 
 * Acknowledges an alert
 */
export async function POST(request: NextRequest) {
  try {
    const monitor = getMonitor();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'acknowledge') {
      const alertId = searchParams.get('id');
      if (!alertId) {
        return NextResponse.json({
          error: 'Missing alert ID',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      
      const user = searchParams.get('user') || 'api-user';
      const acknowledged = monitor.acknowledgeAlert(alertId, user);
      
      if (!acknowledged) {
        return NextResponse.json({
          error: 'Alert not found or already acknowledged',
          timestamp: new Date().toISOString()
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: `Alert ${alertId} acknowledged by ${user}`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (action === 'implement') {
      const recommendationId = searchParams.get('id');
      if (!recommendationId) {
        return NextResponse.json({
          error: 'Missing recommendation ID',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      
      const implemented = monitor.implementRecommendation(recommendationId);
      
      if (!implemented) {
        return NextResponse.json({
          error: 'Recommendation not found or already implemented',
          timestamp: new Date().toISOString()
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: `Recommendation ${recommendationId} implemented`,
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      error: 'Invalid action',
      timestamp: new Date().toISOString()
    }, { status: 400 });
  } catch (error) {
    console.error('Error processing connection pool monitoring action:', error);
    
    return NextResponse.json({
      error: 'Failed to process connection pool monitoring action',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}