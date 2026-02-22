-- Rollback for Compliance Audit Logging Migration
-- Issue: #046

-- Drop integrity verification function
DROP FUNCTION IF EXISTS verify_audit_log_chain;

-- Drop all indexes
DROP INDEX IF EXISTS idx_audit_logs_chain;
DROP INDEX IF EXISTS idx_audit_logs_compliance_report;
DROP INDEX IF EXISTS idx_audit_logs_action_timeline;
DROP INDEX IF EXISTS idx_audit_logs_user_timeline;
DROP INDEX IF EXISTS idx_audit_logs_hash;
DROP INDEX IF EXISTS idx_audit_logs_session_id;
DROP INDEX IF EXISTS idx_audit_logs_severity;
DROP INDEX IF EXISTS idx_audit_logs_category;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;

-- Drop the audit_logs table
DROP TABLE IF EXISTS audit_logs;
