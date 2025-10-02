-- Add workspace access control table
-- Addresses security issue #283 - Implement real workspace access control

-- Create workspace_members table for multi-tenant access control
CREATE TABLE workspace_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{}',
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, workspace_id)
);

-- Indexes for performance
CREATE INDEX workspace_members_workspace_role_idx ON workspace_members(workspace_id, role);
CREATE INDEX workspace_members_active_idx ON workspace_members(user_id, workspace_id, revoked_at);
CREATE INDEX workspace_members_user_idx ON workspace_members(user_id) WHERE revoked_at IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER workspace_members_updated_at
BEFORE UPDATE ON workspace_members
FOR EACH ROW
EXECUTE FUNCTION update_workspace_members_updated_at();

-- Migrate existing data: grant workspace owners full access
-- This gives the workspace creator 'owner' role automatically
INSERT INTO workspace_members (user_id, workspace_id, role, accepted_at)
SELECT user_id, id, 'owner', created_at
FROM workspaces
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE workspace_members IS 'Multi-tenant workspace access control with role-based permissions';
COMMENT ON COLUMN workspace_members.role IS 'User role: owner (full control), admin (manage members), member (read/write), viewer (read-only)';
COMMENT ON COLUMN workspace_members.permissions IS 'Granular permissions JSON: {read: bool, write: bool, delete: bool, invite: bool, admin: bool}';
COMMENT ON COLUMN workspace_members.revoked_at IS 'When access was revoked. NULL means active membership.';
