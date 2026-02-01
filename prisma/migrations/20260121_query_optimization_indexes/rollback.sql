-- Rollback migration: 20260121_query_optimization_indexes

DROP INDEX CONCURRENTLY IF EXISTS idx_agent_memory_agent_tier_accessed;
DROP INDEX CONCURRENTLY IF EXISTS idx_agent_memory_content_type_agent;
DROP INDEX CONCURRENTLY IF EXISTS idx_agent_beliefs_agent_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_agent_session_handoffs_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_rag_ingest_jobs_status_queue;
DROP INDEX CONCURRENTLY IF EXISTS idx_uploads_workspace_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_experiments_active_key;
DROP INDEX CONCURRENTLY IF EXISTS idx_experiment_assignments_variant;
DROP INDEX CONCURRENTLY IF EXISTS idx_experiment_metrics_aggregation;
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_active_recent;
