/**
 * Vector Database - Unified Entry Point
 * Provides consolidated access to all vector database functionality
 * 
 * This module serves as the single entry point for vector database operations,
 * consolidating previously scattered implementations into a unified interface.
 */

// Core interfaces and types
export * from './vector-database-interface';
export * from './vector-types';

// Main service layer (primary interface)
export { VectorStoreService, vectorStore } from './vector-store-service';
export { VectorDatabaseFactory } from './vector-database-factory';

// Base adapter for implementing new providers
export { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';

// Concrete adapter implementations
export { PostgresVectorDatabaseAdapter } from './postgres-vector-database-adapter';
export { CognitiveSearchVectorDatabaseAdapter } from './cognitive-search-vector-database-adapter';
export { CosmosDBVectorDatabaseAdapter } from './cosmosdb-vector-database-adapter';
export { RedisVectorDatabaseAdapter } from './redis-vector-database-adapter';
export { SQLServerVectorDatabaseAdapter } from './sqlserver-vector-database-adapter';

// Error handling and retry logic
export { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';
export { VectorRetryHandler } from './vector-retry-handler';

// Connection management and scaling
export { ConnectionPool } from './connection-pool';
export { VectorDBConnectionRouter } from './scaling/connection-router';
export { ShardingManager } from './sharding-manager';

// Caching functionality (moved from cache/vector)
export { VectorCache } from './cache/vector-cache';
export { vectorQueryCache } from './query-cache';

// Enhanced features and query optimization
export { QueryAnalyzer } from './query-analyzer';

// Multi-provider enhanced functionality (moved from vector-stores)
export { 
  EnhancedVectorStore, 
  enhancedVectorStore,
  type VectorStoreProvider,
  type UnifiedSearchOptions,
  type UnifiedSearchResult,
  type VectorStoreStats
} from './enhanced-vector-store';

// Additional adapters and clients
export { 
  PGVectorClient, 
  PGVectorAdapter, 
  COLLECTION_SCHEMAS,
  type PGVectorConfig,
  type PGVectorDocument,
  type PGVectorSearchResult 
} from './pgvector-client-adapter';

export { 
  WeaviateVectorDatabaseAdapter, 
  WeaviateStore,
  weaviateStore,
  type WeaviateDocument,
  type WeaviateSearchOptions,
  type WeaviateSearchResult 
} from './weaviate-adapter';

// Legacy compatibility - for gradual migration
export { migrateToVectorDatabaseAdapters } from './migration-helper';

// Default export - the main vector store service
export default vectorStore;