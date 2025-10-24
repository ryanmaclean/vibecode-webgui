import { NextRequest, NextResponse } from 'next/server';
import { getMetricsCollector } from '../../../../../lib/db/database-metrics';
import {
  getConnectionPoolStatus,
  getDetailedConnectionPoolInfo,
  createRobustConnection
} from '../../../../../lib/db/robust-db-connection';
// import { logger } from '../../../../../lib/logger';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PgVectorStatus {
  installed: boolean;
  version: string | null;
}

interface EmbeddingsStats {
  total_embeddings: number;
  avg_content_size: number;
  latest_embedding: string | null;
  avg_dimension: number;
}

interface VectorSearchStats {
  vector_searches: number;
  vectors_scanned: number;
  index_searches: number;
  vectors_fetched_by_index: number;
  vectors_inserted: number;
  vectors_updated: number;
  vectors_deleted: number;
}

interface VectorIndex {
  name: string;
  definition: string;
  size_bytes: number;
  size_formatted: string;
  type: string;
}

interface VectorMetrics {
  pgvector: PgVectorStatus;
  embeddings: EmbeddingsStats | null;
  vectorSearchStats: VectorSearchStats | null;
  vectorIndexes: VectorIndex[];
}

type ConnectionSnapshot = {
  ageMs?: unknown;
  idleTimeMs?: unknown;
  [key: string]: unknown;
};

type DetailedPoolEntry = {
  type?: string;
  connected?: boolean;
  stats?: {
    connections?: unknown;
    [key: string]: unknown;
  };
  connections?: unknown;
  [key: string]: unknown;
};

interface ConnectionDetail {
  ageMs?: number;
  idleTimeMs?: number;
}

// Query result interfaces
interface PgVectorQueryResult {
  installed: boolean;
  version: string | null;
}

interface EmbeddingStatsQueryResult {
  total_embeddings: number | bigint;
  avg_content_size: number | null;
  latest_embedding: Date | string | null;
  avg_dimension: number | null;
}

interface VectorSearchQueryResult {
  vector_searches: number | bigint | null;
  vectors_scanned: number | bigint | null;
  index_searches: number | bigint | null;
  vectors_fetched_by_index: number | bigint | null;
  vectors_inserted: number | bigint | null;
  vectors_updated: number | bigint | null;
  vectors_deleted: number | bigint | null;
}

interface VectorIndexQueryResult {
  indexname: string;
  indexdef: string;
  index_size: number | bigint | null;
}

export async function GET(_request: NextRequest) {
  const collector = getMetricsCollector();
  const poolStatus = getConnectionPoolStatus();
  const detailedPoolInfo = getDetailedConnectionPoolInfo() as Record<string, DetailedPoolEntry>;
  
  // Update connection metrics
  const totalConnections = poolStatus.pools.reduce((sum, pool) => sum + pool.totalConnections, 0);
  const activeConnections = poolStatus.pools.reduce((sum, pool) => sum + pool.activeConnections, 0);
  const maxConnections = totalConnections + 10; // Estimated max
  
  collector.setConnectionMetrics(
    totalConnections,
    activeConnections,
    maxConnections
  );
  
  // Get current metrics
  const metrics = collector.getMetrics();
  
  // Calculate additional metrics for visualization  
  const utilization = {
    current: (activeConnections / Math.max(totalConnections, 1)) * 100,
    capacity: (totalConnections / maxConnections) * 100,
    acquisitionSuccess: 95, // Mock value
    connectionValidation: {
      validConnections: totalConnections,
      invalidConnections: 0,
      validationRate: 100
    },
    errorRate: 2
  };
  
  // Time series data (last 5 minutes, in 30-second intervals)
  // In a real implementation, this would come from a time-series database
  // For now, we'll generate mock data
  const timeSeriesData = {
    timestamps: Array.from({ length: 10 }).map((_, i) => 
      new Date(Date.now() - (10 - i) * 30000).toISOString()
    ),
    connections: Array.from({ length: 10 }).map(() => 
      Math.floor(Math.random() * maxConnections) + 1
    ),
    active: Array.from({ length: 10 }).map(() => 
      Math.floor(Math.random() * totalConnections)
    ),
    responseTime: Array.from({ length: 10 }).map(() => 
      Math.floor(Math.random() * 100) + 10
    ),
    errors: Array.from({ length: 10 }).map(() => 
      Math.floor(Math.random() * 3)
    )
  };
  
  const toConnectionSnapshots = (value: unknown): ConnectionSnapshot[] =>
    Array.isArray(value)
      ? value.filter((item): item is ConnectionSnapshot => typeof item === 'object' && item !== null)
      : [];

  const normalizeConnectionDetail = (snapshot: ConnectionSnapshot): ConnectionDetail => ({
    ageMs: typeof snapshot?.ageMs === 'number' ? snapshot.ageMs : undefined,
    idleTimeMs: typeof snapshot?.idleTimeMs === 'number' ? snapshot.idleTimeMs : undefined
  });

  const connectionDetails: ConnectionDetail[] = Object.values(detailedPoolInfo)
    .flatMap((entry) => [
      ...toConnectionSnapshots(entry.stats?.connections),
      ...toConnectionSnapshots(entry.connections)
    ])
    .map(normalizeConnectionDetail);

  const connectionAges = connectionDetails.map((conn) => conn.ageMs ?? 0);
  const ageDistribution = {
    // Convert to seconds and group into buckets
    '<30s': connectionAges.filter(age => age < 30000).length,
    '30s-1m': connectionAges.filter(age => age >= 30000 && age < 60000).length,
    '1m-5m': connectionAges.filter(age => age >= 60000 && age < 300000).length,
    '5m-30m': connectionAges.filter(age => age >= 300000 && age < 1800000).length,
    '>30m': connectionAges.filter(age => age >= 1800000).length
  };
  
  // Connection idle time distribution
  const connectionIdleTimes = connectionDetails.map((conn) => conn.idleTimeMs ?? 0);
  const idleTimeDistribution = {
    // Convert to seconds and group into buckets
    '<10s': connectionIdleTimes.filter(idle => idle < 10000).length,
    '10s-30s': connectionIdleTimes.filter(idle => idle >= 10000 && idle < 30000).length,
    '30s-1m': connectionIdleTimes.filter(idle => idle >= 30000 && idle < 60000).length,
    '1m-5m': connectionIdleTimes.filter(idle => idle >= 60000 && idle < 300000).length,
    '>5m': connectionIdleTimes.filter(idle => idle >= 300000).length
  };
  
  // Vector-specific metrics
  let vectorMetrics: VectorMetrics | null = null;
  
  try {
    // Create a robust connection to get vector metrics
    const connection = await createRobustConnection({
      debug: false,
      poolKey: 'vector-metrics',
      enableLogging: false
    });
    
    if (connection.success && connection.prisma) {
      // Check pgvector status
      const pgvectorResult = await connection.prisma.$queryRaw`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as installed,
        (SELECT extversion FROM pg_extension WHERE extname = 'vector') as version
      `;
      
      const pgvectorResultArray = pgvectorResult as PgVectorQueryResult[];
      const pgvectorStatus: PgVectorStatus = {
        installed: pgvectorResultArray[0]?.installed || false,
        version: pgvectorResultArray[0]?.version || null
      };
      
      // Get vector table stats if pgvector is installed
      let embeddings: EmbeddingsStats | null = null;
      let vectorSearchStats: VectorSearchStats | null = null;
      const vectorIndexes: VectorIndex[] = [];
      
      if (pgvectorStatus.installed) {
        try {
          // Try to get document_embeddings table stats
          const embeddingStatsResult = await connection.prisma.$queryRaw`
            SELECT 
              COUNT(*) as total_embeddings,
              AVG(octet_length(content)) as avg_content_size,
              MAX(created_at) as latest_embedding,
              AVG(array_length(embedding, 1)) as avg_dimension
            FROM document_embeddings
          `;
          
          const embeddingStatsArray = embeddingStatsResult as EmbeddingStatsQueryResult[];
          embeddings = {
            total_embeddings: Number(embeddingStatsArray[0]?.total_embeddings || 0),
            avg_content_size: Number(embeddingStatsArray[0]?.avg_content_size || 0),
            latest_embedding: String(embeddingStatsArray[0]?.latest_embedding || null),
            avg_dimension: Number(embeddingStatsArray[0]?.avg_dimension || 0),
          };
          
          // Get vector search stats from pg_stat_user_tables
          const vectorSearchResult = await connection.prisma.$queryRaw`
            SELECT 
              seq_scan as vector_searches,
              seq_tup_read as vectors_scanned,
              idx_scan as index_searches,
              idx_tup_fetch as vectors_fetched_by_index,
              n_tup_ins as vectors_inserted,
              n_tup_upd as vectors_updated,
              n_tup_del as vectors_deleted
            FROM pg_stat_user_tables
            WHERE relname = 'document_embeddings'
          `;
          
          const vectorSearchArray = vectorSearchResult as VectorSearchQueryResult[];
          if (vectorSearchArray.length > 0) {
            vectorSearchStats = {
              vector_searches: Number(vectorSearchArray[0]?.vector_searches || 0),
              vectors_scanned: Number(vectorSearchArray[0]?.vectors_scanned || 0),
              index_searches: Number(vectorSearchArray[0]?.index_searches || 0),
              vectors_fetched_by_index: Number(vectorSearchArray[0]?.vectors_fetched_by_index || 0),
              vectors_inserted: Number(vectorSearchArray[0]?.vectors_inserted || 0),
              vectors_updated: Number(vectorSearchArray[0]?.vectors_updated || 0),
              vectors_deleted: Number(vectorSearchArray[0]?.vectors_deleted || 0),
            };
          }
          
          // Get vector index info
          const vectorIndexResult = await connection.prisma.$queryRaw`
            SELECT 
              indexname, 
              indexdef,
              pg_relation_size(indexname::regclass) as index_size
            FROM pg_indexes 
            WHERE tablename = 'document_embeddings' 
              AND indexdef LIKE '%embedding%'
          `;
          
          (vectorIndexResult as VectorIndexQueryResult[]).forEach(idx => {
            vectorIndexes.push({
              name: idx.indexname,
              definition: idx.indexdef,
              size_bytes: Number(idx.index_size || 0),
              size_formatted: formatBytes(Number(idx.index_size || 0)),
              type: idx.indexdef.includes('ivfflat') ? 'IVFFLAT' : 
                    idx.indexdef.includes('hnsw') ? 'HNSW' : 'OTHER'
            });
          });
          
          // Compile all vector metrics
          vectorMetrics = {
            pgvector: pgvectorStatus,
            embeddings,
            vectorSearchStats,
            vectorIndexes
          };
        } catch (err) {
          console.error('Error fetching vector-specific metrics:', { error: err });
        }
      }
      
      // Release the connection
      if (connection.release) {
        connection.release();
      }
    }
  } catch (err) {
    console.error('Error creating database connection for vector metrics:', { error: err });
  }
  
  return NextResponse.json({
    metrics,
    poolStatus,
    detailedPoolInfo,
    utilization,
    timeSeriesData,
    ageDistribution,
    idleTimeDistribution,
    vectorMetrics,
    timestamp: new Date().toISOString(),
  });
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
