#!/usr/bin/env bash
# Database Scaling Test Script
# This script tests the horizontal scaling capabilities of PostgreSQL with pgvector
# Author: Database Engineering Team

set -e

# Configuration
export PRIMARY_DB_HOST=${PRIMARY_DB_HOST:-"localhost"}
export PRIMARY_DB_PORT=${PRIMARY_DB_PORT:-5432}
export REPLICA_DB_HOST=${REPLICA_DB_HOST:-"localhost"}
export REPLICA_DB_PORT=${REPLICA_DB_PORT:-5433}
export DB_NAME=${DB_NAME:-"vibecode"}
export DB_USER=${DB_USER:-"postgres"}
export DB_PASSWORD=${DB_PASSWORD:-"postgres"}
export TEST_ITERATIONS=${TEST_ITERATIONS:-1000}
export VECTOR_DIMENSION=${VECTOR_DIMENSION:-1536}
export TEST_DATA_SIZE=${TEST_DATA_SIZE:-10000}
export CONCURRENT_CLIENTS=${CONCURRENT_CLIENTS:-10}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Database Scaling Test Script${NC}"
echo "==============================================="
echo "Testing PostgreSQL with pgvector horizontal scaling"
echo "Primary: $PRIMARY_DB_HOST:$PRIMARY_DB_PORT"
echo "Replica: $REPLICA_DB_HOST:$REPLICA_DB_PORT"
echo "Database: $DB_NAME"
echo "Test iterations: $TEST_ITERATIONS"
echo "Vector dimension: $VECTOR_DIMENSION"
echo "Test data size: $TEST_DATA_SIZE"
echo "Concurrent clients: $CONCURRENT_CLIENTS"
echo "==============================================="

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Check if pgbench is available
if ! command -v pgbench &> /dev/null; then
    echo -e "${RED}Error: pgbench command not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Function to check connection to database
check_connection() {
    local host=$1
    local port=$2
    local user=$3
    local db=$4
    
    echo -e "${YELLOW}Checking connection to $host:$port...${NC}"
    
    if PGPASSWORD=$DB_PASSWORD psql -h "$host" -p "$port" -U "$user" -d "$db" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}Connection successful to $host:$port${NC}"
        return 0
    else
        echo -e "${RED}Failed to connect to $host:$port${NC}"
        return 1
    fi
}

# Function to check if pgvector extension is installed
check_pgvector() {
    local host=$1
    local port=$2
    local user=$3
    local db=$4
    
    echo -e "${YELLOW}Checking pgvector extension on $host:$port...${NC}"
    
    if PGPASSWORD=$DB_PASSWORD psql -h "$host" -p "$port" -U "$user" -d "$db" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'" | grep -q "vector"; then
        echo -e "${GREEN}pgvector extension is installed on $host:$port${NC}"
        return 0
    else
        echo -e "${RED}pgvector extension is NOT installed on $host:$port${NC}"
        return 1
    fi
}

# Function to create test table
create_test_table() {
    local host=$1
    local port=$2
    local user=$3
    local db=$4
    
    echo -e "${YELLOW}Creating test table on $host:$port...${NC}"
    
    PGPASSWORD=$DB_PASSWORD psql -h "$host" -p "$port" -U "$user" -d "$db" <<EOF
    CREATE EXTENSION IF NOT EXISTS vector;
    
    DROP TABLE IF EXISTS scaling_test_vectors;
    
    CREATE TABLE scaling_test_vectors (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector($VECTOR_DIMENSION),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS scaling_test_vectors_embedding_idx ON scaling_test_vectors USING ivfflat (embedding vector_l2_ops);
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Test table created successfully on $host:$port${NC}"
        return 0
    else
        echo -e "${RED}Failed to create test table on $host:$port${NC}"
        return 1
    fi
}

# Function to generate random vector
generate_random_vector() {
    local dimension=$1
    local vector="["
    
    for ((i=0; i<dimension; i++)); do
        if [ $i -gt 0 ]; then
            vector+=","
        fi
        vector+=$(awk -v min=-1 -v max=1 'BEGIN{srand(); print min+rand()*(max-min)}')
    done
    
    vector+="]"
    echo "$vector"
}

# Function to insert test data
insert_test_data() {
    local host=$1
    local port=$2
    local user=$3
    local db=$4
    local count=$5
    
    echo -e "${YELLOW}Inserting $count test vectors on $host:$port...${NC}"
    
    for ((i=1; i<=count; i++)); do
        if [ $((i % 100)) -eq 0 ]; then
            echo -e "${YELLOW}Inserted $i/$count vectors${NC}"
        fi
        
        local vector=$(generate_random_vector $VECTOR_DIMENSION)
        local content="Test content $i for scaling test"
        local metadata="{\"test_id\": $i, \"source\": \"scaling_test\"}"
        
        PGPASSWORD=$DB_PASSWORD psql -h "$host" -p "$port" -U "$user" -d "$db" -c "INSERT INTO scaling_test_vectors (content, embedding, metadata) VALUES ('$content', '$vector', '$metadata');" > /dev/null
    done
    
    echo -e "${GREEN}Successfully inserted $count test vectors on $host:$port${NC}"
}

# Function to test read/write splitting
test_read_write_splitting() {
    local primary_host=$1
    local primary_port=$2
    local replica_host=$3
    local replica_port=$4
    local user=$5
    local db=$6
    
    echo -e "${YELLOW}Testing read/write splitting between primary and replica...${NC}"
    
    # Write to primary
    echo "Writing test data to primary..."
    local test_id=$RANDOM
    local vector=$(generate_random_vector $VECTOR_DIMENSION)
    local content="Read/write splitting test $test_id"
    
    PGPASSWORD=$DB_PASSWORD psql -h "$primary_host" -p "$primary_port" -U "$user" -d "$db" \
        -c "INSERT INTO scaling_test_vectors (content, embedding, metadata) VALUES ('$content', '$vector', '{\"test_id\": $test_id, \"test\": \"read_write_splitting\"}') RETURNING id;" > /dev/null
    
    # Wait for replication lag (simulated)
    echo "Waiting for replication lag..."
    sleep 5
    
    # Read from replica
    echo "Reading test data from replica..."
    local result=$(PGPASSWORD=$DB_PASSWORD psql -h "$replica_host" -p "$replica_port" -U "$user" -d "$db" \
        -c "SELECT COUNT(*) FROM scaling_test_vectors WHERE content = '$content';" -t | tr -d ' ')
    
    if [ "$result" -eq "1" ]; then
        echo -e "${GREEN}Read/write splitting test PASSED${NC}"
    else
        echo -e "${RED}Read/write splitting test FAILED${NC}"
        echo "Expected 1 record, found $result"
    fi
}

# Function to test vector search performance
test_vector_search() {
    local host=$1
    local port=$2
    local user=$3
    local db=$4
    local iterations=$5
    
    echo -e "${YELLOW}Testing vector search performance on $host:$port...${NC}"
    
    # Generate a random vector for search
    local search_vector=$(generate_random_vector $VECTOR_DIMENSION)
    local total_time=0
    
    for ((i=1; i<=iterations; i++)); do
        if [ $((i % 10)) -eq 0 ]; then
            echo -e "${YELLOW}Search $i/$iterations${NC}"
        fi
        
        local start_time=$(date +%s.%N)
        
        PGPASSWORD=$DB_PASSWORD psql -h "$host" -p "$port" -U "$user" -d "$db" \
            -c "SELECT id, content FROM scaling_test_vectors ORDER BY embedding <-> '$search_vector' LIMIT 5;" > /dev/null
        
        local end_time=$(date +%s.%N)
        local query_time=$(echo "$end_time - $start_time" | bc)
        total_time=$(echo "$total_time + $query_time" | bc)
    done
    
    local avg_time=$(echo "scale=4; $total_time / $iterations" | bc)
    echo -e "${GREEN}Vector search performance test completed on $host:$port${NC}"
    echo -e "Average search time: ${GREEN}$avg_time seconds${NC}"
    
    echo "$host:$port:$avg_time" >> search_performance.log
}

# Function to test connection pooling and load balancing
test_connection_pooling() {
    local host=$1
    local port=$2
    local user=$3
    local db=$4
    local concurrent=$5
    
    echo -e "${YELLOW}Testing connection pooling with $concurrent concurrent clients on $host:$port...${NC}"
    
    # Create a pgbench script for vector operations
    cat > pgbench_vector_script.sql <<EOF
\set vector_id random(1, $TEST_DATA_SIZE)
SELECT id, content FROM scaling_test_vectors WHERE id = :vector_id;
EOF
    
    # Run pgbench with custom script
    pgbench -h "$host" -p "$port" -U "$user" -d "$db" \
        -c "$concurrent" -j "$concurrent" -T 10 -f pgbench_vector_script.sql
    
    echo -e "${GREEN}Connection pooling test completed on $host:$port${NC}"
}

# Main testing sequence
echo -e "${GREEN}Starting database scaling tests...${NC}"

# Check connections
check_connection "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$DB_USER" "$DB_NAME"
check_connection "$REPLICA_DB_HOST" "$REPLICA_DB_PORT" "$DB_USER" "$DB_NAME"

# Check pgvector extension
check_pgvector "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$DB_USER" "$DB_NAME"
check_pgvector "$REPLICA_DB_HOST" "$REPLICA_DB_PORT" "$DB_USER" "$DB_NAME"

# Create test table on primary
create_test_table "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$DB_USER" "$DB_NAME"

# Insert test data
echo -e "${YELLOW}Generating and inserting test data...${NC}"
insert_test_data "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$DB_USER" "$DB_NAME" "$TEST_DATA_SIZE"

# Test read/write splitting
if [ "$PRIMARY_DB_HOST:$PRIMARY_DB_PORT" != "$REPLICA_DB_HOST:$REPLICA_DB_PORT" ]; then
    test_read_write_splitting "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$REPLICA_DB_HOST" "$REPLICA_DB_PORT" "$DB_USER" "$DB_NAME"
else
    echo -e "${YELLOW}Skipping read/write splitting test (primary and replica are the same)${NC}"
fi

# Test vector search performance on primary
test_vector_search "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$DB_USER" "$DB_NAME" "$TEST_ITERATIONS"

# Test vector search performance on replica
test_vector_search "$REPLICA_DB_HOST" "$REPLICA_DB_PORT" "$DB_USER" "$DB_NAME" "$TEST_ITERATIONS"

# Test connection pooling
test_connection_pooling "$PRIMARY_DB_HOST" "$PRIMARY_DB_PORT" "$DB_USER" "$DB_NAME" "$CONCURRENT_CLIENTS"

echo -e "${GREEN}Database scaling tests completed successfully!${NC}"
echo "Summary of results:"
echo "-------------------------------------------"
echo "Search performance results:"
cat search_performance.log
echo "-------------------------------------------"
echo "Check the logs for detailed information on each test."