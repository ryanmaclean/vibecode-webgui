-- =====================================================
-- UNUSED INDEX RECOMMENDATIONS
-- =====================================================
-- These indexes have not been used in any execution plans recently.
-- Datadog will recommend dropping these indexes to save space
-- and improve write performance.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- SCENARIO 1: Create indexes that won't be used
-- =====================================================
-- Create indexes on columns that are rarely queried

-- Index on email domain extraction (rarely used)
CREATE INDEX IF NOT EXISTS idx_unused_email_domain ON users (SUBSTRING(email FROM '@(.*)$'));

-- Index on name length (rarely used)
CREATE INDEX IF NOT EXISTS idx_unused_name_length ON users (LENGTH(name));

-- Index on created month extraction (rarely used)
CREATE INDEX IF NOT EXISTS idx_unused_created_month ON users (EXTRACT(MONTH FROM created_at));

-- =====================================================
-- SCENARIO 2: Create composite index that won't be used
-- =====================================================
-- Create composite index that doesn't match query patterns

CREATE INDEX IF NOT EXISTS idx_unused_user_project_status ON projects (user_id, status, language, framework);

-- =====================================================
-- SCENARIO 3: Create indexes on columns with low selectivity
-- =====================================================
-- Create indexes on columns with few distinct values

CREATE INDEX IF NOT EXISTS idx_unused_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_unused_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_unused_mime_type ON files (mime_type);

-- =====================================================
-- SCENARIO 4: Create indexes on columns that are never filtered
-- =====================================================
-- Create indexes on columns that are only used in SELECT clauses

CREATE INDEX IF NOT EXISTS idx_unused_avatar ON users (avatar);
CREATE INDEX IF NOT EXISTS idx_unused_description ON projects (description);
CREATE INDEX IF NOT EXISTS idx_unused_metadata ON files (metadata);

-- =====================================================
-- SCENARIO 5: Create indexes on columns with function calls
-- =====================================================
-- Create indexes on function expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_upper_name ON users (UPPER(name));
CREATE INDEX IF NOT EXISTS idx_unused_lower_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_unused_trim_name ON users (TRIM(name));

-- =====================================================
-- SCENARIO 6: Create indexes on columns with complex expressions
-- =====================================================
-- Create indexes on complex expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_name_email ON users (name || ' ' || email);
CREATE INDEX IF NOT EXISTS idx_unused_created_year ON users (EXTRACT(YEAR FROM created_at));
CREATE INDEX IF NOT EXISTS idx_unused_name_length_email ON users (LENGTH(name) + LENGTH(email));

-- =====================================================
-- SCENARIO 7: Create indexes on columns with CASE expressions
-- =====================================================
-- Create indexes on CASE expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_role_case ON users (
    CASE 
        WHEN role = 'admin' THEN 'A'
        WHEN role = 'user' THEN 'U'
        ELSE 'O'
    END
);

-- =====================================================
-- SCENARIO 8: Create indexes on columns with COALESCE expressions
-- =====================================================
-- Create indexes on COALESCE expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_name_coalesce ON users (COALESCE(name, 'Unknown'));
CREATE INDEX IF NOT EXISTS idx_unused_avatar_coalesce ON users (COALESCE(avatar, ''));

-- =====================================================
-- SCENARIO 9: Create indexes on columns with NULLIF expressions
-- =====================================================
-- Create indexes on NULLIF expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_name_nullif ON users (NULLIF(name, ''));
CREATE INDEX IF NOT EXISTS idx_unused_email_nullif ON users (NULLIF(email, ''));

-- =====================================================
-- SCENARIO 10: Create indexes on columns with REGEXP expressions
-- =====================================================
-- Create indexes on REGEXP expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_email_regexp ON users (REGEXP_REPLACE(email, '\.', ''));
CREATE INDEX IF NOT EXISTS idx_unused_name_regexp ON users (REGEXP_REPLACE(name, '[^a-zA-Z0-9]', ''));

-- =====================================================
-- SCENARIO 11: Create indexes on columns with mathematical expressions
-- =====================================================
-- Create indexes on mathematical expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_id_squared ON users (id * id);
CREATE INDEX IF NOT EXISTS idx_unused_name_length_squared ON users (LENGTH(name) * LENGTH(name));

-- =====================================================
-- SCENARIO 12: Create indexes on columns with date arithmetic
-- =====================================================
-- Create indexes on date arithmetic expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_created_plus_days ON users (created_at + INTERVAL '30 days');
CREATE INDEX IF NOT EXISTS idx_unused_created_minus_days ON users (created_at - INTERVAL '30 days');

-- =====================================================
-- SCENARIO 13: Create indexes on columns with string concatenation
-- =====================================================
-- Create indexes on string concatenation expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_name_email_concat ON users (name || '@' || email);
CREATE INDEX IF NOT EXISTS idx_unused_role_name_concat ON users (role || '_' || name);

-- =====================================================
-- SCENARIO 14: Create indexes on columns with conditional expressions
-- =====================================================
-- Create indexes on conditional expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_active_user ON users (
    CASE 
        WHEN created_at > '2024-01-01' THEN 'new'
        WHEN created_at > '2023-01-01' THEN 'recent'
        ELSE 'old'
    END
);

-- =====================================================
-- SCENARIO 15: Create indexes on columns with window functions
-- =====================================================
-- Create indexes on window function expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_user_rank ON users (
    ROW_NUMBER() OVER (ORDER BY created_at)
);

-- =====================================================
-- SCENARIO 16: Create indexes on columns with subqueries
-- =====================================================
-- Create indexes on subquery expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_project_count ON users (
    (SELECT COUNT(*) FROM projects p WHERE p.user_id = users.id)
);

-- =====================================================
-- SCENARIO 17: Create indexes on columns with aggregate functions
-- =====================================================
-- Create indexes on aggregate function expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_avg_project_size ON users (
    (SELECT AVG(f.size) FROM projects p JOIN files f ON p.id = f.project_id WHERE p.user_id = users.id)
);

-- =====================================================
-- SCENARIO 18: Create indexes on columns with JSON operations
-- =====================================================
-- Create indexes on JSON operations that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_metadata_keys ON files ((metadata->>'keys'));
CREATE INDEX IF NOT EXISTS idx_unused_metadata_values ON files ((metadata->>'values'));

-- =====================================================
-- SCENARIO 19: Create indexes on columns with array operations
-- =====================================================
-- Create indexes on array operations that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_array_length ON files (array_length(string_to_array(path, '/'), 1));

-- =====================================================
-- SCENARIO 20: Create indexes on columns with type casting
-- =====================================================
-- Create indexes on type casting expressions that are rarely used

CREATE INDEX IF NOT EXISTS idx_unused_id_text ON users (id::TEXT);
CREATE INDEX IF NOT EXISTS idx_unused_created_text ON users (created_at::TEXT);

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename, indexname;

-- Check for rarely used indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan < 10
ORDER BY idx_scan ASC;

-- Check for indexes with low efficiency
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan > 0 THEN idx_tup_fetch::FLOAT / idx_scan
        ELSE 0
    END as efficiency
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY efficiency ASC;

-- Check for function-based indexes
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
   OR indexdef LIKE '%COALESCE%'
   OR indexdef LIKE '%CASE%'
   OR indexdef LIKE '%REGEXP%'
   OR indexdef LIKE '%::%';

-- Check for composite indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%,%';

-- Check for indexes on columns with low selectivity
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan < 100
ORDER BY idx_scan ASC;

-- =====================================================
-- END OF UNUSED INDEX SCENARIOS
-- =====================================================
