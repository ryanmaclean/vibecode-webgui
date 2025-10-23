import { PoolClient, QueryResult } from 'pg';
import { getDatabaseLogger } from '../../db/database-logger';
import { getDatabaseMetricsCollector } from '../../db/db-metrics';
import { LogCategory } from '../../db/db-types';

/**
 * Query types for routing decisions
 */
export enum QueryType {
  READ = 'read',
  WRITE = 'write',
  MIXED = 'mixed',
  TRANSACTION = 'transaction'
}

/**
 * Query analyzer for determining query type
 */
export class QueryAnalyzer {
  /**
   * Analyze query to determine its type
   */
  public analyzeQueryType(query: string): QueryType {
    const normalizedQuery = query.trim().toUpperCase();
    
    // Check for transaction control statements
    if (
      normalizedQuery.startsWith('BEGIN') ||
      normalizedQuery.startsWith('START TRANSACTION') ||
      normalizedQuery.startsWith('COMMIT') ||
      normalizedQuery.startsWith('ROLLBACK') ||
      normalizedQuery.startsWith('SAVEPOINT') ||
      normalizedQuery.includes('FOR UPDATE')
    ) {
      return QueryType.TRANSACTION;
    }
    
    // Check for common write operations
    if (
      normalizedQuery.startsWith('INSERT') ||
      normalizedQuery.startsWith('UPDATE') ||
      normalizedQuery.startsWith('DELETE') ||
      normalizedQuery.startsWith('CREATE') ||
      normalizedQuery.startsWith('ALTER') ||
      normalizedQuery.startsWith('DROP') ||
      normalizedQuery.startsWith('TRUNCATE')
    ) {
      return QueryType.WRITE;
    }
    
    // Check for read operations
    if (
      normalizedQuery.startsWith('SELECT') ||
      normalizedQuery.startsWith('WITH') && !normalizedQuery.includes('UPDATE') && !normalizedQuery.includes('DELETE') ||
      normalizedQuery.startsWith('SHOW') ||
      normalizedQuery.startsWith('EXPLAIN')
    ) {
      return QueryType.READ;
    }
    
    // Default to MIXED for uncertain cases
    return QueryType.MIXED;
  }
}

/**
 * Connection health and status
 */
interface ConnectionStatus {
  healthy: boolean;
  lastChecked: number;
  latency: number;
  failureCount: number;
  url: string;
  poolId: string;
}

/**
 * Options for the connection router
 */
export interface ConnectionRouterOptions {
  primaryConnection: PoolClient;
  readReplicas?: PoolClient[];
  queryTimeout?: number;
  healthCheckInterval?: number;
  maxFailureCount?: number;
  logQueriesSlowerThan?: number;
  routeAllQueriesToPrimary?: boolean;
  routeVectorQueriesToReplicas?: boolean;
  enableMetrics?: boolean;
}

/**
 * Routes database queries between primary and replica databases
 */
export class VectorDBConnectionRouter {
  private primaryConnection: PoolClient;
  private readReplicas: PoolClient[] = [];
  private queryAnalyzer: QueryAnalyzer;
  private logger = getDatabaseLogger({ defaultCategory: LogCategory.CONNECTION });
  private metricsCollector = getDatabaseMetricsCollector();
  
  private primaryStatus: ConnectionStatus;
  private replicaStatus: Map<string, ConnectionStatus> = new Map();
  
  private healthCheckInterval: number;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private maxFailureCount: number;
  private queryTimeout: number;
  private logQueriesSlowerThan: number;
  private routeAllQueriesToPrimary: boolean;
  private routeVectorQueriesToReplicas: boolean;
  private enableMetrics: boolean;
  
  /**
   * Create a new connection router
   */
  constructor(options: ConnectionRouterOptions) {
    this.primaryConnection = options.primaryConnection;
    this.readReplicas = options.readReplicas || [];
    this.queryAnalyzer = new QueryAnalyzer();
    
    this.queryTimeout = options.queryTimeout || 30000;
    this.healthCheckInterval = options.healthCheckInterval || 60000;
    this.maxFailureCount = options.maxFailureCount || 3;
    this.logQueriesSlowerThan = options.logQueriesSlowerThan || 1000;
    this.routeAllQueriesToPrimary = options.routeAllQueriesToPrimary || false;
    this.routeVectorQueriesToReplicas = options.routeVectorQueriesToReplicas || true;
    this.enableMetrics = options.enableMetrics !== undefined ? options.enableMetrics : true;
    
    // Initialize connection status
    this.primaryStatus = {
      healthy: true,
      lastChecked: Date.now(),
      latency: 0,
      failureCount: 0,
      url: 'primary',
      poolId: 'primary'
    };
    
    // Initialize replica status
    this.readReplicas.forEach((_, index) => {
      const replicaId = `replica-${index}`;
      this.replicaStatus.set(replicaId, {
        healthy: true,
        lastChecked: Date.now(),
        latency: 0,
        failureCount: 0,
        url: replicaId,
        poolId: replicaId
      });
    });
    
    // Start health checks
    this.startHealthChecks();
    
    this.console.log(`Initialized connection router with ${this.readReplicas.length} read replicas`);
  }
  
  /**
   * Routes a query to the appropriate connection based on query type
   */
  public async routeQuery(query: string, params: any[] = []): Promise<QueryResult> {
    const queryType = this.queryAnalyzer.analyzeQueryType(query);
    const startTime = Date.now();
    let result: QueryResult;
    
    try {
      if (
        (queryType === QueryType.READ && !this.routeAllQueriesToPrimary) ||
        (this.isVectorQuery(query) && this.routeVectorQueriesToReplicas)
      ) {
        result = await this.routeToReadReplica(query, params);
      } else {
        result = await this.routeToPrimary(query, params);
      }
      
      // Log slow queries
      const duration = Date.now() - startTime;
      if (duration > this.logQueriesSlowerThan) {
        this.console.warn(`Slow query detected (${duration}ms): ${query.substring(0, 100)}...`);
      }
      
      // Record metrics
      if (this.enableMetrics) {
        this.metricsCollector.recordQuery(
          query,
          duration,
          true,
          {
            type: this.queryAnalyzer.analyzeQueryType(query),
            table: undefined
          }
        );
      }
      
      return result;
    } catch (error) {
      this.console.error(`Query error: ${(error as Error).message}`, error as Error, {
        query: query.substring(0, 200),
        params,
        queryType
      });
      throw error;
    }
  }
  
  /**
   * Routes a query to the primary database
   */
  private async routeToPrimary(query: string, params: any[] = []): Promise<QueryResult> {
    if (!this.primaryStatus.healthy) {
      throw new Error('Primary database is not healthy');
    }
    
    try {
      const result = await this.executeWithTimeout(
        this.primaryConnection,
        query,
        params,
        this.queryTimeout
      );
      
      // Reset failure count on success
      this.primaryStatus.failureCount = 0;
      
      return result;
    } catch (error) {
      // Increment failure count
      this.primaryStatus.failureCount++;
      
      // Mark as unhealthy if too many failures
      if (this.primaryStatus.failureCount >= this.maxFailureCount) {
        this.primaryStatus.healthy = false;
        this.console.error(`Primary database marked as unhealthy after ${this.primaryStatus.failureCount} failures`);
      }
      
      throw error;
    }
  }
  
  /**
   * Routes a query to a read replica using load balancing
   */
  private async routeToReadReplica(query: string, params: any[] = []): Promise<QueryResult> {
    if (this.readReplicas.length === 0 || this.replicaStatus.size === 0) {
      return this.routeToPrimary(query, params);
    }
    
    // Find healthy replicas
    const healthyReplicaIds = [...this.replicaStatus.entries()]
      .filter(([_, status]) => status.healthy)
      .map(([id]) => id);
    
    if (healthyReplicaIds.length === 0) {
      this.console.warn('No healthy read replicas available, routing to primary');
      return this.routeToPrimary(query, params);
    }
    
    // Choose a replica based on least latency
    const replicaId = this.selectBestReplica(healthyReplicaIds);
    const replicaIndex = parseInt(replicaId.split('-')[1], 10);
    
    if (replicaIndex < 0 || replicaIndex >= this.readReplicas.length) {
      this.console.warn(`Invalid replica index ${replicaIndex}, routing to primary`);
      return this.routeToPrimary(query, params);
    }
    
    const replica = this.readReplicas[replicaIndex];
    const status = this.replicaStatus.get(replicaId);
    
    if (!status) {
      this.console.warn(`No status found for replica ${replicaId}, routing to primary`);
      return this.routeToPrimary(query, params);
    }
    
    try {
      const result = await this.executeWithTimeout(
        replica,
        query,
        params,
        this.queryTimeout
      );
      
      // Reset failure count on success
      status.failureCount = 0;
      this.replicaStatus.set(replicaId, status);
      
      return result;
    } catch (error) {
      // Increment failure count
      status.failureCount++;
      
      // Mark as unhealthy if too many failures
      if (status.failureCount >= this.maxFailureCount) {
        status.healthy = false;
        this.console.error(`Replica ${replicaId} marked as unhealthy after ${status.failureCount} failures`);
      }
      
      this.replicaStatus.set(replicaId, status);
      
      // Try with primary instead
      this.console.warn(`Replica ${replicaId} query failed, fallback to primary: ${(error as Error).message}`);
      return this.routeToPrimary(query, params);
    }
  }
  
  /**
   * Execute a query with a timeout
   */
  private async executeWithTimeout(
    client: PoolClient,
    query: string,
    params: any[],
    timeout: number
  ): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timed out after ${timeout}ms`));
      }, timeout);
      
      client.query(query, params)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Check if a query is a vector-specific query (for pgvector)
   */
  private isVectorQuery(query: string): boolean {
    const normalizedQuery = query.toLowerCase();
    return (
      normalizedQuery.includes('vector') ||
      normalizedQuery.includes('<->') ||
      normalizedQuery.includes('<=>') ||
      normalizedQuery.includes('cosine_distance') ||
      normalizedQuery.includes('l2_distance') ||
      normalizedQuery.includes('inner_product') ||
      normalizedQuery.includes('embedding')
    );
  }
  
  /**
   * Select the best replica based on latency and health
   */
  private selectBestReplica(healthyReplicaIds: string[]): string {
    // Default to round-robin if we have no latency data
    if (healthyReplicaIds.length === 1) {
      return healthyReplicaIds[0];
    }
    
    // Sort by latency
    const sortedReplicas = healthyReplicaIds
      .map(id => ({
        id,
        latency: this.replicaStatus.get(id)?.latency || Infinity
      }))
      .sort((a, b) => a.latency - b.latency);
    
    // Select the lowest latency replica
    return sortedReplicas[0].id;
  }
  
  /**
   * Start periodic health checks for all connections
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.checkConnections();
      } catch (error) {
        this.console.error('Error during health check', error as Error);
      }
    }, this.healthCheckInterval);
    
    this.console.log(`Started health checks with interval ${this.healthCheckInterval}ms`);
  }
  
  /**
   * Stop health checks
   */
  public stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.console.log('Stopped health checks');
    }
  }
  
  /**
   * Check health of all connections
   */
  private async checkConnections(): Promise<void> {
    this.console.log('Running connection health checks');
    
    // Check primary
    await this.checkConnection(
      this.primaryConnection,
      'primary',
      status => this.primaryStatus = status
    );
    
    // Check replicas
    for (let i = 0; i < this.readReplicas.length; i++) {
      const replicaId = `replica-${i}`;
      await this.checkConnection(
        this.readReplicas[i],
        replicaId,
        status => this.replicaStatus.set(replicaId, status)
      );
    }
    
    // Log health status
    this.console.log('Connection health check results', {
      primary: this.primaryStatus.healthy,
      replicas: [...this.replicaStatus.entries()].map(([id, status]) => ({
        id,
        healthy: status.healthy,
        latency: status.latency
      }))
    });
  }
  
  /**
   * Check health of a single connection
   */
  private async checkConnection(
    connection: PoolClient,
    connectionId: string,
    updateStatus: (status: ConnectionStatus) => void
  ): Promise<void> {
    const currentStatus = connectionId === 'primary'
      ? this.primaryStatus
      : this.replicaStatus.get(connectionId) || {
          healthy: false,
          lastChecked: 0,
          latency: Infinity,
          failureCount: this.maxFailureCount,
          url: connectionId,
          poolId: connectionId
        };
    
    try {
      const startTime = Date.now();
      await this.executeWithTimeout(
        connection,
        'SELECT 1',
        [],
        5000 // Short timeout for health checks
      );
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update status with success
      updateStatus({
        ...currentStatus,
        healthy: true,
        lastChecked: Date.now(),
        latency,
        failureCount: 0
      });
      
      this.console.log(`Health check for ${connectionId} succeeded with latency ${latency}ms`);
    } catch (error) {
      // Update status with failure
      const newFailureCount = currentStatus.failureCount + 1;
      const newHealthy = newFailureCount < this.maxFailureCount;
      
      updateStatus({
        ...currentStatus,
        healthy: newHealthy,
        lastChecked: Date.now(),
        failureCount: newFailureCount
      });
      
      if (!newHealthy && currentStatus.healthy) {
        this.console.error(`Connection ${connectionId} marked as unhealthy after ${newFailureCount} failures`, error as Error);
      } else {
        this.console.warn(`Health check for ${connectionId} failed: ${(error as Error).message}`, {
          failureCount: newFailureCount,
          maxFailures: this.maxFailureCount
        });
      }
    }
  }
  
  /**
   * Get the current status of all connections
   */
  public getConnectionStatus(): {
    primary: ConnectionStatus;
    replicas: Record<string, ConnectionStatus>;
  } {
    return {
      primary: { ...this.primaryStatus },
      replicas: Object.fromEntries([...this.replicaStatus.entries()].map(
        ([id, status]) => [id, { ...status }]
      ))
    };
  }
  
  /**
   * Dispose the router and clean up resources
   */
  public dispose(): void {
    this.stopHealthChecks();
    this.console.log('Connection router disposed');
  }
}