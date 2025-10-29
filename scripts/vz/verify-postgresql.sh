#!/bin/bash
#
# Verification script for PostgreSQL VM
# Run this after the VM has started to verify PostgreSQL and pgvector
#

set -euo pipefail

echo "========================================================"
echo "PostgreSQL VM Verification"
echo "========================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# PostgreSQL connection details
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-vibecode}"
PG_DB="${PG_DB:-vibecode}"

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Check if port is listening
print_status "Test 1: Checking if PostgreSQL port is listening..."
if nc -zv "$PG_HOST" "$PG_PORT" 2>&1 | grep -q succeeded; then
    print_success "Port $PG_PORT is listening"
    ((TESTS_PASSED++))
else
    print_error "Port $PG_PORT is not listening"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Check PostgreSQL version
print_status "Test 2: Checking PostgreSQL version..."
if PG_VERSION=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT version();" 2>/dev/null); then
    echo "$PG_VERSION" | grep -o "PostgreSQL [0-9.]*" || true
    print_success "PostgreSQL is running"
    ((TESTS_PASSED++))
else
    print_error "Could not connect to PostgreSQL"
    print_warning "Make sure PGPASSWORD is set or use .pgpass file"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Check pgvector extension
print_status "Test 3: Checking pgvector extension..."
if PGVECTOR_VERSION=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';" 2>/dev/null); then
    if [ -n "$PGVECTOR_VERSION" ]; then
        PGVECTOR_VERSION=$(echo "$PGVECTOR_VERSION" | xargs)
        print_success "pgvector extension version: $PGVECTOR_VERSION"
        ((TESTS_PASSED++))
    else
        print_error "pgvector extension not found"
        ((TESTS_FAILED++))
    fi
else
    print_error "Could not check pgvector extension"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Test vector operations
print_status "Test 4: Testing vector operations..."
if psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "
    CREATE TEMP TABLE vector_test (id serial PRIMARY KEY, embedding vector(3));
    INSERT INTO vector_test (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
    SELECT embedding <-> '[3,1,2]' AS distance FROM vector_test;
    DROP TABLE vector_test;
" >/dev/null 2>&1; then
    print_success "Vector operations work correctly"
    ((TESTS_PASSED++))
else
    print_error "Vector operations failed"
    ((TESTS_FAILED++))
fi
echo ""

# Test 5: Check database size
print_status "Test 5: Checking database size..."
if DB_SIZE=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT pg_size_pretty(pg_database_size('$PG_DB'));" 2>/dev/null); then
    DB_SIZE=$(echo "$DB_SIZE" | xargs)
    print_success "Database size: $DB_SIZE"
    ((TESTS_PASSED++))
else
    print_error "Could not check database size"
    ((TESTS_FAILED++))
fi
echo ""

# Test 6: Check available extensions
print_status "Test 6: Listing installed extensions..."
if EXTENSIONS=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT extname || ' (' || extversion || ')' FROM pg_extension ORDER BY extname;" 2>/dev/null); then
    echo "$EXTENSIONS" | while read -r ext; do
        if [ -n "$ext" ]; then
            echo "           - $(echo "$ext" | xargs)"
        fi
    done
    print_success "Extensions listed successfully"
    ((TESTS_PASSED++))
else
    print_error "Could not list extensions"
    ((TESTS_FAILED++))
fi
echo ""

# Test 7: Check active connections
print_status "Test 7: Checking active connections..."
if CONNECTIONS=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null); then
    CONNECTIONS=$(echo "$CONNECTIONS" | xargs)
    print_success "Active connections: $CONNECTIONS"
    ((TESTS_PASSED++))
else
    print_error "Could not check connections"
    ((TESTS_FAILED++))
fi
echo ""

# Summary
echo "========================================================"
echo "Test Results Summary"
echo "========================================================"
echo ""
print_success "Tests passed: $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
    print_error "Tests failed: $TESTS_FAILED"
else
    print_success "Tests failed: $TESTS_FAILED"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    print_success "All tests passed! PostgreSQL VM is working correctly."
    echo ""
    echo "You can now connect to PostgreSQL:"
    echo "  psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB"
    echo ""
    exit 0
else
    print_error "Some tests failed. Please check the PostgreSQL VM logs."
    echo ""
    exit 1
fi
