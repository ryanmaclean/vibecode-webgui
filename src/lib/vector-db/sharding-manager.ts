import type { QueryResult } from 'pg';
import { 
ShardInfo, 
  ShardStatus, 
  ShardingConfig, 
  VectorQuery, 
  VectorQueryResult, 
  VectorSearchResult,
  ReadConsistency,
  WriteConsistency,
  QueryType,
  ShardStats
} from './types';
import { ConsistentHashRing } from './consistent-hash-ring';
import { QueryAnalyzer } from './query-analyzer';
import { DatabasePool, DatabasePoolClient, DatabasePoolFactory, DefaultDatabasePoolFactory } from './connection-router';
// import { logger } from '@/lib/logger';
// Use a simple logger implementation as fallback
const createLogger = (name: string) => ({
  info: (message: string, ...args: any[]) => console.info(`[${name}] INFO: ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[${name}] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[${name}] WARN: ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[${name}] DEBUG: ${message}`, ...args),
});

const DEFAULT_CONFIG: ShardingConfig = {
  shards: [],
  virtualNodeCount: 100,
  replicationFactor: 1,
  readConsistency: ReadConsistency.ONE,
  writeConsistency: WriteConsistency.QUORUM,
  maxRetries: 3,
  retryDelay: 500
};

/**
 * VectorShardingManager is responsible for distributing vector data across multiple database shards
 * and coordinating operations between them. It implements consistent hashing to minimize data
 * redistribution when adding or removing shards.
 */
export class VectorShardingManager {
  private readonly logger = createLogger('VectorShardingManager');
  private readonly consistentHashRing: ConsistentHashRing;
  private readonly queryAnalyzer: QueryAnalyzer;
  private readonly config: ShardingConfig;
  private readonly shardPools: Map<string, DatabasePool>;
  private readonly shardStats: Map<string, ShardStats>;
  // Map to track which shards contain which vector IDs
  private readonly vectorIdToShardMap: Map<string, Set<string>> = new Map();
  private initialized: boolean = false;
  private readonly initPromise: Promise<void>;
  private readonly poolFactory: DatabasePoolFactory;

  /**
   * Creates a new VectorShardingManager
   * @param config Configuration for the sharding system
   * @param poolFactory Factory for creating database pools (optional, uses default if not provided)
   */
  constructor(config: Partial<ShardingConfig> = {}, poolFactory: DatabasePoolFactory = new DefaultDatabasePoolFactory()) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.poolFactory = poolFactory;
    this.consistentHashRing = new ConsistentHashRing(
      this.config.shards,
      this.config.virtualNodeCount
    );
    this.queryAnalyzer = new QueryAnalyzer();
    this.shardPools = new Map<string, DatabasePool>();
    this.shardStats = new Map<string, ShardStats>();
    this.vectorIdToShardMap = new Map<string, Set<string>>();
    
    // Initialize shard connections and pools
    this.initPromise = this.initialize(poolFactory);
  }

  /**
   * Initializes the sharding manager, connecting to all shards
   */
  private async initialize(poolFactory: DatabasePoolFactory): Promise<void> {
    try {
      this.logger.info(`Initializing VectorShardingManager with ${this.config.shards.length} shards`);
      
      // Create connection pools for each shard
      for (const shard of this.config.shards) {
        await this.initializeShard(shard, poolFactory);
      }
      
      // Initialize stats for each shard
      for (const shard of this.config.shards) {
        this.shardStats.set(shard.id, {
          shardId: shard.id,
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          avgResponseTimeMs: 0,
          vectorCount: 0,
          diskUsage: 0,
          lastUpdated: new Date()
        });
      }
      
      this.initialized = true;
      this.logger.info('VectorShardingManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize VectorShardingManager', error);
      throw error;
    }
  }

  /**
   * Initializes a single shard
   * @param shard The shard to initialize
   * @param poolFactory Factory for creating database pools
   */
  private async initializeShard(shard: ShardInfo, poolFactory: DatabasePoolFactory): Promise<void> {
    try {
      this.logger.info(`Initializing shard ${shard.id}`);
      
      // Create a connection pool for this shard using the factory
      const pool = poolFactory.createPool({
        host: shard.host,
        port: shard.port,
        database: shard.database,
        user: shard.username,
        password: shard.password,
        max: 20, // Default max connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });
      
      // Test the connection
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        this.logger.info(`Successfully connected to shard ${shard.id}`);
        
        // Update shard status to ACTIVE
        shard.status = ShardStatus.ACTIVE;
      } finally {
        client.release();
      }
      
      // Store the pool
      this.shardPools.set(shard.id, pool);
      shard.connectionPool = pool;
    } catch (error) {
      this.logger.error(`Failed to initialize shard ${shard.id}`, error);
      shard.status = ShardStatus.OFFLINE;
      throw error;
    }
  }

  /**
   * Ensures the manager is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  /**
   * Gets a client from the shard's connection pool
   * @param shardId The ID of the shard
   * @returns A client from the connection pool
   */
  private async getShardClient(shardId: string): Promise<DatabasePoolClient> {
    await this.ensureInitialized();
    
    const pool = this.shardPools.get(shardId);
    if (!pool) {
      throw new Error(`No connection pool available for shard ${shardId}`);
    }
    
    return pool.connect();
  }

  /**
   * Adds a new shard to the system
   * @param shard The shard to add
   */
  public async addShard(shard: ShardInfo): Promise<void> {
    await this.ensureInitialized();
    
    this.logger.info(`Adding shard ${shard.id}`);
    
    // Initialize the new shard
    await this.initializeShard(shard, this.poolFactory);
    
    // Add to the consistent hash ring
    this.consistentHashRing.addShard(shard);
    
    // Add to the configuration
    this.config.shards.push(shard);
    
    // Initialize stats for the new shard
    this.shardStats.set(shard.id, {
      shardId: shard.id,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgResponseTimeMs: 0,
      vectorCount: 0,
      diskUsage: 0,
      lastUpdated: new Date()
    });
    
    this.logger.info(`Shard ${shard.id} added successfully`);
  }

  /**
   * Removes a shard from the system
   * @param shardId The ID of the shard to remove
   */
  public async removeShard(shardId: string): Promise<void> {
    await this.ensureInitialized();
    
    this.logger.info(`Removing shard ${shardId}`);
    
    // Remove from the hash ring
    this.consistentHashRing.removeShard(shardId);
    
    // Close the connection pool
    const pool = this.shardPools.get(shardId);
    if (pool) {
      await pool.end();
      this.shardPools.delete(shardId);
    }
    
    // Remove from the configuration
    const shardIndex = this.config.shards.findIndex(s => s.id === shardId);
    if (shardIndex >= 0) {
      this.config.shards.splice(shardIndex, 1);
    }
    
    // Remove stats
    this.shardStats.delete(shardId);
    
    this.logger.info(`Shard ${shardId} removed successfully`);
  }

  /**
   * Determines which shard should store a vector
   * @param vectorId The ID of the vector
   * @returns The shard that should store this vector
   */
  public getShardForVector(vectorId: string): ShardInfo | undefined {
    return this.consistentHashRing.getShard(vectorId);
  }

  /**
   * Gets all shards that should contain a copy of a vector
   * @param vectorId The ID of the vector
   * @returns An array of shards that should contain this vector
   */
  public getShardsForVector(vectorId: string): ShardInfo[] {
    return this.consistentHashRing.getShards(
      vectorId, 
      this.config.replicationFactor
    );
  }

  /**
   * Determines which shards should be queried for a vector search
   * @param query The vector query
   * @returns The shards to query
   */
  private determineTargetShards(query: VectorQuery): ShardInfo[] {
    // For now, query all active shards for vector searches
    // In a production system, you might use metadata or collection info to target specific shards
    return this.config.shards.filter(shard => shard.status === ShardStatus.ACTIVE);
  }

  /**
   * Executes a query on a specific shard
   * @param query The SQL query to execute
   * @param params The query parameters
   * @param shardId The ID of the shard to execute on
   * @returns The query result
   */
  public async executeOnShard(
    query: string, 
    params: any[] = [], 
    shardId: string
  ): Promise<QueryResult> {
    await this.ensureInitialized();
    
    const shard = this.config.shards.find(s => s.id === shardId);
    if (!shard || shard.status !== ShardStatus.ACTIVE) {
      throw new Error(`Shard ${shardId} is not available`);
    }
    
    const client = await this.getShardClient(shardId);
    const startTime = Date.now();
    
    try {
      // Execute the query
      const result = await client.query(query, params);
      
      // Update stats
      this.updateShardStats(shardId, Date.now() - startTime, true);
      
      return result;
    } catch (error) {
      // Update stats
      this.updateShardStats(shardId, Date.now() - startTime, false);
      
      this.logger.error(`Query failed on shard ${shardId}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Updates statistics for a shard
   * @param shardId The ID of the shard
   * @param responseTimeMs The response time in milliseconds
   * @param success Whether the query was successful
   */
  private updateShardStats(
    shardId: string, 
    responseTimeMs: number, 
    success: boolean
  ): void {
    const stats = this.shardStats.get(shardId);
    if (!stats) return;
    
    stats.totalQueries += 1;
    
    if (success) {
      stats.successfulQueries += 1;
    } else {
      stats.failedQueries += 1;
    }
    
    // Update average response time
    stats.avgResponseTimeMs = (
      (stats.avgResponseTimeMs * (stats.totalQueries - 1)) + responseTimeMs
    ) / stats.totalQueries;
    
    stats.lastUpdated = new Date();
  }

  /**
   * Executes a SQL query across shards based on query type
   * @param query The SQL query to execute
   * @param params The query parameters
   * @returns The combined query result
   */
  public async executeQuery(
    query: string, 
    params: any[] = []
  ): Promise<QueryResult> {
    await this.ensureInitialized();
    
    const queryType = this.queryAnalyzer.analyzeQueryType(query);
    
    // For admin queries, execute on all shards
    if (queryType === QueryType.ADMIN) {
      return this.executeOnAllShards(query, params);
    }
    
    // For write queries, determine based on write consistency
    if (queryType === QueryType.WRITE) {
      return this.executeWriteQuery(query, params);
    }
    
    // For read queries, route based on the query and read consistency
    return this.executeReadQuery(query, params);
  }

  /**
   * Executes an administrative query on all active shards
   * @param query The SQL query to execute
   * @param params The query parameters
   * @returns The combined query result
   */
  private async executeOnAllShards(
    query: string, 
    params: any[] = []
  ): Promise<QueryResult> {
    const activeShards = this.config.shards.filter(
      shard => shard.status === ShardStatus.ACTIVE
    );
    
    const results = await Promise.all(
      activeShards.map(shard => 
        this.executeOnShard(query, params, shard.id)
          .catch(error => {
            this.logger.error(`Query failed on shard ${shard.id}`, error);
            return null;
          })
      )
    );
    
    // Filter out failed results
    const successfulResults = results.filter(result => result !== null) as QueryResult[];
    
    if (successfulResults.length === 0) {
      throw new Error('Query failed on all shards');
    }
    
    // Combine the results (use the first result as a base)
    const combinedResult = { ...successfulResults[0] };
    
    // Merge rows from all results
    combinedResult.rows = successfulResults.flatMap(result => result.rows);
    
    // Sum up the row count
    combinedResult.rowCount = successfulResults.reduce(
      (total, result) => (total ?? 0) + (result.rowCount ?? 0), 
      0
    );
    
    return combinedResult;
  }

  /**
   * Executes a write query based on write consistency
   * @param query The SQL query to execute
   * @param params The query parameters
   * @returns The query result
   */
  private async executeWriteQuery(
    query: string, 
    params: any[] = []
  ): Promise<QueryResult> {
    // Extract table and potentially a primary key or vector ID from the query
    const tableName = this.queryAnalyzer.extractTableName(query);
    
    if (!tableName) {
      throw new Error('Could not determine target table for write operation');
    }
    
    // For vector insert queries, replicate to multiple shards based on consistency
    if (this.queryAnalyzer.isVectorInsertQuery(query)) {
      return this.executeVectorWriteQuery(query, params);
    }
    
    // For other writes, execute on all shards (in a real system, you'd be more selective)
    return this.executeOnAllShards(query, params);
  }

  /**
   * Executes a vector write query with proper replication
   * @param query The SQL query to execute
   * @param params The query parameters
   * @returns The query result
   */
  private async executeVectorWriteQuery(
    query: string, 
    params: any[] = []
  ): Promise<QueryResult> {
    // In a real implementation, you would extract the vector ID from the query
    // and determine which shards should receive the write based on the consistency level
    
    // For this implementation, we'll use a mock vector ID based on the query
    const mockVectorId = `vector-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Determine target shards based on consistency level
    let targetShards: ShardInfo[];
    
    switch (this.config.writeConsistency) {
      case WriteConsistency.ONE:
        // Write to one shard
        const shard = this.getShardForVector(mockVectorId);
        targetShards = shard ? [shard] : [];
        break;
        
      case WriteConsistency.QUORUM:
        // Write to a majority of shards where this vector would be stored
        const replicaShards = this.getShardsForVector(mockVectorId);
        const quorumCount = Math.floor(replicaShards.length / 2) + 1;
        targetShards = replicaShards.slice(0, quorumCount);
        break;
        
      case WriteConsistency.ALL:
        // Write to all shards where this vector would be stored
        targetShards = this.getShardsForVector(mockVectorId);
        break;
        
      default:
        targetShards = [];
    }
    
    if (targetShards.length === 0) {
      throw new Error('No target shards available for write operation');
    }
    
    // Execute the write on all target shards
    const results = await Promise.all(
      targetShards.map(shard => 
        this.executeOnShard(query, params, shard.id)
          .catch(error => {
            this.logger.error(`Write failed on shard ${shard.id}`, error);
            return null;
          })
      )
    );
    
    // Filter out failed results
    const successfulResults = results.filter(result => result !== null) as QueryResult[];
    
    // Check if we met the consistency requirement
    if (successfulResults.length === 0) {
      throw new Error('Write failed on all target shards');
    }
    
    if (this.config.writeConsistency === WriteConsistency.ALL && 
        successfulResults.length < targetShards.length) {
      throw new Error('Failed to write to all required shards');
    }
    
    if (this.config.writeConsistency === WriteConsistency.QUORUM) {
      const quorumCount = Math.floor(targetShards.length / 2) + 1;
      if (successfulResults.length < quorumCount) {
        throw new Error('Failed to write to a quorum of shards');
      }
    }
    
    // Return the first successful result
    return successfulResults[0];
  }

  /**
   * Executes a read query based on read consistency
   * @param query The SQL query to execute
   * @param params The query parameters
   * @returns The query result
   */
  private async executeReadQuery(
    query: string, 
    params: any[] = []
  ): Promise<QueryResult> {
    // For vector search queries, execute with special handling
    if (this.queryAnalyzer.isVectorSearchQuery(query)) {
      return this.executeVectorReadQuery(query, params);
    }
    
    // For normal reads, route based on the complexity of the query
    const complexity = this.queryAnalyzer.estimateQueryComplexity(query);
    
    // For simple queries, route to a single shard
    if (complexity < 5) {
      // Get a random active shard
      const activeShards = this.config.shards.filter(
        shard => shard.status === ShardStatus.ACTIVE
      );
      
      if (activeShards.length === 0) {
        throw new Error('No active shards available');
      }
      
      const randomShard = activeShards[Math.floor(Math.random() * activeShards.length)];
      return this.executeOnShard(query, params, randomShard.id);
    }
    
    // For complex queries, execute on all shards and combine results
    return this.executeOnAllShards(query, params);
  }

  /**
   * Executes a vector read query with proper consistency
   * @param query The SQL query to execute
   * @param params The query parameters
   * @returns The query result
   */
  private async executeVectorReadQuery(
    query: string, 
    params: any[] = []
  ): Promise<QueryResult> {
    // Determine which shards to query based on read consistency
    let targetShards: ShardInfo[];
    
    switch (this.config.readConsistency) {
      case ReadConsistency.ONE:
        // Read from any single active shard
        const activeShards = this.config.shards.filter(
          shard => shard.status === ShardStatus.ACTIVE
        );
        
        if (activeShards.length === 0) {
          throw new Error('No active shards available');
        }
        
        // Choose a shard with the lowest recent query load
        const sortedShards = [...activeShards].sort((a, b) => {
          const statsA = this.shardStats.get(a.id);
          const statsB = this.shardStats.get(b.id);
          
          if (!statsA || !statsB) return 0;
          
          return statsA.avgResponseTimeMs - statsB.avgResponseTimeMs;
        });
        
        targetShards = [sortedShards[0]];
        break;
        
      case ReadConsistency.QUORUM:
        // Read from a majority of active shards
        const allActiveShards = this.config.shards.filter(
          shard => shard.status === ShardStatus.ACTIVE
        );
        
        if (allActiveShards.length === 0) {
          throw new Error('No active shards available');
        }
        
        const quorumCount = Math.floor(allActiveShards.length / 2) + 1;
        targetShards = allActiveShards.slice(0, quorumCount);
        break;
        
      case ReadConsistency.ALL:
        // Read from all active shards
        targetShards = this.config.shards.filter(
          shard => shard.status === ShardStatus.ACTIVE
        );
        
        if (targetShards.length === 0) {
          throw new Error('No active shards available');
        }
        break;
        
      default:
        targetShards = [];
    }
    
    if (targetShards.length === 0) {
      throw new Error('No target shards available for read operation');
    }
    
    // Execute the read on all target shards
    const results = await Promise.all(
      targetShards.map(shard => 
        this.executeOnShard(query, params, shard.id)
          .catch(error => {
            this.logger.error(`Read failed on shard ${shard.id}`, error);
            return null;
          })
      )
    );
    
    // Filter out failed results
    const successfulResults = results.filter(result => result !== null) as QueryResult[];
    
    // Check if we met the consistency requirement
    if (successfulResults.length === 0) {
      throw new Error('Read failed on all target shards');
    }
    
    if (this.config.readConsistency === ReadConsistency.ALL && 
        successfulResults.length < targetShards.length) {
      throw new Error('Failed to read from all required shards');
    }
    
    if (this.config.readConsistency === ReadConsistency.QUORUM) {
      const quorumCount = Math.floor(targetShards.length / 2) + 1;
      if (successfulResults.length < quorumCount) {
        throw new Error('Failed to read from a quorum of shards');
      }
    }
    
    // Combine the results (for vector searches, we need to merge and re-sort)
    return this.mergeVectorSearchResults(successfulResults);
  }

  /**
   * Merges vector search results from multiple shards
   * @param results The results from each shard
   * @returns A merged result
   */
  private mergeVectorSearchResults(results: QueryResult[]): QueryResult {
    if (results.length === 0) {
      throw new Error('No results to merge');
    }
    
    if (results.length === 1) {
      return results[0];
    }
    
    // Combine the rows from all results
    const allRows = results.flatMap(result => result.rows);
    
    // If the results contain a similarity score, sort by it
    if (allRows.length > 0 && 'similarity' in allRows[0]) {
      allRows.sort((a, b) => (b.similarity as number) - (a.similarity as number));
    }
    
    // Use the first result as a template and update rows
    const mergedResult = { ...results[0] };
    mergedResult.rows = allRows;
    mergedResult.rowCount = allRows.length;
    
    return mergedResult;
  }

  /**
   * Executes a vector similarity search across shards
   * @param query The vector query
   * @returns The search results
   */
  public async executeShardedQuery(query: VectorQuery): Promise<VectorQueryResult> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    
    // Determine which shards to query
    const targetShards = this.determineTargetShards(query);
    
    if (targetShards.length === 0) {
      throw new Error('No active shards available for vector search');
    }
    
    try {
      // Execute the search on each shard in parallel
      const shardPromises = targetShards.map(async shard => {
        try {
          // In a real implementation, this would convert the VectorQuery to a SQL query
          // Here we'll just simulate it with a mock query
          const mockSqlQuery = `
            SELECT id, embedding, metadata, embedding <=> $1 as similarity
            FROM ${query.collectionName}
            WHERE similarity < ${query.minSimilarity || 0.8}
            ORDER BY similarity ASC
            LIMIT ${query.limit}
          `;
          
          // Execute the query
          const result = await this.executeOnShard(
            mockSqlQuery, 
            [query.embedding], 
            shard.id
          );
          
          // Convert the result to VectorSearchResult objects
          return result.rows.map(row => ({
            id: row.id,
            embedding: row.embedding,
            metadata: row.metadata,
            similarity: row.similarity,
            shardId: shard.id
          }));
        } catch (error) {
          this.logger.error(`Vector search failed on shard ${shard.id}`, error);
          return [];
        }
      });
      
      // Wait for all searches to complete
      const shardResults = await Promise.all(shardPromises);
      
      // Flatten the results
      const allResults = shardResults.flat();
      
      // Sort by similarity (ascending)
      allResults.sort((a, b) => a.similarity - b.similarity);
      
      // Limit to the requested number
      const limitedResults = allResults.slice(0, query.limit);
      
      // Build the result
      const queryResult: VectorQueryResult = {
        results: limitedResults,
        totalFound: allResults.length,
        executionTimeMs: Date.now() - startTime,
        shardsQueried: targetShards.length,
        shardsResponded: shardResults.filter(results => results.length > 0).length
      };
      
      return queryResult;
    } catch (error) {
      this.logger.error('Sharded vector query failed', error);
      throw error;
    }
  }

  /**
   * Gets statistics for all shards
   * @returns A map of shard IDs to their statistics
   */
  public getShardStats(): Map<string, ShardStats> {
    return new Map(this.shardStats);
  }

  /**
   * Gets information about all shards
   * @returns An array of shard information
   */
  public getShardInfo(): ShardInfo[] {
    return [...this.config.shards];
  }

  /**
   * Gets the current distribution of keys across shards
   * @param sampleSize Number of sample keys to generate
   * @returns A map of shard IDs to their load percentage
   */
  public getShardDistribution(sampleSize = 1000): Map<string, number> {
    const distribution = this.consistentHashRing.getShardDistribution(sampleSize);
    
    // Convert counts to percentages
    const percentages = new Map<string, number>();
    
    for (const [shardId, count] of distribution.entries()) {
      percentages.set(shardId, (count / sampleSize) * 100);
    }
    
    return percentages;
  }

  /**
   * Shuts down the sharding manager and all connections
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down VectorShardingManager');
    
    // Close all connection pools
    const closePromises = Array.from(this.shardPools.entries()).map(
      async ([shardId, pool]) => {
        try {
          await pool.end();
          this.logger.info(`Closed connection pool for shard ${shardId}`);
        } catch (error) {
          this.logger.error(`Error closing connection pool for shard ${shardId}`, error);
        }
      }
    );
    
    await Promise.all(closePromises);
    
    this.logger.info('VectorShardingManager shutdown complete');
  }
}
