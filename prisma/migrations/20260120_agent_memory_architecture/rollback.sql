-- Rollback Agent Memory Architecture Migration
-- Issue: #897, Epic: #884
-- Removes all agent memory infrastructure tables and functions

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_memory_access ON agent_memory_access_log;
DROP TRIGGER IF EXISTS trigger_agent_memory_updated ON agent_memory;
DROP TRIGGER IF EXISTS trigger_agent_beliefs_updated ON agent_beliefs;

-- Drop functions
DROP FUNCTION IF EXISTS update_memory_access();
DROP FUNCTION IF EXISTS update_agent_memory_timestamp();
DROP FUNCTION IF EXISTS search_agent_memory_semantic(TEXT, vector(1536), FLOAT, INTEGER, TEXT[], TEXT);
DROP FUNCTION IF EXISTS decay_agent_memories(INTEGER, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS cleanup_expired_handoffs();

-- Drop tables in dependency order
DROP TABLE IF EXISTS agent_memory_access_log;
DROP TABLE IF EXISTS agent_session_handoffs;
DROP TABLE IF EXISTS agent_beliefs;
DROP TABLE IF EXISTS agent_memory;

-- Note: We do NOT drop the pgvector extension as it may be used by other tables
