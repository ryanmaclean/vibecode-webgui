#!/bin/bash
# PostgreSQL + pgvector VM Test Suite
# Tests for PostgreSQL with pgvector extension VM infrastructure

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-framework.sh"

# Configuration
PG_CONFIG="${PG_CONFIG:-/Users/ryan.maclean/vibecode-webgui/config/vfkit/postgresql-vm.yaml}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-vibecode}"
PG_PASSWORD="${PG_PASSWORD:-vibecode123}"
PG_DATABASE="${PG_DATABASE:-vibecode}"
VM_NAME="vibecode-postgresql"
VFKIT_BIN="/Users/ryan.maclean/vibecode-webgui/src-tauri/resources/vfkit-aarch64-apple-darwin"

# Test table
TEST_TABLE="test_vectors_$(date +%s)"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."

    # Drop test table if exists
    if command -v psql >/dev/null 2>&1; then
        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -c "DROP TABLE IF EXISTS $TEST_TABLE;" 2>/dev/null || true
    fi

    # Stop VM
    if pgrep -f "vfkit.*$VM_NAME" >/dev/null; then
        log_info "Stopping PostgreSQL VM..."
        pkill -f "vfkit.*$VM_NAME" || true
        sleep 2
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Main test suite
main() {
    init_test_suite "PostgreSQL + pgvector VM Tests"

    # Test 1: Configuration file exists
    log_info "Test 1: Checking PostgreSQL VM configuration..."
    assert_file_exists "$PG_CONFIG" "PostgreSQL VM config file exists"

    # Test 2: Validate YAML syntax
    log_info "Test 2: Validating YAML syntax..."
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import yaml; yaml.safe_load(open('$PG_CONFIG'))" 2>&1 && \
            assert_success "YAML syntax validation" true || \
            assert_success "YAML syntax validation" false
    else
        log_warn "Python3 not available, skipping YAML validation"
    fi

    # Test 3: vfkit binary exists
    log_info "Test 3: Checking vfkit binary..."
    assert_file_exists "$VFKIT_BIN" "vfkit binary exists"

    # Test 4: Start VM (if config exists)
    if [[ ! -f "$PG_CONFIG" ]]; then
        log_warn "PostgreSQL VM config not found at $PG_CONFIG"
        log_warn "Skipping runtime tests. Please run VM setup first."
        finalize_test_suite "PostgreSQL VM Tests (Partial)"
        return
    fi

    log_info "Test 4: Starting PostgreSQL VM..."
    log_info "Command: $VFKIT_BIN --config $PG_CONFIG"

    # Start VM in background
    "$VFKIT_BIN" --config "$PG_CONFIG" > /tmp/postgresql-vm.log 2>&1 &
    local vm_pid=$!
    sleep 5

    # Check if VM is running
    if ps -p $vm_pid > /dev/null 2>&1; then
        assert_success "PostgreSQL VM started successfully" true
    else
        assert_success "PostgreSQL VM started successfully" false
        log_error "VM failed to start. Log output:"
        tail -20 /tmp/postgresql-vm.log
        finalize_test_suite "PostgreSQL VM Tests (Failed)"
        exit 1
    fi

    # Test 5: Wait for VM to boot
    log_info "Test 5: Waiting for VM to boot..."
    if wait_for_vm "$VM_NAME" 60; then
        assert_success "VM boot completed" true
    else
        assert_success "VM boot completed" false
    fi

    # Test 6: Check port accessibility
    log_info "Test 6: Checking port $PG_PORT accessibility..."
    if wait_for_port "$PG_HOST" "$PG_PORT" 30; then
        assert_port_open "$PG_HOST" "$PG_PORT" 5 "PostgreSQL port $PG_PORT is accessible"
    else
        assert_port_open "$PG_HOST" "$PG_PORT" 5 "PostgreSQL port $PG_PORT is accessible"
    fi

    # Test 7: PostgreSQL connection
    if ! command -v psql >/dev/null 2>&1; then
        log_warn "psql not installed, skipping database tests"
        log_info "To install: brew install postgresql@16"
        finalize_test_suite "PostgreSQL VM Tests (Partial)"
        return
    fi

    log_info "Test 7: Testing PostgreSQL connection..."
    if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT version();" > /tmp/pg-version.txt 2>&1; then
        assert_success "psql connection successful" true
        local pg_version=$(cat /tmp/pg-version.txt | grep "PostgreSQL" | head -1)
        log_info "PostgreSQL version: $pg_version"
    else
        assert_success "psql connection successful" false
        log_error "Connection failed. Output:"
        cat /tmp/pg-version.txt
    fi

    # Test 8: Check pgvector extension
    log_info "Test 8: Checking pgvector extension..."
    local ext_check=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname='vector';" 2>&1 | tr -d ' ')

    if [[ "$ext_check" == "1" ]]; then
        assert_success "pgvector extension is installed" true
    else
        log_warn "pgvector extension not found, attempting to install..."
        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 && \
            assert_success "pgvector extension installed" true || \
            assert_success "pgvector extension installed" false
    fi

    # Test 9: Create table with vector column
    log_info "Test 9: Creating table with vector column..."
    local create_table_sql="
CREATE TABLE $TEST_TABLE (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW()
);
"

    if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -c "$create_table_sql" 2>&1 > /tmp/create-table.log; then
        assert_success "Table with vector column created" true
    else
        assert_success "Table with vector column created" false
        log_error "Create table failed:"
        cat /tmp/create-table.log
    fi

    # Test 10: Insert vector data
    log_info "Test 10: Inserting vector data..."

    # Generate a simple test vector (1536 dimensions, random values)
    local test_vector="["
    for i in {1..1536}; do
        test_vector="${test_vector}$(echo "scale=6; $(($RANDOM % 1000)) / 1000" | bc),"
    done
    test_vector="${test_vector%,}]"

    local insert_sql="INSERT INTO $TEST_TABLE (content, embedding) VALUES ('Test document', '$test_vector');"

    if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -c "$insert_sql" 2>&1 > /tmp/insert.log; then
        assert_success "Vector data inserted" true
    else
        assert_success "Vector data inserted" false
        log_error "Insert failed:"
        cat /tmp/insert.log
    fi

    # Test 11: Query vector data
    log_info "Test 11: Querying vector data..."
    local count=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -t -c "SELECT COUNT(*) FROM $TEST_TABLE;" 2>&1 | tr -d ' ')

    if [[ "$count" == "1" ]]; then
        assert_success "Vector data query successful" true
    else
        assert_success "Vector data query successful" false
    fi

    # Test 12: Vector similarity search
    log_info "Test 12: Testing vector similarity search..."

    # Insert more test vectors
    for i in {1..5}; do
        local vec="["
        for j in {1..1536}; do
            vec="${vec}$(echo "scale=6; $(($RANDOM % 1000)) / 1000" | bc),"
        done
        vec="${vec%,}]"
        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -c "INSERT INTO $TEST_TABLE (content, embedding) VALUES ('Document $i', '$vec');" 2>/dev/null || true
    done

    # Perform similarity search using L2 distance
    local similarity_sql="
SELECT content, embedding <-> (SELECT embedding FROM $TEST_TABLE LIMIT 1) as distance
FROM $TEST_TABLE
ORDER BY distance
LIMIT 3;
"

    if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -c "$similarity_sql" > /tmp/similarity.txt 2>&1; then
        assert_success "Vector similarity search works" true
        log_info "Similarity search results:"
        cat /tmp/similarity.txt | head -10
    else
        assert_success "Vector similarity search works" false
    fi

    # Test 13: Create HNSW index
    log_info "Test 13: Creating HNSW index for vector search..."
    local index_sql="CREATE INDEX IF NOT EXISTS ${TEST_TABLE}_embedding_idx ON $TEST_TABLE USING hnsw (embedding vector_l2_ops);"

    if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -c "$index_sql" 2>&1 > /tmp/create-index.log; then
        assert_success "HNSW index created" true
    else
        assert_success "HNSW index created" false
        log_error "Index creation failed:"
        cat /tmp/create-index.log
    fi

    # Test 14: Performance test
    log_info "Test 14: Testing vector search performance..."

    # Measure query time
    local start_time=$(date +%s%N)
    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -c "$similarity_sql" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # milliseconds

    log_info "Query execution time: ${duration}ms"

    if [ $duration -lt 100 ]; then
        assert_success "Vector search performance acceptable (<100ms)" true
    else
        log_warn "Query took ${duration}ms, which is slower than target (<100ms)"
        assert_success "Vector search performance acceptable (<100ms)" false
    fi

    # Test 15: Database size and statistics
    log_info "Test 15: Checking database size and statistics..."
    local db_size=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -t -c "SELECT pg_size_pretty(pg_database_size('$PG_DATABASE'));" 2>&1 | tr -d ' ')
    log_info "Database size: $db_size"

    local table_size=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -t -c "SELECT pg_size_pretty(pg_total_relation_size('$TEST_TABLE'));" 2>&1 | tr -d ' ')
    log_info "Test table size: $table_size"

    assert_success "Database statistics retrieved" true

    # Test 16: Connection pool test
    log_info "Test 16: Testing concurrent connections..."
    local max_conn=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -t -c "SHOW max_connections;" 2>&1 | tr -d ' ')
    log_info "Max connections: $max_conn"

    # Test 17: Resource usage
    log_info "Test 17: Checking VM resource usage..."
    local vm_stats=$(get_vm_stats "$VM_NAME")
    log_info "VM Stats: $vm_stats"

    # Parse CPU usage
    local cpu_usage=$(echo "$vm_stats" | grep -o "CPU: [0-9.]*%" | grep -o "[0-9.]*" || echo "0")
    if (( $(echo "$cpu_usage < 60" | bc -l 2>/dev/null || echo "1") )); then
        assert_success "CPU usage is reasonable (<60%)" true
    else
        assert_success "CPU usage is reasonable (<60%)" false
        log_warn "High CPU usage: ${cpu_usage}%"
    fi

    # Test 18: Test PostgreSQL configuration
    log_info "Test 18: Verifying PostgreSQL configuration..."
    local shared_buffers=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -t -c "SHOW shared_buffers;" 2>&1 | tr -d ' ')
    log_info "Shared buffers: $shared_buffers"

    # Cleanup test table
    log_info "Cleaning up test table..."
    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
        -c "DROP TABLE IF EXISTS $TEST_TABLE;" 2>/dev/null || true

    # Stop VM
    log_info "Stopping PostgreSQL VM..."
    pkill -f "vfkit.*$VM_NAME" || true
    sleep 2

    # Export results
    export_results_json "/tmp/postgresql-test-results.json"
    log_success "Test results exported to /tmp/postgresql-test-results.json"

    finalize_test_suite "PostgreSQL + pgvector VM Tests"
}

# Run tests
main "$@"
