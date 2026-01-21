-- VibeCode PostgreSQL + pgvector Initialization Script
-- PostgreSQL 16+ with pgvector 0.8.0+
--
-- This script:
-- 1. Creates the vibecode database and user
-- 2. Installs and configures pgvector extension
-- 3. Sets up optimized indexes for vector operations
-- 4. Creates sample vector tables for testing
-- 5. Configures security and permissions
--
-- Usage: psql -U postgres -f init.sql
-- Last Updated: 2024-10-28

\set ON_ERROR_STOP on
\timing on

-- ============================================================================
-- SECTION 1: DATABASE AND USER SETUP
-- ============================================================================

\echo '==================================================================='
\echo 'Section 1: Creating Database and Users'
\echo '==================================================================='

-- Set password for postgres superuser
ALTER USER postgres WITH PASSWORD 'postgres_admin_2024';

-- Create vibecode application user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'vibecode') THEN
        CREATE USER vibecode WITH PASSWORD 'vibecode_prod_2024' CREATEDB;
        RAISE NOTICE 'User vibecode created successfully';
    ELSE
        ALTER USER vibecode WITH PASSWORD 'vibecode_prod_2024' CREATEDB;
        RAISE NOTICE 'User vibecode already exists, password updated';
    END IF;
END
$$;

-- Create vibecode database
SELECT 'Creating vibecode database...' as status;
DROP DATABASE IF EXISTS vibecode;
CREATE DATABASE vibecode
    WITH
    OWNER = vibecode
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TEMPLATE = template0
    CONNECTION LIMIT = -1;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode;
ALTER DATABASE vibecode OWNER TO vibecode;

\echo 'Database vibecode created successfully!'
\echo ''

-- Connect to the vibecode database for remaining operations
\c vibecode vibecode

-- ============================================================================
-- SECTION 2: EXTENSION INSTALLATION
-- ============================================================================

\echo '==================================================================='
\echo 'Section 2: Installing PostgreSQL Extensions'
\echo '==================================================================='

-- Install pgvector extension
SELECT 'Installing pgvector extension...' as status;
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector installation
SELECT 'Verifying pgvector...' as status;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Install useful extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pgcrypto;            -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";         -- UUID generation

-- List all installed extensions
\echo ''
\echo 'Installed Extensions:'
SELECT extname, extversion, extrelocatable, extnamespace::regnamespace
FROM pg_extension
ORDER BY extname;

\echo ''

-- ============================================================================
-- SECTION 3: VECTOR TEST SCHEMA AND TABLES
-- ============================================================================

\echo '==================================================================='
\echo 'Section 3: Creating Vector Test Schema'
\echo '==================================================================='

-- Create test schema for vector operations
CREATE SCHEMA IF NOT EXISTS vector_test;
ALTER SCHEMA vector_test OWNER TO vibecode;

SET search_path TO vector_test, public;

-- Test table: embeddings_test
-- This table demonstrates vector storage and similarity search
\echo 'Creating embeddings_test table...'
CREATE TABLE IF NOT EXISTS embeddings_test (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 dimensions
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE embeddings_test IS 'Test table for vector embeddings and similarity search';
COMMENT ON COLUMN embeddings_test.embedding IS 'Vector embedding (1536 dimensions for OpenAI ada-002)';
COMMENT ON COLUMN embeddings_test.metadata IS 'Additional metadata (language, tokens, source, etc.)';

-- Test table: code_embeddings
-- Simulates the production RAG chunks table structure
\echo 'Creating code_embeddings table...'
CREATE TABLE IF NOT EXISTS code_embeddings (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(255) UNIQUE NOT NULL,
    file_name VARCHAR(255),
    file_path TEXT,
    content TEXT NOT NULL,
    language VARCHAR(50),
    start_line INTEGER,
    end_line INTEGER,
    tokens INTEGER,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for code_embeddings
CREATE INDEX IF NOT EXISTS idx_code_embeddings_file_path ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_language ON code_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_chunk_id ON code_embeddings(chunk_id);

COMMENT ON TABLE code_embeddings IS 'Production-like table for code chunk embeddings';

\echo ''
\echo 'Test tables created successfully!'

-- ============================================================================
-- SECTION 4: VECTOR INDEXES
-- ============================================================================

\echo '==================================================================='
\echo 'Section 4: Creating Vector Indexes'
\echo '==================================================================='

-- HNSW Index (Hierarchical Navigable Small World)
-- Best for: High recall, faster queries, larger datasets
-- Parameters:
--   m: Max connections per layer (16 recommended, higher = better recall)
--   ef_construction: Size of dynamic candidate list (64 recommended)
\echo 'Creating HNSW index on embeddings_test (this may take a moment)...'
CREATE INDEX IF NOT EXISTS idx_embeddings_test_hnsw
ON embeddings_test
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

\echo 'HNSW index created!'

-- IVFFlat Index (Inverted File with Flat Compression)
-- Best for: Faster builds, good for smaller datasets
-- Parameters:
--   lists: Number of clusters (sqrt(rows) recommended, 100 for testing)
\echo 'Creating IVFFlat index on code_embeddings...'
CREATE INDEX IF NOT EXISTS idx_code_embeddings_ivfflat
ON code_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

\echo 'IVFFlat index created!'

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_test_created_at
ON embeddings_test(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_embeddings_created_at
ON code_embeddings(created_at DESC);

\echo ''
\echo 'Vector indexes created successfully!'

-- ============================================================================
-- SECTION 5: SAMPLE DATA
-- ============================================================================

\echo '==================================================================='
\echo 'Section 5: Inserting Sample Vector Data'
\echo '==================================================================='

-- Insert sample embeddings (random vectors for testing)
\echo 'Inserting sample embeddings...'

-- Sample 1: TypeScript code chunk
INSERT INTO code_embeddings (
    chunk_id, file_name, file_path, content, language, start_line, end_line, tokens, embedding, metadata
) VALUES (
    'sample-1-typescript',
    'example.ts',
    '/workspace/src/example.ts',
    'function calculateDistance(p1: Point, p2: Point): number { return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }',
    'typescript',
    10,
    15,
    45,
    array_fill(0, ARRAY[1536])::vector,  -- Zero vector for testing
    '{"type": "function", "exported": true, "async": false}'::jsonb
);

-- Sample 2: Python code chunk
INSERT INTO code_embeddings (
    chunk_id, file_name, file_path, content, language, start_line, end_line, tokens, embedding, metadata
) VALUES (
    'sample-2-python',
    'vector_search.py',
    '/workspace/lib/vector_search.py',
    'def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float: return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))',
    'python',
    25,
    28,
    38,
    array_fill(0.1, ARRAY[1536])::vector,  -- Small values for testing
    '{"type": "function", "imports": ["numpy"], "complexity": "low"}'::jsonb
);

-- Sample 3: SQL code chunk
INSERT INTO code_embeddings (
    chunk_id, file_name, file_path, content, language, start_line, end_line, tokens, embedding, metadata
) VALUES (
    'sample-3-sql',
    'schema.sql',
    '/database/schema.sql',
    'CREATE TABLE embeddings (id SERIAL PRIMARY KEY, embedding vector(1536), metadata JSONB);',
    'sql',
    1,
    3,
    22,
    array_fill(0.5, ARRAY[1536])::vector,
    '{"type": "ddl", "table": "embeddings", "operation": "create"}'::jsonb
);

-- Insert sample test embeddings
INSERT INTO embeddings_test (content, embedding, metadata)
VALUES
    ('Vector similarity search with PostgreSQL and pgvector',
     array_fill(0.2, ARRAY[1536])::vector,
     '{"category": "documentation", "tags": ["postgresql", "pgvector"]}'::jsonb),
    ('Building AI applications with embeddings and RAG',
     array_fill(0.3, ARRAY[1536])::vector,
     '{"category": "tutorial", "tags": ["ai", "rag", "embeddings"]}'::jsonb),
    ('Optimizing vector search performance in PostgreSQL',
     array_fill(0.4, ARRAY[1536])::vector,
     '{"category": "optimization", "tags": ["performance", "indexing"]}'::jsonb);

\echo 'Sample data inserted successfully!'
\echo ''

-- ============================================================================
-- SECTION 6: HELPER FUNCTIONS
-- ============================================================================

\echo '==================================================================='
\echo 'Section 6: Creating Helper Functions'
\echo '==================================================================='

-- Function: find_similar_code
-- Performs cosine similarity search on code embeddings
CREATE OR REPLACE FUNCTION find_similar_code(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    chunk_id varchar,
    file_path text,
    content text,
    language varchar,
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.chunk_id,
        ce.file_path,
        ce.content,
        ce.language,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM code_embeddings ce
    WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_similar_code IS 'Find similar code chunks using cosine similarity';

-- Function: get_vector_stats
-- Returns statistics about vector tables
CREATE OR REPLACE FUNCTION get_vector_stats()
RETURNS TABLE (
    table_name text,
    row_count bigint,
    avg_vector_magnitude float,
    index_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'embeddings_test'::text,
        COUNT(*)::bigint,
        AVG(vector_norm(embedding))::float,
        pg_size_pretty(pg_total_relation_size('idx_embeddings_test_hnsw'))
    FROM embeddings_test
    UNION ALL
    SELECT
        'code_embeddings'::text,
        COUNT(*)::bigint,
        AVG(vector_norm(embedding))::float,
        pg_size_pretty(pg_total_relation_size('idx_code_embeddings_ivfflat'))
    FROM code_embeddings;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_vector_stats IS 'Get statistics about vector tables and indexes';

\echo 'Helper functions created successfully!'
\echo ''

-- ============================================================================
-- SECTION 7: PERMISSIONS AND SECURITY
-- ============================================================================

\echo '==================================================================='
\echo 'Section 7: Configuring Permissions'
\echo '==================================================================='

-- Grant schema permissions
GRANT ALL ON SCHEMA vector_test TO vibecode;
GRANT USAGE ON SCHEMA vector_test TO vibecode;

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA vector_test TO vibecode;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA vector_test TO vibecode;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vector_test TO vibecode;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA vector_test
GRANT ALL ON TABLES TO vibecode;

ALTER DEFAULT PRIVILEGES IN SCHEMA vector_test
GRANT ALL ON SEQUENCES TO vibecode;

ALTER DEFAULT PRIVILEGES IN SCHEMA vector_test
GRANT EXECUTE ON FUNCTIONS TO vibecode;

-- Grant public schema permissions (for Prisma)
GRANT ALL ON SCHEMA public TO vibecode;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vibecode;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vibecode;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO vibecode;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO vibecode;

\echo 'Permissions configured successfully!'
\echo ''

-- ============================================================================
-- SECTION 8: VERIFICATION AND TESTING
-- ============================================================================

\echo '==================================================================='
\echo 'Section 8: Verification and Testing'
\echo '==================================================================='

-- Verify pgvector is working
\echo 'Testing vector operations...'
SELECT 'Vector addition test:' as test,
       (ARRAY[1,2,3]::vector + ARRAY[4,5,6]::vector)::text as result;

SELECT 'Vector cosine distance test:' as test,
       (ARRAY[1,0,0]::vector <=> ARRAY[1,0,0]::vector) as distance;

-- Test similarity search
\echo ''
\echo 'Testing similarity search...'
SELECT
    chunk_id,
    LEFT(content, 50) || '...' as content_preview,
    language,
    (1 - (embedding <=> array_fill(0.3, ARRAY[1536])::vector)) as similarity
FROM code_embeddings
ORDER BY embedding <=> array_fill(0.3, ARRAY[1536])::vector
LIMIT 3;

-- Display vector statistics
\echo ''
\echo 'Vector Statistics:'
SELECT * FROM get_vector_stats();

-- Display database size
\echo ''
\echo 'Database Size:'
SELECT
    pg_database.datname as database,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'vibecode';

-- Display table sizes
\echo ''
\echo 'Table Sizes:'
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'vector_test'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- COMPLETION
-- ============================================================================

\echo ''
\echo '==================================================================='
\echo 'PostgreSQL + pgvector Initialization Complete!'
\echo '==================================================================='
\echo ''
\echo 'Summary:'
\echo '  ✓ Database created: vibecode'
\echo '  ✓ User created: vibecode'
\echo '  ✓ pgvector extension installed'
\echo '  ✓ Test schema created: vector_test'
\echo '  ✓ HNSW and IVFFlat indexes created'
\echo '  ✓ Sample data inserted'
\echo '  ✓ Helper functions created'
\echo ''
\echo 'Connection String:'
\echo '  postgresql://vibecode:vibecode_prod_2024@localhost:5432/vibecode?sslmode=require'
\echo ''
\echo 'Test Queries:'
\echo '  -- Find similar code'
\echo '  SELECT * FROM vector_test.find_similar_code('
\echo '    array_fill(0.3, ARRAY[1536])::vector,'
\echo '    0.5,'
\echo '    5'
\echo '  );'
\echo ''
\echo '  -- Get vector statistics'
\echo '  SELECT * FROM vector_test.get_vector_stats();'
\echo ''
\echo '  -- Test cosine similarity'
\echo '  SELECT chunk_id, 1 - (embedding <=> array_fill(0, ARRAY[1536])::vector) AS similarity'
\echo '  FROM vector_test.code_embeddings'
\echo '  ORDER BY embedding <=> array_fill(0, ARRAY[1536])::vector'
\echo '  LIMIT 5;'
\echo ''
\echo 'Next Steps:'
\echo '  1. Update .env file with DATABASE_URL'
\echo '  2. Run: npx prisma migrate deploy'
\echo '  3. Run: npx prisma generate'
\echo '  4. Test vector search from application'
\echo ''
\echo '==================================================================='

-- Reset search path
SET search_path TO public;
