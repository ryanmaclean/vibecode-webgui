---
title: Azure Embedding Service
description: Auto-generated placeholder. Update as needed.
---

# Azure OpenAI Embedding Service Implementation

This implementation adds Azure OpenAI embedding capabilities to the VibeCode platform, enabling vector-based semantic search and RAG (Retrieval Augmented Generation) functionality.

## Files Implemented

1. **Azure Embedding Service**:
   - `src/lib/ai/azureEmbeddingService.ts`: Main implementation of the Azure OpenAI embedding service
   - Handles generating embeddings, storing documents, and performing similarity searches

2. **Embedding Service Factory**:
   - `src/lib/ai/embeddingServiceFactory.ts`: Factory pattern for creating embedding services
   - Supports environment-based configuration and different provider types
   - Now supports static methods for easier usage

3. **Connection Pooling**:
   - `src/lib/db/vector-connection-pool.ts`: Connection pool implementation for vector database operations
   - Improves performance and resource utilization for high-traffic applications

4. **Database Schema**:
   - `vector-schema.sql`: PostgreSQL schema with pgvector extension
   - Creates tables, indexes, and helper functions for vector embeddings

5. **Test Scripts**:
   - `test-azure-embedding-complete.js`: End-to-end test of the Azure embedding service
   - `test-azure-embedding-connection-pool.js`: Tests the connection pooling functionality
   - `test-vector-db-connection-pooling.js`: Stress tests the connection pool under load
   - `run-azure-embedding-e2e-tests.js`: Jest E2E test runner script

## Connection Pooling

To improve performance and resource utilization, especially for high-traffic applications, the Azure Embedding Service supports connection pooling:

```typescript
// Option 1: Enable connection pooling through environment variables
// In .env file:
USE_CONNECTION_POOL=true

// Option 2: Enable connection pooling through EmbeddingServiceFactory
const embeddingService = factory.createEmbeddingService({
  provider: EmbeddingProvider.AZURE,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  useConnectionPool: true  // Enable connection pooling
});

// Option 3: Enable connection pooling with robust connection handling
const { service, releaseConnection } = await EmbeddingServiceFactory
  .createEmbeddingServiceWithRobustConnection(true);  // Enable connection pooling

// Option 4: Direct instantiation with connection pooling
const azureEmbeddingService = new AzureEmbeddingService(
  process.env.AZURE_OPENAI_API_KEY,
  process.env.AZURE_OPENAI_ENDPOINT,
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
  null,  // No Prisma client when using connection pool
  false, // Don't use managed identity 
  true   // Use connection pool
);
```

### Connection Pool Benefits

1. **Improved Performance**: Reuses database connections instead of creating new ones for each operation
2. **Resource Efficiency**: Reduces CPU and memory overhead from establishing new connections
3. **Scalability**: Better handles concurrent requests with optimized resource utilization
4. **Automatic Management**: Handles connection validation, cleanup, and reconnection automatically
5. **Metrics Collection**: Tracks pool usage and performance for monitoring and diagnostics

### Connection Pool Configuration

The connection pool can be configured with the following options:

```typescript
// In your environment variables
CONNECTION_POOL_MIN_CONNECTIONS=2     // Minimum number of connections to maintain
CONNECTION_POOL_MAX_CONNECTIONS=10    // Maximum number of connections allowed
CONNECTION_POOL_ACQUIRE_TIMEOUT=5000  // Time (ms) to wait for a connection
CONNECTION_POOL_IDLE_TIMEOUT=30000    // Time (ms) before closing idle connections
```

The pool dynamically scales between the minimum and maximum connections based on demand, cleaning up idle connections as needed to optimize resource usage.

### Using With Managed Identity

Connection pooling works seamlessly with Azure Managed Identity authentication:

```typescript
// In .env file:
USE_AZURE_MANAGED_IDENTITY=true
USE_CONNECTION_POOL=true

// The service will use both managed identity and connection pooling
const embeddingService = factory.createEmbeddingServiceFromEnv();
```

## How to Test

### Prerequisites

1. PostgreSQL with pgvector extension installed
2. Azure OpenAI API access
3. Environment variables set up:
   - `AZURE_OPENAI_API_KEY` (or use managed identity)
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_DEPLOYMENT_NAME`
   - `USE_AZURE_MANAGED_IDENTITY` (set to 'true' to use managed identity)
   - `USE_CONNECTION_POOL` (set to 'true' to use connection pooling)
   - `DATABASE_URL` (optional, defaults to local PostgreSQL)

### Setting Up the Database

1. Connect to your PostgreSQL database
2. Run the schema creation script:
   ```bash
   psql -U your_username -d your_database -f vector-schema.sql
   ```

### Running Tests

1. Create a `.env.azure` file with your Azure credentials:
   ```
   # Option 1: Using API Key with Connection Pooling
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
   AZURE_OPENAI_API_VERSION=2023-05-15
   USE_CONNECTION_POOL=true
   DATABASE_URL=postgresql://user:password@localhost:5432/database
   
   # Option 2: Using Managed Identity with Connection Pooling
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
   AZURE_OPENAI_API_VERSION=2023-05-15
   USE_AZURE_MANAGED_IDENTITY=true
   USE_CONNECTION_POOL=true
   DATABASE_URL=postgresql://user:password@localhost:5432/database
   ```

2. Run the connection pooling test:
   ```bash
   node test-azure-embedding-connection-pool.js
   ```

3. Run the connection pool stress test:
   ```bash
   node test-vector-db-connection-pooling.js
   ```

4. Run the E2E tests:
   ```bash
   node run-azure-embedding-e2e-tests.js
   ```

## Using in Your Code

### Basic Usage with the Factory

```typescript
import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory } from './src/lib/ai/embeddingServiceFactory';

// Create a Prisma client
const prisma = new PrismaClient();

// Create an embedding service using the factory
// This will automatically use Azure OpenAI if the environment variables are set
const embeddingService = EmbeddingServiceFactory.createEmbeddingService(prisma);

// Generate an embedding for text
const text = "This is a sample document for embedding";
const embedding = await embeddingService.generateEmbedding(text);

// Store a document with embedding in the database
const documentId = "doc-123";
const content = "This is a document about vector embeddings and semantic search";
const metadata = { source: "tutorial", category: "ML" };
await embeddingService.storeDocument(documentId, content, metadata);

// Find similar documents
const query = "How do vector embeddings work?";
const similarDocs = await embeddingService.findSimilarDocuments(query, {
  threshold: 0.7,  // Similarity threshold (0-1)
  limit: 5         // Number of results to return
});

// Perform a RAG query
const ragResult = await embeddingService.ragQuery(query, {
  threshold: 0.7,
  limit: 5
});
```

### Using Static Factory Methods with Connection Pooling

```typescript
import { EmbeddingServiceFactory } from './src/lib/ai/embeddingServiceFactory';

// For robust connection handling with connection pooling
const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection(true);

try {
  // Use the service
  const embedding = await service.generateEmbedding("Sample text");
  
  // Find similar documents
  const results = await service.findSimilarDocuments("Search query", { limit: 5 });
  console.log(`Found ${results.length} similar documents`);
} finally {
  // Release the connection when done (this is a no-op with connection pooling)
  await releaseConnection();
}
```

### Direct Instantiation with Connection Pooling

```typescript
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService';

// Initialize Azure Embedding Service with Connection Pooling
const azureEmbeddingService = new AzureEmbeddingService(
  process.env.AZURE_OPENAI_API_KEY,
  process.env.AZURE_OPENAI_ENDPOINT,
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
  null,  // No Prisma client when using connection pool
  false, // Don't use managed identity
  true   // Use connection pool
);

// Store a document with embedding
await azureEmbeddingService.storeDocument(
  'document-id', 
  'Document content here', 
  { category: 'article', author: 'Jane Doe' }
);
```

## Performance Considerations

- Azure OpenAI API calls incur latency and cost, so consider caching embeddings
- Use connection pooling for high-traffic applications to improve throughput
- Monitor connection pool metrics to identify performance bottlenecks
- Use appropriate vector indices in PostgreSQL for faster similarity searches
- Monitor API usage and rate limits

## Next Steps

1. ✅ Implement Azure Managed Identity support for more secure authentication
2. ✅ Implement connection pooling for database operations
3. Add monitoring for Azure API usage with Datadog integration
4. Create metrics dashboard for embedding operations
5. Add support for batch operations for better performance
6. Implement caching for frequently accessed embeddings

## Troubleshooting

- **pgvector extension not found**: Make sure pgvector is installed in your PostgreSQL instance
- **Authentication errors**: Verify your Azure OpenAI API credentials or managed identity configuration
- **Embedding generation errors**: Check your deployment name and API version
- **Database connection errors**: Verify your database connection string and credentials
- **Connection pool exhaustion**: Increase max connections or optimize query patterns
- **Slow performance**: Check for connection leaks or long-running queries
- **API rate limits**: Implement retries with exponential backoff for rate limit issues