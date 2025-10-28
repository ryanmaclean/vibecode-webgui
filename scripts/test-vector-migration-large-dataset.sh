#!/bin/bash

# Test Vector Database Migration with Large Dataset
# This script tests the migration utility with a large dataset to benchmark performance

set -e

# Configuration
POSTGRES_PORT=5498
POSTGRES_DB=vector_large_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
CONTAINER_NAME=pg-vector-large-test
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VECTOR_DIMENSION=1536
DATASET_SIZE=10000  # Number of rows with vector embeddings

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up test PostgreSQL container with pgvector for large dataset test...${NC}"

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
echo -e "${YELLOW}Creating test table with large vector dataset...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE EXTENSION IF NOT EXISTS vector;
  
  -- Enable timing to measure performance
  \\timing
  
  -- Create the test table
  CREATE TABLE rag_chunks (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector($VECTOR_DIMENSION),
    metadata TEXT
  );
  
  -- Generate a function to create random vectors
  CREATE OR REPLACE FUNCTION random_vector(dim INTEGER) RETURNS vector AS \$\$
  DECLARE
    result vector;
  BEGIN
    -- Create a vector with random values
    SELECT array_agg(random()) INTO result FROM generate_series(1, dim);
    RETURN result;
  END;
  \$\$ LANGUAGE plpgsql;
  
  -- Insert large dataset in batches to avoid memory issues
  DO \$\$
  DECLARE
    batch_size INTEGER := 1000;
    total_rows INTEGER := $DATASET_SIZE;
    i INTEGER;
  BEGIN
    FOR i IN 0..(total_rows/batch_size - 1) LOOP
      RAISE NOTICE 'Inserting batch %', i;
      INSERT INTO rag_chunks (document_id, content, embedding, metadata)
      SELECT 
        'doc-' || (i * batch_size + j), 
        'This is test content for document ' || (i * batch_size + j),
        random_vector($VECTOR_DIMENSION),
        '{\"source\": \"test\", \"page\": ' || ((i * batch_size + j) % 100) || ', \"category\": \"' || 
          CASE ((i * batch_size + j) % 5) 
            WHEN 0 THEN 'finance' 
            WHEN 1 THEN 'technology' 
            WHEN 2 THEN 'healthcare' 
            WHEN 3 THEN 'education' 
            ELSE 'general' 
          END || '\"}'
      FROM generate_series(1, batch_size) j;
      COMMIT;
    END LOOP;
  END;
  \$\$;
  
  -- Create an index on the vector column
  CREATE INDEX idx_rag_chunks_embedding ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
  
  -- Analyze to update statistics
  ANALYZE rag_chunks;
  
  -- Show table size
  SELECT pg_size_pretty(pg_total_relation_size('rag_chunks')) as table_size;
  
  -- Count rows
  SELECT COUNT(*) FROM rag_chunks;
"

echo -e "${GREEN}Large test dataset setup complete.${NC}"
echo -e "${YELLOW}Running schema migration test with large dataset...${NC}"

# Set environment variables for the migration script
export POSTGRES_HOST=localhost
export POSTGRES_PORT=$POSTGRES_PORT
export POSTGRES_DATABASE=$POSTGRES_DB
export POSTGRES_USER=$POSTGRES_USER
export POSTGRES_PASSWORD=$POSTGRES_PASSWORD
export TABLE_NAME=rag_chunks
export SCHEMA_NAME=public
export LOGGING=true

# Measure migration time
start_time=$(date +%s.%N)

# Run the schema migration
node $SCRIPT_DIR/vector-db-migrations/zero-downtime-schema-migration.cjs

# Calculate elapsed time
end_time=$(date +%s.%N)
elapsed=$(echo "$end_time - $start_time" | bc)
elapsed_rounded=$(printf "%.2f" $elapsed)

echo -e "${GREEN}Migration completed in $elapsed_rounded seconds${NC}"

# Verify the migration
echo -e "${YELLOW}Verifying migration results for large dataset...${NC}"
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  -- Enable timing
  \\timing
  
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
  
  -- Show table size after migration
  SELECT pg_size_pretty(pg_total_relation_size('rag_chunks')) as table_size;
  
  -- Test a simple vector query
  SELECT id, document_id, similarity(embedding, (
    SELECT embedding FROM rag_chunks WHERE id = 1
  )) as similarity
  FROM rag_chunks
  ORDER BY similarity DESC
  LIMIT 5;
"

echo -e "${YELLOW}Running vector index migration test with large dataset...${NC}"

# Run the vector index migration (if we have a TypeScript environment)
if command -v ts-node &> /dev/null; then
  export COLUMN_NAME=embedding
  export TARGET_INDEX_TYPE=hnsw
  
  # Measure index migration time
  index_start_time=$(date +%s.%N)
  
  ts-node $SCRIPT_DIR/vector-db-migrations/migrate-vector-index.ts
  
  # Calculate elapsed time
  index_end_time=$(date +%s.%N)
  index_elapsed=$(echo "$index_end_time - $index_start_time" | bc)
  index_elapsed_rounded=$(printf "%.2f" $index_elapsed)
  
  echo -e "${GREEN}Index migration completed in $index_elapsed_rounded seconds${NC}"
  
  # Test the new index
  echo -e "${YELLOW}Testing vector search with new index...${NC}"
  docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
    -- Enable timing
    \\timing
    
    -- Test a vector search with the new index
    EXPLAIN ANALYZE
    SELECT id, document_id, similarity(embedding, (
      SELECT embedding FROM rag_chunks WHERE id = 100
    )) as similarity
    FROM rag_chunks
    ORDER BY similarity DESC
    LIMIT 10;
  "
else
  echo -e "${RED}ts-node not found, skipping vector index migration test${NC}"
fi

echo -e "${GREEN}All large dataset tests completed.${NC}"
echo -e "${YELLOW}Total migration time: $elapsed_rounded seconds${NC}"

if command -v ts-node &> /dev/null; then
  echo -e "${YELLOW}Index migration time: $index_elapsed_rounded seconds${NC}"
fi

echo -e "${YELLOW}Cleaning up...${NC}"

# Cleanup
docker rm -f $CONTAINER_NAME

echo -e "${GREEN}Test environment cleaned up.${NC}"