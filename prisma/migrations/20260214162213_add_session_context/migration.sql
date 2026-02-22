-- SessionContext Migration
-- Feature: Persistent Session Context
-- Creates the session_contexts table for storing conversation context with vector embeddings

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Session Context Table
-- ============================================
CREATE TABLE session_contexts (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,              -- Conversation context text
    metadata JSONB,                     -- Additional metadata (e.g., message count, token count, conversation summary)
    session_id TEXT,                    -- Session identifier
    user_id INTEGER NOT NULL,
    workspace_id INTEGER,
    embedding vector(1536),             -- Vector embedding for semantic search
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Foreign key constraints
    CONSTRAINT fk_session_context_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_session_context_workspace
        FOREIGN KEY (workspace_id)
        REFERENCES workspaces(id)
        ON DELETE SET NULL
);

-- Primary indexes for common query patterns
CREATE INDEX idx_session_contexts_user_id ON session_contexts(user_id);
CREATE INDEX idx_session_contexts_workspace_id ON session_contexts(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_session_contexts_session_id ON session_contexts(session_id) WHERE session_id IS NOT NULL;

-- Composite indexes for efficient queries
CREATE INDEX idx_session_contexts_user_workspace_time ON session_contexts(user_id, workspace_id, created_at) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_session_contexts_user_session ON session_contexts(user_id, session_id) WHERE session_id IS NOT NULL;

-- HNSW index for semantic search (cosine similarity)
-- m=16 and ef_construction=64 provide good balance of accuracy and speed
CREATE INDEX idx_session_contexts_embedding ON session_contexts
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding IS NOT NULL;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE session_contexts IS 'Persistent conversation context storage with vector embeddings for semantic search';
COMMENT ON COLUMN session_contexts.content IS 'Conversation context text';
COMMENT ON COLUMN session_contexts.metadata IS 'Additional metadata (message count, token count, conversation summary, etc.)';
COMMENT ON COLUMN session_contexts.session_id IS 'Session identifier for grouping related contexts';
COMMENT ON COLUMN session_contexts.embedding IS 'vector(1536) embedding for semantic similarity search';
COMMENT ON INDEX idx_session_contexts_embedding IS 'HNSW index for fast approximate nearest neighbor search';
