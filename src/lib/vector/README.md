# Vector Database Adapters

This directory contains the implementation of the vector database adapter pattern for the VibeCode WebGUI. The adapter pattern allows for flexible integration with various vector databases and embedding providers.

## Architecture

The vector database adapter system consists of the following components:

1. **Interfaces**: Define the contracts that all adapters must implement
   - `IVectorDatabaseAdapter`: Core interface for vector database operations
   - `IVectorEmbeddingProvider`: Interface for embedding generation
   - `IVectorCacheAdapter`: Interface for caching vector search results

2. **Base Adapters**: Provide common functionality and default implementations
   - `BaseVectorDatabaseAdapter`: Abstract base class for database adapters
   - `BaseVectorEmbeddingProvider`: Abstract base class for embedding providers
   - `BaseVectorCacheAdapter`: Abstract base class for cache adapters

3. **Concrete Adapters**: Implementations for specific databases and services
   - Database Adapters:
     - `PostgreSQLVectorAdapter`: pgvector-based implementation
     - `SQLServerVectorAdapter`: SQL Server vector implementation
     - `CosmosDBVectorAdapter`: Azure Cosmos DB implementation
     - `RedisVectorAdapter`: Redis/ValKey implementation
   - Embedding Providers:
     - `OpenAIEmbeddingProvider`: Uses OpenAI's embedding models
     - `AzureEmbeddingProvider`: Uses Azure OpenAI Service
   - Cache Adapters:
     - `RedisVectorCacheAdapter`: Caches results in Redis/ValKey

4. **Factory**: Creates the appropriate adapters based on configuration
   - `VectorAdapterFactory`: Creates database, embedding, and cache adapters

## Usage

### Basic Usage

```typescript
import { VectorAdapterFactory } from './adapters/vector-adapter-factory';

// Configure vector database
const config = {
  provider: 'pgvector', // 'pgvector', 'sqlserver', 'cosmosdb', 'redis'
  connectionString: process.env.DATABASE_URL,
  embedding: {
    provider: 'openai', // 'openai', 'azure', 'cohere', 'local'
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    dimension: 1536
  },
  cache: {
    enabled: true,
    provider: 'redis',
    connectionString: process.env.REDIS_URL,
    ttl: { default: 3600, min: 60, max: 86400 }
  }
};

// Create adapter with factory
const vectorAdapter = VectorAdapterFactory.createVectorDatabase(config);

// Connect to database
await vectorAdapter.connect();

// Store vectors
await vectorAdapter.storeVectors(fileId, chunks);

// Search for similar vectors
const embedding = await vectorAdapter.generateEmbedding('query text');
const results = await vectorAdapter.findSimilar(embedding, { limit: 10 });

// Get context for AI prompts
const context = await vectorAdapter.getContext('query text', workspaceId);
```

### Advanced Configuration

#### PostgreSQL with pgvector

```typescript
const config = {
  provider: 'pgvector',
  connectionString: process.env.DATABASE_URL,
  options: {
    schema: 'public',
    tableName: 'rag_chunks',
    useHNSW: true  // Use HNSW indexing for faster search
  },
  // ... embedding and cache config
};
```

#### SQL Server

```typescript
const config = {
  provider: 'sqlserver',
  options: {
    user: process.env.SQLSERVER_USER,
    password: process.env.SQLSERVER_PASSWORD,
    server: process.env.SQLSERVER_SERVER,
    database: process.env.SQLSERVER_DATABASE,
    encrypt: true,
    trustServerCertificate: false
  },
  // ... embedding and cache config
};
```

#### Azure Cosmos DB

```typescript
const config = {
  provider: 'cosmosdb',
  options: {
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
    databaseId: 'vectordb',
    containerId: 'vectors',
    consistencyLevel: 'Session'
  },
  // ... embedding and cache config
};
```

#### Redis/ValKey

```typescript
const config = {
  provider: 'redis',
  connectionString: process.env.REDIS_URL,
  options: {
    indexName: 'vector_idx',
    keyPrefix: 'vector:',
    distanceMetric: 'COSINE'  // 'COSINE', 'IP', 'L2'
  },
  // ... embedding and cache config
};
```

### Using Azure OpenAI Embeddings

```typescript
const config = {
  // ... database config
  embedding: {
    provider: 'azure',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    options: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT
    }
  },
  // ... cache config
};
```

## Extending the System

### Creating a New Database Adapter

To create a new database adapter, extend the `BaseVectorDatabaseAdapter` class:

```typescript
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';

export class MyNewVectorAdapter extends BaseVectorDatabaseAdapter {
  // Implement abstract methods
  async connect(): Promise<boolean> {
    // Connect to your database
  }
  
  async disconnect(): Promise<void> {
    // Disconnect from your database
  }
  
  async storeVectors(fileId: number, chunks: Array<{ /*...*/ }>): Promise<void> {
    // Store vectors in your database
  }
  
  async findSimilar(embedding: number[], options: VectorSearchOptions): Promise<SearchResult[]> {
    // Find similar vectors in your database
  }
  
  async deleteVectors(fileId: number): Promise<void> {
    // Delete vectors from your database
  }
  
  async updateVector(id: string | number, embedding: number[]): Promise<boolean> {
    // Update a vector in your database
  }
  
  async getStats(): Promise<VectorStoreStats> {
    // Get statistics about your vector store
  }
}
```

Then register your adapter in the `VectorAdapterFactory`:

```typescript
// In vector-adapter-factory.ts
import { MyNewVectorAdapter } from './my-new-vector-adapter';

// ...
static createDatabaseAdapter(/*...*/): IVectorDatabaseAdapter {
  switch (config.provider) {
    // ...
    case 'mynewprovider':
      return new MyNewVectorAdapter(config, embeddingProvider, cacheAdapter);
    // ...
  }
}
```

### Creating a New Embedding Provider

To create a new embedding provider, extend the `BaseVectorEmbeddingProvider` class:

```typescript
import { BaseVectorEmbeddingProvider } from './base-vector-embedding-provider';

export class MyNewEmbeddingProvider extends BaseVectorEmbeddingProvider {
  // Implement required methods
  async generateEmbedding(text: string): Promise<number[]> {
    // Generate embedding using your service
  }
  
  getDimension(): number {
    // Return embedding dimension
    return 1536; // or whatever your model uses
  }
}
```

Then register your provider in the `VectorAdapterFactory`:

```typescript
// In vector-adapter-factory.ts
import { MyNewEmbeddingProvider } from './my-new-embedding-provider';

// ...
static createEmbeddingProvider(config: VectorDatabaseConfig): IVectorEmbeddingProvider {
  switch (config.embedding.provider) {
    // ...
    case 'mynewprovider':
      return new MyNewEmbeddingProvider(/*...*/);
    // ...
  }
}
```

## Microsoft Azure Integration

The vector database adapter system provides first-class support for Microsoft Azure services:

1. **Azure Cosmos DB**: Use `CosmosDBVectorAdapter` for vector storage and search
2. **Azure OpenAI Service**: Use `AzureEmbeddingProvider` for embeddings
3. **Azure Cache for Redis**: Use `RedisVectorCacheAdapter` with Azure Redis Cache

### Azure Deployment Templates

For deploying these services to Azure, see the Azure ARM templates in the `azure-templates` directory. These templates provide ready-to-deploy configurations for setting up the required Azure resources.

## Performance Considerations

1. **Vector Indexing**: All adapters support some form of vector indexing for efficient similarity search
   - PostgreSQL: pgvector with HNSW indexing
   - SQL Server: Vector functions with appropriate indexing
   - Cosmos DB: Vector search capabilities
   - Redis: RedisSearch with HNSW indexing

2. **Caching Strategy**: Use the cache adapter to reduce embedding generation and search costs
   - Short TTL for frequently changing data
   - Longer TTL for stable data
   - Workspaced caching for multi-tenant deployments

3. **Connection Pooling**: All adapters implement connection pooling for optimal performance
   - Configure `poolSize` in the adapter config to match your workload

4. **Batch Processing**: Use the batch APIs for storing vectors to reduce overhead
   - `storeVectors` method accepts arrays of chunks for efficient processing