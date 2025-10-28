-- Rollback script for workspace_members migration
-- DANGER: This will remove all workspace access control data

-- Drop trigger
DROP TRIGGER IF EXISTS workspace_members_updated_at ON workspace_members;

-- Drop function
DROP FUNCTION IF EXISTS update_workspace_members_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS workspace_members_user_idx;
DROP INDEX IF EXISTS workspace_members_active_idx;
DROP INDEX IF EXISTS workspace_members_workspace_role_idx;

-- Drop table (CASCADE will remove foreign key constraints)
DROP TABLE IF EXISTS workspace_members CASCADE;

-- Note: Original workspace.user_id relationship is preserved
-- Access control will revert to simple ownership model
