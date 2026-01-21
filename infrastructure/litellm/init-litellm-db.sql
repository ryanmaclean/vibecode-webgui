-- LiteLLM Database Initialization Script
-- =======================================

-- Create LiteLLM database and user
CREATE DATABASE litellm;
CREATE USER litellm WITH ENCRYPTED PASSWORD 'litellm_password';
GRANT ALL PRIVILEGES ON DATABASE litellm TO litellm;

-- Connect to LiteLLM database
\c litellm;

-- Grant privileges to litellm user
GRANT ALL ON SCHEMA public TO litellm;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO litellm;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO litellm;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- LiteLLM Tables (these will be created by LiteLLM on first run, but we can prepare)
-- The actual schema will be managed by LiteLLM's migration system

-- Create initial configuration table if needed
CREATE TABLE IF NOT EXISTS litellm_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO litellm_config (config_key, config_value) VALUES 
('version', '1.0.0'),
('initialized', 'true'),
('database_version', '1')
ON CONFLICT (config_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_litellm_config_key ON litellm_config(config_key);

-- Set proper ownership
ALTER DATABASE litellm OWNER TO litellm;
ALTER TABLE litellm_config OWNER TO litellm; 