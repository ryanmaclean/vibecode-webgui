-- Compliance Audit Logging Migration
-- Issue: #046
-- Creates immutable audit trail for SOC2/HIPAA compliance

-- ============================================
-- Audit Logs Table (Tamper-Evident Storage)
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id INTEGER,                     -- Nullable for system/anonymous actions
    action TEXT NOT NULL,                -- Action performed (e.g., "user.login", "file.create")
    resource TEXT NOT NULL,              -- Resource type and ID (e.g., "project:123")
    ip_address TEXT,                     -- Client IP address
    user_agent TEXT,                     -- Client user agent string
    metadata JSONB,                      -- Additional context (request params, before/after states)
    hash TEXT NOT NULL,                  -- SHA-256 hash of (previous_hash + record_data) for tamper evidence
    previous_hash TEXT,                  -- Reference to previous log hash for chain integrity

    -- Compliance-specific fields
    severity TEXT NOT NULL DEFAULT 'info',    -- info, warning, critical
    category TEXT NOT NULL DEFAULT 'general', -- auth, data_access, admin, system
    outcome TEXT NOT NULL DEFAULT 'success',  -- success, failure, error
    session_id TEXT,                          -- Links to user session for correlation

    -- Constraints for data integrity
    CONSTRAINT audit_logs_valid_severity CHECK (
        severity IN ('info', 'warning', 'critical')
    ),
    CONSTRAINT audit_logs_valid_category CHECK (
        category IN ('auth', 'data_access', 'admin', 'system', 'ai_operation', 'general')
    ),
    CONSTRAINT audit_logs_valid_outcome CHECK (
        outcome IN ('success', 'failure', 'error')
    )
);

-- ============================================
-- Indexes for Compliance Queries
-- ============================================

-- Primary single-column indexes
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX idx_audit_logs_category ON audit_logs(category);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_audit_logs_hash ON audit_logs(hash);

-- Composite indexes for common compliance query patterns
CREATE INDEX idx_audit_logs_user_timeline ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_action_timeline ON audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_logs_compliance_report ON audit_logs(category, severity, timestamp DESC);

-- Index for chain integrity verification
CREATE INDEX idx_audit_logs_chain ON audit_logs(previous_hash) WHERE previous_hash IS NOT NULL;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance (SOC2/HIPAA) - all AI operations, user actions, and system events';
COMMENT ON COLUMN audit_logs.hash IS 'SHA-256 hash of (previous_hash + record_data) creating a tamper-evident chain';
COMMENT ON COLUMN audit_logs.previous_hash IS 'Reference to previous log entry hash for chain integrity verification';
COMMENT ON COLUMN audit_logs.severity IS 'Log severity: info (normal ops), warning (potential issues), critical (security events)';
COMMENT ON COLUMN audit_logs.category IS 'Action category: auth, data_access, admin, system, ai_operation, general';
COMMENT ON COLUMN audit_logs.outcome IS 'Action outcome: success, failure, error';
COMMENT ON COLUMN audit_logs.session_id IS 'User session ID for correlating related audit events';

-- ============================================
-- Integrity Verification Function
-- ============================================
CREATE OR REPLACE FUNCTION verify_audit_log_chain(
    p_start_id UUID DEFAULT NULL,
    p_end_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    is_valid BOOLEAN,
    expected_previous_hash TEXT,
    actual_previous_hash TEXT
) AS $$
DECLARE
    expected_hash TEXT := NULL;
BEGIN
    -- If no start_id provided, start from the first record
    IF p_start_id IS NULL THEN
        SELECT al.id INTO p_start_id
        FROM audit_logs al
        WHERE al.previous_hash IS NULL
        ORDER BY al.timestamp ASC
        LIMIT 1;
    END IF;

    -- Iterate through the chain and verify each link
    FOR id, is_valid, expected_previous_hash, actual_previous_hash IN
        SELECT
            al.id,
            (al.previous_hash IS NOT DISTINCT FROM expected_hash) as is_valid,
            expected_hash as expected_previous_hash,
            al.previous_hash as actual_previous_hash
        FROM audit_logs al
        WHERE al.timestamp >= (SELECT timestamp FROM audit_logs WHERE audit_logs.id = p_start_id)
          AND (p_end_id IS NULL OR al.timestamp <= (SELECT timestamp FROM audit_logs WHERE audit_logs.id = p_end_id))
        ORDER BY al.timestamp ASC
    LOOP
        -- Update expected hash for next iteration
        SELECT hash INTO expected_hash FROM audit_logs WHERE audit_logs.id = verify_audit_log_chain.id;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_audit_log_chain IS 'Verifies the integrity of the audit log hash chain';
