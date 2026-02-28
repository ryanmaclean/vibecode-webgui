-- Rollback migration for confirmation models
-- Removes human-in-the-loop agent approval tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_operation_snapshots_rollback_created;
DROP INDEX IF EXISTS idx_operation_snapshots_confirmation_created;
DROP INDEX IF EXISTS idx_operation_snapshots_created_at;
DROP INDEX IF EXISTS idx_operation_snapshots_rollback_status;
DROP INDEX IF EXISTS idx_operation_snapshots_file_path;
DROP INDEX IF EXISTS idx_operation_snapshots_operation_type;
DROP INDEX IF EXISTS idx_operation_snapshots_confirmation_id;

DROP INDEX IF EXISTS idx_confirmation_requests_risk_status;
DROP INDEX IF EXISTS idx_confirmation_requests_agent_status;
DROP INDEX IF EXISTS idx_confirmation_requests_status_created;
DROP INDEX IF EXISTS idx_confirmation_requests_created_at;
DROP INDEX IF EXISTS idx_confirmation_requests_approved_by;
DROP INDEX IF EXISTS idx_confirmation_requests_agent_id;
DROP INDEX IF EXISTS idx_confirmation_requests_status;

-- Drop tables (CASCADE to handle foreign key constraints)
DROP TABLE IF EXISTS operation_snapshots CASCADE;
DROP TABLE IF EXISTS confirmation_requests CASCADE;
