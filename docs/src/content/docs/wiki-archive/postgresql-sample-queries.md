---
title: PostgreSQL Sample Queries
description: Comprehensive PostgreSQL monitoring and vector database queries
---

```sql
-- PostgreSQL Monitoring and GenAI Sample Queries
-- Comprehensive collection of PostgreSQL queries for monitoring, 
-- performance analysis, and vector database operations

-- ============================================================================
-- Database Health and Performance Monitoring
-- ============================================================================

-- Basic database information
SELECT 
    current_database() as database_name,
    current_user as connected_user,
    version() as postgres_version,
    pg_postmaster_start_time() as server_start_time,
    now() - pg_postmaster_start_time() as uptime;

-- Connection statistics
SELECT 
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as disk_blocks_read,
    blks_hit as buffer_cache_hits,
    tup_returned as rows_returned,
    tup_fetched as rows_fetched,
    tup_inserted as rows_inserted,
    tup_updated as rows_updated,
    tup_deleted as rows_deleted
FROM pg_stat_database 
WHERE datname = current_database();

-- Cache hit ratio (should be > 95% for good performance)
SELECT 
    'Buffer Cache Hit Ratio' as metric,
    ROUND(
        (blks_hit::float / (blks_hit + blks_read)) * 100, 2
    ) as percentage
FROM pg_stat_database 
WHERE datname = current_database()
AND (blks_hit + blks_read) > 0;

-- ============================================================================
-- Vector Extension Status and Configuration
-- ============================================================================

-- Check if pgvector extension is installed
SELECT 
    extname as extension_name,
    extversion as version,
    nspname as schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname = 'vector';

-- List all available vector-related functions
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname ILIKE '%vector%' 
   OR p.proname IN ('cosine_distance', 'l2_distance', 'inner_product')
ORDER BY p.proname;

-- Check vector operator classes for indexing
SELECT 
    opcname as operator_class,
    opcintype::regtype as input_type,
    opcdefault as is_default
FROM pg_opclass 
WHERE opcname LIKE '%vector%';

-- ============================================================================
-- Document Embeddings Analysis
-- ============================================================================

-- Count total embeddings by content type
SELECT 
    content_type,
    COUNT(*) as total_embeddings,
    AVG(array_length(embedding, 1)) as avg_dimensions,
    MIN(created_at) as first_embedding,
    MAX(created_at) as latest_embedding
FROM document_embeddings 
GROUP BY content_type
ORDER BY total_embeddings DESC;

-- Find embeddings with unusual dimensions
SELECT 
    id,
    content_type,
    array_length(embedding, 1) as dimensions,
    LEFT(content, 100) as content_preview,
    created_at
FROM document_embeddings
WHERE array_length(embedding, 1) != 1536  -- Assuming standard OpenAI embeddings
ORDER BY created_at DESC
LIMIT 10;

-- Analyze embedding content sizes
SELECT 
    content_type,
    COUNT(*) as count,
    MIN(LENGTH(content)) as min_content_length,
    MAX(LENGTH(content)) as max_content_length,
    ROUND(AVG(LENGTH(content))) as avg_content_length,
    ROUND(STDDEV(LENGTH(content))) as stddev_content_length
FROM document_embeddings
GROUP BY content_type
ORDER BY avg_content_length DESC;

-- ============================================================================
-- Vector Similarity Search Examples
-- ============================================================================

-- Find most similar documents using cosine similarity
-- (Replace the embedding array with actual values)
WITH target_embedding AS (
    SELECT ARRAY[0.1, 0.2, 0.3]::vector AS embedding  -- Example embedding
)
SELECT 
    de.id,
    de.content_type,
    LEFT(de.content, 200) as content_preview,
    1 - (de.embedding <=> te.embedding) as cosine_similarity,
    de.created_at
FROM document_embeddings de, target_embedding te
ORDER BY de.embedding <=> te.embedding
LIMIT 10;

-- Find similar documents using L2 distance
WITH target_embedding AS (
    SELECT ARRAY[0.1, 0.2, 0.3]::vector AS embedding  -- Example embedding
)
SELECT 
    de.id,
    de.content_type,
    LEFT(de.content, 200) as content_preview,
    de.embedding <-> te.embedding as l2_distance,
    de.created_at
FROM document_embeddings de, target_embedding te
ORDER BY de.embedding <-> te.embedding
LIMIT 10;

-- Batch similarity search for multiple queries
WITH query_embeddings AS (
    SELECT 'query1' as query_name, ARRAY[0.1, 0.2, 0.3]::vector AS embedding
    UNION ALL
    SELECT 'query2' as query_name, ARRAY[0.4, 0.5, 0.6]::vector AS embedding
)
SELECT 
    qe.query_name,
    de.id,
    de.content_type,
    LEFT(de.content, 100) as content_preview,
    1 - (de.embedding <=> qe.embedding) as similarity_score
FROM document_embeddings de
CROSS JOIN query_embeddings qe
ORDER BY qe.query_name, de.embedding <=> qe.embedding
LIMIT 20;

-- ============================================================================
-- Index Performance and Statistics
-- ============================================================================

-- Vector index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read as index_reads,
    idx_tup_fetch as index_fetches,
    idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%' 
   OR tablename = 'document_embeddings';

-- Index size and bloat analysis
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_size_pretty(pg_relation_size(relid)) as table_size
FROM pg_stat_user_indexes
WHERE tablename = 'document_embeddings';

-- Check for unused indexes
SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 
  AND schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- Performance Monitoring Queries
-- ============================================================================

-- Slow queries related to vector operations
SELECT 
    query,
    calls,
    total_exec_time,
    ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
    ROUND((100 * total_exec_time / sum(total_exec_time) OVER())::numeric, 2) as percentage
FROM pg_stat_statements
WHERE query ILIKE '%embedding%' 
   OR query ILIKE '%<->%' 
   OR query ILIKE '%<=>%'
   OR query ILIKE '%<#>%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Table bloat analysis for embeddings table
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    ROUND(100 * n_dead_tup / (n_live_tup + n_dead_tup + 1), 2) as dead_row_percentage,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename = 'document_embeddings';

-- Connection pooling analysis
SELECT 
    datname as database,
    usename as username,
    application_name,
    client_addr,
    state,
    COUNT(*) as connection_count,
    MAX(now() - state_change) as max_idle_time
FROM pg_stat_activity
WHERE state IS NOT NULL
GROUP BY datname, usename, application_name, client_addr, state
ORDER BY connection_count DESC;

-- ============================================================================
-- Maintenance and Optimization Queries
-- ============================================================================

-- Manual vacuum and analyze for embeddings table
-- VACUUM ANALYZE document_embeddings;

-- Update table statistics for better query planning
-- ANALYZE document_embeddings;

-- Create HNSW index for fast similarity search (if not exists)
-- CREATE INDEX CONCURRENTLY idx_document_embeddings_hnsw 
-- ON document_embeddings 
-- USING hnsw (embedding vector_cosine_ops);

-- Create IVFFlat index for memory-efficient similarity search
-- CREATE INDEX CONCURRENTLY idx_document_embeddings_ivfflat 
-- ON document_embeddings 
-- USING ivfflat (embedding vector_cosine_ops) 
-- WITH (lists = 100);

-- Set work_mem for better sort performance during index creation
-- SET work_mem = '256MB';

-- Monitor long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 minutes'
  AND state = 'active'
ORDER BY duration DESC;

-- ============================================================================
-- Backup and Recovery Verification
-- ============================================================================

-- Check last backup status (if using pg_basebackup or similar)
SELECT 
    pg_is_in_recovery() as is_replica,
    pg_last_wal_receive_lsn() as last_wal_received,
    pg_last_wal_replay_lsn() as last_wal_replayed,
    CASE 
        WHEN pg_is_in_recovery() THEN
            EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
        ELSE NULL
    END as replica_lag_seconds;

-- Verify point-in-time recovery capability
SELECT 
    name,
    setting,
    context
FROM pg_settings 
WHERE name IN (
    'archive_mode',
    'archive_command',
    'wal_level',
    'max_wal_senders',
    'wal_keep_size'
);

-- ============================================================================
-- Security and Access Control
-- ============================================================================

-- Review database users and their privileges
SELECT 
    rolname as username,
    rolsuper as is_superuser,
    rolcreaterole as can_create_roles,
    rolcreatedb as can_create_databases,
    rolcanlogin as can_login,
    rolconnlimit as connection_limit,
    valuntil as password_expiry
FROM pg_roles
WHERE rolcanlogin = true
ORDER BY rolname;

-- Check table permissions for document_embeddings
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_name = 'document_embeddings'
ORDER BY grantee, privilege_type;

-- Review active connections and their queries
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    client_hostname,
    state,
    LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE state = 'active'
  AND pid <> pg_backend_pid()
ORDER BY query_start;```
