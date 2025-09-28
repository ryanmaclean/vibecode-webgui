-- =====================================================
-- HIGH ROW COUNT RECOMMENDATIONS
-- =====================================================
-- These queries return large numbers of rows in result sets.
-- Datadog will recommend adding LIMIT clauses, pagination,
-- or filtering to reduce the result set size.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- SCENARIO 1: Query without LIMIT clause
-- =====================================================
-- This query returns all users without any limit
-- Recommendation: Add LIMIT clause or implement pagination

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'bulk_operation',
    'mass_user_export',
    NOW() - INTERVAL '1 hour'
FROM users u;
-- Missing LIMIT clause - returns ALL users

-- =====================================================
-- SCENARIO 2: Cross join creating massive result set
-- =====================================================
-- This creates a cartesian product between users and projects
-- Recommendation: Use proper JOIN conditions

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'cross_join_test',
    'performance_test_' || p.id,
    NOW() - INTERVAL '2 hours'
FROM users u
CROSS JOIN projects p
WHERE u.created_at > '2024-01-01';
-- This multiplies users × projects = potentially millions of rows

-- =====================================================
-- SCENARIO 3: Large aggregation without grouping
-- =====================================================
-- This query returns a large number of grouped results
-- Recommendation: Add LIMIT or filter the grouping

INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'user_project_count_' || u.id,
    COUNT(p.id),
    'count',
    NOW() - INTERVAL '3 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
GROUP BY u.id, u.name, u.email, u.role, u.avatar, u.github_id, u.google_id, u.created_at, u.updated_at;
-- Returns one row per user - could be thousands of rows

-- =====================================================
-- SCENARIO 4: Complex join returning many rows
-- =====================================================
-- This query joins multiple tables and returns many rows
-- Recommendation: Add WHERE conditions or LIMIT

INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'code_generation',
    'Generate ' || p.language || ' code for ' || p.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '4 hours'
FROM users u
CROSS JOIN projects p
LEFT JOIN files f ON p.id = f.project_id
WHERE u.created_at > '2024-01-01';
-- Could return users × projects × files rows

-- =====================================================
-- SCENARIO 5: Subquery returning large result set
-- =====================================================
-- This subquery returns many rows
-- Recommendation: Limit the subquery or use EXISTS instead

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'subquery_test',
    'large_subquery_result',
    NOW() - INTERVAL '5 hours'
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
-- Subquery could return thousands of user IDs

-- =====================================================
-- SCENARIO 6: Window function without partition limit
-- =====================================================
-- This window function processes all rows
-- Recommendation: Add partitioning or filtering

INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'user_rank_' || u.id,
    ROW_NUMBER() OVER (ORDER BY u.created_at),
    'rank',
    NOW() - INTERVAL '6 hours'
FROM users u
ORDER BY u.created_at;
-- Returns one row per user with rank

-- =====================================================
-- SCENARIO 7: UNION ALL creating large result set
-- =====================================================
-- This UNION ALL combines multiple large result sets
-- Recommendation: Add LIMIT to each part of the UNION

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'union_test_1',
    'first_part_' || u.id,
    NOW() - INTERVAL '7 hours'
FROM users u
WHERE u.role = 'user'
UNION ALL
SELECT 
    u.id,
    'union_test_2',
    'second_part_' || u.id,
    NOW() - INTERVAL '7 hours'
FROM users u
WHERE u.role = 'admin'
UNION ALL
SELECT 
    u.id,
    'union_test_3',
    'third_part_' || u.id,
    NOW() - INTERVAL '7 hours'
FROM users u
WHERE u.created_at > '2024-01-01';
-- Combines all users multiple times

-- =====================================================
-- SCENARIO 8: Recursive CTE without depth limit
-- =====================================================
-- This recursive CTE could generate many rows
-- Recommendation: Add depth limit or termination condition

WITH RECURSIVE user_hierarchy AS (
    -- Base case
    SELECT id, name, 1 as level
    FROM users
    WHERE id = 1
    
    UNION ALL
    
    -- Recursive case
    SELECT u.id, u.name, uh.level + 1
    FROM users u
    JOIN user_hierarchy uh ON u.id = uh.id + 1
    WHERE uh.level < 1000  -- This could still be too many
)
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    id,
    'recursive_cte',
    'level_' || level,
    NOW() - INTERVAL '8 hours'
FROM user_hierarchy;

-- =====================================================
-- SCENARIO 9: Large IN clause
-- =====================================================
-- This query uses a large IN clause
-- Recommendation: Use JOIN instead or limit the IN values

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'large_in_clause',
    'in_test_' || u.id,
    NOW() - INTERVAL '9 hours'
FROM users u
WHERE u.id IN (
    SELECT generate_series(1, 10000)  -- Large IN clause
);

-- =====================================================
-- SCENARIO 10: Multiple table joins without filtering
-- =====================================================
-- This query joins many tables without proper filtering
-- Recommendation: Add WHERE conditions or LIMIT

INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'complex_join',
    'Complex join analysis for ' || u.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '10 hours'
FROM users u
JOIN projects p ON u.id = p.user_id
JOIN files f ON p.id = f.project_id
JOIN rag_chunks rc ON f.id = rc.file_id
JOIN uploads up ON u.id = up.user_id
JOIN sessions s ON u.id = s.user_id;
-- Joins 6 tables without filtering - could return millions of rows

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for queries that return many rows
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    rows/calls as avg_rows_per_call
FROM pg_stat_statements
WHERE rows > 1000
ORDER BY rows DESC;

-- Check for queries with high row counts
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    rows/calls as avg_rows_per_call
FROM pg_stat_statements
WHERE rows/calls > 100
ORDER BY avg_rows_per_call DESC;

-- Check for queries without LIMIT clauses
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query ILIKE '%SELECT%'
    AND query NOT ILIKE '%LIMIT%'
    AND rows > 100
ORDER BY rows DESC;

-- =====================================================
-- END OF HIGH ROW COUNT SCENARIOS
-- =====================================================
