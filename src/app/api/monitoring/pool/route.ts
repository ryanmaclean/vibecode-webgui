import { NextRequest, NextResponse } from 'next/server';
import { VectorConnectionPoolFactory } from '@/lib/db/vector-connection-pool';
import { ConnectionPoolMonitor, AlertLevel } from '@/lib/db/connection-pool-monitor';
// import { logger } from '@/lib/logger';
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
 * GET /api/monitoring/pool
 * 
 * Returns connection pool monitoring data including:
 * - Metrics for all pools
 * - Alerts (active or all based on query param)
 * - Recommendations
 * - Pool status
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
=================================
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