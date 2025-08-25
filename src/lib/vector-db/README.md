# Vector Database Adapter Pattern for VibeCode WebGUI

This implementation provides a robust adapter pattern for vector database support in the VibeCode WebGUI application, enabling seamless switching between different vector database providers.

## Architecture Overview

1. **Vector Types** (`vector-types.ts`)
   - Defines common types used across all adapters
   - Includes interfaces for vector chunks, search results, and configuration

2. **Vector Database Interface** (`vector-database-interface.ts`)
   - Core interface that all vector database providers must implement
   - Defines essential operations like storing vectors, searching by similarity, etc.

3. **Base Adapter** (`base-vector-database-adapter.ts`)
   - Abstract base class implementing common functionality
   - Provides embedding generation, connection management, error handling

4. **Provider-Specific Adapters**
   - **PostgreSQL** (`postgres-vector-database-adapter.ts`) - Fully implemented
   - **SQL Server** (`sqlserver-vector-database-adapter.ts`) - Skeleton implementation
   - **Azure Cosmos DB** (`cosmosdb-vector-database-adapter.ts`) - Skeleton implementation
   - **Redis/ValKey** (`redis-vector-database-adapter.ts`) - Skeleton implementation

5. **Factory** (`vector-database-factory.ts`)
   - Creates appropriate adapter based on configuration
   - Manages singleton instance
   - Handles environment variable configuration

6. **Service Layer** (`vector-store-service.ts`)
   - High-level interface for vector operations
   - Maintains backward compatibility with existing codebase
   - Delegates to the appropriate adapter

## Key Features

- **Configuration-based provider selection**
  - Enables switching between providers through environment variables
  - Supports provider-specific configuration options

- **Connection Management**
  - Automatic initialization
  - Error recovery with retry logic
  - Connection pooling support

- **Cache Integration**
  - Built-in caching support for high-performance retrieval
  - Cache invalidation when data changes

- **Metrics and Logging**
  - Performance metrics for monitoring
  - Detailed logging for troubleshooting

- **Error Handling**
  - Graceful fallbacks for search operations
  - Consistent error reporting

## Usage Example

```typescript
// Get the vector store service
import { vectorStore } from './lib/vector-db/vector-store-service';

// Store vector chunks
await vectorStore.storeChunks(fileId, chunks);

// Search for similar content
const results = await vectorStore.search('query text', {
  workspaceId: 123,
  threshold: 0.8,
  limit: 10
});

// Get statistics
const stats = await vectorStore.getStats();
```

## Environment Configuration

Set these environment variables to configure the vector database:

```
# Provider Selection
VECTOR_DB_PROVIDER=postgres  # postgres, sqlserver, cosmosdb, redis

# Common Settings
VECTOR_DB_CONNECTION_STRING=...
VECTOR_DB_HOST=...
VECTOR_DB_PORT=...
VECTOR_DB_USERNAME=...
VECTOR_DB_PASSWORD=...
VECTOR_DB_DATABASE=...
VECTOR_DB_CACHE_ENABLED=true
VECTOR_DB_METRICS_ENABLED=true
VECTOR_DB_LOGGING_ENABLED=true

# Provider-Specific Settings
# See individual adapter implementations for details
```

## Implementation Notes

1. **PostgreSQL Adapter**: Fully implemented using pgVector extension.

2. **SQL Server Adapter**: Skeleton implementation for SQL Server with vector extensions.
   - Requires the SQL Server database with vector search capabilities
   - TODOs marked for implementation details

3. **Cosmos DB Adapter**: Skeleton implementation for Azure Cosmos DB.
   - Requires Azure Cosmos DB with vector search capability
   - TODOs marked for implementation details

4. **Redis/ValKey Adapter**: Skeleton implementation for Redis with vector search.
   - Requires Redis with RedisSearch module or ValKey
   - TODOs marked for implementation details

## Next Steps

1. Complete the implementations for SQL Server, Cosmos DB, and Redis adapters
2. Add comprehensive unit tests for each adapter
3. Implement connection pooling optimization
4. Add telemetry for monitoring adapter performance
5. Create documentation for each adapter's specific configuration options