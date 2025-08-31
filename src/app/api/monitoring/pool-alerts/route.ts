import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { DatadogIntegration } from '@/lib/monitoring/datadog-integration';

// Alert thresholds for connection pool monitoring
interface PoolAlertThresholds {
  warningThreshold: number; // 80% by default
  criticalThreshold: number; // 90% by default
  minAvailableConnections: number; // 2 by default
}

interface PoolAlert {
  poolKey: string;
  severity: 'warning' | 'critical';
  message: string;
  activeConnections: number;
  totalConnections: number;
  utilizationPercent: number;
  availableConnections: number;
  timestamp: string;
}

// Default alert thresholds
const DEFAULT_THRESHOLDS: PoolAlertThresholds = {
  warningThreshold: 80,
  criticalThreshold: 90,
  minAvailableConnections: 2
};

// Initialize Datadog integration
const datadogIntegration = new DatadogIntegration();

/**
 * Check pool status and generate alerts if thresholds are exceeded
 */
function checkPoolAlerts(poolStatus: any, thresholds: PoolAlertThresholds = DEFAULT_THRESHOLDS): PoolAlert[] {
  const alerts: PoolAlert[] = [];
  
  if (!poolStatus.pools || poolStatus.pools.length === 0) {
    return alerts;
  }
  
  for (const pool of poolStatus.pools) {
    const utilizationPercent = (pool.activeConnections / pool.totalConnections) * 100;
    const availableConnections = pool.availableConnections;
    
    let alert: PoolAlert | null = null;
    
    // Check critical threshold first
    if (utilizationPercent >= thresholds.criticalThreshold || availableConnections <= 1) {
      alert = {
        poolKey: pool.key,
        severity: 'critical',
        message: `Database connection pool "${pool.key}" is critically full (${utilizationPercent.toFixed(1)}% utilization, ${availableConnections} available)`,
        activeConnections: pool.activeConnections,
        totalConnections: pool.totalConnections,
        utilizationPercent: Math.round(utilizationPercent * 10) / 10,
        availableConnections,
        timestamp: new Date().toISOString()
      };
    }
    // Check warning threshold
    else if (utilizationPercent >= thresholds.warningThreshold || availableConnections <= thresholds.minAvailableConnections) {
      alert = {
        poolKey: pool.key,
        severity: 'warning',
        message: `Database connection pool "${pool.key}" is approaching capacity (${utilizationPercent.toFixed(1)}% utilization, ${availableConnections} available)`,
        activeConnections: pool.activeConnections,
        totalConnections: pool.totalConnections,
        utilizationPercent: Math.round(utilizationPercent * 10) / 10,
        availableConnections,
        timestamp: new Date().toISOString()
      };
    }
    
    if (alert) {
      alerts.push(alert);
      
      // Send metrics to Datadog
      try {
        datadogIntegration.recordPoolAlert({
          poolKey: pool.key,
          severity: alert.severity,
          utilizationPercent: alert.utilizationPercent,
          availableConnections: alert.availableConnections,
          activeConnections: pool.activeConnections,
          totalConnections: pool.totalConnections
        });
        
        console.log(`📊 Sent pool alert to Datadog: ${alert.severity} for pool ${pool.key}`);
      } catch (error) {
        console.error('Failed to send pool alert to Datadog:', error);
      }
    }
  }
  
  return alerts;
}

/**
 * GET /api/monitoring/pool-alerts
 * Check current pool status and return any active alerts
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const thresholds = {
      warningThreshold: parseInt(searchParams.get('warningThreshold') || '80'),
      criticalThreshold: parseInt(searchParams.get('criticalThreshold') || '90'),
      minAvailableConnections: parseInt(searchParams.get('minAvailableConnections') || '2')
    };
    
    // Get current pool status from the health API
    const healthResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/health/db?verbose=true`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    });
    
    if (!healthResponse.ok) {
      throw new Error('Failed to fetch database health status');
    }
    
    const healthData = await healthResponse.json();
    
    if (healthData.status !== 'ok') {
      return NextResponse.json({
        alerts: [{
          poolKey: 'global',
          severity: 'critical',
          message: `Database health check failed: ${healthData.message}`,
          activeConnections: 0,
          totalConnections: 0,
          utilizationPercent: 0,
          availableConnections: 0,
          timestamp: new Date().toISOString()
        }],
        poolStatus: healthData.poolStatus,
        thresholds,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check for pool alerts
    const alerts = checkPoolAlerts(healthData.poolStatus, thresholds);
    
    return NextResponse.json({
      alerts,
      poolStatus: healthData.poolStatus,
      thresholds,
      alertCount: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      warningAlerts: alerts.filter(a => a.severity === 'warning').length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error checking pool alerts:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check pool alerts',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/pool-alerts/configure
 * Update alert thresholds
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { thresholds } = body;
    
    if (!thresholds) {
      return NextResponse.json(
        { error: 'Alert thresholds are required' },
        { status: 400 }
      );
    }
    
    // Validate thresholds
    if (thresholds.warningThreshold >= thresholds.criticalThreshold) {
      return NextResponse.json(
        { error: 'Warning threshold must be less than critical threshold' },
        { status: 400 }
      );
    }
    
    if (thresholds.warningThreshold < 50 || thresholds.criticalThreshold > 95) {
      return NextResponse.json(
        { error: 'Thresholds must be between 50-95%' },
        { status: 400 }
      );
    }
    
    // In a real implementation, you would save these to a database
    // For now, we'll just return the updated configuration
    
    return NextResponse.json({
      message: 'Alert thresholds configured successfully',
      thresholds: {
        warningThreshold: thresholds.warningThreshold,
        criticalThreshold: thresholds.criticalThreshold,
        minAvailableConnections: thresholds.minAvailableConnections
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error configuring pool alerts:', error);
    return NextResponse.json(
      { 
        error: 'Failed to configure pool alerts',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}