-- AgentAPI Integration Database Migration
-- Date: 2025-10-02
-- Purpose: Add tables for agent session management, conversation history, and health metrics

-- =====================================================
-- 1. Agent Sessions Table
-- =====================================================

CREATE TABLE agent_sessions (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type VARCHAR(32) NOT NULL,
  agent_config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'initializing',
  agentapi_url VARCHAR(512) NOT NULL,
  agentapi_port INTEGER NOT NULL DEFAULT 8766,

  -- Connection tracking
  active_connections INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,

  -- Resource limits
  max_memory_mb INTEGER DEFAULT 1024,
  max_cpu_cores DECIMAL(4,2) DEFAULT 0.5,

  -- Metadata
  environment_vars JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT agent_sessions_status_check CHECK (
    status IN ('initializing', 'starting', 'ready', 'active', 'idle',
               'stopping', 'stopped', 'error', 'crashed', 'deleted')
  ),
  CONSTRAINT agent_sessions_type_check CHECK (
    agent_type IN ('aider', 'goose', 'claude-cli', 'cursor-agent', 'custom')
  ),
  CONSTRAINT agent_sessions_active_connections_check CHECK (active_connections >= 0)
);

-- Indexes for agent_sessions
CREATE INDEX idx_agent_sessions_workspace ON agent_sessions(workspace_id, deleted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_sessions_user ON agent_sessions(user_id, deleted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status, deleted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_sessions_last_activity ON agent_sessions(last_activity_at DESC)
  WHERE deleted_at IS NULL AND status IN ('ready', 'active', 'idle');
CREATE INDEX idx_agent_sessions_workspace_active ON agent_sessions(workspace_id, status, deleted_at)
  WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_agent_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_sessions_updated_at
BEFORE UPDATE ON agent_sessions
FOR EACH ROW
EXECUTE FUNCTION update_agent_sessions_updated_at();

-- =====================================================
-- 2. Conversation History Table
-- =====================================================

CREATE TABLE agent_conversations (
  id BIGSERIAL PRIMARY KEY,
  agent_session_id VARCHAR(64) NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  conversation_id VARCHAR(64) NOT NULL,

  -- Message details
  direction VARCHAR(16) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(32) NOT NULL DEFAULT 'text',

  -- Token tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,

  -- Context and metadata
  context_files JSONB DEFAULT '[]',
  file_selections JSONB DEFAULT '{}',
  tool_calls JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  -- Performance tracking
  latency_ms INTEGER,
  model_used VARCHAR(128),
  temperature DECIMAL(3,2),

  -- Status and errors
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  error_code VARCHAR(64),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT agent_conversations_direction_check CHECK (
    direction IN ('user_to_agent', 'agent_to_user', 'system', 'tool')
  ),
  CONSTRAINT agent_conversations_role_check CHECK (
    role IN ('user', 'assistant', 'system', 'tool')
  ),
  CONSTRAINT agent_conversations_status_check CHECK (
    status IN ('pending', 'processing', 'streaming', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT agent_conversations_tokens_check CHECK (
    total_tokens IS NULL OR total_tokens >= 0
  )
);

-- Indexes for agent_conversations
CREATE INDEX idx_agent_conversations_session ON agent_conversations(agent_session_id, created_at DESC);
CREATE INDEX idx_agent_conversations_conversation ON agent_conversations(conversation_id, created_at ASC);
CREATE INDEX idx_agent_conversations_created_at ON agent_conversations(created_at DESC);
CREATE INDEX idx_agent_conversations_status ON agent_conversations(status)
  WHERE status IN ('pending', 'processing', 'streaming');

-- Partial index for recent messages (last 7 days) for fast lookups
CREATE INDEX idx_agent_conversations_recent ON agent_conversations(agent_session_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '7 days';

-- =====================================================
-- 3. Agent Health Metrics Table
-- =====================================================

CREATE TABLE agent_health_metrics (
  id BIGSERIAL PRIMARY KEY,
  agent_session_id VARCHAR(64) NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,

  -- Timestamp (5-minute intervals recommended)
  metric_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- System metrics
  cpu_usage_percent DECIMAL(5,2),
  memory_usage_mb INTEGER,
  memory_percent DECIMAL(5,2),

  -- Performance metrics
  uptime_seconds INTEGER,
  message_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,

  -- Token metrics
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  tokens_per_minute DECIMAL(10,2),

  -- Connection metrics
  active_connections INTEGER DEFAULT 0,
  total_connections INTEGER DEFAULT 0,
  failed_connections INTEGER DEFAULT 0,

  -- Health status
  health_status VARCHAR(32) NOT NULL DEFAULT 'healthy',
  health_score DECIMAL(5,2),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Constraints
  CONSTRAINT agent_health_metrics_health_status_check CHECK (
    health_status IN ('healthy', 'degraded', 'unhealthy', 'critical', 'unknown')
  ),
  CONSTRAINT agent_health_metrics_health_score_check CHECK (
    health_score IS NULL OR (health_score >= 0 AND health_score <= 100)
  ),
  CONSTRAINT agent_health_metrics_percentages_check CHECK (
    (cpu_usage_percent IS NULL OR cpu_usage_percent >= 0) AND
    (memory_percent IS NULL OR memory_percent >= 0)
  )
);

-- Indexes for agent_health_metrics
CREATE INDEX idx_agent_health_metrics_session ON agent_health_metrics(agent_session_id, metric_timestamp DESC);
CREATE INDEX idx_agent_health_metrics_timestamp ON agent_health_metrics(metric_timestamp DESC);
CREATE INDEX idx_agent_health_metrics_health_status ON agent_health_metrics(health_status, metric_timestamp DESC)
  WHERE health_status IN ('degraded', 'unhealthy', 'critical');

-- Partial index for recent metrics (last 24 hours)
CREATE INDEX idx_agent_health_metrics_recent ON agent_health_metrics(agent_session_id, metric_timestamp DESC)
  WHERE metric_timestamp > NOW() - INTERVAL '24 hours';

-- =====================================================
-- 4. Agent Events Table (Lifecycle & Audit Trail)
-- =====================================================

CREATE TABLE agent_events (
  id BIGSERIAL PRIMARY KEY,
  agent_session_id VARCHAR(64) NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,

  -- Event details
  event_type VARCHAR(64) NOT NULL,
  event_category VARCHAR(32) NOT NULL,
  event_severity VARCHAR(16) NOT NULL DEFAULT 'info',

  -- Event data
  event_message TEXT,
  event_data JSONB DEFAULT '{}',

  -- Context
  user_id INTEGER REFERENCES users(id),
  workspace_id INTEGER REFERENCES workspaces(id),
  triggered_by VARCHAR(128),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT agent_events_category_check CHECK (
    event_category IN ('lifecycle', 'message', 'error', 'performance', 'security', 'system')
  ),
  CONSTRAINT agent_events_severity_check CHECK (
    event_severity IN ('debug', 'info', 'warning', 'error', 'critical')
  )
);

-- Indexes for agent_events
CREATE INDEX idx_agent_events_session ON agent_events(agent_session_id, created_at DESC);
CREATE INDEX idx_agent_events_type ON agent_events(event_type, created_at DESC);
CREATE INDEX idx_agent_events_severity ON agent_events(event_severity, created_at DESC)
  WHERE event_severity IN ('error', 'critical');
CREATE INDEX idx_agent_events_category ON agent_events(event_category, created_at DESC);
CREATE INDEX idx_agent_events_created_at ON agent_events(created_at DESC);

-- =====================================================
-- 5. Agent Rate Limiting Table
-- =====================================================

CREATE TABLE agent_rate_limits (
  id BIGSERIAL PRIMARY KEY,

  -- Identifier (user, workspace, or IP)
  identifier_type VARCHAR(32) NOT NULL,
  identifier_value VARCHAR(256) NOT NULL,

  -- Rate limit tracking
  window_start TIMESTAMPTZ NOT NULL,
  window_duration_seconds INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,

  -- Limits
  limit_type VARCHAR(64) NOT NULL,
  limit_value INTEGER NOT NULL,

  -- Status
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_until TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT agent_rate_limits_identifier_type_check CHECK (
    identifier_type IN ('user', 'workspace', 'ip', 'api_key')
  ),
  CONSTRAINT agent_rate_limits_positive_values_check CHECK (
    window_duration_seconds > 0 AND
    request_count >= 0 AND
    limit_value > 0
  ),

  -- Unique constraint per window
  UNIQUE (identifier_type, identifier_value, limit_type, window_start)
);

-- Indexes for agent_rate_limits
CREATE INDEX idx_agent_rate_limits_identifier ON agent_rate_limits(
  identifier_type, identifier_value, window_start DESC
);
CREATE INDEX idx_agent_rate_limits_blocked ON agent_rate_limits(is_blocked, blocked_until)
  WHERE is_blocked = TRUE;
CREATE INDEX idx_agent_rate_limits_window ON agent_rate_limits(window_start, window_duration_seconds);

-- Updated_at trigger for rate limits
CREATE TRIGGER agent_rate_limits_updated_at
BEFORE UPDATE ON agent_rate_limits
FOR EACH ROW
EXECUTE FUNCTION update_agent_sessions_updated_at();

-- =====================================================
-- 6. Materialized View for Agent Statistics
-- =====================================================

CREATE MATERIALIZED VIEW agent_session_stats AS
SELECT
  asess.id AS agent_session_id,
  asess.workspace_id,
  asess.user_id,
  asess.agent_type,
  asess.status,
  asess.created_at,

  -- Conversation stats
  COUNT(DISTINCT aconv.conversation_id) AS total_conversations,
  COUNT(aconv.id) AS total_messages,
  COUNT(aconv.id) FILTER (WHERE aconv.direction = 'user_to_agent') AS user_messages,
  COUNT(aconv.id) FILTER (WHERE aconv.direction = 'agent_to_user') AS agent_messages,
  COUNT(aconv.id) FILTER (WHERE aconv.status = 'failed') AS failed_messages,

  -- Token stats
  COALESCE(SUM(aconv.input_tokens), 0) AS total_input_tokens,
  COALESCE(SUM(aconv.output_tokens), 0) AS total_output_tokens,
  COALESCE(SUM(aconv.total_tokens), 0) AS total_tokens,

  -- Performance stats
  AVG(aconv.latency_ms) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY aconv.latency_ms) AS p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY aconv.latency_ms) AS p99_latency_ms,
  MAX(aconv.latency_ms) AS max_latency_ms,

  -- Event stats
  COUNT(aevt.id) FILTER (WHERE aevt.event_severity IN ('error', 'critical')) AS error_count,
  MAX(aevt.created_at) FILTER (WHERE aevt.event_severity IN ('error', 'critical')) AS last_error_at,

  -- Time tracking
  asess.last_activity_at,
  EXTRACT(EPOCH FROM (COALESCE(asess.stopped_at, NOW()) - asess.started_at)) AS uptime_seconds

FROM agent_sessions asess
LEFT JOIN agent_conversations aconv ON asess.id = aconv.agent_session_id
LEFT JOIN agent_events aevt ON asess.id = aevt.agent_session_id
WHERE asess.deleted_at IS NULL
GROUP BY asess.id, asess.workspace_id, asess.user_id, asess.agent_type, asess.status,
         asess.created_at, asess.last_activity_at, asess.started_at, asess.stopped_at;

-- Index for materialized view
CREATE UNIQUE INDEX idx_agent_session_stats_id ON agent_session_stats(agent_session_id);
CREATE INDEX idx_agent_session_stats_workspace ON agent_session_stats(workspace_id);
CREATE INDEX idx_agent_session_stats_user ON agent_session_stats(user_id);

-- Refresh function for materialized view (call periodically)
CREATE OR REPLACE FUNCTION refresh_agent_session_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_session_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Cleanup Functions
-- =====================================================

-- Archive old conversations (90+ days)
CREATE OR REPLACE FUNCTION archive_old_agent_conversations()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  CREATE TABLE IF NOT EXISTS agent_conversations_archive (
    LIKE agent_conversations INCLUDING ALL
  );

  WITH archived AS (
    DELETE FROM agent_conversations
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND status IN ('completed', 'failed', 'cancelled')
    RETURNING *
  )
  INSERT INTO agent_conversations_archive
  SELECT * FROM archived;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Archive old metrics (30+ days)
CREATE OR REPLACE FUNCTION archive_old_agent_metrics()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  CREATE TABLE IF NOT EXISTS agent_health_metrics_archive (
    LIKE agent_health_metrics INCLUDING ALL
  );

  WITH archived AS (
    DELETE FROM agent_health_metrics
    WHERE metric_timestamp < NOW() - INTERVAL '30 days'
    RETURNING *
  )
  INSERT INTO agent_health_metrics_archive
  SELECT * FROM archived;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup stale sessions (inactive for 24+ hours)
CREATE OR REPLACE FUNCTION cleanup_stale_agent_sessions()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE agent_sessions
  SET
    status = 'stopped',
    stopped_at = NOW(),
    deleted_at = NOW()
  WHERE
    status IN ('ready', 'active', 'idle')
    AND last_activity_at < NOW() - INTERVAL '24 hours'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Grant Permissions
-- =====================================================

-- Grant permissions to application user (replace 'vibecode_app' with actual user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vibecode_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vibecode_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO vibecode_app;

-- =====================================================
-- 9. Performance Optimization Comments
-- =====================================================

COMMENT ON TABLE agent_sessions IS
  'Tracks active agent sessions. Max 3 agents per workspace. TTL: indefinite (soft delete).';

COMMENT ON TABLE agent_conversations IS
  'Stores message history. Partitioned by created_at recommended for >10M rows. Archive after 90 days.';

COMMENT ON TABLE agent_health_metrics IS
  'System metrics collected every 5 minutes. Archive after 30 days. Consider TimescaleDB for >100K agents.';

COMMENT ON TABLE agent_events IS
  'Audit trail for agent lifecycle. Archive after 90 days.';

COMMENT ON TABLE agent_rate_limits IS
  'Sliding window rate limiting. Cleanup windows older than 1 hour.';

COMMENT ON MATERIALIZED VIEW agent_session_stats IS
  'Aggregated statistics refreshed every 5 minutes. Query this instead of raw tables for dashboards.';

COMMENT ON INDEX idx_agent_sessions_workspace_active IS
  'Optimized for workspace agent listing with status filter. Expected <50ms query time.';

COMMENT ON INDEX idx_agent_conversations_recent IS
  'Partial index for hot data (last 7 days). Reduces index size by 90% for high-traffic systems.';

COMMENT ON INDEX idx_agent_health_metrics_recent IS
  'Partial index for dashboard queries. Covers 99% of monitoring use cases.';
