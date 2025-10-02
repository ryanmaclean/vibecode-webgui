import { PrismaClient } from '@prisma/client';
import { createRobustConnection, getConnectionPoolStatus } from './robust-db-connection';

// We need to use a workaround for executeWithRetry
async function executeQueryWithRetry<T>(
  prisma: PrismaClient,
  queryFn: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error(`Database operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

interface HealthCheckOptions {
  detailed?: boolean;
  checkPgVector?: boolean;
  checkIndices?: boolean;
  timeout?: number;
  debug?: boolean;
  includePoolDetails?: boolean;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: string;
  databaseName?: string;
  postgresVersion?: string;
  connectionTime?: number;
  pgVectorAvailable?: boolean;
  documentTableExists?: boolean;
  pgVectorVersion?: string;
  indices?: {
    exists: boolean;
    count: number;
    details?: Array<{
      name: string;
      definition: string;
    }>;
  };
  connectionPool?: {
    size: number;
    inUse: number;
    maxSize: number;
    minSize: number;
    available: number;
    utilization: number;
    configuration?: {
      idleTimeout: number;
      connectionTimeout: number;
      acquireTimeout: number;
      enableDynamicSizing: boolean;
      enableConnectionValidation: boolean;
    };
    metrics?: {
      totalConnections: number;
      peakConnections: number;
      totalAcquires: number;
      acquireSuccesses: number;
      acquireFailures: number;
      acquireTimeAvg: number;
      connectionValidations: number;
      connectionValidationFailures: number;
      dynamicPoolAdjustments: number;
    };
    connections?: {
      key: string;
      ageMs: number;
      idleTimeMs: number;
      timeSinceValidationMs: number;
      inUse: boolean;
    }[];
  };
  error?: string;
}

interface DbInfo {
  db_name: string;
  pg_version: string;
}

interface PgVectorInfo {
  extname: string;
  extversion: string;
}

interface TableExistsInfo {
  table_exists: boolean;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

/**
 * Perform a comprehensive database health check
 */
export async function checkDatabaseHealth(options: HealthCheckOptions = {}): Promise<HealthCheckResult> {
  const { 
    detailed = false, 
    checkPgVector = true, 
    checkIndices = true,
    timeout = 5000,
    debug = false,
    includePoolDetails = false
  } = options;

  const startTime = Date.now();
  const healthResult: HealthCheckResult = {
    status: 'unhealthy',
    message: 'Database health check not completed',
    timestamp: new Date().toISOString()
  };

  try {
    // Create connection with timeout
    const connectionPromise = createRobustConnection({
      debug,
      maxRetries: 1
    });
    
    // Add timeout to the connection promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Database connection timed out after ${timeout}ms`)), timeout);
    });
    
    // Race the connection against the timeout
    const connection = await Promise.race([connectionPromise, timeoutPromise]);
    
    if (!connection.success || !connection.prisma) {
      return {
        status: 'unhealthy',
        message: 'Failed to connect to database',
        timestamp: new Date().toISOString(),
        error: connection.error?.message || 'Unknown error',
        connectionTime: Date.now() - startTime
      };
    }
    
    const prisma = connection.prisma;
    
    try {
      // Basic database info
      const dbInfo = await executeQueryWithRetry(prisma, () => 
        prisma.$queryRaw`
          SELECT current_database() as db_name, 
                 version() as pg_version
        `
      ) as DbInfo[];
      
      healthResult.databaseName = dbInfo[0].db_name;
      healthResult.postgresVersion = dbInfo[0].pg_version;
      healthResult.connectionTime = Date.now() - startTime;
      
      // Check pgvector if requested
      if (checkPgVector) {
        try {
          const pgvectorInfo = await executeQueryWithRetry(prisma, () => 
            prisma.$queryRaw`
              SELECT extname, extversion 
              FROM pg_extension 
              WHERE extname = 'vector'
            `
          ) as PgVectorInfo[];
          
          healthResult.pgVectorAvailable = pgvectorInfo.length > 0;
          if (pgvectorInfo.length > 0) {
            healthResult.pgVectorVersion = pgvectorInfo[0].extversion;
          }
        } catch (error) {
          healthResult.pgVectorAvailable = false;
        }
      }
      
      // Check document_embeddings table
      try {
        const tableInfo = await executeQueryWithRetry(prisma, () => 
          prisma.$queryRaw`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'document_embeddings'
            ) as table_exists
          `
        ) as TableExistsInfo[];
        
        healthResult.documentTableExists = tableInfo[0].table_exists;
      } catch (error) {
        healthResult.documentTableExists = false;
      }
      
      // Check indices if requested
      if (checkIndices && healthResult.documentTableExists) {
        try {
          const indexInfo = await executeQueryWithRetry(prisma, () => 
            prisma.$queryRaw`
              SELECT indexname, indexdef
              FROM pg_indexes
              WHERE tablename = 'document_embeddings'
            `
          ) as IndexInfo[];
          
          healthResult.indices = {
            exists: indexInfo.length > 0,
            count: indexInfo.length
          };
          
          if (detailed) {
            healthResult.indices.details = indexInfo.map((idx: IndexInfo) => ({
              name: idx.indexname,
              definition: idx.indexdef
            }));
          }
        } catch (error) {
          healthResult.indices = {
            exists: false,
            count: 0
          };
        }
      }
      
      // Get connection pool status
      const robustStatus = getConnectionPoolStatus();
      // Aggregate robust pool status into expected ConnectionPoolStatus shape
      const totalSize = robustStatus.pools.reduce((sum, p) => sum + p.totalConnections, 0);
      const inUse = robustStatus.pools.reduce((sum, p) => sum + p.activeConnections, 0);
      const available = robustStatus.pools.reduce((sum, p) => sum + p.availableConnections, 0);
      const utilization = totalSize > 0 ? (inUse / totalSize) * 100 : 0;

      healthResult.connectionPool = {
        size: totalSize,
        inUse,
        maxSize: totalSize, // Unknown from robust status; approximate with current size
        minSize: 0,
        available,
        utilization,
        configuration: {
          idleTimeout: 0,
          connectionTimeout: 0,
          acquireTimeout: 0,
          enableDynamicSizing: false,
          enableConnectionValidation: false
        },
        metrics: {
          totalConnections: totalSize,
          peakConnections: totalSize, // No historical data available
          totalAcquires: robustStatus.pools.reduce((sum, p) => sum + p.statistics.totalQueries, 0),
          acquireSuccesses: robustStatus.pools.reduce((sum, p) => sum + p.statistics.totalQueries - p.statistics.errors, 0),
          acquireFailures: robustStatus.pools.reduce((sum, p) => sum + p.statistics.errors, 0),
          acquireTimeAvg: robustStatus.pools.reduce((sum, p) => sum + p.statistics.averageQueryTime, 0) / Math.max(1, robustStatus.pools.length),
          connectionValidations: 0,
          connectionValidationFailures: 0,
          dynamicPoolAdjustments: 0
        },
        connections: includePoolDetails
          ? robustStatus.pools.map(p => ({
              key: p.key,
              ageMs: 0,
              idleTimeMs: p.availableConnections > 0 ? 1000 : 0,
              timeSinceValidationMs: 0,
              inUse: p.activeConnections > 0
            }))
          : undefined
      };
      
      // Determine overall status
      if (checkPgVector && !healthResult.pgVectorAvailable) {
        healthResult.status = 'degraded';
        healthResult.message = 'Database connected but pgvector extension not available';
      } else if (checkIndices && healthResult.indices && !healthResult.indices.exists) {
        healthResult.status = 'degraded';
        healthResult.message = 'Database connected but required indices not found';
      } else {
        healthResult.status = 'healthy';
        healthResult.message = 'Database connection successful';
      }
    } catch (error) {
      healthResult.status = 'degraded';
      healthResult.message = 'Connected to database but failed to execute health checks';
      healthResult.error = (error as Error).message;
    } finally {
      // Always release the connection
      if (connection.release) {
        connection.release();
      }
    }
  } catch (error) {
    healthResult.status = 'unhealthy';
    healthResult.message = 'Failed to connect to database';
    healthResult.error = (error as Error).message;
    healthResult.connectionTime = Date.now() - startTime;
  }
  
  return healthResult;
}

/**
 * Quick database health check that returns minimal information
 */
export async function quickDatabaseHealthCheck(timeout = 3000): Promise<{
  healthy: boolean;
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    const result = await checkDatabaseHealth({
      detailed: false,
      checkPgVector: false,
      checkIndices: false,
      timeout,
      debug: false
    });
    
    return {
      healthy: result.status === 'healthy',
      message: result.message,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Database health check failed: ${(error as Error).message}`,
      responseTime: Date.now() - startTime
    };
  }
}