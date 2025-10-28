-- =====================================================
-- Datadog Database Monitoring Recommendations Generator
-- =====================================================
-- This script creates fictional database scenarios that will trigger
-- various Datadog DBM recommendations for testing and demonstration purposes.
-- 
-- Based on: https://docs.datadoghq.com/database_monitoring/recommendations/
-- 
-- WARNING: This script modifies production data. Use with caution!
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- 1. FUNCTION IN FILTER RECOMMENDATIONS
-- =====================================================
-- These queries call functions on columns being filtered, leading to 
-- expensive sequential scans that can't take advantage of indexes.

-- Scenario 1: Using LOWER() function in WHERE clause
-- This prevents index usage on email column
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'chat',
    'Generate code for ' || u.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '1 hour'
FROM users u
WHERE LOWER(u.email) LIKE '%@example.com'
LIMIT 100;

-- Scenario 2: Using DATE() function on timestamp
-- This prevents index usage on created_at column
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'page_view',
    'dashboard_view',
    NOW() - INTERVAL '2 hours'
FROM users u
WHERE DATE(u.created_at) = CURRENT_DATE
LIMIT 50;

-- Scenario 3: Using SUBSTRING() function in WHERE clause
-- This prevents index usage on name column
INSERT INTO projects (name, description, user_id, language, framework, created_at)
SELECT 
    'Project-' || SUBSTRING(u.name, 1, 10),
    'Auto-generated project',
    u.id,
    'typescript',
    'react',
    NOW() - INTERVAL '3 hours'
FROM users u
WHERE SUBSTRING(u.name, 1, 3) = 'Tes'
LIMIT 75;

-- =====================================================
-- 2. HIGH IMPACT BLOCKER RECOMMENDATIONS
-- =====================================================
-- These queries cause significant waiting time for blocked queries.

-- Scenario 1: Long-running transaction that locks critical tables
BEGIN;
-- Lock users table for extended period
UPDATE users SET updated_at = NOW() WHERE id = 1;
-- Simulate long-running operation
SELECT pg_sleep(60); -- This will block other queries for 60 seconds
COMMIT;

-- Scenario 2: Create blocking scenario with multiple transactions
-- Transaction 1: Lock a row
BEGIN;
UPDATE users SET name = 'Blocked User' WHERE id = 2;
-- Hold the lock

-- Transaction 2: Try to access the same row (will be blocked)
-- This should be run in a separate session
-- BEGIN;
-- UPDATE users SET name = 'Waiting User' WHERE id = 2;
-- This will wait until Transaction 1 commits

-- =====================================================
-- 3. HIGH ROW COUNT RECOMMENDATIONS
-- =====================================================
-- These queries return large numbers of rows in result sets.

-- Scenario 1: Query that returns all users without LIMIT
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'bulk_operation',
    'mass_user_export',
    NOW() - INTERVAL '4 hours'
FROM users u
CROSS JOIN generate_series(1, 10); -- This multiplies results by 10

-- Scenario 2: Large result set from complex join
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'code_generation',
    'Generate ' || p.language || ' code for ' || p.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '5 hours'
FROM users u
CROSS JOIN projects p
WHERE u.created_at > '2024-01-01'
LIMIT 1000;

-- =====================================================
-- 4. LONG RUNNING QUERY RECOMMENDATIONS
-- =====================================================
-- These queries have durations exceeding 30 seconds.

-- Scenario 1: Complex aggregation without proper indexing
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'user_project_count',
    COUNT(p.id),
    'count',
    NOW() - INTERVAL '6 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
LEFT JOIN rag_chunks rc ON f.id = rc.file_id
WHERE u.created_at > '2023-01-01'
GROUP BY u.id, u.name, u.email, u.role, u.avatar, u.github_id, u.google_id, u.created_at, u.updated_at;

-- Scenario 2: Cross join creating massive result set
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'cross_join_test',
    'performance_test_' || s.series,
    NOW() - INTERVAL '7 hours'
FROM users u
CROSS JOIN generate_series(1, 100) s
WHERE u.id % 2 = 0;

-- =====================================================
-- 5. MISSING INDEX RECOMMENDATIONS
-- =====================================================
-- These queries perform expensive sequential scans.

-- Scenario 1: Query on non-indexed column
-- First, let's remove some indexes to simulate missing indexes
-- DROP INDEX IF EXISTS idx_files_language;
-- DROP INDEX IF EXISTS idx_projects_status;

-- Query that will trigger missing index recommendation
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    f.user_id,
    'file_access',
    'file_language_' || f.language,
    NOW() - INTERVAL '8 hours'
FROM files f
WHERE f.language = 'typescript'  -- No index on language column
AND f.size > 1000;

-- Scenario 2: Complex WHERE clause without composite index
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    p.user_id,
    'project_analysis',
    'Analyze ' || p.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '9 hours'
FROM projects p
WHERE p.status = 'active'  -- No composite index on (status, language)
AND p.language = 'javascript'
AND p.created_at > '2024-01-01';

-- =====================================================
-- 6. QUERY LOAD INCREASE RECOMMENDATIONS
-- =====================================================
-- These queries have seen significant increases in total duration.

-- Scenario 1: Simulate increased query frequency
-- Run this query multiple times to simulate load increase
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..50 LOOP
        INSERT INTO events (user_id, event_type, event_name, created_at)
        SELECT 
            u.id,
            'load_test',
            'iteration_' || i,
            NOW() - INTERVAL (i || ' minutes')
        FROM users u
        WHERE u.id % 3 = 0;
        
        -- Add some delay to simulate processing
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;

-- Scenario 2: Simulate degraded performance over time
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at, duration_ms)
SELECT 
    u.id,
    'performance_test',
    'Test query performance degradation',
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '10 hours',
    35000 + (random() * 20000)::INTEGER  -- Simulate increasing duration
FROM users u
WHERE u.created_at > '2024-01-01'
LIMIT 200;

-- =====================================================
-- 7. UNUSED INDEX RECOMMENDATIONS
-- =====================================================
-- These indexes have not been used recently.

-- Scenario 1: Create indexes that won't be used
CREATE INDEX IF NOT EXISTS idx_unused_email_domain ON users (SUBSTRING(email FROM '@(.*)$'));
CREATE INDEX IF NOT EXISTS idx_unused_name_length ON users (LENGTH(name));
CREATE INDEX IF NOT EXISTS idx_unused_created_month ON users (EXTRACT(MONTH FROM created_at));

-- Scenario 2: Create composite index that won't be used
CREATE INDEX IF NOT EXISTS idx_unused_user_project_status ON projects (user_id, status, language, framework);

-- =====================================================
-- 8. LOW DISK SPACE RECOMMENDATIONS
-- =====================================================
-- Note: This is only available on Amazon RDS and requires actual disk space issues.
-- We'll simulate by creating large temporary data.

-- Scenario 1: Create large temporary tables to simulate disk pressure
CREATE TEMP TABLE temp_large_data AS
SELECT 
    generate_series(1, 1000000) as id,
    'Large data row ' || generate_series(1, 1000000) as data,
    NOW() as created_at;

-- Scenario 2: Insert large amounts of data
INSERT INTO rag_chunks (content, user_id, workspace_id, project_id, chunk_index, token_count, created_at)
SELECT 
    'Large chunk content ' || generate_series(1, 1000),
    (random() * 10 + 1)::INTEGER,
    (random() * 5 + 1)::INTEGER,
    (random() * 20 + 1)::INTEGER,
    generate_series(1, 1000),
    (random() * 1000 + 100)::INTEGER,
    NOW() - INTERVAL '11 hours'
FROM generate_series(1, 1000);

-- =====================================================
-- 9. ADDITIONAL PERFORMANCE ISSUES
-- =====================================================

-- Scenario 1: N+1 Query Problem Simulation
-- This creates multiple individual queries instead of batch operations
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM users LIMIT 20 LOOP
        INSERT INTO events (user_id, event_type, event_name, created_at)
        VALUES (user_record.id, 'individual_query', 'n_plus_one_test', NOW() - INTERVAL '12 hours');
    END LOOP;
END $$;

-- Scenario 2: Inefficient subquery
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'inefficient_subquery',
    COUNT(*),
    'count',
    NOW() - INTERVAL '13 hours'
FROM users u
WHERE u.id IN (
    SELECT DISTINCT p.user_id 
    FROM projects p 
    WHERE p.created_at > '2024-01-01'
    AND p.id IN (
        SELECT f.project_id 
        FROM files f 
        WHERE f.size > 1000
    )
);

-- Scenario 3: Cartesian product (accidental cross join)
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'cartesian_product',
    'accidental_cross_join',
    NOW() - INTERVAL '14 hours'
FROM users u, projects p  -- Missing JOIN condition
WHERE u.created_at > '2024-01-01'
LIMIT 500;

-- =====================================================
-- 10. CLEANUP AND MONITORING QUERIES
-- =====================================================

-- Query to check current database size
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query to check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- Query to check table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- =====================================================
-- END OF DBM RECOMMENDATIONS GENERATOR
-- =====================================================
-- 
-- This script creates various scenarios that should trigger Datadog DBM recommendations:
-- 1. Function in Filter - Queries using functions in WHERE clauses
-- 2. High Impact Blocker - Long-running transactions causing blocks
-- 3. High Row Count - Queries returning large result sets
-- 4. Long Running Query - Queries taking >30 seconds
-- 5. Missing Index - Sequential scans on unindexed columns
-- 6. Query Load Increase - Increased frequency/degraded performance
-- 7. Unused Index - Indexes that aren't being used
-- 8. Low Disk Space - Large data operations (RDS only)
-- 
-- Monitor your Datadog DBM dashboard after running this script to see
-- the recommendations appear.
-- =====================================================
