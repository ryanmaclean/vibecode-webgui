-- Initialize VibeCode WebGUI database schema
-- This script sets up the core tables for the AI-powered development platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    github_id VARCHAR(100) UNIQUE,
    google_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Audit fields
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Projects table for code projects and workspaces
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Project configuration
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'internal')),
    template VARCHAR(100),
    language VARCHAR(50),
    framework VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadata
    star_count INTEGER DEFAULT 0,
    fork_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,

    -- Constraints
    CONSTRAINT projects_name_length CHECK (length(name) >= 1 AND length(name) <= 255)
);

-- Files table for project file storage and versioning
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT,

    -- File metadata
    language VARCHAR(50),
    size_bytes INTEGER DEFAULT 0,
    mime_type VARCHAR(100),
    encoding VARCHAR(20) DEFAULT 'utf-8',

    -- Version control
    version INTEGER DEFAULT 1,
    hash VARCHAR(64),
    parent_hash VARCHAR(64),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Collaboration
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    -- Constraints
    UNIQUE(project_id, path),
    CONSTRAINT files_path_format CHECK (path ~ '^[^/].*[^/]$' OR path = ''),
    CONSTRAINT files_size_positive CHECK (size_bytes >= 0)
);

-- Collaborators table for project sharing and permissions
CREATE TABLE collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Permission levels
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}',

    -- Collaboration settings
    can_invite BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_deploy BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,

    -- Invitation metadata
    invited_by UUID REFERENCES users(id),
    invitation_token VARCHAR(100),
    invitation_expires_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(project_id, user_id)
);

-- Sessions table for active coding sessions and real-time collaboration
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session metadata
    container_id VARCHAR(100),
    code_server_url TEXT,
    websocket_url TEXT,

    -- Session state
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    -- Resource usage
    cpu_usage DECIMAL(5,2) DEFAULT 0.0,
    memory_usage DECIMAL(5,2) DEFAULT 0.0,
    storage_usage BIGINT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    terminated_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT sessions_user_project_unique UNIQUE(user_id, project_id),
    CONSTRAINT sessions_usage_valid CHECK (cpu_usage >= 0 AND memory_usage >= 0 AND storage_usage >= 0)
);

-- AI Interactions table for Claude Code integration and history
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

    -- Interaction data
    prompt TEXT NOT NULL,
    response TEXT,
    context JSONB DEFAULT '{}',

    -- AI metadata
    model VARCHAR(50) DEFAULT 'claude-3-sonnet',
    provider VARCHAR(20) DEFAULT 'anthropic',
    tokens_used INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,

    -- Interaction type and status
    interaction_type VARCHAR(50) DEFAULT 'chat' CHECK (interaction_type IN ('chat', 'code_generation', 'debugging', 'explanation', 'refactoring')),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),

    -- Performance metrics
    response_time_ms INTEGER,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT ai_interactions_prompt_length CHECK (length(prompt) >= 1),
    CONSTRAINT ai_interactions_tokens_positive CHECK (tokens_used >= 0),
    CONSTRAINT ai_interactions_cost_positive CHECK (cost_cents >= 0)
);

-- Deployments table for tracking project deployments
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Deployment metadata
    environment VARCHAR(20) DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production')),
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('netlify', 'vercel', 'github-pages', 'aws', 'gcp', 'azure')),

    -- Deployment details
    url TEXT,
    build_logs TEXT,
    deployment_config JSONB DEFAULT '{}',

    -- Status and results
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deployed', 'failed', 'cancelled')),
    error_message TEXT,
    build_time_seconds INTEGER,

    -- Version control
    commit_hash VARCHAR(40),
    branch VARCHAR(100) DEFAULT 'main',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT deployments_build_time_positive CHECK (build_time_seconds >= 0),
    CONSTRAINT deployments_url_format CHECK (url IS NULL OR url ~* '^https?://.*')
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_visibility ON projects(visibility);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);
CREATE INDEX idx_projects_active ON projects(is_archived) WHERE is_archived = false;

CREATE INDEX idx_files_project ON files(project_id);
CREATE INDEX idx_files_path ON files(project_id, path);
CREATE INDEX idx_files_language ON files(language);
CREATE INDEX idx_files_updated ON files(updated_at DESC);

CREATE INDEX idx_collaborators_project ON collaborators(project_id);
CREATE INDEX idx_collaborators_user ON collaborators(user_id);
CREATE INDEX idx_collaborators_role ON collaborators(role);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_activity ON sessions(last_activity_at DESC);

CREATE INDEX idx_ai_interactions_project ON ai_interactions(project_id);
CREATE INDEX idx_ai_interactions_user ON ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_type ON ai_interactions(interaction_type);
CREATE INDEX idx_ai_interactions_created ON ai_interactions(created_at DESC);

CREATE INDEX idx_deployments_project ON deployments(project_id);
CREATE INDEX idx_deployments_user ON deployments(user_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_environment ON deployments(environment);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data
INSERT INTO users (email, name, avatar_url) VALUES
('admin@vibecode.dev', 'VibeCode Admin', 'https://github.com/identicons/admin.png');

-- Grant permissions (if needed for specific roles)
-- Additional security policies can be added here using Row Level Security (RLS)

COMMIT;
