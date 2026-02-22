-- Secret Management and Rotation Tracking Migration
-- Implements secret lifecycle management with expiration policies and rotation history
-- Feature: Secret Rotation and Expiration Policies (Issue #066)

-- ============================================
-- Secret Metadata Table
-- Tracks API keys, tokens, and credentials with expiration and rotation policies
-- ============================================
CREATE TABLE secret_metadata (
    id SERIAL PRIMARY KEY,
    key_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_rotated_at TIMESTAMPTZ,
    rotation_policy TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB,

    -- Constraints
    CONSTRAINT secret_metadata_valid_status CHECK (
        status IN ('active', 'expired', 'rotating', 'revoked')
    )
);

-- Primary indexes for common query patterns
CREATE INDEX idx_secret_metadata_key_name ON secret_metadata(key_name);
CREATE INDEX idx_secret_metadata_status ON secret_metadata(status);
CREATE INDEX idx_secret_metadata_expires_at ON secret_metadata(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_secret_metadata_rotation_policy ON secret_metadata(rotation_policy) WHERE rotation_policy IS NOT NULL;
CREATE INDEX idx_secret_metadata_last_rotated_at ON secret_metadata(last_rotated_at) WHERE last_rotated_at IS NOT NULL;

-- Composite index for finding active secrets expiring soon
CREATE INDEX idx_secret_metadata_status_expires ON secret_metadata(status, expires_at)
    WHERE status = 'active' AND expires_at IS NOT NULL;

-- ============================================
-- Secret Rotation History Table
-- Audit trail for secret rotation events
-- ============================================
CREATE TABLE secret_rotation_history (
    id SERIAL PRIMARY KEY,
    secret_id INTEGER NOT NULL REFERENCES secret_metadata(id) ON DELETE CASCADE,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_by TEXT,
    previous_expires_at TIMESTAMPTZ,
    new_expires_at TIMESTAMPTZ,
    reason TEXT,
    metadata JSONB,

    -- Constraints
    CONSTRAINT rotation_history_valid_reason CHECK (
        reason IS NULL OR reason IN ('scheduled', 'manual', 'compromised', 'expired', 'policy_change', 'emergency')
    )
);

-- Rotation history indexes
CREATE INDEX idx_rotation_history_secret_id ON secret_rotation_history(secret_id);
CREATE INDEX idx_rotation_history_rotated_at ON secret_rotation_history(rotated_at);
CREATE INDEX idx_rotation_history_rotated_by ON secret_rotation_history(rotated_by) WHERE rotated_by IS NOT NULL;

-- Composite index for retrieving rotation history chronologically
CREATE INDEX idx_rotation_history_secret_time ON secret_rotation_history(secret_id, rotated_at DESC);

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE secret_metadata IS 'Tracks API keys, tokens, and credentials with expiration policies and rotation schedules';
COMMENT ON TABLE secret_rotation_history IS 'Audit trail for secret rotation events with reason tracking';

COMMENT ON COLUMN secret_metadata.key_name IS 'Unique identifier for the secret (e.g., GITHUB_TOKEN, OPENAI_API_KEY)';
COMMENT ON COLUMN secret_metadata.expires_at IS 'When the secret expires (NULL = no expiration)';
COMMENT ON COLUMN secret_metadata.last_rotated_at IS 'Last successful rotation timestamp';
COMMENT ON COLUMN secret_metadata.rotation_policy IS 'Policy identifier (e.g., api_keys_90d, auth_tokens_30d)';
COMMENT ON COLUMN secret_metadata.status IS 'Secret status: active, expired, rotating, revoked';

COMMENT ON COLUMN secret_rotation_history.rotated_by IS 'User identifier or "system" for automated rotations';
COMMENT ON COLUMN secret_rotation_history.reason IS 'Reason for rotation: scheduled, manual, compromised, expired, policy_change, emergency';
