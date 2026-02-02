-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with vector column
CREATE TABLE your_table (
    id bigserial PRIMARY KEY,
    vector vector(1536) NOT NULL
);

-- Create index on the vector column (correct column name)
CREATE INDEX idx_vector ON your_table USING ivfflat (vector vector_cosine_ops);

-- Insert sample data with proper 1536-dimension vectors
INSERT INTO your_table (vector) VALUES
    (array_fill(0.1, ARRAY[1536])::vector),
    (array_fill(0.2, ARRAY[1536])::vector),
    (array_fill(0.3, ARRAY[1536])::vector);

-- Query examples using cosine distance
SELECT id, vector <-> array_fill(0.1, ARRAY[1536])::vector as distance 
FROM your_table
WHERE vector <-> array_fill(0.1, ARRAY[1536])::vector < 0.5;

-- Order by similarity (closest first)
SELECT id, vector <-> array_fill(0.1, ARRAY[1536])::vector as distance
FROM your_table
ORDER BY vector <-> array_fill(0.1, ARRAY[1536])::vector
LIMIT 10;

-- Additional pgvector operations for VibeCode AI workflow

-- 1. Different distance operators
SELECT id, 
    vector <-> array_fill(0.1, ARRAY[1536])::vector as cosine_distance,
    vector <#> array_fill(0.1, ARRAY[1536])::vector as negative_inner_product,
    vector <=> array_fill(0.1, ARRAY[1536])::vector as euclidean_distance
FROM your_table
ORDER BY vector <-> array_fill(0.1, ARRAY[1536])::vector
LIMIT 5;

-- 2. Create a more realistic table for AI embeddings
CREATE TABLE ai_embeddings (
    id bigserial PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL, -- 'code', 'documentation', 'chat'
    content_hash VARCHAR(64) NOT NULL,
    embedding vector(1536) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create optimized indexes for different use cases
CREATE INDEX idx_ai_embeddings_cosine ON ai_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_ai_embeddings_content_type ON ai_embeddings(content_type);
CREATE INDEX idx_ai_embeddings_metadata ON ai_embeddings USING gin(metadata);

-- 4. Insert realistic test data
INSERT INTO ai_embeddings (content_type, content_hash, embedding, metadata) VALUES
    ('code', 'abc123', array_fill(0.1, ARRAY[1536])::vector, '{"language": "typescript", "file": "api.ts"}'),
    ('documentation', 'def456', array_fill(0.2, ARRAY[1536])::vector, '{"section": "getting-started"}'),
    ('chat', 'ghi789', array_fill(0.3, ARRAY[1536])::vector, '{"user_id": "user123", "session_id": "sess456"}');

-- 5. Semantic search query for VibeCode AI features
SELECT 
    content_type,
    content_hash,
    metadata,
    embedding <-> array_fill(0.1, ARRAY[1536])::vector as similarity_score
FROM ai_embeddings
WHERE content_type = 'code'
ORDER BY embedding <-> array_fill(0.1, ARRAY[1536])::vector
LIMIT 10;

-- 6. Hybrid search combining vector similarity with metadata filtering
SELECT 
    id,
    content_type,
    metadata->>'language' as language,
    embedding <-> array_fill(0.15, ARRAY[1536])::vector as similarity
FROM ai_embeddings
WHERE 
    content_type = 'code' 
    AND metadata->>'language' = 'typescript'
    AND embedding <-> array_fill(0.15, ARRAY[1536])::vector < 0.8
ORDER BY embedding <-> array_fill(0.15, ARRAY[1536])::vector
LIMIT 5;
