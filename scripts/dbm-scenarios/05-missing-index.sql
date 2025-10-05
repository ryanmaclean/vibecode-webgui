-- =====================================================
-- MISSING INDEX RECOMMENDATIONS
-- =====================================================
-- These queries perform expensive sequential scans.
-- Datadog will recommend creating indexes to expedite the queries.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- SCENARIO 1: Query on non-indexed column
-- =====================================================
-- First, let's remove some indexes to simulate missing indexes
-- DROP INDEX IF EXISTS idx_files_language;
-- DROP INDEX IF EXISTS idx_projects_status;

-- Query that will trigger missing index recommendation
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    f.user_id,
    'file_access',
    'file_language_' || f.language,
    NOW() - INTERVAL '1 hour'
FROM files f
WHERE f.language = 'typescript'  -- No index on language column
AND f.size > 1000;

-- =====================================================
-- SCENARIO 2: Complex WHERE clause without composite index
-- =====================================================
-- Query that needs a composite index
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    p.user_id,
    'project_analysis',
    'Analyze ' || p.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '2 hours'
FROM projects p
WHERE p.status = 'active'  -- No composite index on (status, language)
AND p.language = 'javascript'
AND p.created_at > '2024-01-01';

-- =====================================================
-- SCENARIO 3: JOIN condition without index
-- =====================================================
-- Query that joins on non-indexed columns
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'join_test',
    'join_without_index',
    NOW() - INTERVAL '3 hours'
FROM users u
JOIN projects p ON u.id = p.user_id  -- user_id might not be indexed
WHERE p.status = 'active'
AND u.created_at > '2024-01-01';

-- =====================================================
-- SCENARIO 4: ORDER BY without index
-- =====================================================
-- Query that orders by non-indexed column
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'ordered_query',
    COUNT(*),
    'count',
    NOW() - INTERVAL '4 hours'
FROM files f
WHERE f.size > 1000
ORDER BY f.created_at DESC;  -- No index on created_at

-- =====================================================
-- SCENARIO 5: Range query without index
-- =====================================================
-- Query that uses range conditions on non-indexed column
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'range_query',
    'range_test',
    NOW() - INTERVAL '5 hours'
FROM users u
WHERE u.created_at BETWEEN '2024-01-01' AND '2024-12-31'
AND u.role = 'user';

-- =====================================================
-- SCENARIO 6: IN clause without index
-- =====================================================
-- Query that uses IN clause on non-indexed column
INSERT INTO projects (name, description, user_id, language, framework, created_at)
SELECT 
    'IN Query Project',
    'Project created via IN query',
    u.id,
    'typescript',
    'react',
    NOW() - INTERVAL '6 hours'
FROM users u
WHERE u.role IN ('user', 'admin', 'moderator')
AND u.created_at > '2024-01-01';

-- =====================================================
-- SCENARIO 7: LIKE query without index
-- =====================================================
-- Query that uses LIKE on non-indexed column
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'like_query',
    'like_test',
    NOW() - INTERVAL '7 hours'
FROM users u
WHERE u.name LIKE '%test%'
OR u.email LIKE '%@example.com';

-- =====================================================
-- SCENARIO 8: Subquery without index
-- =====================================================
-- Query with subquery that needs indexing
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'subquery_test',
    'Subquery analysis',
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '8 hours'
FROM users u
WHERE u.id IN (
    SELECT DISTINCT p.user_id 
    FROM projects p 
    WHERE p.status = 'active'
    AND p.created_at > '2024-01-01'
);

-- =====================================================
-- SCENARIO 9: GROUP BY without index
-- =====================================================
-- Query that groups by non-indexed column
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'group_by_' || f.language,
    COUNT(*),
    'count',
    NOW() - INTERVAL '9 hours'
FROM files f
WHERE f.size > 1000
GROUP BY f.language  -- No index on language
ORDER BY COUNT(*) DESC;

-- =====================================================
-- SCENARIO 10: Complex WHERE clause with multiple conditions
-- =====================================================
-- Query with multiple WHERE conditions that need composite index
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'complex_where',
    'complex_condition_test',
    NOW() - INTERVAL '10 hours'
FROM users u
WHERE u.role = 'user'
AND u.created_at > '2024-01-01'
AND u.created_at < '2024-12-31'
AND u.name IS NOT NULL
AND u.email IS NOT NULL;

-- =====================================================
-- SCENARIO 11: EXISTS subquery without index
-- =====================================================
-- Query using EXISTS that needs indexing
INSERT INTO projects (name, description, user_id, language, framework, created_at)
SELECT 
    'EXISTS Project',
    'Project created via EXISTS query',
    u.id,
    'python',
    'fastapi',
    NOW() - INTERVAL '11 hours'
FROM users u
WHERE EXISTS (
    SELECT 1 
    FROM files f 
    WHERE f.user_id = u.id 
    AND f.size > 1000
);

-- =====================================================
-- SCENARIO 12: Window function without index
-- =====================================================
-- Query using window function that needs indexing
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'window_function_' || u.id,
    ROW_NUMBER() OVER (ORDER BY u.created_at),
    'rank',
    NOW() - INTERVAL '12 hours'
FROM users u
WHERE u.role = 'user'
ORDER BY u.created_at;

-- =====================================================
-- SCENARIO 13: DISTINCT without index
-- =====================================================
-- Query using DISTINCT on non-indexed column
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'distinct_query',
    'distinct_test',
    NOW() - INTERVAL '13 hours'
FROM users u
WHERE u.id IN (
    SELECT DISTINCT p.user_id 
    FROM projects p 
    WHERE p.language = 'typescript'
);

-- =====================================================
-- SCENARIO 14: CASE statement without index
-- =====================================================
-- Query using CASE statement that needs indexing
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    CASE 
        WHEN u.role = 'admin' THEN 'admin_task'
        WHEN u.role = 'user' THEN 'user_task'
        ELSE 'other_task'
    END,
    'CASE statement analysis',
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '14 hours'
FROM users u
WHERE u.created_at > '2024-01-01';

-- =====================================================
-- SCENARIO 15: Multiple table join without proper indexes
-- =====================================================
-- Query joining multiple tables without proper indexes
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'multi_join',
    'multi_join_test',
    NOW() - INTERVAL '15 hours'
FROM users u
JOIN projects p ON u.id = p.user_id
JOIN files f ON p.id = f.project_id
WHERE p.status = 'active'
AND f.language = 'typescript'
AND f.size > 1000;

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for sequential scans
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;

-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE 
        WHEN seq_scan > 0 THEN seq_tup_read::FLOAT / seq_scan
        ELSE 0
    END as avg_tuples_per_seq_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY avg_tuples_per_seq_scan DESC;

-- Check for slow queries that might need indexes
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements
WHERE shared_blks_read > 100
ORDER BY shared_blks_read DESC;

-- =====================================================
-- END OF MISSING INDEX SCENARIOS
-- =====================================================
