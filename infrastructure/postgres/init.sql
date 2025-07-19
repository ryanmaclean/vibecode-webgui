-- PostgreSQL initialization script for VibeCode WebGUI
-- Ensures pgvector extension is available for vector embeddings

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');

-- Create initial admin user if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Tables don't exist yet, will be created by Prisma
        RAISE NOTICE 'Database initialized with extensions. Tables will be created by Prisma migrations.';
    ELSE
        RAISE NOTICE 'Database already initialized.';
    END IF;
END $$;
