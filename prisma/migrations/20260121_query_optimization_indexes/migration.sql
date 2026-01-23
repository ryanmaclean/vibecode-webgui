-- Additional indexes for query optimization
-- Based on analysis of common query patterns in optimized-queries.ts and chat-postgres.ts

-- Agent Memory indexes for memory tier access patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_memory_agent_tier_accessed
  ON agent_memory(agent_id, tier, accessed_at DESC)
  WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

COMMENT ON INDEX idx_agent_memory_agent_tier_accessed IS 'Optimizes agent memory retrieval by tier with LRU ordering';

-- Agent Memory content type index for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_memory_content_type_agent
  ON agent_memory(content_type, agent_id)
  WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

COMMENT ON INDEX idx_agent_memory_content_type_agent IS 'Optimizes memory queries filtered by content type';

-- Agent Beliefs status index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_beliefs_agent_status
  ON agent_beliefs(agent_id, status, confidence DESC);

COMMENT ON INDEX idx_agent_beliefs_agent_status IS 'Optimizes belief queries by agent and validation status';

-- Agent Session Handoffs for active handoff lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_session_handoffs_active
  ON agent_session_handoffs(agent_id, status)
  WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP;

COMMENT ON INDEX idx_agent_session_handoffs_active IS 'Optimizes active session handoff lookups';

-- RAG Ingest Jobs status and queue optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_ingest_jobs_status_queue
  ON rag_ingest_jobs(status, queue_name, requested_at)
  WHERE status IN ('queued', 'processing');

COMMENT ON INDEX idx_rag_ingest_jobs_status_queue IS 'Optimizes job queue processing queries';

-- Uploads workspace status for upload management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploads_workspace_status
  ON uploads(workspace_id, status, created_at DESC)
  WHERE workspace_id IS NOT NULL;

COMMENT ON INDEX idx_uploads_workspace_status IS 'Optimizes workspace upload listings';

-- Experiments active experiments query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiments_active_key
  ON experiments(key, status)
  WHERE status IN ('RUNNING', 'PAUSED');

COMMENT ON INDEX idx_experiments_active_key IS 'Optimizes active experiment lookups by key';

-- Experiment assignments for fast variant lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_assignments_variant
  ON experiment_assignments(experiment_id, variant_key, assigned_at DESC);

COMMENT ON INDEX idx_experiment_assignments_variant IS 'Optimizes variant assignment queries';

-- Experiment metrics aggregation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_metrics_aggregation
  ON experiment_metrics(experiment_id, metric_name, timestamp DESC);

COMMENT ON INDEX idx_experiment_metrics_aggregation IS 'Optimizes metric aggregation queries';

-- Add partial index for recent messages (last 30 days)
-- This is more efficient for real-time chat scenarios
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recent
  ON messages(conversation_id, created_at DESC)
  WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

COMMENT ON INDEX idx_messages_recent IS 'Optimizes recent message queries (last 30 days)';

-- Add partial index for active conversations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_active_recent
  ON conversations(user_id, updated_at DESC)
  WHERE status = 'ACTIVE';

COMMENT ON INDEX idx_conversations_active_recent IS 'Optimizes active conversation listings';

-- Create statistics update for query planner optimization
ANALYZE conversations;
ANALYZE messages;
ANALYZE agent_memory;
ANALYZE agent_beliefs;
ANALYZE experiments;
ANALYZE experiment_assignments;
ANALYZE experiment_metrics;
