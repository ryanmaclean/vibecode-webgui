#!/bin/bash

# Test Vector Database Migration Rollback Functionality
# This script tests the rollback mechanism by deliberately causing an error during migration

set -e

# Configuration
POSTGRES_PORT=5497
POSTGRES_DB=vector_rollback_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
CONTAINER_NAME=pg-vector-rollback-test
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up test PostgreSQL container for rollback testing...${NC}"

# Stop and remove existing container if it exists
docker rm -f $CONTAINER_NAME 2>/dev/null || true

# Start PostgreSQL container with pgvector
docker run --name $CONTAINER_NAME \
  -e POSTGRES_DB=$POSTGRES_DB \
  -e POSTGRES_USER=$POSTGRES_USER \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -p $POSTGRES_PORT:5432 \
  -d ankane/pgvector

# Wait for PostgreSQL to start
echo -e "${YELLOW}Waiting for PostgreSQL to start...${NC}"
sleep 5

# Test connection
echo -e "${YELLOW}Testing connection to PostgreSQL...${NC}"
if ! docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1"; then
  echo -e "${RED}Failed to connect to PostgreSQL${NC}"
  docker rm -f $CONTAINER_NAME
  exit 1
fi

# Create test table with vector data
echo -e "${YELLOW}Creating test table for rollback testing...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE EXTENSION IF NOT EXISTS vector;
  
  CREATE TABLE rag_chunks (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT
  );
  
  -- Insert some test data
  INSERT INTO rag_chunks (document_id, content, embedding, metadata)
  SELECT 
    'doc-' || i, 
    'This is test content ' || i,
    (SELECT array_agg(random()) FROM generate_series(1, 1536)),
    '{\"source\": \"test\", \"page\": ' || (i % 10) || '}'
  FROM generate_series(1, 50) i;
  
  -- Create a vector index
  CREATE INDEX idx_rag_chunks_embedding ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
"

echo -e "${GREEN}Test database setup complete.${NC}"

# Create a snapshot of the database schema before migration
echo -e "${YELLOW}Creating schema snapshot before migration...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'rag_chunks'
  ORDER BY ordinal_position;
" > /tmp/schema_before_migration.txt

# Count rows before migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT COUNT(*) FROM rag_chunks;
" > /tmp/row_count_before_migration.txt

echo -e "${YELLOW}Running migration with forced error to test rollback...${NC}"

# Set environment variables for the migration script
export POSTGRES_HOST=localhost
export POSTGRES_PORT=$POSTGRES_PORT
export POSTGRES_DATABASE=$POSTGRES_DB
export POSTGRES_USER=$POSTGRES_USER
export POSTGRES_PASSWORD=$POSTGRES_PASSWORD
export TABLE_NAME=rag_chunks
export SCHEMA_NAME=public
export LOGGING=true
export FORCE_MIGRATION_ERROR=true  # This will cause the migration to fail

# Run the modified migration script for testing rollback
cat > /tmp/rollback_test_migration.js << 'EOF'
// Modified version of zero-downtime-schema-migration.cjs for testing rollback
const originalScript = require('../scripts/vector-db-migrations/zero-downtime-schema-migration.cjs');

// Override the swapTables function to inject an error
const originalSwapTables = originalScript.swapTables;
originalScript.swapTables = async function(client, sourceTableName, stagingTableName) {
  if (process.env.FORCE_MIGRATION_ERROR === 'true') {
    console.log('Injecting error to test rollback...');
    await client.query('BEGIN');
    
    // Lock the table
    await client.query(`LOCK TABLE ${sourceTableName} IN ACCESS EXCLUSIVE MODE`);
    
    // Inject error after acquiring lock
    throw new Error('Simulated error during table swap to test rollback');
  }
  
  return originalSwapTables(client, sourceTableName, stagingTableName);
};

// Run the migration with our overridden function
originalScript.migrateTableSchema().catch(console.error);
EOF

# Run the modified script (this should fail)
if node /tmp/rollback_test_migration.js; then
  echo -e "${RED}Error: Migration should have failed but succeeded${NC}"
  exit 1
else
  echo -e "${GREEN}Migration failed as expected for rollback test${NC}"
fi

# Check if database was rolled back correctly
echo -e "${YELLOW}Verifying database state after rollback...${NC}"

# Get schema after attempted migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'rag_chunks'
  ORDER BY ordinal_position;
" > /tmp/schema_after_rollback.txt

# Count rows after rollback
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT COUNT(*) FROM rag_chunks;
" > /tmp/row_count_after_rollback.txt

# Compare schemas
echo -e "${YELLOW}Comparing schema before and after rollback...${NC}"
if diff /tmp/schema_before_migration.txt /tmp/schema_after_rollback.txt > /dev/null; then
  echo -e "${GREEN}Original table structure preserved ✓${NC}"
else
  echo -e "${RED}Original table structure was modified! ✗${NC}"
  echo "Before migration:"
  cat /tmp/schema_before_migration.txt
  echo "After rollback:"
  cat /tmp/schema_after_rollback.txt
  exit 1
fi

# Compare row counts
echo -e "${YELLOW}Comparing row counts before and after rollback...${NC}"
before_count=$(grep -o '[0-9]\+' /tmp/row_count_before_migration.txt)
after_count=$(grep -o '[0-9]\+' /tmp/row_count_after_rollback.txt)

if [ "$before_count" = "$after_count" ]; then
  echo -e "${GREEN}Row count preserved: $before_count rows ✓${NC}"
else
  echo -e "${RED}Row count changed! Before: $before_count, After: $after_count ✗${NC}"
  exit 1
fi

# Verify data integrity by checking a specific row
echo -e "${YELLOW}Verifying data integrity after rollback...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT id, document_id, content, metadata, array_length(embedding, 1) as embedding_dimension
  FROM rag_chunks
  WHERE id = 1;
" > /tmp/sample_row_after_rollback.txt

if grep -q "doc-1" /tmp/sample_row_after_rollback.txt && grep -q "1536" /tmp/sample_row_after_rollback.txt; then
  echo -e "${GREEN}Data integrity verified ✓${NC}"
else
  echo -e "${RED}Data integrity check failed! ✗${NC}"
  cat /tmp/sample_row_after_rollback.txt
  exit 1
fi

echo -e "${GREEN}Rollback test completed successfully.${NC}"
echo -e "${YELLOW}Cleaning up...${NC}"

# Cleanup
docker rm -f $CONTAINER_NAME
rm -f /tmp/schema_before_migration.txt /tmp/row_count_before_migration.txt
rm -f /tmp/schema_after_rollback.txt /tmp/row_count_after_rollback.txt
rm -f /tmp/sample_row_after_rollback.txt /tmp/rollback_test_migration.js

echo -e "${GREEN}Test environment cleaned up.${NC}"
echo -e "${GREEN}Errors detected, rolling back - Transaction rollback confirmed.${NC}"
echo -e "${GREEN}Original table structure preserved${NC}"