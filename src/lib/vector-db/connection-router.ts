import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseLogger } from '../db/database-logger';

/**
 * Interface for database pool operations
 * This allows for dependency injection and easier testing
 */
export interface DatabasePool {
  query<T extends QueryResultRow = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  connect(): Promise<DatabasePoolClient>;
  end(): Promise<void>;
  totalCount: number;
  idleCount: number;
}

/**
 * Interface for database pool client operations
 */
export interface DatabasePoolClient {
  query<T extends QueryResultRow = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  release(): void;
}

/**
 * Factory interface for creating database pools
 */
export interface DatabasePoolFactory {
  createPool(config: ConnectionPoolSettings): DatabasePool;
}

/**
 * Default implementation of DatabasePoolFactory using pg Pool
 */
export class DefaultDatabasePoolFactory implements DatabasePoolFactory {
  createPool(config: ConnectionPoolSettings): DatabasePool {
    const pool = new Pool({
      ...config,
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000
    });

    return {
      query: pool.query.bind(pool),
      connect: async () => {
        const client = await pool.connect();
        return {
          query: client.query.bind(client),
          release: client.release.bind(client)
        };
      },
      end: pool.end.bind(pool),
      totalCount: pool.totalCount,
      idleCount: pool.idleCount
    };
  }
}

/**
 * Query types for routing decisions
 */
export enum QueryType {
  READ = 'read',
  WRITE = 'write',
  TRANSACTION = 'transaction',
  UNKNOWN = 'unknown'
}

/**
 * Interface for connection pool settings
 */
export interface ConnectionPoolSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Interface for query analyzer options
 */
export interface QueryAnalyzerOptions {
  /**
   * Force all queries to primary (for maintenance or emergency)
   */
  forceRouteToPrimary?: boolean;
  
  /**
   * The maximum lag in milliseconds that is acceptable for a read replica
   */
  maxReplicaLagMs?: number;
  
  /**
   * Pattern to match read-only queries 
   */
  readOnlyPattern?: RegExp;
  
  /**
   * Pattern to match write queries
   */
  writePattern?: RegExp;
  
  /**
   * Pattern to match transaction queries
   */
  transactionPattern?: RegExp;
  
  /**
   * Enable caching for read-only queries
   */
  enableQueryCache?: boolean;
  
  /**
   * Default TTL for cached queries in milliseconds
   */
  defaultCacheTTL?: number;
}

/**
 * Interface for query routing options
 */
export interface QueryRoutingOptions {
  /**
   * Force this query to use the primary connection
   */
  forcePrimary?: boolean;
  
  /**
   * Cache key for query caching
   */
  cacheKey?: string;
  
  /**
   * TTL for this specific query in cache (in milliseconds)
   */
  cacheTTL?: number;
  
  /**
   * Timeout for this query in milliseconds
   */
  queryTimeout?: number;
  
  /**
   * Tag for this query for monitoring purposes
   */
  queryTag?: string;
}

/**
 * QueryAnalyzer class for analyzing SQL queries to determine routing
 */
export class QueryAnalyzer {
  private options: QueryAnalyzerOptions;
  private logger = getDatabaseLogger();
  
  constructor(options: QueryAnalyzerOptions = {}) {
    this.options = {
      forceRouteToPrimary: false,
      maxReplicaLagMs: 1000,
      readOnlyPattern: /^SELECT |^WITH (?!.*FOR UPDATE)|^EXPLAIN |^SHOW /i,
      writePattern: /^INSERT |^UPDATE |^DELETE |^TRUNCATE |^ALTER |^DROP |^CREATE /i,
      transactionPattern: /^BEGIN|^START TRANSACTION|^COMMIT|^ROLLBACK|^SAVEPOINT|^RELEASE/i,
      enableQueryCache: false,
      defaultCacheTTL: 60000, // 1 minute
      ...options
    };
  }
  
  /**
   * Analyze a SQL query to determine its type for routing
   */
  public analyzeQueryType(query: string): QueryType {
    // Force all queries to primary if configured
    if (this.options.forceRouteToPrimary) {
      return QueryType.WRITE;
    }
    
    // Normalize query by removing extra whitespace
    const normalizedQuery = query.trim();
    
    // Check for transaction-related queries
    if (this.options.transactionPattern && this.options.transactionPattern.test(normalizedQuery)) {
      return QueryType.TRANSACTION;
    }
    
    // Check for write queries
    if (this.options.writePattern && this.options.writePattern.test(normalizedQuery)) {
      return QueryType.WRITE;
    }
    
    // Check for read queries
    if (this.options.readOnlyPattern && this.options.readOnlyPattern.test(normalizedQuery)) {
      return QueryType.READ;
    }
    
    // If not recognized, default to sending to primary for safety
    this.logger.warn(`Unrecognized query type, routing to primary: ${normalizedQuery.substring(0, 100)}...`);
    return QueryType.UNKNOWN;
  }
}

/**
 * ReplicaHealthStatus interface for tracking replica health
 */
interface ReplicaHealthStatus {
  isHealthy: boolean;
  lastChecked: Date;
  replicationLagMs?: number;
  errorCount: number;
  lastError?: Error;
}

/**
 * VectorDBConnectionRouter class for routing database queries to appropriate connections
 */
export class VectorDBConnectionRouter {
  private primaryPool: DatabasePool;
  private replicaPools: DatabasePool[] = [];
  private queryAnalyzer: QueryAnalyzer;
  private replicaHealth: Map<string, ReplicaHealthStatus> = new Map();
  private logger = getDatabaseLogger();
  
  private inTransaction = false;
  private transactionClient: DatabasePoolClient | null = null;
  private _primaryPoolSettings: ConnectionPoolSettings;
  private replicaPoolSettings: ConnectionPoolSettings[];
  
  /**
   * Constructor
   * @param primarySettings Primary database connection pool settings
   * @param replicaSettings Array of read replica connection pool settings
   * @param analyzerOptions Options for the query analyzer
   * @param poolFactory Factory for creating database pools (optional, uses default if not provided)
   */
  constructor(
    primarySettings: ConnectionPoolSettings,
    replicaSettings: ConnectionPoolSettings[] = [],
    analyzerOptions: QueryAnalyzerOptions = {},
    poolFactory: DatabasePoolFactory = new DefaultDatabasePoolFactory()
  ) {
    this._primaryPoolSettings = primarySettings;
    this.replicaPoolSettings = replicaSettings;
    this.queryAnalyzer = new QueryAnalyzer(analyzerOptions);
    
    // Initialize primary pool using factory
    this.primaryPool = poolFactory.createPool({
      ...primarySettings,
      max: primarySettings.max || 10,
      idleTimeoutMillis: primarySettings.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: primarySettings.connectionTimeoutMillis || 5000
    });
    
    // Initialize replica pools using factory
    if (replicaSettings.length > 0) {
      this.replicaPools = replicaSettings.map((settings, index) => {
        const pool = poolFactory.createPool({
          ...settings,
          max: settings.max || 20,
          idleTimeoutMillis: settings.idleTimeoutMillis || 30000,
          connectionTimeoutMillis: settings.connectionTimeoutMillis || 5000
        });
        
        // Initialize health status
        const key = `replica-${index}-${settings.host}:${settings.port}`;
        this.replicaHealth.set(key, {
          isHealthy: true,
          lastChecked: new Date(),
          errorCount: 0
        });
        
        return pool;
      });
    }
    
    this.logger.info(`Initialized VectorDBConnectionRouter with ${this.replicaPools.length} replicas`);
    
    // Set up health check interval
    setInterval(() => this.checkReplicaHealth(), 30000);
  }
  
  /**
   * Route a query to the appropriate database connection
   * @param query SQL query to execute
   * @param params Query parameters
   * @param options Routing options
   * @returns Query result
   */
  public async routeQuery<T extends QueryResultRow = any>(
    query: string,
    params: any[] = [],
    options: QueryRoutingOptions = {}
  ): Promise<QueryResult<T>> {
    // Check if we're in a transaction
    if (this.inTransaction && this.transactionClient) {
      return this.transactionClient.query(query, params);
    }
    
    // Force primary if specified in options
    if (options.forcePrimary) {
      return this.routeToPrimary<T>(query, params);
    }
    
    // Analyze query type
    const queryType = this.queryAnalyzer.analyzeQueryType(query);
    
    // Route based on query type
    switch (queryType) {
      case QueryType.READ:
        return this.routeToReadReplica<T>(query, params, options);
      case QueryType.WRITE:
      case QueryType.TRANSACTION:
      case QueryType.UNKNOWN:
      default:
        return this.routeToPrimary<T>(query, params);
    }
  }
  
  /**
   * Route a query to the primary database
   * @param query SQL query
   * @param params Query parameters
   * @returns Query result
   */
  private async routeToPrimary<T extends QueryResultRow = any>(
    query: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await this.primaryPool.query<T>(query, params);
      
      const duration = Date.now() - startTime;
      this.logger.debug(`Primary query completed in ${duration}ms`, {
        queryText: query.substring(0, 100),
        paramsCount: params.length,
        rowCount: result.rowCount
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Primary query failed after ${duration}ms: ${(error as Error).message}`, {
        queryText: query.substring(0, 100),
        paramsCount: params.length,
        errorMessage: (error as Error).message
      });
      
      throw error;
    }
  }
  
  /**
   * Route a query to a read replica using load balancing
   * @param query SQL query
   * @param params Query parameters
   * @param options Routing options
   * @returns Query result
   */
  private async routeToReadReplica<T extends QueryResultRow = any>(
    query: string,
    params: any[] = [],
    _options: QueryRoutingOptions = {}
  ): Promise<QueryResult<T>> {
    // If no replicas available, fall back to primary
    if (this.replicaPools.length === 0) {
      this.logger.debug('No replicas available, routing read query to primary');
      return this.routeToPrimary<T>(query, params);
    }
    
    const startTime = Date.now();
    
    // Select a healthy replica using round-robin with health check
    const healthyReplicas = Array.from(this.replicaHealth.entries())
      .filter(([_, status]) => status.isHealthy)
      .map(([key, _]) => {
        // Extract index from key format "replica-{index}-{host}:{port}"
        const index = parseInt(key.split('-')[1], 10);
        return index;
      });
    
    // If no healthy replicas, route to primary
    if (healthyReplicas.length === 0) {
      this.logger.warn('No healthy replicas available, routing read query to primary');
      return this.routeToPrimary<T>(query, params);
    }
    
    // Simple round-robin selection among healthy replicas
    const replicaIndex = healthyReplicas[Math.floor(Math.random() * healthyReplicas.length)];
    const selectedPool = this.replicaPools[replicaIndex];
    const replicaKey = `replica-${replicaIndex}-${this.replicaPoolSettings[replicaIndex].host}:${this.replicaPoolSettings[replicaIndex].port}`;
    
    try {
      const result = await selectedPool.query<T>(query, params);
      
      const duration = Date.now() - startTime;
      this.logger.debug(`Replica query completed in ${duration}ms`, {
        replicaKey,
        queryText: query.substring(0, 100),
        paramsCount: params.length,
        rowCount: result.rowCount
      });
      
      // Update health status
      const health = this.replicaHealth.get(replicaKey);
      if (health) {
        health.lastChecked = new Date();
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Replica query failed after ${duration}ms: ${(error as Error).message}`, {
        replicaKey,
        queryText: query.substring(0, 100),
        paramsCount: params.length,
        errorMessage: (error as Error).message
      });
      
      // Update health status
      const health = this.replicaHealth.get(replicaKey);
      if (health) {
        health.errorCount++;
        health.lastError = error as Error;
        
        // Mark as unhealthy if too many errors
        if (health.errorCount >= 5) {
          health.isHealthy = false;
          this.logger.warn(`Marking replica ${replicaKey} as unhealthy due to too many errors`);
        }
      }
      
      // Fall back to primary
      this.logger.info(`Falling back to primary after replica query failure`);
      return this.routeToPrimary<T>(query, params);
    }
  }
  
  /**
   * Begin a transaction on the primary
   */
  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    
    try {
      this.transactionClient = await this.primaryPool.connect();
      await this.transactionClient.query('BEGIN');
      this.inTransaction = true;
      this.logger.debug('Transaction started');
    } catch (error) {
      if (this.transactionClient) {
        this.transactionClient.release();
        this.transactionClient = null;
      }
      this.logger.error(`Failed to begin transaction: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Commit the current transaction
   */
  public async commitTransaction(): Promise<void> {
    if (!this.inTransaction || !this.transactionClient) {
      throw new Error('No transaction in progress');
    }
    
    try {
      await this.transactionClient.query('COMMIT');
      this.logger.debug('Transaction committed');
    } catch (error) {
      this.logger.error(`Failed to commit transaction: ${(error as Error).message}`);
      throw error;
    } finally {
      if (this.transactionClient) {
        this.transactionClient.release();
        this.transactionClient = null;
      }
      this.inTransaction = false;
    }
  }
  
  /**
   * Rollback the current transaction
   */
  public async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction || !this.transactionClient) {
      throw new Error('No transaction in progress');
    }
    
    try {
      await this.transactionClient.query('ROLLBACK');
      this.logger.debug('Transaction rolled back');
    } catch (error) {
      this.logger.error(`Failed to rollback transaction: ${(error as Error).message}`);
      throw error;
    } finally {
      if (this.transactionClient) {
        this.transactionClient.release();
        this.transactionClient = null;
      }
      this.inTransaction = false;
    }
  }
  
  /**
   * Check the health of all replicas
   */
  private async checkReplicaHealth(): Promise<void> {
    for (let i = 0; i < this.replicaPools.length; i++) {
      const pool = this.replicaPools[i];
      const settings = this.replicaPoolSettings[i];
      const key = `replica-${i}-${settings.host}:${settings.port}`;
      
      try {
        // Check if replica is responsive
        const result = await pool.query('SELECT 1 as health_check');
        
        if (result.rows[0]?.health_check === 1) {
          // Check replication lag
          try {
            const lagResult = await pool.query<{ lag_ms: number }>(
              `SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 as lag_ms`
            );
            
            const lagMs = lagResult.rows[0]?.lag_ms || 0;
            const maxLagMs = this.queryAnalyzer['options'].maxReplicaLagMs || 1000;
            
            const health = this.replicaHealth.get(key) || {
              isHealthy: true,
              lastChecked: new Date(),
              errorCount: 0
            };
            
            health.replicationLagMs = lagMs;
            health.lastChecked = new Date();
            
            // Check if lag is acceptable
            if (lagMs > maxLagMs) {
              this.logger.warn(`Replica ${key} has high replication lag: ${lagMs}ms`);
              health.isHealthy = false;
            } else {
              // Reset error count and mark as healthy
              health.errorCount = 0;
              health.isHealthy = true;
            }
            
            this.replicaHealth.set(key, health);
          } catch (error) {
            this.logger.warn(`Failed to check replication lag for ${key}: ${(error as Error).message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Health check failed for replica ${key}: ${(error as Error).message}`);
        
        const health = this.replicaHealth.get(key);
        if (health) {
          health.errorCount++;
          health.lastError = error as Error;
          health.isHealthy = false;
          health.lastChecked = new Date();
          this.replicaHealth.set(key, health);
        }
      }
    }
    
    // Log summary of replica health
    const healthySummary = Array.from(this.replicaHealth.entries())
      .map(([key, status]) => `${key}: ${status.isHealthy ? 'healthy' : 'unhealthy'}${status.replicationLagMs ? ` (lag: ${status.replicationLagMs}ms)` : ''}`)
      .join(', ');
    
    this.logger.info(`Replica health check completed: ${healthySummary}`);
  }
  
  /**
   * Close all database connections
   */
  public async close(): Promise<void> {
    if (this.inTransaction && this.transactionClient) {
      try {
        await this.transactionClient.query('ROLLBACK');
      } catch (error) {
        this.logger.error(`Failed to rollback transaction during close: ${(error as Error).message}`);
      } finally {
        this.transactionClient.release();
        this.transactionClient = null;
        this.inTransaction = false;
      }
    }
    
    // Close all replica pools
    for (let i = 0; i < this.replicaPools.length; i++) {
      try {
        await this.replicaPools[i].end();
      } catch (error) {
        this.logger.error(`Failed to close replica pool ${i}: ${(error as Error).message}`);
      }
    }
    
    // Close primary pool
    try {
      await this.primaryPool.end();
    } catch (error) {
      this.logger.error(`Failed to close primary pool: ${(error as Error).message}`);
    }
    
    this.logger.info('VectorDBConnectionRouter closed all connections');
  }
  
  /**
   * Get the health status of all connections
   */
  public getConnectionStatus(): {
    primary: { poolSize: number; available: number; idle: number };
    replicas: Array<{ index: number; host: string; port: number; healthy: boolean; lagMs?: number; poolSize: number }>;
  } {
    const primaryStatus = {
      poolSize: this.primaryPool.totalCount,
      available: this.primaryPool.idleCount,
      idle: this.primaryPool.idleCount
    };
    
    const replicaStatus = Array.from(this.replicaHealth.entries())
      .map(([key, status]) => {
        // Extract index and connection info from key format "replica-{index}-{host}:{port}"
        const [_, indexStr, hostPort] = key.split('-');
        const index = parseInt(indexStr, 10);
        const [host, portStr] = hostPort.split(':');
        const port = parseInt(portStr, 10);
        
        return {
          index,
          host,
          port,
          healthy: status.isHealthy,
          lagMs: status.replicationLagMs,
          poolSize: this.replicaPools[index]?.totalCount || 0
        };
      });
    
    return {
      primary: primaryStatus,
      replicas: replicaStatus
    };
  }
}