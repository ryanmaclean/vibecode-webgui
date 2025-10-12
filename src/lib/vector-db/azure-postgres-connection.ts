/**
 * Azure PostgreSQL Connection Module for GenAI Applications
 * 
 * This module provides specialized connection handling for Azure PostgreSQL Flexible Server
 * with pgvector extension enabled. It supports managed identity authentication, connection
 * pooling optimized for vector operations, automatic retry logic, and enhanced monitoring.
 * 
 * Designed for production AI workloads with comprehensive observability features.
 */
import { Pool, PoolClient, PoolConfig } from 'pg';
import { DefaultAzureCredential } from '@azure/identity';
import { metrics } from '../server-monitoring';
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';
import { logger } from '@/lib/logger';
// Re-export for convenience
export type { PoolClient };

/**
 * Azure PostgreSQL connection configuration
 */
export interface AzurePostgresConfig {
  // Connection details
  host: string;
  database: string;
  port?: number;
  
  // Authentication (choose one)
  username?: string;
  password?: string;
  useManagedIdentity?: boolean;
  
  // Connection pool settings
  maxPoolSize?: number;
  minPoolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  
  // Monitoring and logging
  enableMetrics?: boolean;
  enableLogging?: boolean;
  applicationName?: string;
  
  // Advanced settings
  statementTimeoutMs?: number;
  queryTrackingEnabled?: boolean;
  sslMode?: 'require' | 'prefer' | 'disable';
}

/**
 * Azure PostgreSQL Connection Manager
 * Optimized for pgvector operations with built-in monitoring
 */
export class AzurePostgresConnection {
  private pool: Pool | null = null;
  private config: AzurePostgresConfig;
  private errorHandler: VectorDbErrorHandler;
  private isInitialized = false;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  /**
   * Create a new Azure PostgreSQL connection manager
   */
  constructor(config: AzurePostgresConfig) {
    this.config = {
      // Default values
      port: 5432,
      maxPoolSize: 10,
      minPoolSize: 2,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
      enableMetrics: true,
      enableLogging: true,
      statementTimeoutMs: 30000,
      queryTrackingEnabled: true,
      sslMode: 'require',
      applicationName: 'vibecode-vector-db',
      ...config
    };
    
    this.errorHandler = new VectorDbErrorHandler(
      'azure-postgres', 
      this.config.enableLogging || false,
      this.config.enableMetrics || false
    );
  }
  
  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      const startTime = Date.now();
      const poolConfig = await this.createPoolConfig();
      
      this.pool = new Pool(poolConfig);
      
      // Set up event handlers
      this.pool.on('error', (err) => {
        if (this.config.enableLogging) {
          logger.error('Unexpected PostgreSQL pool error:', err);
        }
        if (this.config.enableMetrics) {
          metrics.increment('azure_postgres.pool.error');
        }
      });
      
      this.pool.on('connect', (client) => {
        if (this.config.enableLogging) {
          logger.info('New PostgreSQL client connected');
        }
        
        // Set application_name for all connections
        client.query(`SET application_name = '${this.config.applicationName}'`);
        
        // Enable query tracking if requested
        if (this.config.queryTrackingEnabled) {
          client.query('SET track_io_timing = ON');
          client.query('SET log_min_duration_statement = 1000'); // Log queries over 1s
        }
        
        // Set statement timeout
        if (this.config.statementTimeoutMs) {
          client.query(`SET statement_timeout = ${this.config.statementTimeoutMs}`);
        }
      });
      
      // Verify connection works and pgvector is available
      await this.verifyConnection();
      
      this.isInitialized = true;
      
      if (this.config.enableMetrics) {
        metrics.histogram('azure_postgres.initialize.duration', Date.now() - startTime);
        metrics.increment('azure_postgres.initialize.success');
      }
      
      if (this.config.enableLogging) {
        logger.info('Azure PostgreSQL connection initialized successfully');
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('azure_postgres.initialize.error');
      }
      
      if (this.config.enableLogging) {
        logger.error('Failed to initialize Azure PostgreSQL connection:', error);
      }
      
      throw this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'initialize',
        VectorDbErrorType.INITIALIZATION,
        true
      );
    }
  }
  
  /**
   * Get a client from the connection pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool || !this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        throw this.errorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          'getClient',
          VectorDbErrorType.CONNECTION_FAILED,
          true
        );
      }
    }
    
    if (!this.pool) {
      throw this.errorHandler.handleError(
        new Error('Pool is not initialized'),
        'getClient',
        VectorDbErrorType.CONNECTION_FAILED,
        true
      );
    }
    
    try {
      const startTime = Date.now();
      const client = await this.pool.connect();
      
      if (this.config.enableMetrics) {
        metrics.histogram('azure_postgres.get_client.duration', Date.now() - startTime);
        metrics.increment('azure_postgres.get_client.success');
        
        // Track current pool size
        const poolStatus = await this.getPoolStatus();
        metrics.gauge('azure_postgres.pool.total', poolStatus.total);
        metrics.gauge('azure_postgres.pool.idle', poolStatus.idle);
        metrics.gauge('azure_postgres.pool.active', poolStatus.active);
      }
      
      return client;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('azure_postgres.get_client.error');
      }
      
      throw this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'getClient',
        VectorDbErrorType.CONNECTION_FAILED,
        true
      );
    }
  }
  
  /**
   * Get current pool status metrics
   */
  async getPoolStatus(): Promise<{
    total: number;
    idle: number;
    active: number;
    waiting: number;
  }> {
    if (!this.pool) {
      return {
        total: 0,
        idle: 0,
        active: 0,
        waiting: 0
      };
    }
    
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      active: this.pool.totalCount - this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }
  
  /**
   * Execute a query with automatic retries
   */
  async executeQuery<T = any>(
    queryText: string,
    params: any[] = [],
    options: {
      retryCount?: number;
      useTransaction?: boolean;
    } = {}
  ): Promise<T[]> {
    const retryCount = options.retryCount ?? this.MAX_RETRY_ATTEMPTS;
    const useTransaction = options.useTransaction ?? false;
    
    let client: PoolClient | null = null;
    let attempt = 0;
    
    while (attempt < retryCount) {
      attempt++;
      
      try {
        client = await this.getClient();
        const startTime = Date.now();
        
        let queryResult: any;
        
        if (useTransaction) {
          await client.query('BEGIN');
          queryResult = await client.query(queryText, params);
          await client.query('COMMIT');
        } else {
          queryResult = await client.query(queryText, params);
        }
        
        if (this.config.enableMetrics) {
          metrics.histogram('azure_postgres.query.duration', Date.now() - startTime);
          metrics.increment('azure_postgres.query.success');
        }
        
        return queryResult.rows as T[];
      } catch (error) {
        if (this.config.enableMetrics) {
          metrics.increment('azure_postgres.query.error');
        }
        
        if (client && useTransaction) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            if (this.config.enableLogging) {
              logger.error('Error during transaction rollback:', rollbackError);
            }
          }
        }
        
        const isRetryable = this.isRetryableError(error);
        
        if (attempt >= retryCount || !isRetryable) {
          throw this.errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            'executeQuery',
            VectorDbErrorType.QUERY_FAILED,
            false
          );
        }
        
        if (this.config.enableLogging) {
          logger.warn(`Retrying query after error (attempt ${attempt}/${retryCount}):`, error);
        }
        
        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      } finally {
        if (client) {
          client.release();
        }
      }
    }
    
    // This should never be reached due to the throw in the catch block
    throw new Error('Unexpected error: max retries exceeded without throw');
  }
  
  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    
    // Connection-related errors are retryable
    const retryableErrorMessages = [
      'connection timeout',
      'connection terminated',
      'Connection terminated',
      'Connection terminated unexpectedly',
      'server closed the connection unexpectedly',
      'the database system is starting up',
      'too many clients',
      'remaining connection slots are reserved',
      'sorry, too many clients already'
    ];
    
    // Check if the error message contains any of the retryable phrases
    return retryableErrorMessages.some(msg => error.message.includes(msg));
  }
  
  /**
   * Verify connection and pgvector availability
   */
  private async verifyConnection(): Promise<void> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool!.connect();
      
      // Check basic connectivity
      const result = await client.query('SELECT 1 as connected');
      if (result.rows[0].connected !== 1) {
        throw new Error('PostgreSQL connectivity check failed');
      }
      
      // First check if pgvector is available in the available extensions
      const availableExtResult = await client.query(`
        SELECT * FROM pg_available_extensions WHERE name = 'vector'
      `);
      
      if (availableExtResult.rowCount === 0) {
        if (this.config.enableLogging) {
          logger.error('⚠️ pgvector extension is not available on this Azure PostgreSQL server');
          logger.error('⚠️ Please contact Azure support to enable the pgvector extension for your server');
        }
        throw new Error('pgvector extension is not available in pg_available_extensions. Contact Azure support to enable it.');
      }
      
      // Try to create the extension if it's available but not installed yet
      try {
        // First check if already installed
        const installedExtResult = await client.query(`
          SELECT extname FROM pg_extension WHERE extname = 'vector'
        `);
        
        if (installedExtResult.rowCount === 0) {
          if (this.config.enableLogging) {
            logger.info('pgvector extension is available but not installed. Attempting to create extension...');
          }
          
          // Try to create the extension directly (without using shared_preload_libraries)
          await client.query('CREATE EXTENSION IF NOT EXISTS vector');
          
          if (this.config.enableLogging) {
            logger.info('Successfully created pgvector extension');
          }
        }
      } catch (extError) {
        const errorMsg = extError instanceof Error ? extError.message : String(extError);
        
        // Check for specific Azure PostgreSQL shared_preload_libraries error
        if (errorMsg.includes('shared_preload_libraries') || 
            errorMsg.includes('ServerParameterToCMSUnAllowedParameterValue') ||
            errorMsg.toLowerCase().includes('value \'vector\' is invalid for server parameter')) {
          
          if (this.config.enableLogging) {
            logger.error('⚠️ Azure PostgreSQL does not allow adding vector to shared_preload_libraries');
            logger.error('⚠️ However, you can still use pgvector directly. Please see our documentation:');
            logger.error('⚠️ docs/azure-postgres-pgvector-guide.md');
          }
          
          throw new Error('Azure PostgreSQL does not allow adding vector to shared_preload_libraries. See docs/azure-postgres-pgvector-guide.md');
        }
        
        // For other errors, just propagate them
        throw extError;
      }
      
      // Verify pgvector extension is properly installed and working
      try {
        // Check if vector type exists
        await client.query(`SELECT '[1,2,3]'::vector`);
        
        if (this.config.enableLogging) {
          logger.info('✅ PostgreSQL connection verified with pgvector extension working properly');
        }
      } catch (vectorTypeError) {
        throw new Error(`pgvector extension is installed but vector type is not working: ${vectorTypeError instanceof Error ? vectorTypeError.message : String(vectorTypeError)}`);
      }
    } catch (error) {
      throw this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'verifyConnection',
        VectorDbErrorType.INITIALIZATION,
        true
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
  
  /**
   * Create pool configuration with support for managed identity
   */
  private async createPoolConfig(): Promise<PoolConfig> {
    const baseConfig: PoolConfig = {
      host: this.config.host,
      database: this.config.database,
      port: this.config.port,
      max: this.config.maxPoolSize,
      min: this.config.minPoolSize,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,
      ssl: this.config.sslMode === 'require' ? true : false,
    };
    
    // Regular username/password authentication
    if (this.config.username && this.config.password) {
      return {
        ...baseConfig,
        user: this.config.username,
        password: this.config.password,
      };
    }
    
    // Azure Managed Identity authentication
    if (this.config.useManagedIdentity) {
      if (this.config.enableLogging) {
        logger.info('Using Azure Managed Identity for PostgreSQL authentication');
      }
      
      try {
        const credential = new DefaultAzureCredential();
        const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
        
        return {
          ...baseConfig,
          user: this.config.username || 'azure-identity',
          password: token?.token || '',
          // Set connection parameters for managed identity
          ssl: {
            rejectUnauthorized: true,
          },
        };
      } catch (error) {
        if (this.config.enableLogging) {
          logger.error('Failed to get token from Azure Managed Identity:', error);
        }
        throw error;
      }
    }
    
    throw new Error('Either username/password or useManagedIdentity must be provided');
  }
  
  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isInitialized = false;
      
      if (this.config.enableLogging) {
        logger.info('Azure PostgreSQL connection pool closed');
      }
    }
  }
  
  /**
   * Helper function to create vector-specific queries with Azure PostgreSQL compatibility
   */
  static createVectorQuery(dimensions: number = 1536): string {
    return `-- First check if pgvector is available in this server
            DO $$
            DECLARE
              vector_available BOOLEAN;
            BEGIN
              SELECT EXISTS(
                SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
              ) INTO vector_available;
              
              IF NOT vector_available THEN
                RAISE EXCEPTION 'pgvector extension is not available on this Azure PostgreSQL server. Please contact Azure support to enable it.';
              END IF;
            END
            $$;
            
            -- Create extension if not exists
            -- This works on Azure PostgreSQL without requiring shared_preload_libraries
            CREATE EXTENSION IF NOT EXISTS vector;
            
            -- Verify vector type exists
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'vector'
              ) THEN
                RAISE EXCEPTION 'vector type not found after creating extension. Please check server configuration.';
              END IF;
            END
            $$;
            
            -- Check if vector dimensions need to be increased
            DO $$
            DECLARE
              current_dimensions INTEGER;
            BEGIN
              SELECT typmod INTO current_dimensions FROM pg_type WHERE typname = 'vector';
              IF current_dimensions < ${dimensions} THEN
                EXECUTE 'ALTER TYPE vector SET (DIMENSIONS = ' || ${dimensions} || ')';
              END IF;
            END
            $$;
            
            -- Test vector operations to ensure everything is working
            DO $$
            DECLARE
              test_result FLOAT;
            BEGIN
              SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector INTO test_result;
              -- If we got here, vector operations are working
            EXCEPTION WHEN OTHERS THEN
              RAISE EXCEPTION 'Vector operations test failed: %', SQLERRM;
            END
            $$;`;
  }
  
  /**
   * Helper function to create optimized vector index
   */
  static createVectorIndexQuery(
    tableName: string,
    columnName: string,
    indexName: string,
    indexType: 'hnsw' | 'ivfflat' = 'hnsw'
  ): string {
    if (indexType === 'hnsw') {
      // HNSW index (better quality, more storage)
      return `CREATE INDEX IF NOT EXISTS ${indexName}
              ON ${tableName} USING hnsw (${columnName} vector_cosine_ops)
              WITH (m = 16, ef_construction = 64);`;
    } else {
      // IVFFlat index (faster build, less storage)
      return `CREATE INDEX IF NOT EXISTS ${indexName}
              ON ${tableName} USING ivfflat (${columnName} vector_cosine_ops)
              WITH (lists = 100);`;
    }
  }
  
  /**
   * Helper function to run EXPLAIN ANALYZE and get query plan
   */
  async explainQuery(query: string, params: any[] = []): Promise<string> {
    const explainQuery = `EXPLAIN (ANALYZE, VERBOSE, BUFFERS, FORMAT JSON) ${query}`;
    const result = await this.executeQuery<{ [key: string]: any }>(explainQuery, params);
    return JSON.stringify(result[0], null, 2);
  }
  
  /**
   * Get connection statistics for monitoring
   */
  async getDatabaseStats(): Promise<{
    connections: {
      active: number;
      idle: number;
      total: number;
    };
    performance: {
      slowQueries: {
        query: string;
        executionTime: number;
        calls: number;
      }[];
    };
    vectorStats: {
      indexSize: number;
      tableSize: number;
      estimatedRows: number;
    };
  }> {
    try {
      // Get connection stats
      const connStats = await this.executeQuery(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      // Get slow queries
      const slowQueries = await this.executeQuery(`
        SELECT 
          query,
          mean_exec_time as execution_time,
          calls
        FROM pg_stat_statements 
        WHERE mean_exec_time > 1000
        ORDER BY mean_exec_time DESC 
        LIMIT 5
      `);
      
      // Get vector table stats
      const vectorStats = await this.executeQuery(`
        SELECT
          pg_relation_size('rag_chunks') as table_size,
          pg_relation_size('rag_chunks_embedding_idx') as index_size,
          n_live_tup as estimated_rows
        FROM pg_stat_user_tables
        WHERE relname = 'rag_chunks'
      `);
      
      return {
        connections: {
          active: parseInt(connStats[0]?.active_connections || '0', 10),
          idle: parseInt(connStats[0]?.idle_connections || '0', 10),
          total: parseInt(connStats[0]?.total_connections || '0', 10)
        },
        performance: {
          slowQueries: slowQueries.map(q => ({
            query: q.query,
            executionTime: parseFloat(q.execution_time),
            calls: parseInt(q.calls, 10)
          }))
        },
        vectorStats: {
          tableSize: parseInt(vectorStats[0]?.table_size || '0', 10),
          indexSize: parseInt(vectorStats[0]?.index_size || '0', 10),
          estimatedRows: parseInt(vectorStats[0]?.estimated_rows || '0', 10)
        }
      };
    } catch (error) {
      if (this.config.enableLogging) {
        logger.error('Error getting database stats:', error);
      }
      
      if (this.config.enableMetrics) {
        metrics.increment('azure_postgres.get_stats.error');
      }
      
      throw error;
    }
  }
}

/**
 * Create a connection to Azure PostgreSQL with default configuration
 */
export async function createAzurePostgresConnection(
  config: AzurePostgresConfig
): Promise<AzurePostgresConnection> {
  const connection = new AzurePostgresConnection(config);
  await connection.initialize();
  return connection;
}

/**
 * Example usage for Azure PostgreSQL connection
 * 
 * ```typescript
 * // With username/password
 * const connection = await createAzurePostgresConnection({
 *   host: 'my-server.postgres.database.azure.com',
 *   database: 'my-database',
 *   username: 'my-username',
 *   password: 'my-password'
 * });
 * 
 * // With managed identity
 * const connection = await createAzurePostgresConnection({
 *   host: 'my-server.postgres.database.azure.com',
 *   database: 'my-database',
 *   useManagedIdentity: true
 * });
 * 
 * // Execute a query
 * const results = await connection.executeQuery(
 *   'SELECT * FROM rag_chunks WHERE embedding <=> $1 ORDER BY embedding <=> $1 LIMIT $2',
 *   [embeddingVector, 10]
 * );
 * ```
 * 
 * ## Important Note on pgvector with Azure PostgreSQL
 * 
 * Azure PostgreSQL Flexible Server does not allow adding 'vector' to the 
 * shared_preload_libraries parameter, which is mentioned in many pgvector guides.
 * 
 * Instead, this class handles the limitation by:
 * 
 * 1. Checking if pgvector is available in pg_available_extensions
 * 2. Creating the extension directly without modifying shared_preload_libraries
 * 3. Verifying vector operations work correctly
 * 
 * If you encounter errors about 'vector' being invalid for shared_preload_libraries,
 * you can use our approach as demonstrated in the createVectorQuery method.
 * 
 * For more details, see: docs/azure-postgres-pgvector-guide.md
 */