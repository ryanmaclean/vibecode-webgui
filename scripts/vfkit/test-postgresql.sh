#!/usr/bin/env bash
# Test PostgreSQL VM - Comprehensive database connectivity and feature tests
# Tests: Connection, Queries, pgvector (if available), Performance

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PG_HOST="localhost"
PG_PORT="5432"
PG_USER="vibecode"
PG_PASSWORD="vibecode"
PG_DATABASE="vibecode"

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_error() { echo -e "${RED}[FAIL]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

test_passed=0
test_failed=0

run_test() {
    local test_name=$1
    shift
    echo -e "\n${BLUE}Test:${NC} $test_name"
    if "$@"; then
        log_success "$test_name"
        ((test_passed++))
        return 0
    else
        log_error "$test_name"
        ((test_failed++))
        return 1
    fi
}

# Check if psql is available
check_psql() {
    if ! command -v psql &>/dev/null; then
        log_error "psql not found"
        log_info "Install with: brew install postgresql"
        return 1
    fi
    return 0
}

# Execute SQL query
exec_sql() {
    PGPASSWORD="$PG_PASSWORD" psql \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DATABASE" \
        -t \
        -A \
        -c "$1" \
        2>/dev/null
}

# Test 1: Port connectivity
test_port_connectivity() {
    nc -z "$PG_HOST" "$PG_PORT" 2>/dev/null
}

# Test 2: Basic connection
test_connection() {
    PGPASSWORD="$PG_PASSWORD" psql \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DATABASE" \
        -c "SELECT 1" >/dev/null 2>&1
}

# Test 3: Database version
test_version() {
    local version
    version=$(exec_sql "SELECT version();")
    [[ -n "$version" ]]
}

# Test 4: Create table
test_create_table() {
    exec_sql "
        DROP TABLE IF EXISTS test_vibecode_table;
        CREATE TABLE test_vibecode_table (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW()
        );
    " >/dev/null
}

# Test 5: Insert data
test_insert_data() {
    exec_sql "
        INSERT INTO test_vibecode_table (name) VALUES
        ('Test 1'),
        ('Test 2'),
        ('Test 3');
    " >/dev/null
}

# Test 6: Query data
test_query_data() {
    local count
    count=$(exec_sql "SELECT COUNT(*) FROM test_vibecode_table;")
    [[ "$count" -eq 3 ]]
}

# Test 7: Update data
test_update_data() {
    exec_sql "UPDATE test_vibecode_table SET name = 'Updated' WHERE id = 1;" >/dev/null
    local name
    name=$(exec_sql "SELECT name FROM test_vibecode_table WHERE id = 1;")
    [[ "$name" == "Updated" ]]
}

# Test 8: Delete data
test_delete_data() {
    exec_sql "DELETE FROM test_vibecode_table WHERE id = 1;" >/dev/null
    local count
    count=$(exec_sql "SELECT COUNT(*) FROM test_vibecode_table;")
    [[ "$count" -eq 2 ]]
}

# Test 9: Transaction
test_transaction() {
    exec_sql "
        BEGIN;
        INSERT INTO test_vibecode_table (name) VALUES ('Transaction Test');
        ROLLBACK;
    " >/dev/null

    local count
    count=$(exec_sql "SELECT COUNT(*) FROM test_vibecode_table WHERE name = 'Transaction Test';")
    [[ "$count" -eq 0 ]]
}

# Test 10: JSON support
test_json_support() {
    exec_sql "
        CREATE TEMP TABLE test_json (
            id SERIAL PRIMARY KEY,
            data JSONB
        );
        INSERT INTO test_json (data) VALUES ('{\"key\": \"value\"}');
    " >/dev/null

    local value
    value=$(exec_sql "SELECT data->>'key' FROM test_json;")
    [[ "$value" == "value" ]]
}

# Test 11: Full-text search
test_fulltext_search() {
    exec_sql "
        CREATE TEMP TABLE test_fts (
            id SERIAL PRIMARY KEY,
            content TEXT,
            tsv TSVECTOR
        );
        INSERT INTO test_fts (content, tsv) VALUES
        ('VibeCode is awesome', to_tsvector('english', 'VibeCode is awesome'));
    " >/dev/null

    local count
    count=$(exec_sql "SELECT COUNT(*) FROM test_fts WHERE tsv @@ to_tsquery('english', 'awesome');")
    [[ "$count" -eq 1 ]]
}

# Test 12: pgvector extension (if available)
test_pgvector() {
    # Try to create extension (may not be available in Alpine)
    if exec_sql "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null; then
        # Test vector operations
        exec_sql "
            CREATE TEMP TABLE test_vectors (
                id SERIAL PRIMARY KEY,
                embedding vector(3)
            );
            INSERT INTO test_vectors (embedding) VALUES
            ('[1,2,3]'),
            ('[4,5,6]');
        " >/dev/null 2>&1 || return 1

        return 0
    else
        log_warn "pgvector extension not available (expected in Alpine)"
        return 0  # Don't fail if pgvector isn't available
    fi
}

# Test 13: Index performance
test_index() {
    exec_sql "
        DROP TABLE IF EXISTS test_index;
        CREATE TABLE test_index (
            id SERIAL PRIMARY KEY,
            value INTEGER
        );
        INSERT INTO test_index (value)
        SELECT generate_series(1, 1000);
        CREATE INDEX idx_test_value ON test_index(value);
    " >/dev/null

    local count
    count=$(exec_sql "SELECT COUNT(*) FROM test_index WHERE value > 500;")
    [[ "$count" -eq 500 ]]
}

# Cleanup
cleanup_tests() {
    exec_sql "DROP TABLE IF EXISTS test_vibecode_table;" >/dev/null 2>&1 || true
    exec_sql "DROP TABLE IF EXISTS test_index;" >/dev/null 2>&1 || true
}

# Show PostgreSQL info
show_postgres_info() {
    echo -e "\n${BLUE}=== PostgreSQL Server Information ===${NC}"

    echo -e "\n${YELLOW}Version:${NC}"
    exec_sql "SELECT version();" | head -1

    echo -e "\n${YELLOW}Database Size:${NC}"
    exec_sql "SELECT pg_size_pretty(pg_database_size('$PG_DATABASE'));" | tr -d ' '

    echo -e "\n${YELLOW}Active Connections:${NC}"
    exec_sql "SELECT count(*) FROM pg_stat_activity;"

    echo -e "\n${YELLOW}Tables:${NC}"
    exec_sql "
        SELECT schemaname, tablename,
               pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10;
    " | column -t -s '|' || true

    echo -e "\n${YELLOW}Extensions:${NC}"
    exec_sql "SELECT extname, extversion FROM pg_extension ORDER BY extname;" | column -t || true

    echo -e "\n${YELLOW}Cache Hit Ratio:${NC}"
    exec_sql "
        SELECT round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) AS cache_hit_ratio
        FROM pg_stat_database
        WHERE datname = '$PG_DATABASE';
    " || true
}

# Main test execution
main() {
    echo -e "${BLUE}TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW${NC}"
    echo -e "${BLUE}Q  PostgreSQL VM Comprehensive Tests    Q${NC}"
    echo -e "${BLUE}ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]${NC}"

    echo -e "\n${YELLOW}Configuration:${NC}"
    echo "  Host: $PG_HOST"
    echo "  Port: $PG_PORT"
    echo "  Database: $PG_DATABASE"
    echo "  User: $PG_USER"
    echo "  Password: [REDACTED]"

    # Check psql availability
    if ! check_psql; then
        exit 1
    fi

    # Run tests
    run_test "Port Connectivity" test_port_connectivity
    run_test "Basic Connection" test_connection
    run_test "Database Version" test_version
    run_test "Create Table" test_create_table
    run_test "Insert Data" test_insert_data
    run_test "Query Data" test_query_data
    run_test "Update Data" test_update_data
    run_test "Delete Data" test_delete_data
    run_test "Transaction Support" test_transaction
    run_test "JSON/JSONB Support" test_json_support
    run_test "Full-Text Search" test_fulltext_search
    run_test "pgvector Extension" test_pgvector
    run_test "Index Performance" test_index

    # Cleanup
    cleanup_tests

    # Show info
    show_postgres_info

    # Summary
    echo -e "\n${BLUE}=== Test Summary ===${NC}"
    echo -e "  ${GREEN}Passed:${NC} $test_passed"
    echo -e "  ${RED}Failed:${NC} $test_failed"
    echo -e "  ${YELLOW}Total:${NC} $((test_passed + test_failed))"

    if [[ $test_failed -eq 0 ]]; then
        echo -e "\n${GREEN} All tests passed! PostgreSQL is working correctly.${NC}"
        exit 0
    else
        echo -e "\n${RED} Some tests failed. Check the PostgreSQL VM logs.${NC}"
        exit 1
    fi
}

main "$@"
