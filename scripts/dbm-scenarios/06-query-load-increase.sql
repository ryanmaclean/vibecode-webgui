-- =====================================================
-- QUERY LOAD INCREASE RECOMMENDATIONS
-- =====================================================
-- These queries have seen significant increases in total duration.
-- Datadog will recommend investigating the cause of the performance
-- degradation and optimizing the queries.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- SCENARIO 1: Simulate increased query frequency
-- =====================================================
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

-- =====================================================
-- SCENARIO 2: Simulate degraded performance over time
-- =====================================================
-- Insert queries with increasing duration to simulate performance degradation
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at, duration_ms)
SELECT 
    u.id,
    'performance_test',
    'Test query performance degradation',
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '1 hour',
    35000 + (random() * 20000)::INTEGER  -- Simulate increasing duration
FROM users u
WHERE u.created_at > '2024-01-01'
LIMIT 200;

-- =====================================================
-- SCENARIO 3: Simulate increasing data volume affecting performance
-- =====================================================
-- Create queries that become slower as data volume increases
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'volume_test',
    'volume_increase_test',
    NOW() - INTERVAL '2 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
LEFT JOIN rag_chunks rc ON f.id = rc.file_id
WHERE u.created_at > '2023-01-01'
    AND p.status = 'active'
    AND f.size > 1000
    AND rc.token_count > 100;

-- =====================================================
-- SCENARIO 4: Simulate concurrent load increase
-- =====================================================
-- Create multiple concurrent operations to simulate load spike
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..30 LOOP
        -- Simulate concurrent user operations
        INSERT INTO events (user_id, event_type, event_name, created_at)
        SELECT 
            u.id,
            'concurrent_load',
            'concurrent_' || i,
            NOW() - INTERVAL '3 hours'
        FROM users u
        WHERE u.id % 2 = 0;
        
        -- Simulate concurrent project operations
        INSERT INTO projects (name, description, user_id, language, framework, created_at)
        SELECT 
            'Concurrent Project ' || i,
            'Project created during load spike',
            u.id,
            'typescript',
            'react',
            NOW() - INTERVAL '3 hours'
        FROM users u
        WHERE u.id % 3 = 0;
        
        -- Add delay to simulate processing
        PERFORM pg_sleep(0.05);
    END LOOP;
END $$;

-- =====================================================
-- SCENARIO 5: Simulate query complexity increase
-- =====================================================
-- Create queries that become more complex over time
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'complexity_test_' || u.id,
    COUNT(DISTINCT p.id) + COUNT(DISTINCT f.id) + COUNT(DISTINCT rc.id),
    'complex_count',
    NOW() - INTERVAL '4 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
LEFT JOIN rag_chunks rc ON f.id = rc.file_id
LEFT JOIN uploads up ON u.id = up.user_id
LEFT JOIN sessions s ON u.id = s.user_id
WHERE u.created_at > '2023-01-01'
GROUP BY u.id, u.name, u.email, u.role, u.avatar, u.github_id, u.google_id, u.created_at, u.updated_at;

-- =====================================================
-- SCENARIO 6: Simulate index bloat affecting performance
-- =====================================================
-- Create queries that become slower due to index bloat
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'index_bloat_test',
    'index_bloat_simulation',
    NOW() - INTERVAL '5 hours'
FROM users u
WHERE u.created_at > '2024-01-01'
    AND u.role = 'user'
    AND u.name IS NOT NULL
    AND u.email IS NOT NULL
ORDER BY u.created_at DESC;

-- =====================================================
-- SCENARIO 7: Simulate memory pressure affecting performance
-- =====================================================
-- Create queries that consume more memory over time
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at, duration_ms)
SELECT 
    u.id,
    'memory_pressure_test',
    'Memory pressure simulation for ' || u.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '6 hours',
    25000 + (random() * 30000)::INTEGER
FROM users u
CROSS JOIN generate_series(1, 10) s
WHERE u.created_at > '2024-01-01'
LIMIT 100;

-- =====================================================
-- SCENARIO 8: Simulate connection pool exhaustion
-- =====================================================
-- Create many small queries to simulate connection pool issues
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..100 LOOP
        -- Simulate many small queries
        INSERT INTO events (user_id, event_type, event_name, created_at)
        SELECT 
            u.id,
            'connection_pool_test',
            'pool_test_' || i,
            NOW() - INTERVAL '7 hours'
        FROM users u
        WHERE u.id = (i % 10) + 1;
        
        -- Add small delay
        PERFORM pg_sleep(0.01);
    END LOOP;
END $$;

-- =====================================================
-- SCENARIO 9: Simulate query plan changes affecting performance
-- =====================================================
-- Create queries that might change execution plans
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'plan_change_test',
    'plan_change_simulation',
    NOW() - INTERVAL '8 hours'
FROM users u
WHERE u.created_at > '2024-01-01'
    AND u.role = 'user'
    AND u.id IN (
        SELECT p.user_id 
        FROM projects p 
        WHERE p.status = 'active'
        AND p.created_at > '2024-01-01'
    );

-- =====================================================
-- SCENARIO 10: Simulate resource contention
-- =====================================================
-- Create queries that compete for resources
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'resource_contention_' || u.id,
    COUNT(*),
    'contention_count',
    NOW() - INTERVAL '9 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
LEFT JOIN rag_chunks rc ON f.id = rc.file_id
WHERE u.created_at > '2023-01-01'
    AND p.status = 'active'
    AND f.size > 1000
    AND rc.token_count > 100
GROUP BY u.id, u.name, u.email, u.role, u.avatar, u.github_id, u.google_id, u.created_at, u.updated_at;

-- =====================================================
-- SCENARIO 11: Simulate slow network affecting performance
-- =====================================================
-- Create queries that simulate network delays
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'network_delay_test',
    'network_delay_simulation',
    NOW() - INTERVAL '10 hours'
FROM users u
WHERE u.created_at > '2024-01-01'
    AND u.role = 'user'
    AND u.name IS NOT NULL
    AND u.email IS NOT NULL
    AND u.avatar IS NOT NULL;

-- =====================================================
-- SCENARIO 12: Simulate query timeout issues
-- =====================================================
-- Create queries that might timeout
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at, duration_ms)
SELECT 
    u.id,
    'timeout_test',
    'Timeout simulation for ' || u.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '11 hours',
    45000 + (random() * 15000)::INTEGER  -- Simulate near-timeout duration
FROM users u
WHERE u.created_at > '2024-01-01'
LIMIT 50;

-- =====================================================
-- SCENARIO 13: Simulate batch processing load increase
-- =====================================================
-- Create batch operations that increase in size
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..20 LOOP
        -- Simulate increasing batch sizes
        INSERT INTO events (user_id, event_type, event_name, created_at)
        SELECT 
            u.id,
            'batch_processing',
            'batch_' || i,
            NOW() - INTERVAL '12 hours'
        FROM users u
        WHERE u.id % (i + 1) = 0;
        
        -- Add delay proportional to batch size
        PERFORM pg_sleep(i * 0.01);
    END LOOP;
END $$;

-- =====================================================
-- SCENARIO 14: Simulate query cache misses
-- =====================================================
-- Create queries that cause cache misses
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'cache_miss_test',
    'cache_miss_simulation',
    NOW() - INTERVAL '13 hours'
FROM users u
WHERE u.created_at > '2024-01-01'
    AND u.role = 'user'
    AND u.name IS NOT NULL
    AND u.email IS NOT NULL
    AND u.avatar IS NOT NULL
    AND u.github_id IS NOT NULL
    AND u.google_id IS NOT NULL;

-- =====================================================
-- SCENARIO 15: Simulate query optimization regression
-- =====================================================
-- Create queries that might have regressed in performance
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'optimization_regression_' || u.id,
    COUNT(DISTINCT p.id) * COUNT(DISTINCT f.id),
    'regression_count',
    NOW() - INTERVAL '14 hours'
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN files f ON p.id = f.project_id
WHERE u.created_at > '2023-01-01'
    AND p.status = 'active'
    AND f.size > 1000
GROUP BY u.id, u.name, u.email, u.role, u.avatar, u.github_id, u.google_id, u.created_at, u.updated_at;

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for queries with increasing execution time
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    total_time/calls as avg_time_per_call
FROM pg_stat_statements
WHERE calls > 10
ORDER BY avg_time_per_call DESC;

-- Check for queries with high total time
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE total_time > 100000  -- 100 seconds total
ORDER BY total_time DESC;

-- Check for queries with increasing call frequency
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    calls::FLOAT / EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())) as calls_per_second
FROM pg_stat_statements
WHERE calls > 100
ORDER BY calls_per_second DESC;

-- =====================================================
-- END OF QUERY LOAD INCREASE SCENARIOS
-- =====================================================
