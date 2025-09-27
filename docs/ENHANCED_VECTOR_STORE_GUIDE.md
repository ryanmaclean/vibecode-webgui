# Enhanced Vector Store Usage Guide

## Overview

The `EnhancedVectorStore` is a high-level wrapper that provides a simple, instrumented API for vector database operations. It internally delegates to `EnhancedVectorDatabaseAdapter` and automatically collects metrics for all database operations.

## Features

- **Automatic Metrics Collection**: Records query timings, success/failure counts, and provider-specific statistics
- **Retry Logic**: Built-in retry mechanism with configurable backoff and timeout settings
- **Error Handling**: Enhanced error handling with detailed logging and context
- **Multiple Providers**: Supports various vector database providers through adapter pattern

## Basic Usage

### Initialization

```typescript
import { EnhancedVectorStore } from '@/lib/vector-db/enhanced-vector-store';
import { PostgresVectorAdapter } from '@/lib/vector-db/postgres-vector-database-adapter';
import { VectorDatabaseConfig } from '@/lib/vector-db/vector-types';

// Create adapter instance
const adapter = new PostgresVectorAdapter();

// Configuration
const config: VectorDatabaseConfig = {
  provider: 'postgres',
  connectionString: process.env.DATABASE_URL,
  enableLogging: true,
  enableMetrics: true
};

// Optional retry configuration
const retryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  timeoutMs: 30000
};

// Create vector store instance
const vectorStore = new EnhancedVectorStore(adapter, config, retryConfig);

// Initialize the store
await vectorStore.initialize();
```

### Storing Vector Chunks

```typescript
// Store code chunks for a file
const fileId = 123;
const chunks = [
  {
    content: 'function calculateSum(a, b) { return a + b; }',
    startLine: 1,
    endLine: 3,
    tokens: 12
  },
  {
    content: 'const result = calculateSum(5, 10);',
    startLine: 4,
    endLine: 4,
    tokens: 8
  }
];

await vectorStore.storeChunks(fileId, chunks);
```

### Vector Similarity Search

```typescript
// Search with embedding vector
const queryEmbedding = await someEmbeddingService.generateEmbedding('calculate sum');

const searchOptions = {
  workspaceId: 1,
  limit: 10,
  threshold: 0.7,
  fileIds: [123, 124, 125] // Optional: limit search to specific files
};

const results = await vectorStore.search(queryEmbedding, searchOptions);

results.forEach(result => {
  console.log(`Similarity: ${result.similarity}`);
  console.log(`Content: ${result.chunk.content}`);
  console.log(`File ID: ${result.chunk.metadata.fileId}`);
});
```

### Text-based Search

```typescript
// Search with text query (embedding generated internally)
const searchOptions = {
  workspaceId: 1,
  limit: 5,
  threshold: 0.8
};

const results = await vectorStore.searchWithText('async function example', searchOptions);
```

### Deleting File Chunks

```typescript
// Delete all chunks associated with a file
await vectorStore.deleteFileChunks(fileId);
```

## Search Options

The `SearchOptions` interface supports various filtering and configuration options:

```typescript
interface SearchOptions {
  workspaceId?: number;    // Filter by workspace
  fileIds?: number[];      // Filter by specific files
  limit?: number;          // Maximum number of results (default: 10)
  threshold?: number;      // Minimum similarity threshold (0-1)
  useCache?: boolean;      // Enable/disable caching (if available)
}
```

## Error Handling

The EnhancedVectorStore includes comprehensive error handling:

```typescript
try {
  const results = await vectorStore.search(embedding, options);
  // Process results
} catch (error) {
  console.error('Vector search failed:', error);
  
  // Error details are automatically logged with context:
  // - Provider name
  // - Query parameters
  // - Embedding dimensions
  // - Error type and message
}
```

## Metrics and Monitoring

All operations automatically emit metrics to the global metrics collector:

- **Query Timings**: Total and average query execution times
- **Success/Failure Counts**: Operation success rates
- **Provider Statistics**: Cache hits, provider switches, etc.

Access metrics through the metrics collector:

```typescript
import { getMetricsCollector } from '@/lib/db/database-metrics';

const metrics = getMetricsCollector();
const vectorMetrics = metrics.getVectorMetrics();

console.log('Vector operations:', vectorMetrics);
```

## Best Practices

### 1. Connection Management

```typescript
// Initialize once per application lifecycle
const vectorStore = new EnhancedVectorStore(adapter, config);
await vectorStore.initialize();

// Reuse the same instance throughout your application
export const globalVectorStore = vectorStore;
```

### 2. Batch Operations

```typescript
// Store chunks in batches for better performance
const batchSize = 50;
for (let i = 0; i < allChunks.length; i += batchSize) {
  const batch = allChunks.slice(i, i + batchSize);
  await vectorStore.storeChunks(fileId, batch);
}
```

### 3. Error Handling with Retries

```typescript
// The built-in retry mechanism handles transient failures automatically
// Configure retries based on your use case:

const retryConfig = {
  maxRetries: 5,        // More retries for critical operations
  backoffMs: 2000,      // Longer backoff for rate-limited APIs
  timeoutMs: 60000      // Longer timeout for large operations
};
```

### 4. Search Optimization

```typescript
// Use appropriate thresholds to filter low-quality results
const searchOptions = {
  threshold: 0.75,      // Higher threshold for more relevant results
  limit: 20,            // Reasonable limit to avoid overwhelming results
  fileIds: relevantFiles // Pre-filter by file context when possible
};
```

## Configuration Examples

### Production Configuration

```typescript
const productionConfig: VectorDatabaseConfig = {
  provider: 'postgres',
  connectionString: process.env.VECTOR_DB_URL,
  enableLogging: false,     // Reduce logging in production
  enableMetrics: true       // Keep metrics for monitoring
};

const productionRetryConfig = {
  maxRetries: 5,
  backoffMs: 2000,
  timeoutMs: 30000
};
```

### Development Configuration

```typescript
const devConfig: VectorDatabaseConfig = {
  provider: 'postgres',
  connectionString: 'postgresql://localhost:5432/dev_vectordb',
  enableLogging: true,      // Enable detailed logging for debugging
  enableMetrics: true
};

const devRetryConfig = {
  maxRetries: 2,            // Faster failure in development
  backoffMs: 500,
  timeoutMs: 10000
};
```

## Troubleshooting

### Common Issues

1. **Import Path Errors**
   - Ensure you're using the correct import path: `@/lib/vector-db/enhanced-vector-store`
   - Check that your TypeScript path mapping is configured correctly

2. **Connection Failures**
   - Verify your database connection string
   - Check that the vector database is running and accessible
   - Review retry configuration for network-sensitive environments

3. **Performance Issues**
   - Monitor query performance through metrics
   - Consider adjusting search thresholds and limits
   - Use file filtering to reduce search scope
   - Implement caching for frequently accessed queries

4. **Memory Usage**
   - Large embedding vectors can consume significant memory
   - Consider batch processing for large datasets
   - Monitor connection pool usage

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
const debugConfig: VectorDatabaseConfig = {
  provider: 'postgres',
  connectionString: process.env.DATABASE_URL,
  enableLogging: true,
  enableMetrics: true
};

// Logs will include:
// - Operation timings
// - Query parameters
// - Error details with stack traces
// - Retry attempts and outcomes
```