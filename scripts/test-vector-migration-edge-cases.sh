#!/bin/bash

# Test Vector Database Migration Edge Cases
# This script tests edge cases like partial migrations and unusual schema scenarios

set -e

# Configuration
POSTGRES_PORT=5496
POSTGRES_DB=vector_edge_cases_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
CONTAINER_NAME=pg-vector-edge-cases
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up test PostgreSQL container for edge case testing...${NC}"

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

# =========================================================
# Test Case 1: Empty Table
# =========================================================
echo -e "${YELLOW}Test Case 1: Migration with empty table${NC}"

# Create empty table
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE EXTENSION IF NOT EXISTS vector;
  
  CREATE TABLE empty_table (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT
  );
  
  -- No data inserted
"

# Set environment variables for the migration script
export POSTGRES_HOST=localhost
export POSTGRES_PORT=$POSTGRES_PORT
export POSTGRES_DATABASE=$POSTGRES_DB
export POSTGRES_USER=$POSTGRES_USER
export POSTGRES_PASSWORD=$POSTGRES_PASSWORD
export TABLE_NAME=empty_table
export SCHEMA_NAME=public
export LOGGING=true

# Run the schema migration
echo -e "${YELLOW}Running migration on empty table...${NC}"
node $SCRIPT_DIR/vector-db-migrations/zero-downtime-schema-migration.cjs

# Verify the migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'empty_table'
  ORDER BY ordinal_position;
"

echo -e "${GREEN}Empty table migration completed.${NC}"

# =========================================================
# Test Case 2: Table with NULL Values
# =========================================================
echo -e "${YELLOW}Test Case 2: Migration with NULL values${NC}"

# Create table with NULL values
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE TABLE null_values_table (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT
  );
  
  -- Insert rows with NULL values
  INSERT INTO null_values_table (document_id, content, embedding, metadata)
  VALUES 
    ('doc-1', 'Content 1', (SELECT array_agg(random()) FROM generate_series(1, 1536)), NULL),
    ('doc-2', 'Content 2', NULL, '{\"source\": \"test\"}'),
    ('doc-3', 'Content 3', NULL, NULL);
"

# Set environment variables for the migration script
export TABLE_NAME=null_values_table

# Run the schema migration
echo -e "${YELLOW}Running migration on table with NULL values...${NC}"
node $SCRIPT_DIR/vector-db-migrations/zero-downtime-schema-migration.cjs

# Verify the migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT id, document_id, content, 
         (embedding IS NULL) as has_null_embedding,
         legacy_metadata, 
         metadata_json
  FROM null_values_table
  ORDER BY id;
"

echo -e "${GREEN}NULL values migration completed.${NC}"

# =========================================================
# Test Case 3: Table with unusual column names
# =========================================================
echo -e "${YELLOW}Test Case 3: Migration with unusual column names${NC}"

# Create table with unusual column names (spaces, case sensitivity, special chars)
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE TABLE \"Unusual_Column_Names\" (
    id SERIAL PRIMARY KEY,
    \"Document ID\" VARCHAR(255) NOT NULL,
    \"Content-Data\" TEXT NOT NULL,
    \"embedding_vector\" vector(1536),
    \"Meta Data\" TEXT
  );
  
  -- Insert a few rows
  INSERT INTO \"Unusual_Column_Names\" (\"Document ID\", \"Content-Data\", \"embedding_vector\", \"Meta Data\")
  VALUES 
    ('doc-1', 'Content 1', (SELECT array_agg(random()) FROM generate_series(1, 1536)), '{\"source\": \"test\"}');
"

# Set environment variables for the migration script
export TABLE_NAME=Unusual_Column_Names
export COLUMN_MAPPINGS='{"Document ID":"document_id","Content-Data":"content","embedding_vector":"embedding","Meta Data":"metadata"}'

# Create a custom migration script for this case
cat > /tmp/unusual_columns_migration.js << 'EOF'
// Modified version of zero-downtime-schema-migration.cjs for unusual column names
const originalScript = require('../scripts/vector-db-migrations/zero-downtime-schema-migration.cjs');

// Override the schemaMigration object to handle unusual column names
originalScript.schemaMigration = {
  // Columns to add
  addColumns: [
    { name: 'metadata_json', type: 'JSONB', nullable: true },
    { name: 'last_accessed_at', type: 'TIMESTAMP WITH TIME ZONE', nullable: true, default: null },
    { name: 'embedding_model', type: 'VARCHAR(100)', nullable: true }
  ],
  
  // Columns to rename
  renameColumns: [
    { from: '"Meta Data"', to: 'legacy_metadata' }
  ],
  
  // Columns to modify
  modifyColumns: [
    { name: '"Content-Data"', type: 'TEXT', nullable: false }
  ],
  
  // Columns to drop
  dropColumns: [],
  
  // Indexes to create
  createIndexes: [
    { name: 'idx_unusual_last_accessed', columns: ['last_accessed_at'] },
    { name: 'idx_unusual_embedding_model', columns: ['embedding_model'] }
  ]
};

// Run the migration with our customized schema
originalScript.migrateTableSchema().catch(console.error);
EOF

# Run the schema migration
echo -e "${YELLOW}Running migration on table with unusual column names...${NC}"
node /tmp/unusual_columns_migration.js

# Verify the migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'Unusual_Column_Names'
  ORDER BY ordinal_position;
  
  SELECT * FROM \"Unusual_Column_Names\";
"

echo -e "${GREEN}Unusual column names migration completed.${NC}"

# =========================================================
# Test Case 4: Partial migration scenario
# =========================================================
echo -e "${YELLOW}Test Case 4: Partial migration scenario${NC}"

# Create a table for partial migration testing
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE TABLE partial_migration (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT,
    -- Already has one of the columns we want to add
    metadata_json JSONB
  );
  
  -- Insert some test data
  INSERT INTO partial_migration (document_id, content, embedding, metadata, metadata_json)
  VALUES 
    ('doc-1', 'Content 1', (SELECT array_agg(random()) FROM generate_series(1, 1536)), '{\"source\": \"test\"}', '{\"source\": \"test\", \"processed\": true}'::jsonb);
"

# Set environment variables for the migration script
export TABLE_NAME=partial_migration

# Create a custom migration script for partial migration
cat > /tmp/partial_migration.js << 'EOF'
// Modified version for partial migration
const originalScript = require('../scripts/vector-db-migrations/zero-downtime-schema-migration.cjs');

// Override the schemaMigration object to handle partial migration
originalScript.schemaMigration = {
  // Only add the columns that don't exist yet
  addColumns: [
    { name: 'last_accessed_at', type: 'TIMESTAMP WITH TIME ZONE', nullable: true, default: null },
    { name: 'embedding_model', type: 'VARCHAR(100)', nullable: true }
  ],
  
  // Still rename metadata
  renameColumns: [
    { from: 'metadata', to: 'legacy_metadata' }
  ],
  
  // No modifications
  modifyColumns: [],
  
  // No drops
  dropColumns: [],
  
  // Create indexes
  createIndexes: [
    { name: 'idx_partial_last_accessed', columns: ['last_accessed_at'] },
    { name: 'idx_partial_embedding_model', columns: ['embedding_model'] }
  ]
};

// Run the migration with our customized schema
originalScript.migrateTableSchema().catch(console.error);
EOF

# Run the schema migration
echo -e "${YELLOW}Running partial migration...${NC}"
node /tmp/partial_migration.js

# Verify the migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'partial_migration'
  ORDER BY ordinal_position;
  
  -- Make sure existing data in metadata_json is preserved
  SELECT id, document_id, legacy_metadata, metadata_json
  FROM partial_migration;
"

echo -e "${GREEN}Partial migration completed.${NC}"

# =========================================================
# Test Case 5: Interrupted migration recovery
# =========================================================
echo -e "${YELLOW}Test Case 5: Interrupted migration recovery${NC}"

# Create a table for interrupted migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  CREATE TABLE interrupted_migration (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT
  );
  
  -- Insert some test data
  INSERT INTO interrupted_migration (document_id, content, embedding, metadata)
  VALUES 
    ('doc-1', 'Content 1', (SELECT array_agg(random()) FROM generate_series(1, 1536)), '{\"source\": \"test\"}');
  
  -- Create a staging table that looks like it was left from a previous failed migration
  CREATE TABLE interrupted_migration_staging (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    legacy_metadata TEXT,
    metadata_json JSONB,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    embedding_model VARCHAR(100)
  );
"

# Set environment variables for the migration script
export TABLE_NAME=interrupted_migration

# Create a custom migration script for interrupted migration
cat > /tmp/interrupted_migration.js << 'EOF'
// Modified version for interrupted migration
const originalScript = require('../scripts/vector-db-migrations/zero-downtime-schema-migration.cjs');

// Override the migrateTableSchema function to handle existing staging table
const originalMigrateTableSchema = originalScript.migrateTableSchema;

originalScript.migrateTableSchema = async function() {
  console.log('🔄 Starting migration recovery...');
  
  // Get the full table names
  const sourceTableName = originalScript.getFullTableName();
  const stagingTableName = `${sourceTableName}_staging`;
  
  // Get database client
  const client = await originalScript.getClient();
  
  try {
    // Connect to the database
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Check if staging table exists
    const checkStagingResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      ) as exists
    `, [stagingTableName.split('.')[1]]);
    
    const stagingTableExists = checkStagingResult.rows[0].exists;
    
    if (stagingTableExists) {
      console.log(`Found existing staging table ${stagingTableName}, continuing migration...`);
      
      // Skip table creation and data copying, go straight to swapping
      console.log('Recovering migration by swapping tables...');
      
      // Analyze the staging table first
      await client.query(`ANALYZE ${stagingTableName}`);
      
      // Swap tables
      const backupTableName = await originalScript.swapTables(client, sourceTableName, stagingTableName);
      
      // Validate the migration
      await originalScript.validateMigration(client, sourceTableName);
      
      console.log(`\n✅ Migration recovery completed successfully!`);
      console.log(`\nBackup table created: ${backupTableName}`);
    } else {
      // No existing staging table, proceed with normal migration
      return originalMigrateTableSchema();
    }
  } catch (error) {
    console.error('❌ Migration recovery failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
    console.log('✅ Database connection closed');
  }
};

// Run the migration with our recovery logic
originalScript.migrateTableSchema().catch(console.error);
EOF

# Run the schema migration
echo -e "${YELLOW}Running interrupted migration recovery...${NC}"
node /tmp/interrupted_migration.js

# Verify the migration
docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'interrupted_migration'
  ORDER BY ordinal_position;
  
  -- Check that we didn't lose the data
  SELECT id, document_id, content
  FROM interrupted_migration;
"

echo -e "${GREEN}Interrupted migration recovery completed.${NC}"

# =========================================================
# Final summary
# =========================================================
echo -e "${GREEN}All edge case tests completed successfully.${NC}"
echo -e "${YELLOW}Cleaning up...${NC}"

# Cleanup
docker rm -f $CONTAINER_NAME
rm -f /tmp/unusual_columns_migration.js /tmp/partial_migration.js /tmp/interrupted_migration.js

echo -e "${GREEN}Test environment cleaned up.${NC}"