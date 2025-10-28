-- pgvector Performance Test for VibeCode Platform
-- This script demonstrates production-ready pgvector usage

-- 1. Create production-ready embeddings table
CREATE TABLE IF NOT EXISTS code_embeddings (
    id bigserial PRIMARY KEY,
    file_path VARCHAR(500) NOT NULL,
    content_hash VARCHAR(64) NOT NULL UNIQUE,
    embedding vector(1536) NOT NULL,
    language VARCHAR(50),
    framework VARCHAR(100),
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert realistic test data (simulating 1000 code files)
INSERT INTO code_embeddings (file_path, content_hash, embedding, language, framework, file_size)
SELECT 
    'src/components/file_' || i || '.tsx',
    md5('content_' || i),
    (SELECT array_agg(random()) FROM generate_series(1, 1536))::vector,
    CASE (i % 4)
        WHEN 0 THEN 'typescript'
        WHEN 1 THEN 'javascript'
        WHEN 2 THEN 'python'
        ELSE 'rust'
    END,
    CASE (i % 3)
        WHEN 0 THEN 'react'
        WHEN 1 THEN 'nextjs'
        ELSE 'express'
    END,
    1000 + (i * 100)
FROM generate_series(1, 1000) i
ON CONFLICT (content_hash) DO NOTHING;

-- 3. Create optimized indexes AFTER data insertion
CREATE INDEX IF NOT EXISTS idx_code_embeddings_ivfflat 
ON code_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_code_embeddings_language ON code_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_framework ON code_embeddings(language, framework);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_path ON code_embeddings USING gin(to_tsvector('english', file_path));

-- 4. Performance test queries
\timing on

-- Query 1: Pure vector similarity search
EXPLAIN (ANALYZE, BUFFERS) 
SELECT file_path, language, embedding <-> (SELECT embedding FROM code_embeddings LIMIT 1) as similarity
FROM code_embeddings
ORDER BY embedding <-> (SELECT embedding FROM code_embeddings LIMIT 1)
LIMIT 10;

-- Query 2: Hybrid search with language filter
EXPLAIN (ANALYZE, BUFFERS)
SELECT file_path, language, framework, embedding <-> (SELECT embedding FROM code_embeddings WHERE language = 'typescript' LIMIT 1) as similarity
FROM code_embeddings
WHERE language = 'typescript'
ORDER BY embedding <-> (SELECT embedding FROM code_embeddings WHERE language = 'typescript' LIMIT 1)
LIMIT 10;

-- Query 3: Complex search with multiple filters
EXPLAIN (ANALYZE, BUFFERS)
SELECT file_path, language, framework, file_size, embedding <-> (SELECT embedding FROM code_embeddings WHERE language = 'typescript' AND framework = 'react' LIMIT 1) as similarity
FROM code_embeddings
WHERE language = 'typescript' 
  AND framework = 'react'
  AND file_size > 2000
ORDER BY embedding <-> (SELECT embedding FROM code_embeddings WHERE language = 'typescript' AND framework = 'react' LIMIT 1)
LIMIT 5;

\timing off

-- 5. Index usage statistics
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE tablename = 'code_embeddings';

-- 6. Table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables 
WHERE tablename = 'code_embeddings';
