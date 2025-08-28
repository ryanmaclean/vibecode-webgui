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

3. **OpenAI Embedding Service**:
   - `src/lib/ai/embeddingService.ts`: Implementation of OpenAI embedding service
   - Alternative to Azure OpenAI if preferred

4. **Database Schema**:
   - `vector-schema.sql`: PostgreSQL schema with pgvector extension
   - Creates tables, indexes, and helper functions for vector embeddings

5. **Test Scripts**:
   - `test-azure-embedding-complete.js`: End-to-end test of the Azure embedding service
   - `run-azure-embedding-e2e-tests.js`: Jest E2E test runner script
   - `tests/azure-embedding-e2e.test.ts`: Jest test suite for Azure embeddings

## How to Test

### Prerequisites

1. PostgreSQL with pgvector extension installed
2. Azure OpenAI API access
3. Environment variables set up:
   - `AZURE_OPENAI_API_KEY` (or use managed identity)
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_DEPLOYMENT_NAME`
   - `USE_AZURE_MANAGED_IDENTITY` (set to 'true' to use managed identity)
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
   # Option 1: Using API Key
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
   AZURE_OPENAI_API_VERSION=2023-05-15
   DATABASE_URL=postgresql://user:password@localhost:5432/database
   
   # Option 2: Using Managed Identity
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
   AZURE_OPENAI_API_VERSION=2023-05-15
   USE_AZURE_MANAGED_IDENTITY=true
   DATABASE_URL=postgresql://user:password@localhost:5432/database
   ```

2. Run the direct test script:
   ```bash
   node test-azure-embedding-direct.js
   ```

3. Run the E2E tests:
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

### Using Static Factory Methods

```typescript
import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory } from './src/lib/ai/embeddingServiceFactory';

// Create a service with a new Prisma client
const embeddingService = EmbeddingServiceFactory.createEmbeddingService(new PrismaClient());

// For robust connection handling
const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection();

try {
  // Use the service
  const embedding = await service.generateEmbedding("Sample text");
} finally {
  // Release the connection when done
  await releaseConnection();
}
```

### Direct Instantiation

```typescript
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Option 1: Initialize Azure Embedding Service with API Key
const azureEmbeddingService = new AzureEmbeddingService(
  process.env.AZURE_OPENAI_API_KEY,
  process.env.AZURE_OPENAI_ENDPOINT,
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
  prisma
);

// Option 2: Initialize Azure Embedding Service with Managed Identity
const azureEmbeddingServiceWithMI = new AzureEmbeddingService(
  '',  // Empty API key
  process.env.AZURE_OPENAI_ENDPOINT,
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
  prisma,
  true  // Use managed identity
);

// Store a document with embedding
await azureEmbeddingService.storeDocument(
  'document-id', 
  'Document content here', 
  { category: 'article', author: 'Jane Doe' }
);
```

### Using Azure Managed Identity

To use Azure Managed Identity instead of API keys:

1. Set the environment variable:
   ```
   USE_AZURE_MANAGED_IDENTITY=true
   ```

2. Make sure your app is deployed to an Azure service that supports managed identities (e.g., App Service, AKS, VM)

3. Assign the appropriate role to your managed identity:
   ```bash
   # Using Azure CLI
   az role assignment create \
     --assignee-object-id <managed-identity-object-id> \
     --assignee-principal-type ServicePrincipal \
     --role "Cognitive Services OpenAI User" \
     --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<openai-resource-name>
   ```

4. The service will automatically authenticate using the DefaultAzureCredential

## Vector Search Implementation

The vector search uses PostgreSQL's pgvector extension, which provides vector similarity operations:

- `<=>`: Euclidean distance (smaller values mean more similar)
- `<#>`: Negative inner product (smaller values mean more similar)
- `<->`: Cosine distance (smaller values mean more similar)

The implementation uses `<=>` (Euclidean distance) and converts it to a similarity score:

```sql
SELECT 
  id, 
  document_id, 
  content,
  metadata,
  1 - (embedding <=> $1::vector) as similarity
FROM document_embeddings
WHERE 1 - (embedding <=> $1::vector) > $threshold
```

## Performance Considerations

- Azure OpenAI API calls incur latency and cost, so consider caching embeddings
- For large-scale deployments, implement connection pooling and query caching
- Use appropriate vector indices in PostgreSQL for faster similarity searches
- Monitor API usage and rate limits

## Next Steps

1. ✅ Implement Azure Managed Identity support for more secure authentication
2. Add monitoring for Azure API usage with Datadog integration
3. Implement connection pooling for database operations
4. Create metrics dashboard for embedding operations
5. Add support for batch operations for better performance
6. Implement caching for frequently accessed embeddings

## Troubleshooting

- **pgvector extension not found**: Make sure pgvector is installed in your PostgreSQL instance
- **Authentication errors**: Verify your Azure OpenAI API credentials or managed identity configuration
- **Embedding generation errors**: Check your deployment name and API version
- **Database connection errors**: Verify your database connection string and credentials
- **API rate limits**: Implement retries with exponential backoff for rate limit issues
- **Managed identity errors**: Check that the managed identity has the correct role assignments