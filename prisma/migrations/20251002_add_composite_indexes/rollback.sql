-- Rollback script for composite indexes migration
-- Safe to run - only removes performance indexes, no data loss

-- Workspace indexes
DROP INDEX IF EXISTS workspaces_user_status_idx;
DROP INDEX IF EXISTS workspaces_user_updated_idx;
DROP INDEX IF EXISTS workspaces_workspace_status_idx;

-- Project indexes
DROP INDEX IF EXISTS projects_workspace_status_idx;
DROP INDEX IF EXISTS projects_user_workspace_idx;
DROP INDEX IF EXISTS projects_workspace_updated_idx;
DROP INDEX IF EXISTS projects_user_updated_idx;

-- File indexes
DROP INDEX IF EXISTS files_workspace_language_idx;
DROP INDEX IF EXISTS files_project_language_idx;
DROP INDEX IF EXISTS files_workspace_updated_idx;
DROP INDEX IF EXISTS files_project_updated_idx;

-- RAG chunk indexes
DROP INDEX IF EXISTS rag_chunks_workspace_chunk_idx;
DROP INDEX IF EXISTS rag_chunks_file_lines_idx;
DROP INDEX IF EXISTS rag_chunks_workspace_user_idx;

-- AI request indexes
DROP INDEX IF EXISTS ai_requests_user_status_created_idx;
DROP INDEX IF EXISTS ai_requests_user_type_created_idx;
DROP INDEX IF EXISTS ai_requests_project_created_idx;
DROP INDEX IF EXISTS ai_requests_status_created_idx;

-- Session indexes
DROP INDEX IF EXISTS sessions_user_expires_idx;
DROP INDEX IF EXISTS sessions_token_expires_idx;

-- Event indexes
DROP INDEX IF EXISTS events_user_type_created_idx;
DROP INDEX IF EXISTS events_type_created_idx;

-- System metrics indexes
DROP INDEX IF EXISTS system_metrics_name_created_idx;

-- Note: Original single-column indexes remain intact
-- Performance will revert to baseline, but queries will still function
