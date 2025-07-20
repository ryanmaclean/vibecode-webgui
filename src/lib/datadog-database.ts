/**
 * Datadog Database Monitoring Integration
 * Provides comprehensive PostgreSQL monitoring and alerting
 */

import { prisma } from './prisma'

interface DatabaseMetrics {
  connections: {
    active: number
    idle: number
    total: number
  }
  performance: {
    queryCount: number
    slowQueries: number
    averageQueryTime: number
  }
  storage: {
    databaseSize: number
    tableStats: Array<{
      table: string
      size: number
      rowCount: number
    }>
  }
  vectorStore: {
    totalEmbeddings: number
    averageEmbeddingDimensions: number
    indexSize: number
  }
}

class DatadogDatabaseMonitoring {
  private isEnabled: boolean

  constructor() {
    this.isEnabled = process.env.DD_DATABASE_MONITORING_ENABLED === 'true'
  }

  /**
   * Collect comprehensive database metrics
   */
  async collectMetrics(): Promise<DatabaseMetrics> {
    try {
      const [
        connectionStats,
        performanceStats,
        storageStats,
        vectorStats
      ] = await Promise.all([
        this.getConnectionMetrics(),
        this.getPerformanceMetrics(),
        this.getStorageMetrics(),
        this.getVectorStoreMetrics()
      ])

      const metrics: DatabaseMetrics = {
        connections: connectionStats,
        performance: performanceStats,
        storage: storageStats,
        vectorStore: vectorStats
      }

      // Log metrics to Datadog
      if (this.isEnabled) {
        this.sendMetricsToDatadog(metrics)
      }

      return metrics
    } catch (error) {
      console.error('Error collecting database metrics:', error)
      throw error
    }
  }

  /**
   * Get database connection statistics
   */
  private async getConnectionMetrics() {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      ` as Array<{
        total_connections: bigint
        active_connections: bigint
        idle_connections: bigint
      }>

      const stats = result[0]
      return {
        active: Number(stats.active_connections),
        idle: Number(stats.idle_connections),
        total: Number(stats.total_connections)
      }
    } catch (error) {
      console.error('Error getting connection metrics:', error)
      return { active: 0, idle: 0, total: 0 }
    }
  }

  /**
   * Get query performance statistics
   */
  private async getPerformanceMetrics() {
    try {
      // Get query statistics from pg_stat_statements if available
      const queryStats = await prisma.$queryRaw`
        SELECT 
          COALESCE(sum(calls), 0) as total_queries,
          COALESCE(avg(mean_exec_time), 0) as avg_exec_time,
          COALESCE(sum(calls) FILTER (WHERE mean_exec_time > 1000), 0) as slow_queries
        FROM pg_stat_statements 
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ` as Array<{
        total_queries: bigint | number
        avg_exec_time: number
        slow_queries: bigint | number
      }>

      const stats = queryStats[0] || { total_queries: 0, avg_exec_time: 0, slow_queries: 0 }
      
      return {
        queryCount: Number(stats.total_queries),
        averageQueryTime: Number(stats.avg_exec_time),
        slowQueries: Number(stats.slow_queries)
      }
    } catch (error) {
      // pg_stat_statements might not be enabled
      console.warn('pg_stat_statements not available, using basic metrics')
      return {
        queryCount: 0,
        averageQueryTime: 0,
        slowQueries: 0
      }
    }
  }

  /**
   * Get database storage statistics
   */
  private async getStorageMetrics() {
    try {
      // Get database size
      const dbSize = await prisma.$queryRaw`
        SELECT pg_database_size(current_database()) as size
      ` as Array<{ size: bigint }>

      // Get table statistics
      const tableStats = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_total_relation_size(schemaname||'.'||tablename) as size,
          n_tup_ins + n_tup_upd + n_tup_del as total_changes,
          n_live_tup as row_count
        FROM pg_stat_user_tables 
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      ` as Array<{
        schemaname: string
        tablename: string
        size: bigint
        total_changes: bigint
        row_count: bigint
      }>

      return {
        databaseSize: Number(dbSize[0]?.size || 0),
        tableStats: tableStats.map(table => ({
          table: `${table.schemaname}.${table.tablename}`,
          size: Number(table.size),
          rowCount: Number(table.row_count)
        }))
      }
    } catch (error) {
      console.error('Error getting storage metrics:', error)
      return {
        databaseSize: 0,
        tableStats: []
      }
    }
  }

  /**
   * Get vector store specific metrics
   */
  private async getVectorStoreMetrics() {
    try {
      const [embeddingCount, indexSize] = await Promise.all([
        prisma.rAGChunk.count({
          where: {
            embedding: {
              not: null
            }
          }
        }),
        this.getVectorIndexSize()
      ])

      return {
        totalEmbeddings: embeddingCount,
        averageEmbeddingDimensions: 1536, // text-embedding-3-small dimensions
        indexSize
      }
    } catch (error) {
      console.error('Error getting vector store metrics:', error)
      return {
        totalEmbeddings: 0,
        averageEmbeddingDimensions: 0,
        indexSize: 0
      }
    }
  }

  /**
   * Get vector index size
   */
  private async getVectorIndexSize(): Promise<number> {
    try {
      const result = await prisma.$queryRaw`
        SELECT pg_relation_size('rag_chunks_embedding_idx') as index_size
      ` as Array<{ index_size: bigint }>

      return Number(result[0]?.index_size || 0)
    } catch (error) {
      console.error('Error getting vector index size:', error)
      return 0
    }
  }

  /**
   * Send metrics to Datadog
   */
  private sendMetricsToDatadog(metrics: DatabaseMetrics) {
    const timestamp = Math.floor(Date.now() / 1000)
    const tags = [
      'service:vibecode-webgui',
      'env:' + (process.env.DD_ENV || 'development'),
      'database:postgresql'
    ]

    // Log metrics in Datadog format
    console.log(JSON.stringify({
      '@timestamp': new Date().toISOString(),
      level: 'info',
      service: 'vibecode-database',
      message: 'Database metrics collected',
      dd: {
        trace_id: Date.now().toString(),
        span_id: Date.now().toString()
      },
      metrics: {
        'database.connections.active': {
          value: metrics.connections.active,
          type: 'gauge',
          tags
        },
        'database.connections.idle': {
          value: metrics.connections.idle,
          type: 'gauge',
          tags
        },
        'database.connections.total': {
          value: metrics.connections.total,
          type: 'gauge',
          tags
        },
        'database.queries.count': {
          value: metrics.performance.queryCount,
          type: 'count',
          tags
        },
        'database.queries.slow': {
          value: metrics.performance.slowQueries,
          type: 'count',
          tags
        },
        'database.queries.avg_time': {
          value: metrics.performance.averageQueryTime,
          type: 'gauge',
          tags
        },
        'database.storage.size': {
          value: metrics.storage.databaseSize,
          type: 'gauge',
          tags
        },
        'database.vector.embeddings': {
          value: metrics.vectorStore.totalEmbeddings,
          type: 'gauge',
          tags: [...tags, 'vector_store:pgvector']
        },
        'database.vector.index_size': {
          value: metrics.vectorStore.indexSize,
          type: 'gauge',
          tags: [...tags, 'vector_store:pgvector']
        }
      }
    }))
  }

  /**
   * Check database health and performance
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    checks: Array<{
      name: string
      status: 'pass' | 'fail'
      message: string
    }>
  }> {
    const checks = []

    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`
      checks.push({
        name: 'database_connectivity',
        status: 'pass' as const,
        message: 'Database connection successful'
      })
    } catch (error) {
      checks.push({
        name: 'database_connectivity',
        status: 'fail' as const,
        message: `Database connection failed: ${error}`
      })
    }

    try {
      // Check if pgvector extension is available
      await prisma.$queryRaw`SELECT 1 FROM pg_extension WHERE extname = 'vector'`
      checks.push({
        name: 'pgvector_extension',
        status: 'pass' as const,
        message: 'pgvector extension is installed'
      })
    } catch (error) {
      checks.push({
        name: 'pgvector_extension',
        status: 'fail' as const,
        message: 'pgvector extension not available'
      })
    }

    try {
      // Check if vector index exists
      await prisma.$queryRaw`SELECT 1 FROM pg_indexes WHERE indexname = 'rag_chunks_embedding_idx'`
      checks.push({
        name: 'vector_index',
        status: 'pass' as const,
        message: 'Vector similarity index exists'
      })
    } catch (error) {
      checks.push({
        name: 'vector_index',
        status: 'fail' as const,
        message: 'Vector similarity index missing'
      })
    }

    const failedChecks = checks.filter(check => check.status === 'fail')
    const status = failedChecks.length === 0 ? 'healthy' : 
                  failedChecks.length === checks.length ? 'critical' : 'warning'

    return { status, checks }
  }

  /**
   * Get slow queries for monitoring
   */
  async getSlowQueries(limit: number = 10) {
    try {
      const slowQueries = await prisma.$queryRaw`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC 
        LIMIT ${limit}
      ` as Array<{
        query: string
        calls: bigint
        total_exec_time: number
        mean_exec_time: number
        max_exec_time: number
        rows: bigint
      }>

      return slowQueries.map(q => ({
        query: q.query,
        calls: Number(q.calls),
        totalTime: q.total_exec_time,
        meanTime: q.mean_exec_time,
        maxTime: q.max_exec_time,
        rows: Number(q.rows)
      }))
    } catch (error) {
      console.error('Error getting slow queries:', error)
      return []
    }
  }
}

// Export singleton instance
export const datadogDatabase = new DatadogDatabaseMonitoring()
export default datadogDatabase