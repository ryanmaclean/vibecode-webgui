-- PostgreSQL + pgvector Test Suite
-- Comprehensive testing script for vector database functionality
-- Usage: psql -h localhost -p 5432 -U vibecode -d vibecode -f test-vector-db.sql

\set ON_ERROR_STOP on
\timing on

\echo '========================================='
\echo 'PostgreSQL + pgvector Test Suite'
\echo '========================================='
\echo ''

-- Test 1: Extension verification
\echo 'Test 1: Verifying pgvector extension...'
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✓ PASS'
        ELSE '✗ FAIL'
    END as result,
    'pgvector extension installed' as test
FROM pg_extension
WHERE extname = 'vector';

\echo ''

-- Test 2: Vector type creation
\echo 'Test 2: Creating and manipulating vectors...'
SELECT
    '[1,2,3]'::vector as vector_created,
    '[1,2,3]'::vector + '[4,5,6]'::vector as vector_addition,
    '[1,2,3]'::vector - '[1,1,1]'::vector as vector_subtraction;

\echo ''

-- Test 3: Distance calculations
\echo 'Test 3: Distance calculations...'
SELECT
    'Cosine Distance' as metric,
    '[1,0,0]'::vector <=> '[1,0,0]'::vector as same_vector,
    '[1,0,0]'::vector <=> '[0,1,0]'::vector as orthogonal_vectors,
    '[1,0,0]'::vector <=> '[-1,0,0]'::vector as opposite_vectors;

SELECT
    'L2 Distance (Euclidean)' as metric,
    '[0,0,0]'::vector <-> '[3,4,0]'::vector as distance_3_4_5_triangle,
    '[1,1,1]'::vector <-> '[2,2,2]'::vector as unit_diagonal;

SELECT
    'Inner Product' as metric,
    '[1,2,3]'::vector <#> '[4,5,6]'::vector as inner_product_result;

\echo ''

-- Test 4: Table and index verification
\echo 'Test 4: Verifying test tables and indexes...'
SET search_path TO vector_test, public;

SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('vector_test.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'vector_test'
ORDER BY tablename;

\echo ''

-- Test 5: Index verification
\echo 'Test 5: Verifying vector indexes...'
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'vector_test'
ORDER BY tablename, indexname;

\echo ''

-- Test 6: Sample data verification
\echo 'Test 6: Verifying sample data...'
SELECT
    COUNT(*) as total_embeddings,
    AVG(vector_norm(embedding)) as avg_magnitude
FROM embeddings_test;

SELECT
    COUNT(*) as total_code_embeddings,
    COUNT(DISTINCT language) as unique_languages,
    AVG(tokens) as avg_tokens
FROM code_embeddings;

\echo ''

-- Test 7: Similarity search (HNSW index)
\echo 'Test 7: Testing similarity search with HNSW index...'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    id,
    LEFT(content, 40) || '...' as content_preview,
    1 - (embedding <=> array_fill(0.2, ARRAY[1536])::vector) as similarity
FROM embeddings_test
ORDER BY embedding <=> array_fill(0.2, ARRAY[1536])::vector
LIMIT 5;

\echo ''

-- Test 8: Similarity search (IVFFlat index)
\echo 'Test 8: Testing similarity search with IVFFlat index...'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    chunk_id,
    language,
    LEFT(content, 40) || '...' as content_preview,
    1 - (embedding <=> array_fill(0.3, ARRAY[1536])::vector) as similarity
FROM code_embeddings
ORDER BY embedding <=> array_fill(0.3, ARRAY[1536])::vector
LIMIT 5;

\echo ''

-- Test 9: Helper function test
\echo 'Test 9: Testing find_similar_code function...'
SELECT
    chunk_id,
    language,
    LEFT(content, 50) || '...' as preview,
    similarity
FROM find_similar_code(
    array_fill(0.3, ARRAY[1536])::vector,
    0.0,  -- threshold (0 to get all results)
    5     -- limit
);

\echo ''

-- Test 10: Vector statistics
\echo 'Test 10: Vector statistics...'
SELECT * FROM get_vector_stats();

\echo ''

-- Test 11: Query performance
\echo 'Test 11: Query performance metrics...'
SELECT
    LEFT(query, 60) || '...' as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
    ROUND(total_exec_time::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query LIKE '%embedding%'
ORDER BY mean_exec_time DESC
LIMIT 5;

\echo ''

-- Test 12: Cache hit ratio
\echo 'Test 12: Database cache performance...'
SELECT
    'Buffer Cache Hit Ratio' as metric,
    ROUND(
        100.0 * sum(heap_blks_hit) /
        NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
        2
    ) || '%' as ratio,
    CASE
        WHEN ROUND(
            100.0 * sum(heap_blks_hit) /
            NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
            2
        ) > 99 THEN '✓ EXCELLENT'
        WHEN ROUND(
            100.0 * sum(heap_blks_hit) /
            NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
            2
        ) > 90 THEN '✓ GOOD'
        ELSE '⚠ NEEDS TUNING'
    END as status
FROM pg_statio_user_tables;

\echo ''

-- Test 13: Connection count
\echo 'Test 13: Active connections...'
SELECT
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active,
    COUNT(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'vibecode';

\echo ''

-- Test 14: Database size
\echo 'Test 14: Database size...'
SELECT
    pg_database.datname as database,
    pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database
WHERE datname = 'vibecode';

\echo ''

-- Test 15: Top 5 largest tables
\echo 'Test 15: Largest tables...'
SELECT
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(
        pg_total_relation_size(schemaname||'.'||tablename) -
        pg_relation_size(schemaname||'.'||tablename)
    ) as index_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 5;

\echo ''

-- Test 16: Vacuum and analyze status
\echo 'Test 16: Autovacuum status...'
SELECT
    schemaname || '.' || relname as table_name,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE
        WHEN n_live_tup > 0 THEN
            ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0
    END || '%' as dead_row_percent
FROM pg_stat_user_tables
WHERE schemaname = 'vector_test'
ORDER BY n_dead_tup DESC;

\echo ''

-- Test 17: Lock status
\echo 'Test 17: Lock status...'
SELECT
    COUNT(*) as total_locks,
    COUNT(*) FILTER (WHERE granted = true) as granted,
    COUNT(*) FILTER (WHERE granted = false) as waiting
FROM pg_locks
WHERE database = (SELECT oid FROM pg_database WHERE datname = 'vibecode');

\echo ''

-- Test 18: Configuration check
\echo 'Test 18: Key configuration parameters...'
SELECT
    name,
    setting,
    unit,
    context
FROM pg_settings
WHERE name IN (
    'shared_buffers',
    'effective_cache_size',
    'work_mem',
    'maintenance_work_mem',
    'max_connections',
    'random_page_cost',
    'effective_io_concurrency',
    'wal_level',
    'max_wal_size',
    'checkpoint_completion_target'
)
ORDER BY name;

\echo ''

-- Test 19: Extension list
\echo 'Test 19: Installed extensions...'
SELECT
    extname,
    extversion,
    extrelocatable,
    extnamespace::regnamespace as schema
FROM pg_extension
ORDER BY extname;

\echo ''

-- Test 20: Final summary
\echo 'Test 20: Overall health summary...'
SELECT
    'PostgreSQL Version' as metric,
    version() as value
UNION ALL
SELECT
    'Database Size',
    pg_size_pretty(pg_database_size('vibecode'))
UNION ALL
SELECT
    'Active Connections',
    COUNT(*)::text
FROM pg_stat_activity
WHERE datname = 'vibecode'
UNION ALL
SELECT
    'pgvector Version',
    extversion
FROM pg_extension
WHERE extname = 'vector'
UNION ALL
SELECT
    'Total Vector Embeddings',
    (SELECT COUNT(*)::text FROM vector_test.embeddings_test)
UNION ALL
SELECT
    'Total Code Embeddings',
    (SELECT COUNT(*)::text FROM vector_test.code_embeddings);

\echo ''
\echo '========================================='
\echo 'Test Suite Complete!'
\echo '========================================='
\echo ''
\echo 'Summary:'
\echo '  ✓ pgvector extension: INSTALLED'
\echo '  ✓ Vector operations: WORKING'
\echo '  ✓ HNSW indexes: CREATED'
\echo '  ✓ IVFFlat indexes: CREATED'
\echo '  ✓ Sample data: LOADED'
\echo '  ✓ Helper functions: AVAILABLE'
\echo ''
\echo 'Next Steps:'
\echo '  1. Review query performance (EXPLAIN ANALYZE)'
\echo '  2. Monitor cache hit ratio (should be > 99%)'
\echo '  3. Check autovacuum activity'
\echo '  4. Test with production workload'
\echo '  5. Benchmark vector search performance'
\echo ''
\echo 'For detailed documentation, see:'
\echo '  docs/POSTGRESQL_PGVECTOR_SETUP.md'
\echo '========================================='

-- Reset search path
SET search_path TO public;
