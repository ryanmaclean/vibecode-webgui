-- Human-in-the-Loop Agent Approval Migration
-- Feature: #039
-- Creates confirmation request and operation snapshot tables for agent approval workflow

-- ============================================
-- Confirmation Requests Table
-- ============================================
CREATE TABLE confirmation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,         -- External request identifier
    agent_id TEXT NOT NULL,                  -- Agent that created the request
    action_type TEXT NOT NULL,               -- Type of destructive operation
    file_path TEXT,                          -- File path for file operations
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, expired
    risk_level TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    metadata JSONB,                          -- Additional context (diff preview, operation details)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,         -- Request expiration timestamp
    approved_at TIMESTAMPTZ,                 -- Approval timestamp
    approved_by INTEGER,                     -- User ID who approved/rejected the request

    -- Constraints for data integrity
    CONSTRAINT confirmation_requests_valid_status CHECK (
        status IN ('pending', 'approved', 'rejected', 'expired')
    ),
    CONSTRAINT confirmation_requests_valid_risk_level CHECK (
        risk_level IN ('low', 'medium', 'high', 'critical')
    )
);

-- ============================================
-- Operation Snapshots Table (for Rollback)
-- ============================================
CREATE TABLE operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confirmation_id UUID NOT NULL,           -- Reference to confirmation request
    operation_type TEXT NOT NULL,            -- Type of operation
    file_path TEXT,                          -- File path for file operations
    original_content TEXT,                   -- Content before operation (for rollback)
    modified_content TEXT,                   -- Content after operation (for verification)
    rollback_status TEXT NOT NULL DEFAULT 'available', -- available, rolled_back, expired
    rolled_back_at TIMESTAMPTZ,              -- Timestamp when rollback was performed
    rolled_back_by INTEGER,                  -- User ID who triggered rollback
    metadata JSONB,                          -- Additional context (file hash, permissions)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign key constraint
    CONSTRAINT fk_operation_snapshots_confirmation
        FOREIGN KEY (confirmation_id)
        REFERENCES confirmation_requests(id)
        ON DELETE CASCADE,

    -- Constraints for data integrity
    CONSTRAINT operation_snapshots_valid_rollback_status CHECK (
        rollback_status IN ('available', 'rolled_back', 'expired')
    )
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Confirmation Requests indexes
CREATE INDEX idx_confirmation_requests_status
    ON confirmation_requests(status);

CREATE INDEX idx_confirmation_requests_agent_id
    ON confirmation_requests(agent_id);

CREATE INDEX idx_confirmation_requests_approved_by
    ON confirmation_requests(approved_by)
    WHERE approved_by IS NOT NULL;

CREATE INDEX idx_confirmation_requests_created_at
    ON confirmation_requests(created_at);

CREATE INDEX idx_confirmation_requests_status_created
    ON confirmation_requests(status, created_at);

CREATE INDEX idx_confirmation_requests_agent_status
    ON confirmation_requests(agent_id, status);

CREATE INDEX idx_confirmation_requests_risk_status
    ON confirmation_requests(risk_level, status);

-- Operation Snapshots indexes
CREATE INDEX idx_operation_snapshots_confirmation_id
    ON operation_snapshots(confirmation_id);

CREATE INDEX idx_operation_snapshots_operation_type
    ON operation_snapshots(operation_type);

CREATE INDEX idx_operation_snapshots_file_path
    ON operation_snapshots(file_path)
    WHERE file_path IS NOT NULL;

CREATE INDEX idx_operation_snapshots_rollback_status
    ON operation_snapshots(rollback_status);

CREATE INDEX idx_operation_snapshots_created_at
    ON operation_snapshots(created_at);

CREATE INDEX idx_operation_snapshots_confirmation_created
    ON operation_snapshots(confirmation_id, created_at);

CREATE INDEX idx_operation_snapshots_rollback_created
    ON operation_snapshots(rollback_status, created_at);

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE confirmation_requests IS 'Stores human-in-the-loop approval requests for destructive agent operations';
COMMENT ON TABLE operation_snapshots IS 'Stores operation snapshots for rollback capability';

COMMENT ON COLUMN confirmation_requests.request_id IS 'External request identifier for tracking';
COMMENT ON COLUMN confirmation_requests.agent_id IS 'ID of the agent that requested the operation';
COMMENT ON COLUMN confirmation_requests.action_type IS 'Type of destructive operation (e.g., file.delete, database.drop)';
COMMENT ON COLUMN confirmation_requests.risk_level IS 'Risk assessment: low, medium, high, critical';
COMMENT ON COLUMN confirmation_requests.metadata IS 'Additional context including diff preview, operation details';

COMMENT ON COLUMN operation_snapshots.confirmation_id IS 'Reference to the confirmation request';
COMMENT ON COLUMN operation_snapshots.original_content IS 'File content before operation for rollback';
COMMENT ON COLUMN operation_snapshots.modified_content IS 'File content after operation for verification';
COMMENT ON COLUMN operation_snapshots.rollback_status IS 'Rollback availability: available, rolled_back, expired';
