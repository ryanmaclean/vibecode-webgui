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

-- Create vector indices if they don't exist
-- Note: This might fail if pgvector extension isn't properly installed
DO $$
BEGIN
  BEGIN
    -- Create L2 distance index (Euclidean distance)
    EXECUTE 'CREATE INDEX IF NOT EXISTS document_embeddings_embedding_l2_idx ON document_embeddings USING ivfflat (embedding vector_l2_ops)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create L2 index: %', SQLERRM;
  END;

  BEGIN
    -- Create inner product index (for cosine similarity)
    EXECUTE 'CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ip_idx ON document_embeddings USING ivfflat (embedding vector_ip_ops)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create IP index: %', SQLERRM;
  END;
END
$$;