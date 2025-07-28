-- PostgreSQL Database Monitoring (DBM) Initialization
-- Creates datadog monitoring user and required functions for Datadog DBM

-- Create datadog user for monitoring if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
        CREATE USER datadog;
        RAISE NOTICE 'Created datadog monitoring user';
    ELSE
        RAISE NOTICE 'Datadog user already exists, skipping creation';
    END IF;
END
$$;

-- Set password for datadog user (from environment variable)
-- This will be handled by the container initialization
\set datadog_password `echo "$DATADOG_POSTGRES_PASSWORD"`
ALTER USER datadog WITH PASSWORD :'datadog_password';

-- Grant necessary permissions for database monitoring
GRANT pg_monitor TO datadog;
GRANT pg_read_all_stats TO datadog;
GRANT pg_read_all_settings TO datadog;

-- Create datadog schema for custom functions and views
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
GRANT CREATE ON SCHEMA datadog TO datadog;

-- Enable required extensions for monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_activity;

-- Verify extensions are loaded
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_stat_statements', 'pg_stat_activity');

-- Create explain plan function for query optimization
CREATE OR REPLACE FUNCTION datadog.explain_statement(
    l_query TEXT,
    OUT explain JSON
) RETURNS SETOF JSON AS $$
DECLARE
    curs REFCURSOR;
    plan JSON;
BEGIN
    OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
    FETCH curs INTO plan;
    CLOSE curs;
    RETURN QUERY SELECT plan;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to get explain plan for query: %', l_query;
        RETURN;
END;
$$ LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;

-- Grant execute permission on explain function
GRANT EXECUTE ON FUNCTION datadog.explain_statement TO datadog;

-- Create activity monitoring function for older PostgreSQL versions
CREATE OR REPLACE FUNCTION datadog.pg_stat_activity()
RETURNS SETOF pg_stat_activity AS $$
    SELECT * FROM pg_catalog.pg_stat_activity;
$$ LANGUAGE sql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.pg_stat_activity TO datadog;

-- Create statements monitoring function for older PostgreSQL versions  
CREATE OR REPLACE FUNCTION datadog.pg_stat_statements()
RETURNS SETOF pg_stat_statements AS $$
    SELECT * FROM public.pg_stat_statements;
$$ LANGUAGE sql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.pg_stat_statements TO datadog;

-- Create schema monitoring view for tracking migrations
CREATE OR REPLACE VIEW datadog.schema_migrations AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    atttypid::regtype as data_type,
    attnotnull as not_null,
    atthasdef as has_default,
    attnum as column_position,
    current_timestamp as captured_at
FROM pg_attribute 
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE attnum > 0 
AND NOT attisdropped
AND nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'datadog')
ORDER BY schemaname, tablename, attnum;

GRANT SELECT ON datadog.schema_migrations TO datadog;

-- Create table size monitoring view
CREATE OR REPLACE VIEW datadog.table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
    pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
    current_timestamp as captured_at
FROM pg_tables 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'datadog')
ORDER BY total_bytes DESC;

GRANT SELECT ON datadog.table_sizes TO datadog;

-- Create index usage monitoring view
CREATE OR REPLACE VIEW datadog.index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_relation_size(indexrelid) as index_bytes,
    current_timestamp as captured_at
FROM pg_stat_user_indexes
JOIN pg_stat_user_tables USING (schemaname, tablename)
ORDER BY index_scans DESC;

GRANT SELECT ON datadog.index_usage TO datadog;

-- Create database statistics view
CREATE OR REPLACE VIEW datadog.database_stats AS
SELECT 
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    CASE WHEN (blks_read + blks_hit) > 0 
         THEN ROUND((blks_hit * 100.0) / (blks_read + blks_hit), 2)
         ELSE 0 
    END as cache_hit_ratio,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted,
    current_timestamp as captured_at
FROM pg_stat_database
WHERE datname = current_database();

GRANT SELECT ON datadog.database_stats TO datadog;

-- Create slow query monitoring function
CREATE OR REPLACE FUNCTION datadog.get_slow_queries(
    min_duration_ms INTEGER DEFAULT 1000,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    query_hash TEXT,
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    max_time DOUBLE PRECISION,
    rows_returned BIGINT,
    rows_affected BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md5(pss.query) as query_hash,
        pss.query,
        pss.calls,
        pss.total_exec_time as total_time,
        pss.mean_exec_time as mean_time,
        pss.max_exec_time as max_time,
        pss.rows as rows_returned,
        pss.rows as rows_affected
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > min_duration_ms
    ORDER BY pss.mean_exec_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.get_slow_queries TO datadog;

-- Create connection monitoring view
CREATE OR REPLACE VIEW datadog.connection_stats AS
SELECT 
    state,
    COUNT(*) as connection_count,
    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    current_timestamp as captured_at
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
GROUP BY state;

GRANT SELECT ON datadog.connection_stats TO datadog;

-- Log successful initialization
SELECT 'Database monitoring initialization completed successfully' as status;

-- Display monitoring setup summary
SELECT 
    'Datadog user created' as component,
    CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'datadog') 
         THEN '✅ Success' 
         ELSE '❌ Failed' 
    END as status
UNION ALL
SELECT 
    'pg_stat_statements extension',
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') 
         THEN '✅ Enabled' 
         ELSE '❌ Missing' 
    END
UNION ALL
SELECT 
    'Datadog schema created',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'datadog') 
         THEN '✅ Created' 
         ELSE '❌ Missing' 
    END
UNION ALL
SELECT 
    'Explain function created',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'explain_statement' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'datadog')) 
         THEN '✅ Available' 
         ELSE '❌ Missing' 
    END;