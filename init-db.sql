-- Initialize pgvector extension and create tables
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspace documents table for RAG
CREATE TABLE IF NOT EXISTS workspace_documents (
    id SERIAL PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    filepath TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, filepath)
);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_documents_embedding
ON workspace_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
