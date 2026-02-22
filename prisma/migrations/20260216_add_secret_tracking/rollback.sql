-- Rollback Secret Management and Rotation Tracking Migration
-- Removes secret tracking tables and indexes

-- Drop tables (CASCADE will remove dependent objects)
DROP TABLE IF EXISTS secret_rotation_history CASCADE;
DROP TABLE IF EXISTS secret_metadata CASCADE;
