-- =====================================================
-- LONG RUNNING QUERY RECOMMENDATIONS
-- =====================================================
-- These queries have durations exceeding 30 seconds.
-- Datadog will recommend optimizing these queries by adding indexes,
-- rewriting the query, or breaking it into smaller parts.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- SCENARIO 1: Complex aggregation without proper indexing
-- =====================================================
-- This query performs complex aggregations across multiple tables
-- Recommendation: Add indexes on join columns and WHERE conditions

INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'complex_aggregation',
    COUNT(DISTINCT rc.id),
    'count',
    NOW() - INTERVAL '1 hour'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
LEFT JOIN rag_chunks rc ON f.id = rc.file_id
LEFT JOIN uploads up ON u.id = up.user_id
WHERE u.created_at > '2023-01-01'
    AND p.status = 'active'
    AND f.size > 1000
    AND rc.token_count > 100
GROUP BY u.id, u.name, u.email, u.role, u.avatar, u.github_id, u.google_id, u.created_at, u.updated_at;

-- =====================================================
-- SCENARIO 2: Cross join creating massive computation
-- =====================================================
-- This query creates a cartesian product and performs calculations
-- Recommendation: Use proper JOIN conditions or break into smaller queries

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'cross_join_calculation',
    'calculation_' || p.id,
    NOW() - INTERVAL '2 hours'
FROM users u
CROSS JOIN projects p
CROSS JOIN generate_series(1, 100) s
WHERE u.created_at > '2024-01-01'
    AND p.status = 'active';
-- This creates users × projects × 100 rows

-- =====================================================
-- SCENARIO 3: Window function over large dataset
-- =====================================================
-- This window function processes all rows without partitioning
-- Recommendation: Add partitioning or filtering

INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'window_function_' || u.id,
    ROW_NUMBER() OVER (ORDER BY u.created_at, u.id),
    'rank',
    NOW() - INTERVAL '3 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
ORDER BY u.created_at, u.id;
-- Processes all users × projects × files

-- =====================================================
-- SCENARIO 4: Recursive CTE with deep recursion
-- =====================================================
-- This recursive CTE could run for a long time
-- Recommendation: Add depth limits or optimize termination conditions

WITH RECURSIVE user_chain AS (
    -- Base case
    SELECT id, name, 1 as depth, ARRAY[id] as path
    FROM users
    WHERE id = 1
    
    UNION ALL
    
    -- Recursive case
    SELECT u.id, u.name, uc.depth + 1, uc.path || u.id
    FROM users u
    JOIN user_chain uc ON u.id = uc.id + 1
    WHERE uc.depth < 1000  -- Deep recursion
        AND NOT (u.id = ANY(uc.path))  -- Avoid cycles
)
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    id,
    'recursive_cte',
    'depth_' || depth,
    NOW() - INTERVAL '4 hours'
FROM user_chain;

-- =====================================================
-- SCENARIO 5: Complex subquery with multiple levels
-- =====================================================
-- This query has nested subqueries that could be slow
-- Recommendation: Rewrite as JOINs or use EXISTS

INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'complex_subquery',
    'Analysis for ' || u.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '5 hours'
FROM users u
WHERE u.id IN (
    SELECT DISTINCT p.user_id 
    FROM projects p 
    WHERE p.id IN (
        SELECT f.project_id 
        FROM files f 
        WHERE f.id IN (
            SELECT rc.file_id 
            FROM rag_chunks rc 
            WHERE rc.token_count > (
                SELECT AVG(token_count) 
                FROM rag_chunks 
                WHERE token_count IS NOT NULL
            )
        )
    )
);

-- =====================================================
-- SCENARIO 6: Large IN clause with subquery
-- =====================================================
-- This query uses a large IN clause with complex subquery
-- Recommendation: Use JOIN instead of IN clause

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'large_in_subquery',
    'in_test_' || u.id,
    NOW() - INTERVAL '6 hours'
FROM users u
WHERE u.id IN (
    SELECT DISTINCT p.user_id 
    FROM projects p 
    WHERE p.created_at > '2024-01-01'
    AND p.id IN (
        SELECT f.project_id 
        FROM files f 
        WHERE f.size > 1000
        AND f.language IN ('typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c++', 'c#')
    )
);

-- =====================================================
-- SCENARIO 7: String operations on large dataset
-- =====================================================
-- This query performs string operations on many rows
-- Recommendation: Add indexes on computed columns or use different approach

INSERT INTO projects (name, description, user_id, language, framework, created_at)
SELECT 
    'String Op Project ' || SUBSTRING(u.name, 1, 20) || ' ' || EXTRACT(YEAR FROM u.created_at),
    'Project with complex string operations for ' || u.name,
    u.id,
    CASE 
        WHEN LENGTH(u.name) > 10 THEN 'typescript'
        WHEN LENGTH(u.name) > 5 THEN 'javascript'
        ELSE 'python'
    END,
    CASE 
        WHEN u.role = 'admin' THEN 'react'
        WHEN u.role = 'user' THEN 'vue'
        ELSE 'angular'
    END,
    NOW() - INTERVAL '7 hours'
FROM users u
WHERE u.created_at > '2023-01-01'
    AND LENGTH(u.name) > 3
    AND UPPER(u.name) LIKE '%A%';

-- =====================================================
-- SCENARIO 8: Mathematical calculations on large dataset
-- =====================================================
-- This query performs mathematical calculations on many rows
-- Recommendation: Pre-calculate values or use materialized views

INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'math_calculation_' || u.id,
    SQRT(POWER(EXTRACT(EPOCH FROM (NOW() - u.created_at)), 2) + 
         POWER(LENGTH(u.name), 2) + 
         POWER(COALESCE(u.id, 0), 2)),
    'calculated_value',
    NOW() - INTERVAL '8 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
WHERE u.created_at > '2023-01-01'
    AND p.status = 'active'
    AND f.size > 100;

-- =====================================================
-- SCENARIO 9: Multiple UNION operations
-- =====================================================
-- This query uses multiple UNION operations
-- Recommendation: Combine into single query or add LIMIT clauses

INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'union_operation_1',
    'first_union_' || u.id,
    NOW() - INTERVAL '9 hours'
FROM users u
WHERE u.role = 'user'
UNION ALL
SELECT 
    u.id,
    'union_operation_2',
    'second_union_' || u.id,
    NOW() - INTERVAL '9 hours'
FROM users u
WHERE u.role = 'admin'
UNION ALL
SELECT 
    u.id,
    'union_operation_3',
    'third_union_' || u.id,
    NOW() - INTERVAL '9 hours'
FROM users u
WHERE u.created_at > '2024-01-01'
UNION ALL
SELECT 
    u.id,
    'union_operation_4',
    'fourth_union_' || u.id,
    NOW() - INTERVAL '9 hours'
FROM users u
WHERE u.created_at < '2024-01-01';

-- =====================================================
-- SCENARIO 10: Complex CASE statements with subqueries
-- =====================================================
-- This query uses complex CASE statements with subqueries
-- Recommendation: Pre-calculate values or use JOINs

INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    CASE 
        WHEN (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) > 10 THEN 'heavy_user'
        WHEN (SELECT COUNT(*) FROM files f JOIN projects p ON f.project_id = p.id WHERE p.user_id = u.id) > 100 THEN 'file_heavy_user'
        WHEN (SELECT COUNT(*) FROM rag_chunks rc WHERE rc.user_id = u.id) > 1000 THEN 'chunk_heavy_user'
        ELSE 'regular_user'
    END,
    'Complex case analysis for ' || u.name,
    CASE 
        WHEN u.role = 'admin' THEN 'anthropic/claude-3.5-sonnet'
        WHEN u.created_at > '2024-01-01' THEN 'anthropic/claude-3-haiku'
        ELSE 'anthropic/claude-3-opus'
    END,
    'openrouter',
    'completed',
    NOW() - INTERVAL '10 hours'
FROM users u
WHERE u.created_at > '2023-01-01';

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for long-running queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    total_time/calls as avg_time_per_call
FROM pg_stat_statements
WHERE mean_time > 30000  -- 30 seconds
ORDER BY mean_time DESC;

-- Check for queries with high total time
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE total_time > 300000  -- 5 minutes total
ORDER BY total_time DESC;

-- Check for queries with high CPU usage
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements
WHERE shared_blks_read > 1000
ORDER BY shared_blks_read DESC;

-- =====================================================
-- END OF LONG RUNNING QUERY SCENARIOS
-- =====================================================
