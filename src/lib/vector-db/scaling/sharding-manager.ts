import { getDatabaseLogger } from '../../db/database-logger';
import { LogCategory } from '../../db/db-types';
import { getDatabaseMetricsCollector } from '../../db/db-metrics';
import { PrismaClient } from '@prisma/client';

/**
 * Information about a database shard
 */
export interface ShardInfo {
  id: string;
  url: string;
  prisma?: PrismaClient;
  weight: number;
  active: boolean;
  primary: boolean;
  tags: string[];
  region?: string;
}

/**
 * Vector query parameters
 */
export interface VectorQuery {
  embedding: number[];
  dimension?: number;
  limit?: number;
  filter?: Record<string, unknown>;
  collection?: string;
  similarityFunction?: 'cosine' | 'l2' | 'dot';
  minSimilarity?: number;
}

/**
 * Vector query result
 */
export interface VectorQueryResult {
  results: VectorQueryMatch[];
  stats: VectorQueryStats;
}

/**
 * Vector query match
 */
export interface VectorQueryMatch {
  id: string;
  similarity: number;
  metadata: Record<string, unknown>;
  document?: string;
}

/**
 * Vector query stats
 */
export interface VectorQueryStats {
  totalLatency: number;
  shardLatencies: Record<string, number>;
  shardResults: Record<string, number>;
  totalShards: number;
  activeShards: number;
  errors: Record<string, string>;
}

/**
 * Consistent hash ring for shard selection
 */
class ConsistentHashRing {
  private ring: { position: number; shardId: string }[] = [];
  private sortedRing: { position: number; shardId: string }[] = [];
  private shards: Map<string, ShardInfo> = new Map();
  private virtualNodesPerShard: number;
  
  constructor(virtualNodesPerShard = 100) {
    this.virtualNodesPerShard = virtualNodesPerShard;
  }
  
  /**
   * Add a shard to the hash ring
   */
  public addShard(shard: ShardInfo): void {
    if (this.shards.has(shard.id)) {
      this.removeShard(shard.id);
    }
    
    this.shards.set(shard.id, shard);
    
    // Add virtual nodes for the shard
    const virtualNodes = shard.weight * this.virtualNodesPerShard;
    for (let i = 0; i < virtualNodes; i++) {
      const position = this.hashKey(`${shard.id}-${i}`);
      this.ring.push({ position, shardId: shard.id });
    }
    
    // Re-sort the ring
    this.sortRing();
  }
  
  /**
   * Remove a shard from the hash ring
   */
  public removeShard(shardId: string): void {
    this.shards.delete(shardId);
    this.ring = this.ring.filter(node => node.shardId !== shardId);
    this.sortRing();
  }
  
  /**
   * Get the shard for a given key
   */
  public getNode(key: string): ShardInfo | null {
    if (this.ring.length === 0) {
      return null;
    }
    
    const hash = this.hashKey(key);
    const nodes = this.sortedRing;
    
    // Find the first node with position >= hash
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].position >= hash) {
        const shardId = nodes[i].shardId;
        return this.shards.get(shardId) || null;
      }
    }
    
    // If we reached the end, return the first node (wrap around)
    const shardId = nodes[0].shardId;
    return this.shards.get(shardId) || null;
  }
  
  /**
   * Get all shards
   */
  public getAllShards(): ShardInfo[] {
    return Array.from(this.shards.values());
  }
  
  /**
   * Get active shards
   */
  public getActiveShards(): ShardInfo[] {
    return Array.from(this.shards.values())
      .filter(shard => shard.active);
  }
  
  /**
   * Sort the ring by position
   */
  private sortRing(): void {
    this.sortedRing = [...this.ring].sort((a, b) => a.position - b.position);
  }
  
  /**
   * Hash a key to a position on the ring
   */
  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Options for the sharding manager
 */
export interface ShardingManagerOptions {
  defaultShards?: ShardInfo[];
  virtualNodesPerShard?: number;
  metricsEnabled?: boolean;
  replicationFactor?: number;
  enableCrossShardQueries?: boolean;
  queryTimeout?: number;
}

/**
 * Manages vector database sharding
 */
export class VectorShardingManager {
  private shardMap: Map<string, ShardInfo> = new Map();
  private consistentHashRing: ConsistentHashRing;
  private logger = getDatabaseLogger({ defaultCategory: LogCategory.VECTOR });
  private metricsCollector = getDatabaseMetricsCollector();
  private replicationFactor: number;
  private enableCrossShardQueries: boolean;
  private metricsEnabled: boolean;
  private queryTimeout: number;
  
  /**
   * Create a new sharding manager
   */
  constructor(options: ShardingManagerOptions = {}) {
    const {
      defaultShards = [],
      virtualNodesPerShard = 100,
      metricsEnabled = true,
      replicationFactor = 1,
      enableCrossShardQueries = true,
      queryTimeout = 30000
    } = options;
    
    this.consistentHashRing = new ConsistentHashRing(virtualNodesPerShard);
    this.metricsEnabled = metricsEnabled;
    this.replicationFactor = replicationFactor;
    this.enableCrossShardQueries = enableCrossShardQueries;
    this.queryTimeout = queryTimeout;
    
    // Add default shards
    for (const shard of defaultShards) {
      this.addShard(shard);
    }
    
    console.info(`Initialized sharding manager with ${defaultShards.length} shards`);
  }
  
  /**
   * Add a shard to the manager
   */
  public addShard(shard: ShardInfo): void {
    this.shardMap.set(shard.id, shard);
    this.consistentHashRing.addShard(shard);
    console.info(`Added shard ${shard.id} to sharding manager`);
  }
  
  /**
   * Remove a shard from the manager
   */
  public removeShard(shardId: string): void {
    const shard = this.shardMap.get(shardId);
    if (shard) {
      this.shardMap.delete(shardId);
      this.consistentHashRing.removeShard(shardId);
      console.info(`Removed shard ${shardId} from sharding manager`);
    }
  }
  
  /**
   * Get a shard by ID
   */
  public getShard(shardId: string): ShardInfo | null {
    return this.shardMap.get(shardId) || null;
  }
  
  /**
   * Get all shards
   */
  public getAllShards(): ShardInfo[] {
    return Array.from(this.shardMap.values());
  }
  
  /**
   * Get active shards
   */
  public getActiveShards(): ShardInfo[] {
    return Array.from(this.shardMap.values())
      .filter(shard => shard.active);
  }
  
  /**
   * Determine which shard should store a vector
   */
  public getShardForVector(vectorId: string): ShardInfo | null {
    return this.consistentHashRing.getNode(vectorId);
  }
  
  /**
   * Get replica shards for a vector
   */
  public getReplicaShardsForVector(vectorId: string): ShardInfo[] {
    const primaryShard = this.getShardForVector(vectorId);
    if (!primaryShard) {
      return [];
    }
    
    // If replication factor is 1, just return the primary
    if (this.replicationFactor <= 1) {
      return [primaryShard];
    }
    
    // Get all active shards except the primary
    const activeShards = this.getActiveShards()
      .filter(shard => shard.id !== primaryShard.id);
    
    if (activeShards.length === 0) {
      return [primaryShard];
    }
    
    // Sort by hash of vectorId + shardId to ensure consistent selection
    const sortedShards = activeShards
      .map(shard => ({
        shard,
        hash: this.hashForReplica(vectorId, shard.id)
      }))
      .sort((a, b) => a.hash - b.hash)
      .map(item => item.shard);
    
    // Select replica shards up to replication factor
    const replicaCount = Math.min(this.replicationFactor - 1, sortedShards.length);
    const replicaShards = sortedShards.slice(0, replicaCount);
    
    // Return primary first, then replicas
    return [primaryShard, ...replicaShards];
  }
  
  /**
   * Hash function for replica selection
   */
  private hashForReplica(vectorId: string, shardId: string): number {
    let hash = 0;
    const key = `${vectorId}-${shardId}`;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Determine target shards for a vector query
   */
  private determineTargetShards(query: VectorQuery): ShardInfo[] {
    // If collection is specified, hash by collection
    const keyForHashing = query.collection || 'default';
    
    // If cross-shard queries are disabled, just return the primary shard
    if (!this.enableCrossShardQueries) {
      const primaryShard = this.consistentHashRing.getNode(keyForHashing);
      return primaryShard ? [primaryShard] : [];
    }
    
    // For cross-shard queries, return all active shards
    return this.getActiveShards();
  }
  
  /**
   * Execute a query on a specific shard
   */
  private async executeOnShard(
    query: VectorQuery,
    shard: ShardInfo
  ): Promise<{ results: VectorQueryMatch[]; latency: number; error?: string }> {
    if (!shard.prisma) {
      return { results: [], latency: 0, error: 'No Prisma client for shard' };
    }
    
    const startTime = Date.now();
    try {
      const { embedding, dimension = 1536, limit = 10, filter = {} } = query;
      
      // Validate embedding dimensions
      if (embedding.length !== dimension) {
        throw new Error(`Embedding dimension mismatch: expected ${dimension}, got ${embedding.length}`);
      }
      
      // Execute query with timeout
      const resultPromise = shard.prisma.$queryRaw`
        SELECT 
          document_id as id,
          content as document,
          metadata,
          1 - (embedding <=> ${embedding}::vector) as similarity
        FROM document_embeddings
        WHERE metadata @> ${JSON.stringify(filter)}::jsonb
        ORDER BY embedding <=> ${embedding}::vector
        LIMIT ${limit}
      `;
      
      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timed out after ${this.queryTimeout}ms`));
        }, this.queryTimeout);
      });
      
      // Race query vs timeout
      const results = await Promise.race([resultPromise, timeoutPromise]);

      // Process results - assert as array of query results
      const queryResults = results as Array<{
        id: string;
        similarity: number;
        metadata?: Record<string, unknown>;
        document?: string;
      }>;
      const matches = queryResults.map(row => ({
        id: row.id,
        similarity: row.similarity,
        metadata: row.metadata || {},
        document: row.document
      }));
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return { results: matches, latency };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      console.error(`Error executing query on shard ${shard.id}: ${(error as Error).message}`);
      
      return { 
        results: [], 
        latency, 
        error: (error as Error).message 
      };
    }
  }
  
  /**
   * Merge results from multiple shards
   */
  private mergeResults(
    shardResults: { 
      shard: ShardInfo; 
      results: VectorQueryMatch[]; 
      latency: number; 
      error?: string 
    }[]
  ): VectorQueryResult {
    // Collect all results
    const allResults: VectorQueryMatch[] = [];
    const stats: VectorQueryStats = {
      totalLatency: 0,
      shardLatencies: {},
      shardResults: {},
      totalShards: shardResults.length,
      activeShards: 0,
      errors: {}
    };
    
    // Process each shard's results
    for (const { shard, results, latency, error } of shardResults) {
      // Add to stats
      stats.totalLatency += latency;
      stats.shardLatencies[shard.id] = latency;
      stats.shardResults[shard.id] = results.length;
      
      if (error) {
        stats.errors[shard.id] = error;
      } else {
        stats.activeShards++;
        // Add results from this shard
        allResults.push(...results);
      }
    }
    
    // Sort all results by similarity (descending)
    const sortedResults = allResults.sort((a, b) => b.similarity - a.similarity);
    
    return {
      results: sortedResults,
      stats
    };
  }
  
  /**
   * Execute a query across multiple shards and combine results
   */
  public async executeShardedQuery(query: VectorQuery): Promise<VectorQueryResult> {
    const startTime = Date.now();
    
    try {
      // Determine which shards to query
      const targetShards = this.determineTargetShards(query);
      
      if (targetShards.length === 0) {
        console.warn('No active shards available for query');
        return {
          results: [],
          stats: {
            totalLatency: 0,
            shardLatencies: {},
            shardResults: {},
            totalShards: 0,
            activeShards: 0,
            errors: { 'global': 'No active shards available' }
          }
        };
      }
      
      // Execute query on all target shards in parallel
      const shardPromises = targetShards.map(async shard => {
        try {
          const result = await this.executeOnShard(query, shard);
          return { shard, ...result };
        } catch (error) {
          return {
            shard,
            results: [],
            latency: Date.now() - startTime,
            error: (error as Error).message
          };
        }
      });
      
      const shardResults = await Promise.all(shardPromises);
      
      // Merge results
      const result = this.mergeResults(shardResults);
      
      // Record metrics
      if (this.metricsEnabled) {
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        this.metricsCollector.recordQuery(
          'vector_search',
          totalTime,
          true,
          { type: 'VECTOR', table: query.collection || 'default' }
        );
      }
      
      return result;
    } catch (error) {
      console.error(`Error executing sharded query: ${(error as Error).message}`);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      if (this.metricsEnabled) {
        this.metricsCollector.recordQuery(
          'vector_search',
          totalTime,
          false,
          { type: 'VECTOR', table: query.collection || 'default', error: (error as Error).message }
        );
      }
      
      return {
        results: [],
        stats: {
          totalLatency: totalTime,
          shardLatencies: {},
          shardResults: {},
          totalShards: 0,
          activeShards: 0,
          errors: { 'global': (error as Error).message }
        }
      };
    }
  }
}