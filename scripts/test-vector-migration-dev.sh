#!/bin/bash

# Test Vector Database Migration in Development Environment
# This script sets up a development PostgreSQL container with pgvector
# and runs a test migration to verify the functionality

set -e

# Configuration
POSTGRES_PORT=5499
POSTGRES_DB=vector_test_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
CONTAINER_NAME=pg-vector-migration-test
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up test PostgreSQL container with pgvector...${NC}"

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
echo -e "${YELLOW}Creating test table with vector data...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE EXTENSION IF NOT EXISTS vector;
  
  CREATE TABLE IF NOT EXISTS rag_chunks (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT
  );
  
  -- Create a vector index
  CREATE INDEX idx_rag_chunks_embedding ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
  
  -- Insert some test data (random vectors)
  INSERT INTO rag_chunks (document_id, content, embedding, metadata)
  SELECT 
    'doc-' || i, 
    'This is test content ' || i,
    (SELECT array_agg(random()) FROM generate_series(1, 1536)),
    '{\"source\": \"test\", \"page\": ' || (i % 10) || '}'
  FROM generate_series(1, 100) i;
"

echo -e "${GREEN}Test database setup complete.${NC}"
echo -e "${YELLOW}Running schema migration test...${NC}"

# Set environment variables for the migration script
export POSTGRES_HOST=localhost
export POSTGRES_PORT=$POSTGRES_PORT
export POSTGRES_DATABASE=$POSTGRES_DB
export POSTGRES_USER=$POSTGRES_USER
export POSTGRES_PASSWORD=$POSTGRES_PASSWORD
export TABLE_NAME=rag_chunks
export SCHEMA_NAME=public
export LOGGING=true

# Run the schema migration
node $SCRIPT_DIR/vector-db-migrations/zero-downtime-schema-migration.cjs

# Verify the migration
echo -e "${YELLOW}Verifying migration results...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  -- Check if the new columns exist
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'rag_chunks'
  ORDER BY ordinal_position;
  
  -- Check if the indexes exist
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE tablename = 'rag_chunks';
  
  -- Count rows
  SELECT COUNT(*) FROM rag_chunks;
"

echo -e "${YELLOW}Running vector index migration test...${NC}"

# Run the vector index migration
export COLUMN_NAME=embedding
export TARGET_INDEX_TYPE=hnsw

if [ -f "$SCRIPT_DIR/vector-db-migrations/migrate-vector-index.ts" ]; then
  # Run TypeScript file with ts-node if available
  if command -v ts-node &> /dev/null; then
    ts-node $SCRIPT_DIR/vector-db-migrations/migrate-vector-index.ts
  else
    echo -e "${RED}ts-node not found. Please install it with: npm install -g ts-node${NC}"
    echo -e "${YELLOW}Skipping vector index migration test${NC}"
  fi
else
  echo -e "${RED}migrate-vector-index.ts not found${NC}"
  echo -e "${YELLOW}Skipping vector index migration test${NC}"
fi

echo -e "${GREEN}All tests completed.${NC}"
echo -e "${YELLOW}Cleaning up...${NC}"

# Cleanup
docker rm -f $CONTAINER_NAME

echo -e "${GREEN}Test environment cleaned up.${NC}"