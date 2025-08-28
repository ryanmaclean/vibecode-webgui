# Azure OpenAI Embedding Service Setup Guide

This guide will walk you through setting up the Azure OpenAI embedding service for your VibeCode application. The Azure embedding service allows you to generate vector embeddings for text using Azure OpenAI models and store them in a database for similarity search.

## Prerequisites

- Azure account with access to Azure OpenAI
- Azure OpenAI service deployed with a text embedding model (e.g., `text-embedding-3-small`)
- Database with pgvector extension (PostgreSQL recommended)

## Step 1: Create Azure OpenAI Service

1. Log in to the [Azure Portal](https://portal.azure.com)
2. Create a new Azure OpenAI service resource
3. Once deployed, deploy a text embedding model (e.g., `text-embedding-3-small`)
4. Note down the following information:
   - API Key
   - Endpoint URL
   - Deployment name (the name you gave to your embedding model deployment)
   - API version (e.g., `2023-05-15`)

## Step 2: Set Environment Variables

Add the following environment variables to your application:

```dotenv
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_ENDPOINT=https://your-service.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-embedding-model-deployment-name
AZURE_OPENAI_API_VERSION=2023-05-15

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
```

## Step 3: Database Setup

Ensure your PostgreSQL database has the pgvector extension installed:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the document_embeddings table for storing vector embeddings
CREATE TABLE IF NOT EXISTS document_embeddings (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  embedding_generation_time_ms INTEGER DEFAULT 0,
  search_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);

-- Create vector index (may not work on all PostgreSQL services)
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## Step 4: Usage in Code

You can use the embedding service in your code like this:

```typescript
import { PrismaClient } from '@prisma/client';
import { createEmbeddingServiceWithRobustConnection } from './src/lib/ai/embeddingServiceFactory';

async function example() {
  // Create the embedding service with robust connection
  const { service, releaseConnection } = await createEmbeddingServiceWithRobustConnection();
  
  try {
    // Generate an embedding for a text
    const text = "This is a sample text to generate embeddings for";
    const embedding = await service.generateEmbedding(text);
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Store a document with its embedding
    await service.storeDocument(
      "doc-1",
      "This is a sample document to store",
      { category: "sample", tags: ["example", "documentation"] }
    );
    
    // Find similar documents
    const similarDocs = await service.findSimilarDocuments(
      "Find documents similar to this query",
      { threshold: 0.7, limit: 5 }
    );
    console.log(`Found ${similarDocs.length} similar documents`);
    
    // Perform a RAG query
    const ragResult = await service.ragQuery(
      "What information do you have about vector embeddings?",
      { threshold: 0.7, limit: 5 }
    );
    console.log(`Found ${ragResult.documents.length} relevant documents for RAG`);
  } finally {
    // Release the database connection
    releaseConnection();
  }
}
```

## Troubleshooting

### Common Issues

1. **Azure OpenAI API Connection Errors**
   - Verify your API key, endpoint, and deployment name are correct
   - Ensure your Azure region matches your endpoint URL
   - Check API version compatibility with your deployed model

2. **Database Connection Issues**
   - Verify your database connection string is correct
   - Ensure the pgvector extension is installed
   - Check that the document_embeddings table exists with the correct schema

3. **Embedding Generation Failures**
   - Verify that your deployment is using a text embedding model
   - Check Azure OpenAI service quotas and limits
   - Ensure your text input is not too large (typically < 8192 tokens)

### Testing

You can test your Azure embedding service setup using the provided test script:

```bash
# Test with database operations (requires valid DATABASE_URL)
node test-azure-embedding-direct.js

# Test only embedding generation (skip database operations)
SKIP_DB_TESTS=true node test-azure-embedding-direct.js
```

## Performance Considerations

- **Batch Processing**: When processing multiple documents, consider batching them to reduce API calls
- **Caching**: Consider caching embeddings for frequently used texts
- **Vector Indexes**: Use appropriate vector indexes in your database for faster similarity searches
- **Connection Pooling**: Use connection pooling for database operations to improve performance

## Security Considerations

- **API Key Protection**: Store your Azure OpenAI API key securely using environment variables or a secrets manager
- **Access Control**: Implement proper access control for your embedding service
- **Data Privacy**: Be mindful of the data you store as embeddings, as it may contain sensitive information