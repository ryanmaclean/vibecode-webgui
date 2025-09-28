-- Align rag_chunks table with Prisma schema expectations (user/workspace/project columns and indexes)
-- Run against the target Postgres instance (e.g., staging flexible server) before retrying RAG suites.

BEGIN;

ALTER TABLE rag_chunks
  ADD COLUMN IF NOT EXISTS user_id INTEGER,
  ADD COLUMN IF NOT EXISTS workspace_id INTEGER,
  ADD COLUMN IF NOT EXISTS project_id INTEGER,
  ADD COLUMN IF NOT EXISTS token_count INTEGER,
  ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill ownership metadata from files table when available.
UPDATE rag_chunks AS rc
SET
  user_id = COALESCE(rc.user_id, f.user_id),
  workspace_id = COALESCE(rc.workspace_id, f.workspace_id),
  project_id = COALESCE(rc.project_id, f.project_id)
FROM files AS f
WHERE rc.file_id = f.id
  AND (rc.user_id IS NULL OR rc.workspace_id IS NULL OR rc.project_id IS NULL);

-- Enforce the non-null constraint that Prisma expects on user_id.
ALTER TABLE rag_chunks
  ALTER COLUMN user_id SET NOT NULL;

-- Ensure supporting indexes exist for query performance.
CREATE INDEX IF NOT EXISTS rag_chunks_user_id_idx ON rag_chunks(user_id);
CREATE INDEX IF NOT EXISTS rag_chunks_workspace_id_idx ON rag_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS rag_chunks_project_id_idx ON rag_chunks(project_id);

-- Add foreign-key relationships if they were missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_user_id_fkey'
  ) THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_workspace_id_fkey'
  ) THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_project_id_fkey'
  ) THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END;
$$;

COMMIT;
