-- =====================================================
-- FUNCTION IN FILTER RECOMMENDATIONS
-- =====================================================
-- These queries call functions on columns being filtered, leading to 
-- expensive sequential scans that can't take advantage of indexes.
-- 
-- Datadog will recommend removing functions from WHERE clauses or
-- creating function-based indexes.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- Scenario 1: Using LOWER() function in WHERE clause
-- This prevents index usage on email column
-- Recommendation: Create index on LOWER(email) or use ILIKE instead
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
-- Recommendation: Use date range queries instead
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
-- Recommendation: Create function-based index or use LIKE with wildcards
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

-- Scenario 4: Using EXTRACT() function on timestamp
-- This prevents index usage on created_at column
-- Recommendation: Use date range queries or create function-based index
INSERT INTO system_metrics (metric_name, value, unit, created_at)
SELECT 
    'monthly_user_count',
    COUNT(*),
    'count',
    NOW() - INTERVAL '4 hours'
FROM users u
WHERE EXTRACT(MONTH FROM u.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
GROUP BY EXTRACT(MONTH FROM u.created_at);

-- Scenario 5: Using LENGTH() function in WHERE clause
-- This prevents index usage on name column
-- Recommendation: Create function-based index on LENGTH(name)
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'name_length_check',
    'long_name_user',
    NOW() - INTERVAL '5 hours'
FROM users u
WHERE LENGTH(u.name) > 20
LIMIT 30;

-- Scenario 6: Using UPPER() function in WHERE clause
-- This prevents index usage on role column
-- Recommendation: Use ILIKE or create function-based index
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'admin_task',
    'Admin task for ' || u.name,
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '6 hours'
FROM users u
WHERE UPPER(u.role) = 'ADMIN'
LIMIT 25;

-- Scenario 7: Using TRIM() function in WHERE clause
-- This prevents index usage on name column
-- Recommendation: Clean data at insert time or create function-based index
INSERT INTO projects (name, description, user_id, language, framework, created_at)
SELECT 
    'Clean-' || TRIM(u.name),
    'Project with clean name',
    u.id,
    'python',
    'fastapi',
    NOW() - INTERVAL '7 hours'
FROM users u
WHERE TRIM(u.name) != u.name  -- Names with leading/trailing spaces
LIMIT 40;

-- Scenario 8: Using COALESCE() function in WHERE clause
-- This prevents index usage on avatar column
-- Recommendation: Use separate conditions or create function-based index
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'avatar_check',
    'user_without_avatar',
    NOW() - INTERVAL '8 hours'
FROM users u
WHERE COALESCE(u.avatar, '') = ''
LIMIT 60;

-- Scenario 9: Using CASE expression in WHERE clause
-- This prevents index usage on status column
-- Recommendation: Use separate conditions or create computed column
INSERT INTO ai_requests (user_id, request_type, prompt, model, provider, status, created_at)
SELECT 
    u.id,
    'status_check',
    'User status analysis',
    'anthropic/claude-3.5-sonnet',
    'openrouter',
    'completed',
    NOW() - INTERVAL '9 hours'
FROM users u
WHERE CASE 
    WHEN u.role = 'admin' THEN 'active'
    WHEN u.created_at > '2024-01-01' THEN 'new'
    ELSE 'legacy'
END = 'active'
LIMIT 80;

-- Scenario 10: Using REGEXP_REPLACE() function in WHERE clause
-- This prevents index usage on email column
-- Recommendation: Use separate conditions or create function-based index
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    u.id,
    'email_cleanup',
    'email_format_check',
    NOW() - INTERVAL '10 hours'
FROM users u
WHERE REGEXP_REPLACE(u.email, '\.', '') LIKE '%@example%'
LIMIT 35;

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for function-based indexes that could help
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%LOWER%' 
   OR indexdef LIKE '%UPPER%'
   OR indexdef LIKE '%SUBSTRING%'
   OR indexdef LIKE '%EXTRACT%'
   OR indexdef LIKE '%LENGTH%'
   OR indexdef LIKE '%TRIM%'
   OR indexdef LIKE '%COALESCE%';

-- Check current query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%LOWER%' 
   OR query LIKE '%UPPER%'
   OR query LIKE '%SUBSTRING%'
   OR query LIKE '%EXTRACT%'
   OR query LIKE '%LENGTH%'
   OR query LIKE '%TRIM%'
   OR query LIKE '%COALESCE%'
ORDER BY mean_time DESC;

-- =====================================================
-- END OF FUNCTION IN FILTER SCENARIOS
-- =====================================================
