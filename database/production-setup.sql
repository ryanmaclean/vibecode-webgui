-- VibeCode Production Database Setup
-- Configures PostgreSQL for production use with pgvector and monitoring

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create Datadog monitoring user (if credentials provided)
DO $$
BEGIN
  -- Only create if 'vibecode.datadog_password' is provided (typically sourced from
  -- DD_POSTGRES_PASSWORD with legacy DATADOG_POSTGRES_PASSWORD fallback)
  IF current_setting('vibecode.datadog_password', true) IS NOT NULL THEN
    -- Create user if doesn't exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
      EXECUTE 'CREATE USER datadog WITH ENCRYPTED PASSWORD ''' || 
              current_setting('vibecode.datadog_password') || '''';
    END IF;
    
    -- Grant monitoring permissions
    GRANT SELECT ON pg_stat_database TO datadog;
    GRANT SELECT ON pg_stat_activity TO datadog;
    GRANT SELECT ON pg_stat_statements TO datadog;
    GRANT SELECT ON pg_stat_user_tables TO datadog;
    GRANT SELECT ON pg_stat_user_indexes TO datadog;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if setting is not available
  NULL;
END $$;

-- Performance optimization settings for vector operations
-- These are recommendations - adjust based on your hardware

-- Memory settings for vector operations
-- work_mem: Memory for sorting and hash operations (recommended: 256MB+)
-- maintenance_work_mem: Memory for maintenance operations like index creation (recommended: 512MB+)
-- shared_buffers: Shared memory buffer pool (recommended: 25% of RAM)
-- effective_cache_size: Estimate of disk cache available (recommended: 75% of RAM)

-- Connection settings
-- max_connections: Maximum number of concurrent connections (adjust based on workload)
-- Note: Lower connection counts often perform better with connection pooling

-- Write-Ahead Logging (WAL) settings for better performance
-- max_wal_size: Maximum WAL size before triggering checkpoints
-- checkpoint_completion_target: Spread checkpoints over time

-- Enable query performance tracking
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- Log slow queries (queries taking more than 1 second)
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_duration = off;

-- Connection and memory settings (conservative defaults)
-- These should be tuned based on your specific hardware and workload
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';

-- WAL settings for better write performance
ALTER SYSTEM SET max_wal_size = '2GB';
ALTER SYSTEM SET min_wal_size = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Background writer settings
ALTER SYSTEM SET bgwriter_delay = 200;
ALTER SYSTEM SET bgwriter_lru_maxpages = 100;
ALTER SYSTEM SET bgwriter_lru_multiplier = 2.0;

-- Autovacuum settings (important for tables with frequent updates)
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 3;
ALTER SYSTEM SET autovacuum_naptime = 60;

-- Statistics settings
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'all';

-- Apply the configuration changes
-- Note: This will only take effect after a PostgreSQL restart or SIGHUP
SELECT pg_reload_conf();

-- Create optimized indexes for vector operations if not already present
-- This will be handled by Prisma migrations, but included here for reference

-- Example vector indexes (uncomment if needed manually):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS rag_chunks_embedding_hnsw_idx 
-- ON rag_chunks USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Alternative IVFFlat index (good for larger datasets):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS rag_chunks_embedding_ivfflat_idx 
-- ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 1000);

-- Create a view for monitoring vector operations
CREATE OR REPLACE VIEW vector_operations_stats AS
SELECT 
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation,
  most_common_vals,
  most_common_freqs,
  histogram_bounds
FROM pg_stats 
WHERE attname = 'embedding' AND tablename = 'rag_chunks';

-- Create a function to check vector index usage
CREATE OR REPLACE FUNCTION check_vector_index_usage()
RETURNS TABLE(
  index_name TEXT,
  table_name TEXT,
  index_scans BIGINT,
  tuples_read BIGINT,
  tuples_fetched BIGINT,
  index_size TEXT
)
LANGUAGE SQL
AS $$
  SELECT 
    indexrelname::TEXT as index_name,
    tablename::TEXT as table_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
  FROM pg_stat_user_indexes 
  WHERE tablename = 'rag_chunks' AND indexrelname LIKE '%embedding%';
$$;

-- Create a function to get vector database health metrics
CREATE OR REPLACE FUNCTION vector_database_health()
RETURNS TABLE(
  metric_name TEXT,
  metric_value TEXT,
  status TEXT
)
LANGUAGE SQL
AS $$
  WITH health_metrics AS (
    SELECT 'total_rag_chunks' as name, COUNT(*)::TEXT as value FROM rag_chunks
    UNION ALL
    SELECT 'vector_indexes', COUNT(*)::TEXT FROM pg_indexes WHERE tablename = 'rag_chunks' AND indexdef ILIKE '%embedding%'
    UNION ALL
    SELECT 'vector_extension_version', extversion FROM pg_extension WHERE extname = 'vector'
    UNION ALL
    SELECT 'database_size', pg_size_pretty(pg_database_size(current_database()))
    UNION ALL
    SELECT 'rag_table_size', pg_size_pretty(pg_total_relation_size('rag_chunks'))
  )
  SELECT 
    name::TEXT,
    value::TEXT,
    CASE 
      WHEN name = 'total_rag_chunks' AND value::INTEGER > 0 THEN 'healthy'
      WHEN name = 'vector_indexes' AND value::INTEGER > 0 THEN 'healthy'
      WHEN name = 'vector_extension_version' AND value IS NOT NULL THEN 'healthy'
      WHEN name IN ('database_size', 'rag_table_size') THEN 'info'
      ELSE 'warning'
    END::TEXT as status
  FROM health_metrics;
$$;

-- Grant usage on the health function to application users
GRANT EXECUTE ON FUNCTION vector_database_health() TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_vector_index_usage() TO PUBLIC;
GRANT SELECT ON vector_operations_stats TO PUBLIC;

-- Display setup completion message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VibeCode Production Database Setup Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Extensions installed:';
  RAISE NOTICE '  - uuid-ossp: %', (SELECT extversion FROM pg_extension WHERE extname = 'uuid-ossp');
  RAISE NOTICE '  - vector: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
  RAISE NOTICE '  - pg_stat_statements: %', (SELECT extversion FROM pg_extension WHERE extname = 'pg_stat_statements');
  RAISE NOTICE '';
  RAISE NOTICE 'Configuration applied:';
  RAISE NOTICE '  - Performance optimizations for vector operations';
  RAISE NOTICE '  - Query performance tracking enabled';
  RAISE NOTICE '  - Monitoring functions created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Restart PostgreSQL to apply all settings';
  RAISE NOTICE '  2. Run database migrations';
  RAISE NOTICE '  3. Monitor performance and adjust settings as needed';
  RAISE NOTICE '  4. Set up regular backups';
  RAISE NOTICE '';
  RAISE NOTICE 'Health check: SELECT * FROM vector_database_health();';
  RAISE NOTICE '========================================';
END $$;