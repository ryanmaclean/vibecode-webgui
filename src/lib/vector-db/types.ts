import type { DatabasePool } from './connection-router';

/**
 * Defines the shard information for a vector database shard
 */
export interface ShardInfo {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  weight: number;
  status: ShardStatus;
  connectionPool?: DatabasePool;
}

/**
 * Represents the operational status of a database shard
 */
export enum ShardStatus {
  ACTIVE = 'active',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  INITIALIZING = 'initializing',
  REBALANCING = 'rebalancing'
}

/**
 * Configuration for the vector database sharding system
 */
export interface ShardingConfig {
  shards: ShardInfo[];
  virtualNodeCount: number; // Number of virtual nodes per physical shard for consistent hashing
  replicationFactor: number; // Number of replicas to maintain for each vector
  readConsistency: ReadConsistency; // Read consistency level
  writeConsistency: WriteConsistency; // Write consistency level
  maxRetries: number; // Maximum number of retries for operations
  retryDelay: number; // Delay between retries in ms
}

/**
 * Read consistency levels for vector operations
 */
export enum ReadConsistency {
  ONE = 'one', // Read from any single shard
  QUORUM = 'quorum', // Read from a majority of shards
  ALL = 'all' // Read from all shards
}

/**
 * Write consistency levels for vector operations
 */
export enum WriteConsistency {
  ONE = 'one', // Write to any single shard
  QUORUM = 'quorum', // Write to a majority of shards
  ALL = 'all' // Write to all shards
}

/**
 * Represents a query to be executed on the vector database
 */
export interface VectorQuery {
  embedding: number[]; // The vector embedding to search for
  collectionName: string; // The collection to search in
  limit: number; // Maximum number of results to return
  filter?: Record<string, any>; // Additional filters for the query
  minSimilarity?: number; // Minimum similarity score (0-1)
}

/**
 * Represents a single result from a vector search query
 */
export interface VectorSearchResult {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  similarity: number;
  shardId: string;
}

/**
 * Represents the combined results from a vector search across shards
 */
export interface VectorQueryResult {
  results: VectorSearchResult[];
  totalFound: number;
  executionTimeMs: number;
  shardsQueried: number;
  shardsResponded: number;
}

/**
 * Type of query for routing purposes
 */
export enum QueryType {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

/**
 * Statistics about a shard's operation
 */
export interface ShardStats {
  shardId: string;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgResponseTimeMs: number;
  vectorCount: number;
  diskUsage: number;
  lastUpdated: Date;
}

/**
 * Interface for monitoring shard health and performance
 */
export interface ShardMonitor {
  getShardHealth(shardId: string): Promise<ShardStatus>;
  getShardStats(shardId: string): Promise<ShardStats>;
  pingShards(): Promise<Map<string, number>>;
  detectSuspiciousActivity(shardId: string): Promise<boolean>;
}

/**
 * Configuration for a vector database client
 */
export interface VectorDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectionPooling?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    allowExitOnIdle: boolean;
  };
}

/**
 * Pool status for vector database connections
 */
export interface PoolStatus {
  size: number;
  available: number;
  inUse: number;
  maxSize: number;
  waitingClients: number;
  idleConnections: number;
}
