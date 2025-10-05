-- =====================================================
-- HIGH IMPACT BLOCKER RECOMMENDATIONS
-- =====================================================
-- These queries cause significant waiting time for blocked queries.
-- They typically involve long-running transactions that hold locks
-- on critical tables, preventing other queries from proceeding.
-- =====================================================

-- Enable query logging for better DBM visibility
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- =====================================================
-- SCENARIO 1: Long-running transaction with row locks
-- =====================================================
-- This simulates a transaction that holds locks for an extended period
-- Run this in one session, then try to run blocking queries in another session

-- Start a long-running transaction
BEGIN;
-- Lock a critical user record
UPDATE users SET updated_at = NOW() WHERE id = 1;
-- Simulate processing time
SELECT pg_sleep(30); -- Hold lock for 30 seconds
COMMIT;

-- =====================================================
-- SCENARIO 2: Bulk update causing table-level locks
-- =====================================================
-- This simulates a bulk operation that locks the entire table
BEGIN;
-- Update many rows at once (can cause table lock)
UPDATE users SET updated_at = NOW() WHERE created_at < '2024-01-01';
-- Simulate processing time
SELECT pg_sleep(45); -- Hold lock for 45 seconds
COMMIT;

-- =====================================================
-- SCENARIO 3: Deadlock scenario
-- =====================================================
-- This creates a deadlock situation between two transactions
-- Run these in separate sessions simultaneously

-- Session 1: Lock users then projects
BEGIN;
UPDATE users SET name = 'Session1 User' WHERE id = 2;
SELECT pg_sleep(5); -- Wait 5 seconds
UPDATE projects SET name = 'Session1 Project' WHERE user_id = 2;
COMMIT;

-- Session 2: Lock projects then users (opposite order = deadlock)
-- BEGIN;
-- UPDATE projects SET name = 'Session2 Project' WHERE user_id = 2;
-- SELECT pg_sleep(5); -- Wait 5 seconds
-- UPDATE users SET name = 'Session2 User' WHERE id = 2;
-- COMMIT;

-- =====================================================
-- SCENARIO 4: Index creation blocking queries
-- =====================================================
-- Creating indexes can block other operations
-- This simulates a slow index creation

-- Create a large index that will block other operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- =====================================================
-- SCENARIO 5: VACUUM operation blocking
-- =====================================================
-- VACUUM operations can block other queries
-- This simulates a VACUUM that takes time

-- Run VACUUM FULL on a table (this will block other operations)
-- VACUUM FULL users;

-- =====================================================
-- SCENARIO 6: Foreign key constraint checking
-- =====================================================
-- Large foreign key operations can cause blocking
-- This simulates a bulk insert with foreign key checks

BEGIN;
-- Insert many projects that reference users
INSERT INTO projects (name, description, user_id, language, framework, created_at)
SELECT 
    'Blocking Project ' || generate_series(1, 1000),
    'Project created during blocking scenario',
    (random() * 10 + 1)::INTEGER,
    'typescript',
    'react',
    NOW() - INTERVAL '1 hour'
FROM generate_series(1, 1000);
-- Hold the transaction open
SELECT pg_sleep(60);
COMMIT;

-- =====================================================
-- SCENARIO 7: Schema modification blocking
-- =====================================================
-- ALTER TABLE operations can block other queries
-- This simulates a schema change

-- Add a column to a frequently accessed table
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_blocking_column VARCHAR(255);
-- This will block other operations on the users table

-- =====================================================
-- SCENARIO 8: Long-running SELECT with locks
-- =====================================================
-- SELECT queries with FOR UPDATE can block other operations
-- This simulates a long-running select with row locks

BEGIN;
-- Select and lock multiple rows
SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5) FOR UPDATE;
-- Hold the locks
SELECT pg_sleep(40);
COMMIT;

-- =====================================================
-- SCENARIO 9: Backup operation blocking
-- =====================================================
-- pg_dump operations can cause blocking
-- This simulates a backup operation

-- Create a large table to simulate backup blocking
CREATE TEMP TABLE temp_backup_simulation AS
SELECT 
    generate_series(1, 1000000) as id,
    'Backup data ' || generate_series(1, 1000000) as data;

-- =====================================================
-- SCENARIO 10: Concurrent insert conflicts
-- =====================================================
-- Multiple concurrent inserts can cause blocking
-- This simulates concurrent operations on the same table

-- Insert many records that might conflict
INSERT INTO events (user_id, event_type, event_name, created_at)
SELECT 
    (random() * 10 + 1)::INTEGER,
    'concurrent_insert',
    'blocking_test_' || generate_series(1, 500),
    NOW() - INTERVAL '2 hours'
FROM generate_series(1, 500);

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check for current locks and blocking queries
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Check for long-running transactions
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    query
FROM pg_stat_activity
WHERE state = 'active'
    AND query_start < NOW() - INTERVAL '30 seconds'
ORDER BY query_start;

-- Check for lock waits
SELECT 
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity
WHERE wait_event_type IS NOT NULL
ORDER BY state_change;

-- =====================================================
-- END OF HIGH IMPACT BLOCKER SCENARIOS
-- =====================================================
