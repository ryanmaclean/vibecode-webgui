-- Agent Memory Architecture Migration
-- Issue: #897, Epic: #884
-- Creates the three-tier memory infrastructure for multi-agent state management

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Core Agent Memory Table (Long-term Storage)
-- ============================================
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    project_id TEXT,
    workspace_id TEXT,
    bead_id TEXT,                    -- Gas Town bead reference

    -- Content
    tier TEXT NOT NULL DEFAULT 'long_term',
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    embedding vector(1536),

    -- Metadata
    source TEXT,
    confidence FLOAT DEFAULT 1.0,
    validated_at TIMESTAMPTZ,
    validated_by TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,          -- NULL = permanent
    accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT agent_memory_valid_tier CHECK (tier IN ('working', 'long_term')),
    CONSTRAINT agent_memory_valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Primary indexes for common query patterns
CREATE INDEX idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_project_id ON agent_memory(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_agent_memory_workspace_id ON agent_memory(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_agent_memory_bead_id ON agent_memory(bead_id) WHERE bead_id IS NOT NULL;
CREATE INDEX idx_agent_memory_content_type ON agent_memory(content_type);
CREATE INDEX idx_agent_memory_tier ON agent_memory(tier);
CREATE INDEX idx_agent_memory_tags ON agent_memory USING GIN(tags);
CREATE INDEX idx_agent_memory_metadata ON agent_memory USING GIN(metadata);
CREATE INDEX idx_agent_memory_expires_at ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_agent_memory_confidence ON agent_memory(confidence) WHERE confidence < 0.5;

-- Composite indexes for common query patterns
CREATE INDEX idx_agent_memory_agent_type ON agent_memory(agent_id, content_type);
CREATE INDEX idx_agent_memory_agent_tier ON agent_memory(agent_id, tier);
CREATE INDEX idx_agent_memory_agent_confidence ON agent_memory(agent_id, confidence DESC);
CREATE INDEX idx_agent_memory_project_type ON agent_memory(project_id, content_type) WHERE project_id IS NOT NULL;

-- HNSW index for semantic search (cosine similarity)
-- m=16 and ef_construction=64 provide good balance of accuracy and speed
CREATE INDEX idx_agent_memory_embedding ON agent_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- Agent Beliefs Table (Belief Management)
-- ============================================
CREATE TABLE agent_beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    memory_id UUID REFERENCES agent_memory(id) ON DELETE CASCADE,

    -- Belief content
    statement TEXT NOT NULL,
    evidence TEXT[] DEFAULT '{}',

    -- Confidence tracking
    confidence FLOAT NOT NULL DEFAULT 0.5,
    confidence_history JSONB DEFAULT '[]',

    -- Validation
    status TEXT DEFAULT 'pending',
    validated_at TIMESTAMPTZ,
    validated_by TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT agent_beliefs_valid_status CHECK (
        status IN ('pending', 'validated', 'rejected', 'outdated')
    ),
    CONSTRAINT agent_beliefs_valid_confidence CHECK (
        confidence >= 0 AND confidence <= 1
    )
);

-- Belief indexes
CREATE INDEX idx_agent_beliefs_agent_id ON agent_beliefs(agent_id);
CREATE INDEX idx_agent_beliefs_status ON agent_beliefs(status);
CREATE INDEX idx_agent_beliefs_memory_id ON agent_beliefs(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_agent_beliefs_agent_status ON agent_beliefs(agent_id, status);
CREATE INDEX idx_agent_beliefs_pending ON agent_beliefs(agent_id, created_at)
    WHERE status = 'pending';

-- ============================================
-- Memory Access Log (Analytics and Decay)
-- ============================================
CREATE TABLE agent_memory_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES agent_memory(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    access_type TEXT NOT NULL,  -- 'read', 'write', 'search'
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT agent_memory_access_valid_type CHECK (
        access_type IN ('read', 'write', 'search', 'promote', 'decay')
    )
);

-- Access log indexes
CREATE INDEX idx_memory_access_log_memory_id ON agent_memory_access_log(memory_id);
CREATE INDEX idx_memory_access_log_agent_id ON agent_memory_access_log(agent_id);
CREATE INDEX idx_memory_access_log_created_at ON agent_memory_access_log(created_at);
CREATE INDEX idx_memory_access_log_type_time ON agent_memory_access_log(access_type, created_at DESC);

-- Partition access log by time for efficient cleanup (optional - for high volume)
-- CREATE INDEX idx_memory_access_log_time_partition ON agent_memory_access_log(created_at)
--     WHERE created_at > NOW() - INTERVAL '90 days';

-- ============================================
-- Session Handoff Table (Cross-session State)
-- ============================================
CREATE TABLE agent_session_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    session_id TEXT NOT NULL,

    -- Handoff content
    working_memory_snapshot TEXT[] DEFAULT '{}',  -- Memory IDs
    ephemeral_summary TEXT,
    active_bead_id TEXT,

    -- Status
    status TEXT DEFAULT 'active',
    resumed_at TIMESTAMPTZ,
    resumed_by_session TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',

    -- Constraints
    CONSTRAINT agent_handoff_valid_status CHECK (
        status IN ('active', 'resumed', 'expired')
    )
);

-- Handoff indexes
CREATE INDEX idx_agent_handoffs_agent_id ON agent_session_handoffs(agent_id);
CREATE INDEX idx_agent_handoffs_session_id ON agent_session_handoffs(session_id);
CREATE INDEX idx_agent_handoffs_status ON agent_session_handoffs(status) WHERE status = 'active';
CREATE INDEX idx_agent_handoffs_bead_id ON agent_session_handoffs(active_bead_id) WHERE active_bead_id IS NOT NULL;
CREATE INDEX idx_agent_handoffs_expires ON agent_session_handoffs(expires_at) WHERE status = 'active';

-- ============================================
-- Trigger Functions
-- ============================================

-- Function to update access metadata on memory read
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE agent_memory
    SET
        accessed_at = NOW(),
        usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.memory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update memory access stats
CREATE TRIGGER trigger_memory_access
    AFTER INSERT ON agent_memory_access_log
    FOR EACH ROW
    WHEN (NEW.access_type IN ('read', 'search'))
    EXECUTE FUNCTION update_memory_access();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agent_memory updated_at
CREATE TRIGGER trigger_agent_memory_updated
    BEFORE UPDATE ON agent_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_memory_timestamp();

-- Trigger for agent_beliefs updated_at
CREATE TRIGGER trigger_agent_beliefs_updated
    BEFORE UPDATE ON agent_beliefs
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_memory_timestamp();

-- ============================================
-- Helper Functions
-- ============================================

-- Function for semantic search with similarity threshold
CREATE OR REPLACE FUNCTION search_agent_memory_semantic(
    p_agent_id TEXT,
    p_query_embedding vector(1536),
    p_threshold FLOAT DEFAULT 0.7,
    p_limit INTEGER DEFAULT 10,
    p_content_types TEXT[] DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    content_type TEXT,
    confidence FLOAT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        am.id,
        am.content,
        am.content_type,
        am.confidence,
        (1 - (am.embedding <=> p_query_embedding))::FLOAT as similarity,
        am.metadata
    FROM agent_memory am
    WHERE
        am.agent_id = p_agent_id
        AND am.tier = 'long_term'
        AND am.embedding IS NOT NULL
        AND (1 - (am.embedding <=> p_query_embedding)) > p_threshold
        AND (p_content_types IS NULL OR am.content_type = ANY(p_content_types))
        AND (p_project_id IS NULL OR am.project_id = p_project_id)
    ORDER BY am.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to decay unused memories
CREATE OR REPLACE FUNCTION decay_agent_memories(
    p_unused_days INTEGER DEFAULT 30,
    p_decay_rate FLOAT DEFAULT 0.1,
    p_min_confidence FLOAT DEFAULT 0.2
)
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE agent_memory
    SET
        confidence = GREATEST(confidence - p_decay_rate, p_min_confidence),
        updated_at = NOW()
    WHERE
        tier = 'long_term'
        AND last_used_at < NOW() - (p_unused_days || ' days')::INTERVAL
        AND confidence > p_min_confidence;

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    -- Log decay operation
    INSERT INTO agent_memory_access_log (memory_id, agent_id, access_type, context)
    SELECT id, agent_id, 'decay', jsonb_build_object('decay_rate', p_decay_rate, 'affected', affected_count)
    FROM agent_memory
    WHERE
        tier = 'long_term'
        AND last_used_at < NOW() - (p_unused_days || ' days')::INTERVAL
        AND confidence <= p_min_confidence + p_decay_rate
    LIMIT 1;

    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired handoffs
CREATE OR REPLACE FUNCTION cleanup_expired_handoffs()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE agent_session_handoffs
    SET status = 'expired'
    WHERE
        status = 'active'
        AND expires_at < NOW();

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE agent_memory IS 'Long-term and working memory storage for multi-agent systems';
COMMENT ON TABLE agent_beliefs IS 'Belief management with validation tracking to prevent error amplification';
COMMENT ON TABLE agent_memory_access_log IS 'Access logging for memory decay and analytics';
COMMENT ON TABLE agent_session_handoffs IS 'Cross-session state for agent continuity';

COMMENT ON COLUMN agent_memory.tier IS 'Memory tier: working (TTL-based) or long_term (persistent)';
COMMENT ON COLUMN agent_memory.confidence IS 'Confidence score 0-1, decays over time if unused';
COMMENT ON COLUMN agent_memory.embedding IS 'vector(1536) embedding for semantic search';
COMMENT ON COLUMN agent_memory.bead_id IS 'Reference to Gas Town bead for task context';

COMMENT ON COLUMN agent_beliefs.confidence_history IS 'JSON array tracking confidence changes over time';
COMMENT ON COLUMN agent_beliefs.status IS 'pending -> validated/rejected, outdated for stale beliefs';

COMMENT ON FUNCTION search_agent_memory_semantic IS 'Semantic search using pgvector cosine similarity';
COMMENT ON FUNCTION decay_agent_memories IS 'Reduce confidence of unused memories to prevent staleness';

COMMENT ON INDEX idx_agent_memory_embedding IS 'HNSW index for fast approximate nearest neighbor search';
