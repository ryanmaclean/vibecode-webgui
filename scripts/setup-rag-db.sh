#!/bin/bash

# RAG Database Setup Script
# Sets up the pgvector database for documentation ingestion

set -e

echo "🚀 Setting up RAG database for documentation..."

# Check if required environment variables are set
if [[ -z "$DATABASE_URL" ]]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    exit 1
fi

# Initialize vector database schema
echo "📊 Initializing vector database schema..."
if [[ -f "vector-schema.sql" ]]; then
    psql "$DATABASE_URL" -f vector-schema.sql
    echo "✅ Vector schema initialized"
else
    echo "⚠️  vector-schema.sql not found, creating tables manually..."
    psql "$DATABASE_URL" << 'EOF'
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure the document_embeddings table exists
CREATE TABLE IF NOT EXISTS document_embeddings (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  embedding_generation_time_ms INTEGER,
  search_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indices if they don't exist
CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);

-- Create vector indices
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_cosine_idx 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
EOF
    echo "✅ Database schema created"
fi

# Check if Azure OpenAI credentials are available
if [[ -z "$AZURE_OPENAI_API_KEY" ]] || [[ -z "$AZURE_OPENAI_ENDPOINT" ]]; then
    echo "⚠️  Azure OpenAI credentials not found"
    echo "Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT"
    echo "Continuing without embedding generation..."
else
    echo "✅ Azure OpenAI credentials found"
fi

# Test database connectivity
echo "🔗 Testing database connectivity..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM document_embeddings;" > /dev/null
echo "✅ Database connection successful"

# Count existing documents
DOC_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM document_embeddings;" | xargs)
echo "📚 Current documents in database: $DOC_COUNT"

echo ""
echo "✅ RAG database setup completed!"
echo ""
echo "Next steps:"
echo "1. Run the ingestion script: npm run tsx scripts/ingest-docs-to-rag.ts"
echo "2. Or use the Node.js script: node -r tsx/register scripts/ingest-docs-to-rag.ts"
echo ""
