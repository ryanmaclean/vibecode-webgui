-- Add composite indexes for query optimization
-- Improves performance for common multi-column queries

-- Workspace indexes
CREATE INDEX workspaces_user_status_idx ON workspaces(user_id, status) WHERE status = 'active';
CREATE INDEX workspaces_user_updated_idx ON workspaces(user_id, updated_at DESC);
CREATE INDEX workspaces_workspace_status_idx ON workspaces(workspace_id, status);

-- Project indexes
CREATE INDEX projects_workspace_status_idx ON projects(workspace_id, status) WHERE status = 'active';
CREATE INDEX projects_user_workspace_idx ON projects(user_id, workspace_id);
CREATE INDEX projects_workspace_updated_idx ON projects(workspace_id, updated_at DESC);
CREATE INDEX projects_user_updated_idx ON projects(user_id, updated_at DESC);

-- File indexes
CREATE INDEX files_workspace_language_idx ON files(workspace_id, language) WHERE language IS NOT NULL;
CREATE INDEX files_project_language_idx ON files(project_id, language) WHERE language IS NOT NULL;
CREATE INDEX files_workspace_updated_idx ON files(workspace_id, updated_at DESC);
CREATE INDEX files_project_updated_idx ON files(project_id, updated_at DESC);

-- RAG chunk indexes
CREATE INDEX rag_chunks_workspace_chunk_idx ON rag_chunks(workspace_id, chunk_index);
CREATE INDEX rag_chunks_file_lines_idx ON rag_chunks(file_id, start_line, end_line) WHERE start_line IS NOT NULL;
CREATE INDEX rag_chunks_workspace_user_idx ON rag_chunks(workspace_id, user_id);

-- AI request indexes
CREATE INDEX ai_requests_user_status_created_idx ON ai_requests(user_id, status, created_at DESC);
CREATE INDEX ai_requests_user_type_created_idx ON ai_requests(user_id, request_type, created_at DESC);
CREATE INDEX ai_requests_project_created_idx ON ai_requests(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX ai_requests_status_created_idx ON ai_requests(status, created_at DESC) WHERE status IN ('pending', 'processing');

-- Session indexes
CREATE INDEX sessions_user_expires_idx ON sessions(user_id, expires) WHERE expires > CURRENT_TIMESTAMP;
CREATE INDEX sessions_token_expires_idx ON sessions(session_token, expires);

-- Event indexes (for analytics)
CREATE INDEX events_user_type_created_idx ON events(user_id, event_type, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX events_type_created_idx ON events(event_type, created_at DESC);

-- System metrics indexes
CREATE INDEX system_metrics_name_created_idx ON system_metrics(metric_name, created_at DESC);

-- Add comments for documentation
COMMENT ON INDEX workspaces_user_status_idx IS 'Optimizes user workspace listings filtered by status';
COMMENT ON INDEX projects_workspace_status_idx IS 'Optimizes active project queries per workspace';
COMMENT ON INDEX files_workspace_language_idx IS 'Optimizes language-specific file queries';
COMMENT ON INDEX rag_chunks_file_lines_idx IS 'Optimizes line-based chunk retrieval for code context';
COMMENT ON INDEX ai_requests_user_status_created_idx IS 'Optimizes user AI request history with status filtering';
