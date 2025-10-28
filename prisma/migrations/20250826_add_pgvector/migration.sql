-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for storing document embeddings
CREATE TABLE document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),  -- For OpenAI embeddings
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for vector similarity search
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id INT,
  document_id TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    document_id,
    content,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Add monitoring columns to track performance
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS embedding_generation_time_ms INTEGER;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS search_count INTEGER DEFAULT 0;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE;

-- Create a function to update last_accessed_at
CREATE OR REPLACE FUNCTION update_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    NEW.search_count = COALESCE(NEW.search_count, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update last_accessed_at on search
CREATE TRIGGER update_document_access
BEFORE UPDATE OF embedding ON document_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_last_accessed();

-- Create a view for monitoring embedding usage
CREATE OR REPLACE VIEW embedding_usage_stats AS
SELECT
    DATE_TRUNC('hour', created_at) AS hour_bucket,
    COUNT(*) AS total_embeddings,
    AVG(LENGTH(content)) AS avg_content_length,
    AVG(embedding_generation_time_ms) AS avg_generation_time_ms,
    SUM(search_count) AS total_searches
FROM document_embeddings
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;
