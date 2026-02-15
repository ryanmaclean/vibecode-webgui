import { NextRequest, NextResponse } from 'next/server';
import { createServiceLogger } from '@/lib/logging';
import { getDatabaseTraceContext } from '@/lib/monitoring/opentelemetry';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'health-db' });

export const dynamic = 'force-dynamic'

// Defer heavy or circular-prone imports to runtime to avoid build-time evaluation cycles
// that caused "Cannot access 't' before initialization" during route module evaluation.

interface DbInfo {
  db_name: string;
  user_name: string;
  version: string;
  start_time: Date;
}

interface PgvectorStatus {
  installed: boolean;
  version: string | null;
}

interface EmbeddingsStats {
  total_embeddings: number;
  avg_content_size?: number;
  latest_embedding?: Date;
  error?: string;
}

interface DbStats {
  active_connections: number;
  transactions_committed: number;
  transactions_rolled_back: number;
  blocks_read: number;
  blocks_hit: number;
  rows_returned: number;
  rows_fetched: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deleted: number;
}

// Define the metrics interface based on what we're using
interface DatabaseMetrics {
  totalQueries: number;
  totalQueriesPerSecond: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  errorRate: number;
  slowQueries: number;
  queriesByType: Record<string, number>;
  queriesByTable: Record<string, number>;
  [key: string]: unknown;
}

interface PoolStatus {
  size: number;
  inUse: number;
  maxSize: number;
  available: number;
}

/**
 * Database health check endpoint
 * 
 * Returns:
 * - status: "ok" | "error"
 * - message: String message about database status
 * - details: Object with connection details
 * - poolStatus: Connection pool information
 * - latency: Connection latency in ms
 */

interface PgvectorStatus {
  installed: boolean;
  version: string | null;
}

interface EmbeddingsStats {
  total_embeddings: number;
  avg_content_size?: number;
  latest_embedding?: Date;
  error?: string;
}

interface DbStats {
  active_connections: number;
  transactions_committed: number;
  transactions_rolled_back: number;
  blocks_read: number;
  blocks_hit: number;
  rows_returned: number;
  rows_fetched: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deleted: number;
}

/**
 * Database health check endpoint
 *
 * Returns:
 * - status: "ok" | "error"
 * - message: String message about database status
 * - details: Object with connection details
 * - poolStatus: Connection pool information
 * - latency: Connection latency in ms
 *
 * SECURITY: Phase 4 - Batch 3 validation added
 */
export async function GET(request: NextRequest) {
  // Defer imports to runtime to avoid circular-init build issues
  const [dbMod, metricsMod, poolMod, validationMod] = await Promise.all([
    import('@/lib/db/robust-db-connection'),
    import('@/lib/db/db-metrics'),
    import('@/lib/db/pool-adapter'),
    import('@/lib/api/validation/middleware'),
  ]);
  const { createRobustConnection, getConnectionPoolStatus } = dbMod as unknown as {
    createRobustConnection: (options: { debug: boolean; poolKey: string; enableLogging: boolean }) => Promise<{ success: boolean; prisma?: { $queryRaw: <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T> }; error?: { message: string }; release?: () => void }>;
    getConnectionPoolStatus: () => unknown;
  };
  const { getDatabaseMetricsCollector } = metricsMod as unknown as {
    getDatabaseMetricsCollector: () => { getMetrics: () => Partial<DatabaseMetrics> };
  };
  const { adaptPoolStatus } = poolMod as unknown as {
    adaptPoolStatus: (status: unknown) => PoolStatus;
  };
  const { validateQueryParams } = validationMod as unknown as {
    validateQueryParams: (request: NextRequest, schema: unknown) => { success: boolean; data: { format?: string; verbose?: boolean }; error?: NextResponse };
  };

  // Validate query parameters
  const { healthCheckQuerySchema } = await import('@/lib/api/validation/schemas');
  const validation = validateQueryParams(request, healthCheckQuerySchema);
  if (!validation.success) {
    return validation.error;
  }
  const { format, verbose } = validation.data;

  const startTime = Date.now();
  const includeMetrics = request.nextUrl.searchParams.get('metrics') === 'true';
  
  try {
    // Test basic connection
    const connection = await createRobustConnection({
      debug: false,
      poolKey: 'health-check',
      enableLogging: true
    });
    
    if (!connection.success || !connection.prisma) {
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        error: connection.error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
    
    // Get basic database info
    const dbInfoResult = await connection.prisma.$queryRaw`
      SELECT 
        current_database() as db_name, 
        current_user as user_name,
        version() as version,
        pg_postmaster_start_time() as start_time
    `;
    
    const dbInfo = (dbInfoResult as DbInfo[])[0];
    
    // Get connection pool status
    const rawPoolStatus = getConnectionPoolStatus();
    const poolStatus = adaptPoolStatus(rawPoolStatus);
    
    // Get database metrics
    let metricsData: Partial<DatabaseMetrics> | undefined = undefined;

    if (includeMetrics) {
      const metricsCollector = getDatabaseMetricsCollector();
      metricsData = metricsCollector.getMetrics();
    }
    
    // Check if pgvector is installed
    let pgvectorStatus: PgvectorStatus = { installed: false, version: null };
    try {
      const extResult = await connection.prisma.$queryRaw`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'vector'
      `;
      
      if (Array.isArray(extResult) && extResult.length > 0) {
        pgvectorStatus = { 
          installed: true, 
          version: extResult[0].extversion 
        };
      }
    } catch (extError) {
      logger.error('Error checking pgvector extension:', { data: extError });
    }
    
    // Get database statistics
    let dbStats: DbStats | null = null;
    if (verbose) {
      try {
        const statsResult = await connection.prisma.$queryRaw`
          SELECT 
            numbackends as active_connections,
            xact_commit as transactions_committed,
            xact_rollback as transactions_rolled_back,
            blks_read as blocks_read,
            blks_hit as blocks_hit,
            tup_returned as rows_returned,
            tup_fetched as rows_fetched,
            tup_inserted as rows_inserted,
            tup_updated as rows_updated,
            tup_deleted as rows_deleted
          FROM pg_stat_database 
          WHERE datname = current_database()
        `;
        
        const rawStats = (statsResult as Record<string, unknown>[])[0];
        dbStats = {
          active_connections: Number(rawStats.active_connections),
          transactions_committed: Number(rawStats.transactions_committed),
          transactions_rolled_back: Number(rawStats.transactions_rolled_back),
          blocks_read: Number(rawStats.blocks_read),
          blocks_hit: Number(rawStats.blocks_hit),
          rows_returned: Number(rawStats.rows_returned),
          rows_fetched: Number(rawStats.rows_fetched),
          rows_inserted: Number(rawStats.rows_inserted),
          rows_updated: Number(rawStats.rows_updated),
          rows_deleted: Number(rawStats.rows_deleted)
        };
      } catch (statsError) {
        logger.error('Error getting database statistics:', { data: statsError });
      }
    }
    
    // Check document_embeddings table if pgvector is installed
    let embeddingsStats: EmbeddingsStats | null = null;
    if (pgvectorStatus.installed) {
      try {
        const embedResult = await connection.prisma.$queryRaw`
          SELECT 
            COUNT(*) as total_embeddings,
            AVG(octet_length(content)) as avg_content_size,
            MAX(created_at) as latest_embedding
          FROM document_embeddings
        `;
        
        const rawStats = (embedResult as Record<string, unknown>[])[0];
        embeddingsStats = {
          total_embeddings: Number(rawStats.total_embeddings),
          avg_content_size: rawStats.avg_content_size != null ? Number(rawStats.avg_content_size) : undefined,
          latest_embedding: rawStats.latest_embedding as Date | undefined
        };
      } catch (embedError) {
        // This could happen if table doesn't exist yet, which is ok
        embeddingsStats = { 
          total_embeddings: 0,
          error: (embedError as Error).message
        };
      }
    }
    
    // Release the connection
    if (connection.release) {
      connection.release();
    }
    
    const endTime = Date.now();
    const latency = endTime - startTime;

    // Get trace context for correlation
    const traceContext = getDatabaseTraceContext();

    const response = {
      status: 'ok',
      message: 'Database connection healthy',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
      trace_id: traceContext.trace_id,
      span_id: traceContext.span_id,
      database: {
        name: dbInfo?.db_name,
        user: dbInfo?.user_name,
        version: dbInfo?.version,
        uptime: dbInfo?.start_time,
      },
      pgvector: pgvectorStatus,
      poolStatus,
      embeddings: embeddingsStats,
      stats: verbose ? dbStats : undefined,
      metrics: metricsData
    };
    
    // Format as text if requested
    if (format === 'text') {
      let textResponse = `
Database Health Check - ${response.status.toUpperCase()}
----------------------------------------------------
Message: ${response.message}
Latency: ${response.latency}
Timestamp: ${response.timestamp}

Database Info:
- Name: ${response.database.name}
- Version: ${response.database.version?.split(',')[0]}
- User: ${response.database.user}

pgvector Extension:
- Installed: ${response.pgvector.installed}
- Version: ${response.pgvector.version || 'N/A'}

Connection Pool:
- Size: ${response.poolStatus.size}
- In Use: ${response.poolStatus.inUse}
- Max Size: ${response.poolStatus.maxSize}
- Available: ${response.poolStatus.available}

${response.embeddings ? `Embeddings:
- Total Count: ${response.embeddings.total_embeddings}
- Avg Content Size: ${response.embeddings.avg_content_size || 'N/A'}
- Latest: ${response.embeddings.latest_embedding || 'N/A'}
` : ''}

${verbose && response.stats ? `Database Statistics:
- Active Connections: ${response.stats.active_connections}
- Transactions Committed: ${response.stats.transactions_committed}
- Transactions Rolled Back: ${response.stats.transactions_rolled_back}
- Rows Returned: ${response.stats.rows_returned}
- Rows Fetched: ${response.stats.rows_fetched}
- Rows Inserted: ${response.stats.rows_inserted}
- Rows Updated: ${response.stats.rows_updated}
- Rows Deleted: ${response.stats.rows_deleted}
` : ''}`;

      if (metricsData) {
        textResponse += `
Database Metrics:
- Total Queries: ${metricsData.totalQueries ?? 0}
- Queries Per Second: ${(metricsData.totalQueriesPerSecond ?? 0).toFixed(2)}
- Average Query Time: ${(metricsData.avgQueryTime ?? 0).toFixed(2)}ms
- P95 Query Time: ${(metricsData.p95QueryTime ?? 0).toFixed(2)}ms
- P99 Query Time: ${(metricsData.p99QueryTime ?? 0).toFixed(2)}ms
- Error Rate: ${((metricsData.errorRate ?? 0) * 100).toFixed(2)}%
- Slow Queries: ${metricsData.slowQueries ?? 0}
`;
      }
      
      return new NextResponse(textResponse, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Database health check failed:', { error: error });
    
    const errorResponse = {
      status: 'error',
      message: 'Database health check failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    };
    
    if (format === 'text') {
      const textResponse = `
Database Health Check - ERROR
-----------------------------
Message: ${errorResponse.message}
Error: ${errorResponse.error}
Timestamp: ${errorResponse.timestamp}
      `;
      
      return new NextResponse(textResponse, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}