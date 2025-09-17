#!/bin/bash

# Vector Database Migration Dev Test Script
# This script sets up a test environment and runs a migration to validate functionality

# Stop on error
set -e

# Default configuration
SOURCE_TABLE="rag_chunks"
TARGET_TABLE="rag_chunks_new"
DOCKER_COMPOSE_FILE="docker-compose.pgvector.yml"
MIGRATION_SCRIPT="./scripts/vector-db-migrations/migrate-vector-data.js"
INDEX_MIGRATION_SCRIPT="./scripts/vector-db-migrations/migrate-vector-index.ts"
SCHEMA_MIGRATION_SCRIPT="./scripts/vector-db-migrations/zero-downtime-schema-migration.cjs"
SAMPLE_DATA_SIZE=1000
TEST_NAME="vector-migration-test-$(date +%Y%m%d%H%M%S)"
DOCKER_NETWORK="${TEST_NAME}-network"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --source-table) SOURCE_TABLE="$2"; shift ;;
    --target-table) TARGET_TABLE="$2"; shift ;;
    --sample-size) SAMPLE_DATA_SIZE="$2"; shift ;;
    --docker-compose) DOCKER_COMPOSE_FILE="$2"; shift ;;
    --test-name) TEST_NAME="$2"; shift ;;
    --help) 
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --source-table SOURCE   Source table name (default: rag_chunks)"
      echo "  --target-table TARGET   Target table name (default: rag_chunks_new)"
      echo "  --sample-size SIZE      Number of sample vectors to create (default: 1000)"
      echo "  --docker-compose FILE   Docker compose file to use (default: docker-compose.pgvector.yml)"
      echo "  --test-name NAME        Test name for container naming (default: vector-migration-test-<timestamp>)"
      echo "  --help                  Show this help message"
      exit 0
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

echo "==============================================="
echo "Vector Database Migration Development Test"
echo "==============================================="
echo "Test name: $TEST_NAME"
echo "Source table: $SOURCE_TABLE"
echo "Target table: $TARGET_TABLE"
echo "Sample data size: $SAMPLE_DATA_SIZE"
echo "Docker compose file: $DOCKER_COMPOSE_FILE"
echo "==============================================="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting."; exit 1; }

echo "Starting test environment..."

# Create docker network for test
docker network create $DOCKER_NETWORK || true

# Start PostgreSQL with pgvector
export COMPOSE_PROJECT_NAME=$TEST_NAME
export POSTGRES_PASSWORD="testpassword"
export POSTGRES_USER="postgres"
export POSTGRES_DB="vectortest"

echo "Starting PostgreSQL with pgvector..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if docker exec ${TEST_NAME}-postgres pg_isready -U postgres &>/dev/null; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo -n "."
  sleep 1
  if [ $i -eq 30 ]; then
    echo "Error: PostgreSQL failed to start within 30 seconds"
    exit 1
  fi
done

# Install pgvector extension
echo "Installing pgvector extension..."
docker exec ${TEST_NAME}-postgres psql -U postgres -d vectortest -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Create test schema and tables
echo "Creating test schema and tables..."
docker exec ${TEST_NAME}-postgres psql -U postgres -d vectortest -c "
-- Create test tables
CREATE TABLE IF NOT EXISTS $SOURCE_TABLE (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata TEXT
);

-- Create index on document_id
CREATE INDEX IF NOT EXISTS idx_${SOURCE_TABLE}_document_id ON $SOURCE_TABLE(document_id);
"

# Create sample vector data
echo "Generating $SAMPLE_DATA_SIZE sample vectors..."
# Create a JS script to generate sample data
cat > /tmp/generate_vectors.js << EOF
const { Client } = require('pg');
const fs = require('fs');

// Generate random vector of specified dimension
function generateRandomVector(dimension) {
  const vector = [];
  for (let i = 0; i < dimension; i++) {
    vector.push((Math.random() * 2) - 1); // Values between -1 and 1
  }
  return vector;
}

// Normalize vector to unit length
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

// Main function
async function generateSampleData() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'vectortest',
    user: 'postgres',
    password: 'testpassword'
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Generate and insert data in batches
    const batchSize = 100;
    const totalRows = ${SAMPLE_DATA_SIZE};
    const dimension = 1536;
    
    console.log(\`Generating \${totalRows} sample vectors of dimension \${dimension}...\`);
    
    for (let i = 0; i < totalRows; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalRows - i);
      console.log(\`Generating batch \${i/batchSize + 1} of \${Math.ceil(totalRows/batchSize)} (\${i+1}-\${i+currentBatchSize})\`);
      
      // Prepare batch insert query
      const values = [];
      const placeholders = [];
      
      for (let j = 0; j < currentBatchSize; j++) {
        const docId = \`doc-\${i+j+1}\`;
        const content = \`Sample document \${i+j+1} for testing vector migrations\`;
        const vector = normalizeVector(generateRandomVector(dimension));
        const metadata = JSON.stringify({ 
          source: 'test-generator', 
          timestamp: new Date().toISOString(),
          test_group: Math.floor((i+j) / 100)
        });
        
        values.push(docId, content, vector, metadata);
        placeholders.push(\`($\${j*4+1}, $\${j*4+2}, $\${j*4+3}::vector, $\${j*4+4})\`);
      }
      
      const query = \`
        INSERT INTO ${SOURCE_TABLE} (document_id, content, embedding, metadata)
        VALUES \${placeholders.join(', ')}
      \`;
      
      await client.query(query, values);
    }
    
    // Verify data was inserted
    const countResult = await client.query('SELECT COUNT(*) FROM ${SOURCE_TABLE}');
    console.log(\`Successfully inserted \${countResult.rows[0].count} rows\`);
    
    // Create vector index
    console.log('Creating vector index...');
    await client.query(\`
      CREATE INDEX IF NOT EXISTS idx_${SOURCE_TABLE}_embedding 
      ON ${SOURCE_TABLE} USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)
    \`);
    
    console.log('Done!');
  } catch (err) {
    console.error('Error generating sample data:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

generateSampleData();
EOF

# Run the sample data generator
echo "Running sample data generator..."
node /tmp/generate_vectors.js

# Run schema migration test
echo "Testing schema migration..."
POSTGRES_HOST=localhost \
POSTGRES_DATABASE=vectortest \
POSTGRES_USER=postgres \
POSTGRES_PASSWORD=testpassword \
TABLE_NAME=$SOURCE_TABLE \
node $SCHEMA_MIGRATION_SCRIPT

# Run vector index migration test
echo "Testing vector index migration..."
npx ts-node $INDEX_MIGRATION_SCRIPT \
  --host=localhost \
  --database=vectortest \
  --user=postgres \
  --password=testpassword \
  --table-name=$SOURCE_TABLE \
  --column-name=embedding \
  --target-index-type=hnsw

# Run data migration test
echo "Testing vector data migration..."
node $MIGRATION_SCRIPT \
  --source-table=$SOURCE_TABLE \
  --target-table=$TARGET_TABLE \
  --batch-size=100 \
  --connection="postgresql://postgres:testpassword@localhost:5432/vectortest"

# Verify migration results
echo "Verifying migration results..."
docker exec ${TEST_NAME}-postgres psql -U postgres -d vectortest -c "
SELECT 
  (SELECT COUNT(*) FROM $SOURCE_TABLE) as source_count,
  (SELECT COUNT(*) FROM $TARGET_TABLE) as target_count,
  (SELECT COUNT(*) FROM $SOURCE_TABLE) = (SELECT COUNT(*) FROM $TARGET_TABLE) as counts_match;
"

# Test queries with both indexes
echo "Testing vector queries on both tables..."
cat > /tmp/test_queries.js << EOF
const { Client } = require('pg');

async function testQueries() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'vectortest',
    user: 'postgres',
    password: 'testpassword'
  });

  try {
    await client.connect();
    
    // Generate a test vector (normalized random vector)
    function generateTestVector(dimension) {
      const vector = [];
      for (let i = 0; i < dimension; i++) {
        vector.push((Math.random() * 2) - 1);
      }
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    }
    
    const testVector = generateTestVector(1536);
    
    // Test on source table with IVFFLAT
    console.log('Testing query on source table with IVFFLAT index...');
    console.time('source_query');
    const sourceResult = await client.query(\`
      SELECT id, document_id, 1 - (embedding <=> $1) AS similarity
      FROM ${SOURCE_TABLE}
      ORDER BY embedding <=> $1
      LIMIT 5
    \`, [testVector]);
    console.timeEnd('source_query');
    
    // Test on target table with HNSW
    console.log('Testing query on target table with HNSW index...');
    console.time('target_query');
    const targetResult = await client.query(\`
      SELECT id, document_id, 1 - (embedding <=> $1) AS similarity
      FROM ${TARGET_TABLE}
      ORDER BY embedding <=> $1
      LIMIT 5
    \`, [testVector]);
    console.timeEnd('target_query');
    
    // Compare results
    console.log('\\nSource table results:');
    for (const row of sourceResult.rows) {
      console.log(\`ID: \${row.id}, Document: \${row.document_id}, Similarity: \${row.similarity.toFixed(4)}\`);
    }
    
    console.log('\\nTarget table results:');
    for (const row of targetResult.rows) {
      console.log(\`ID: \${row.id}, Document: \${row.document_id}, Similarity: \${row.similarity.toFixed(4)}\`);
    }
    
    // Check if the same IDs are returned (might be in different order due to index differences)
    const sourceIds = new Set(sourceResult.rows.map(row => row.id));
    const targetIds = new Set(targetResult.rows.map(row => row.id));
    const intersection = [...sourceIds].filter(id => targetIds.has(id));
    
    console.log(\`\\nMatch rate: \${intersection.length}/5 results matched between indexes\`);
    
  } catch (err) {
    console.error('Error testing queries:', err);
  } finally {
    await client.end();
  }
}

testQueries();
EOF

# Run the query test
echo "Running vector query tests..."
node /tmp/test_queries.js

# Clean up
echo "Test completed. Clean up? (y/n)"
read -r cleanup

if [[ $cleanup == "y" ]]; then
  echo "Cleaning up test environment..."
  docker-compose -f $DOCKER_COMPOSE_FILE down
  docker network rm $DOCKER_NETWORK || true
  rm /tmp/generate_vectors.js
  rm /tmp/test_queries.js
  echo "Cleanup complete!"
else
  echo "Skipping cleanup. To clean up manually, run:"
  echo "docker-compose -f $DOCKER_COMPOSE_FILE down"
  echo "docker network rm $DOCKER_NETWORK"
fi

echo "==============================================="
echo "Vector Migration Test Complete!"
echo "==============================================="