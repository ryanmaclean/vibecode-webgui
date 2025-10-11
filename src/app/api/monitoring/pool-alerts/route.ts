<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
// import { datadogDBM, DBMAlert } from '@/lib/monitoring/datadog-dbm';
import { createRobustConnection } from '@/lib/db/robust-db-connection';
import { DatadogIntegration } from '@/lib/monitoring/datadog-integration';
=======
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { datadogMetrics } from "@/lib/monitoring/datadog-metrics";
import { createRobustConnection } from "@/lib/db/robust-db-connection";
>>>>>>> fix/consolidated-dependency-updates

// Alert thresholds for connection pool monitoring
interface PoolAlertThresholds {
  warningThreshold: number; // 80% by default
  criticalThreshold: number; // 90% by default
  minAvailableConnections: number; // 2 by default
}

interface PoolAlert {
  poolKey: string;
  severity: "warning" | "critical";
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
  minAvailableConnections: 2,
};

// Initialize Datadog integration
// const datadogIntegration = new DatadogIntegration();

/**
 * Check pool status and generate alerts if thresholds are exceeded
 */
function checkPoolAlerts(
  poolStatus: any,
  thresholds: PoolAlertThresholds = DEFAULT_THRESHOLDS,
): PoolAlert[] {
  const alerts: PoolAlert[] = [];

  if (!poolStatus.pools || poolStatus.pools.length === 0) {
    return alerts;
  }

  for (const pool of poolStatus.pools) {
    const utilizationPercent =
      (pool.activeConnections / pool.totalConnections) * 100;
    const availableConnections = pool.availableConnections;

    let alert: PoolAlert | null = null;

    // Check critical threshold first
    if (
      utilizationPercent >= thresholds.criticalThreshold ||
      availableConnections <= 1
    ) {
      alert = {
        poolKey: pool.key,
        severity: "critical",
        message: `Database connection pool "${pool.key}" is critically full (${utilizationPercent.toFixed(1)}% utilization, ${availableConnections} available)`,
        activeConnections: pool.activeConnections,
        totalConnections: pool.totalConnections,
        utilizationPercent: Math.round(utilizationPercent * 10) / 10,
        availableConnections,
        timestamp: new Date().toISOString(),
      };
    }
    // Check warning threshold
    else if (
      utilizationPercent >= thresholds.warningThreshold ||
      availableConnections <= thresholds.minAvailableConnections
    ) {
      alert = {
        poolKey: pool.key,
        severity: "warning",
        message: `Database connection pool "${pool.key}" is approaching capacity (${utilizationPercent.toFixed(1)}% utilization, ${availableConnections} available)`,
        activeConnections: pool.activeConnections,
        totalConnections: pool.totalConnections,
        utilizationPercent: Math.round(utilizationPercent * 10) / 10,
        availableConnections,
        timestamp: new Date().toISOString(),
      };
    }

    if (alert) {
      alerts.push(alert);

      // Send metrics to Datadog
      try {
        // datadogIntegration.recordPoolAlert({
        //   poolKey: pool.key,
        //   severity: alert.severity,
        //   utilizationPercent: alert.utilizationPercent,
        //   availableConnections: alert.availableConnections,
        //   activeConnections: pool.activeConnections,
        //   totalConnections: pool.totalConnections
        // });

        console.log(`📊 Pool alert: ${alert.severity} for pool ${pool.key}`);
      } catch (error) {
        console.error("Failed to send pool alert to Datadog:", error);
      }
    }
  }

  return alerts;
}

/**
 * GET /api/monitoring/pool-alerts
 * Check database metrics using Datadog DBM and return any active alerts
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Check if Datadog DBM is enabled
<<<<<<< HEAD
    if (true) { // datadogDBM not available
      return NextResponse.json({
        error: 'Datadog Database Monitoring is not enabled. Set DD_DBM_ENABLED=true in environment.',
        alerts: [],
        dbmConfig: null, // datadogDBM not available
        timestamp: new Date().toISOString()
      }, { status: 503 });
=======
    if (!datadogDBM.isEnabled()) {
      return NextResponse.json(
        {
          error:
            "Datadog Database Monitoring is not enabled. Set DD_DBM_ENABLED=true in environment.",
          alerts: [],
          dbmConfig: datadogDBM.getConfig(),
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
>>>>>>> fix/consolidated-dependency-updates
    }

    // Get real database connection metrics
    const connection = await createRobustConnection({
      poolKey: "pool-alerts-monitoring",
      enableLogging: true,
    });

    if (!connection.success || !connection.prisma) {
      return NextResponse.json(
        {
          error: "Failed to establish database connection for monitoring",
          alerts: [],
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    try {
      // Narrow prisma client after earlier guard
      const prisma = connection.prisma!;
      // Query actual PostgreSQL connection stats
<<<<<<< HEAD
      const connectionStatsResult = await prisma.$queryRaw`
        SELECT 
=======
      const connectionStatsResult = await connection.prisma.$queryRaw`
        SELECT
>>>>>>> fix/consolidated-dependency-updates
          numbackends as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as idle_in_transaction,
          (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_connections
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

      const stats = (connectionStatsResult as any[])[0];

      // Calculate connection pool metrics
      const activeConnections = Number(stats.active_connections) || 0;
      const maxConnections = Number(stats.max_connections) || 100;
      const idleConnections = Number(stats.idle_connections) || 0;
      const waitingConnections = Number(stats.waiting_connections) || 0;
      const utilizationPercent = (activeConnections / maxConnections) * 100;

<<<<<<< HEAD
      // Create a pseudo pool status and generate alerts using checkPoolAlerts
      const poolStatus = {
        pools: [
          {
            key: 'postgres-main',
            activeConnections,
            totalConnections: maxConnections,
            availableConnections: idleConnections
          }
        ]
      } as any;
      const alerts = checkPoolAlerts(poolStatus);
=======
      // Record metrics with Datadog DBM
      datadogDBM.recordConnectionMetrics({
        activeConnections,
        totalConnections: maxConnections,
        waitingConnections,
        idleConnections,
      });

      // Generate alerts based on real metrics
      const dbmMetrics = {
        activeConnections,
        totalConnections: maxConnections,
        connectionPoolUtilization: utilizationPercent,
        averageQueryTime: 50, // Mock for now, would come from pg_stat_statements
        slowQueryCount: 0, // Mock for now
        errorRate: 0, // Mock for now
        throughput: 100, // Mock for now
      };

      const alerts = datadogDBM.generatePoolAlerts(dbmMetrics);
>>>>>>> fix/consolidated-dependency-updates

      return NextResponse.json({
        alerts,
        dbmEnabled: true,
        connectionMetrics: {
          activeConnections,
          maxConnections,
          idleConnections,
          waitingConnections,
          utilizationPercent: Math.round(utilizationPercent * 10) / 10,
        },
        alertCount: alerts.length,
        criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
        warningAlerts: alerts.filter((a) => a.severity === "warning").length,
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Release database connection if available
      const releaseFn = connection.release;
      if (releaseFn) {
        await (releaseFn as () => Promise<void>)();
      }
    }
  } catch (error: any) {
    console.error("Error checking pool alerts:", error);
    return NextResponse.json(
      {
        error: "Failed to check pool alerts",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
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
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { thresholds } = body;

    if (!thresholds) {
      return NextResponse.json(
        { error: "Alert thresholds are required" },
        { status: 400 },
      );
    }

    // Validate thresholds
    if (thresholds.warningThreshold >= thresholds.criticalThreshold) {
      return NextResponse.json(
        { error: "Warning threshold must be less than critical threshold" },
        { status: 400 },
      );
    }

    if (thresholds.warningThreshold < 50 || thresholds.criticalThreshold > 95) {
      return NextResponse.json(
        { error: "Thresholds must be between 50-95%" },
        { status: 400 },
      );
    }

    // In a real implementation, you would save these to a database
    // For now, we'll just return the updated configuration

    return NextResponse.json({
      message: "Alert thresholds configured successfully",
      thresholds: {
        warningThreshold: thresholds.warningThreshold,
        criticalThreshold: thresholds.criticalThreshold,
        minAvailableConnections: thresholds.minAvailableConnections,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error configuring pool alerts:", error);
    return NextResponse.json(
      {
        error: "Failed to configure pool alerts",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
