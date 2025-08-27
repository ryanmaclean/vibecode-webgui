-- Sample PostgreSQL Queries for Azure PostgreSQL Monitoring Webinar
-- These queries demonstrate monitoring vector operations and performance

-- 1. Check pgvector Extension Installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 2. Check Vector Type Configuration
SELECT typelem, typndims, typmod FROM pg_type WHERE typname = 'vector';

-- 3. Get Vector Index Information
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'rag_chunks' 
  AND indexdef LIKE '%vector%';

-- 4. Check Vector Table Size and Row Count
SELECT 
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
  pg_size_pretty(pg_relation_size(concat('rag_chunks_embedding_idx'::regclass))) as vector_index_size,
  reltuples::bigint as row_estimate
FROM pg_class c
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relname = 'rag_chunks';

-- 5. Monitor Active Vector Queries
SELECT 
  pid,
  state,
  now() - query_start as query_duration,
  query
FROM pg_stat_activity
WHERE query LIKE '%<=>%' 
  OR query LIKE '%vector%'
ORDER BY query_duration DESC;

-- 6. Get Vector Query Performance Statistics
SELECT 
  query,
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as avg_time_ms,
  round(max_exec_time::numeric, 2) as max_time_ms,
  rows
FROM pg_stat_statements
WHERE query LIKE '%<=>%' 
  OR query LIKE '%embedding%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 7. Get Database Connection Statistics
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity 
WHERE datname = current_database();

-- 8. Get Azure PostgreSQL Resource Utilization (Azure Metrics)
-- Note: These metrics are available through Azure Portal/API but not directly via SQL
-- These are example queries that extract related information:

-- Memory-related Info
SELECT 
  name, 
  setting, 
  unit, 
  context 
FROM pg_settings 
WHERE name IN (
  'work_mem', 
  'maintenance_work_mem', 
  'shared_buffers', 
  'effective_cache_size'
);

-- 9. Vector Operation Performance Metrics
WITH vector_counts AS (
  SELECT COUNT(*) as total_embeddings FROM rag_chunks WHERE embedding IS NOT NULL
)
SELECT 
  vc.total_embeddings,
  pg_size_pretty(pg_relation_size('rag_chunks_embedding_idx')) as index_size,
  (SELECT pg_size_pretty(pg_relation_size('rag_chunks_embedding_idx') / NULLIF(vc.total_embeddings, 0))) as avg_bytes_per_vector
FROM vector_counts vc;

-- 10. Check for Slow Vector Queries (Last Hour)
SELECT 
  query,
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as avg_time_ms,
  round(stddev_exec_time::numeric, 2) as stddev_time_ms,
  rows
FROM pg_stat_statements
WHERE query LIKE '%<=>%' 
  AND mean_exec_time > 100  -- milliseconds
  AND calls > 5
ORDER BY total_exec_time DESC
LIMIT 10;

-- 11. Estimate Vector Search Performance at Scale (EXPLAIN ANALYZE)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, content
FROM rag_chunks
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- 12. Monitoring Function for Custom Metrics
CREATE OR REPLACE FUNCTION get_vector_metrics() 
RETURNS TABLE (metric_name text, metric_value numeric) AS $$
BEGIN
  RETURN QUERY
  
  -- Total vector count
  SELECT 'vector_count', COUNT(*)::numeric 
  FROM rag_chunks 
  WHERE embedding IS NOT NULL
  
  UNION ALL
  
  -- Vector index size
  SELECT 'vector_index_size', pg_relation_size('rag_chunks_embedding_idx')::numeric
  
  UNION ALL
  
  -- Average vector search time
  SELECT 'avg_vector_search_time', mean_exec_time
  FROM pg_stat_statements
  WHERE query LIKE '%<=>%' AND calls > 10
  ORDER BY mean_exec_time DESC
  LIMIT 1
  
  UNION ALL
  
  -- Vector table size
  SELECT 'vector_table_size', pg_relation_size('rag_chunks')::numeric
  
  UNION ALL
  
  -- Vector search query rate (calls per minute)
  SELECT 'vector_search_rate', 
    SUM(calls) / 
    (EXTRACT(EPOCH FROM (now() - pg_stat_statements_reset())) / 60)
  FROM pg_stat_statements
  WHERE query LIKE '%<=>%';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for monitoring user
GRANT EXECUTE ON FUNCTION get_vector_metrics() TO datadog;

-- 13. Reset Query Statistics
-- Run this after testing to reset performance metrics
SELECT pg_stat_statements_reset();

-- 14. Check Table Fragmentation
SELECT 
  schemaname, 
  relname, 
  n_dead_tup, 
  n_live_tup, 
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tup_ratio
FROM pg_stat_user_tables
WHERE relname = 'rag_chunks'
ORDER BY n_dead_tup DESC;

-- 15. Monitor Index Usage
SELECT 
  relname, 
  indexrelname, 
  idx_scan, 
  idx_tup_read, 
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'rag_chunks'
ORDER BY idx_scan DESC;

-- 16. Optimize Database for Vector Operations
-- Run these commands to optimize performance for vector workloads

-- Set memory parameters
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET effective_cache_size = '8GB';

-- Optimize for SSD storage (Azure Premium Storage)
ALTER SYSTEM SET random_page_cost = 1.1;

-- Enable parallel query
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;

-- Track query statistics
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;

-- Reload configuration
SELECT pg_reload_conf();

-- 17. Test Vector Similarity Search
-- Replace with actual vector values
SELECT id, content
FROM rag_chunks
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- 18. Check Database Wait Events
SELECT 
  wait_event_type, 
  wait_event, 
  COUNT(*) as count
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY wait_event_type, wait_event
ORDER BY count DESC;

-- 19. Monitor Table VACUUM Operations
SELECT 
  relname, 
  last_vacuum, 
  last_autovacuum, 
  vacuum_count, 
  autovacuum_count
FROM pg_stat_user_tables
WHERE relname = 'rag_chunks';

-- 20. Create Index for Different Distance Metrics
-- Cosine similarity (normalized, angle-based)
CREATE INDEX idx_embedding_cosine ON rag_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Inner product (useful for certain ML models)
CREATE INDEX idx_embedding_ip ON rag_chunks 
USING hnsw (embedding vector_ip_ops);

-- Euclidean distance
CREATE INDEX idx_embedding_l2 ON rag_chunks 
USING hnsw (embedding vector_l2_ops);