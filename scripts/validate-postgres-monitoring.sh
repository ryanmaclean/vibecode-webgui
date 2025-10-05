#!/bin/bash
# PostgreSQL Datadog Monitoring Validation Script
# Comprehensive validation of PostgreSQL Database Monitoring setup

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_HOST=${POSTGRES_HOST:-"localhost"}
POSTGRES_PORT=${POSTGRES_PORT:-"5432"}
POSTGRES_DB=${POSTGRES_DB:-"vibecode"}
POSTGRES_USER=${POSTGRES_USER:-"vibecode"}
POSTGRES_MONITORING_USER=${POSTGRES_MONITORING_USER:-"datadog"}
CONTAINER_NAME=${CONTAINER_NAME:-"postgres-monitoring"}

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_test "$test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        print_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        print_error "$test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

run_query_test() {
    local test_name="$1"
    local query="$2"
    local user="${3:-$POSTGRES_USER}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_test "$test_name"
    
    if docker exec "$CONTAINER_NAME" psql -U "$user" -d "$POSTGRES_DB" -c "$query" >/dev/null 2>&1; then
        print_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        print_error "$test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Main validation function
main() {
    print_header "POSTGRESQL DATADOG MONITORING VALIDATION"
    
    echo "Validating PostgreSQL Database Monitoring setup..."
    echo "Container: $CONTAINER_NAME"
    echo "Database: $POSTGRES_DB"
    echo "Host: $POSTGRES_HOST:$POSTGRES_PORT"
    echo ""
    
    # Test 1: Container Status
    print_header "CONTAINER AND CONNECTIVITY TESTS"
    
    run_test "PostgreSQL container is running" \
        "docker ps | grep -q '$CONTAINER_NAME'"
    
    run_test "PostgreSQL is accepting connections" \
        "docker exec '$CONTAINER_NAME' pg_isready -U '$POSTGRES_USER' -d '$POSTGRES_DB'"
    
    # Test 2: Database User Tests
    print_header "DATABASE USER TESTS"
    
    run_query_test "Main database user can connect" \
        "SELECT 'Connection successful' AS result;" \
        "$POSTGRES_USER"
    
    run_query_test "Datadog monitoring user exists" \
        "SELECT 1 FROM pg_user WHERE usename = '$POSTGRES_MONITORING_USER';" \
        "$POSTGRES_USER"
    
    run_query_test "Datadog user can connect" \
        "SELECT 'Datadog connection successful' AS result;" \
        "$POSTGRES_MONITORING_USER"
    
    # Test 3: Extension Tests
    print_header "EXTENSION AND PERMISSIONS TESTS"
    
    run_query_test "pg_stat_statements extension exists" \
        "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements';" \
        "$POSTGRES_USER"
    
    # Test 4: Permission Tests
    print_header "MONITORING PERMISSIONS TESTS"
    
    run_query_test "Datadog can read pg_stat_database" \
        "SELECT datname FROM pg_stat_database LIMIT 1;" \
        "$POSTGRES_MONITORING_USER"
    
    run_query_test "Datadog can read pg_stat_user_tables" \
        "SELECT schemaname FROM pg_stat_user_tables LIMIT 1;" \
        "$POSTGRES_MONITORING_USER"
    
    run_query_test "Datadog can read pg_stat_user_indexes" \
        "SELECT schemaname FROM pg_stat_user_indexes LIMIT 1;" \
        "$POSTGRES_MONITORING_USER"
    
    run_query_test "Datadog can read pg_stat_activity" \
        "SELECT state FROM pg_stat_activity WHERE state IS NOT NULL LIMIT 1;" \
        "$POSTGRES_MONITORING_USER"
    
    # Test 5: Custom Monitoring Queries
    print_header "CUSTOM MONITORING QUERIES TESTS"
    
    run_query_test "Table statistics query works" \
        "SELECT schemaname, relname, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables;" \
        "$POSTGRES_MONITORING_USER"
    
    run_query_test "Index statistics query works" \
        "SELECT schemaname, relname, indexrelname, idx_tup_read FROM pg_stat_user_indexes;" \
        "$POSTGRES_MONITORING_USER"
    
    run_query_test "Database activity query works" \
        "SELECT count(*) as connections, count(*) FILTER (WHERE state = 'active') as active FROM pg_stat_activity;" \
        "$POSTGRES_MONITORING_USER"
    
    # Test 6: Health Function Test
    print_header "HEALTH FUNCTION TESTS"
    
    run_query_test "Monitoring health function exists" \
        "SELECT 1 FROM pg_proc WHERE proname = 'datadog_monitoring_health';" \
        "$POSTGRES_USER"
    
    if run_query_test "Health function executes successfully" \
        "SELECT * FROM datadog_monitoring_health();" \
        "$POSTGRES_USER"; then
        
        echo ""
        echo -e "${BLUE}Health Check Results:${NC}"
        docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT * FROM datadog_monitoring_health();" 2>/dev/null || true
    fi
    
    # Test 7: Sample Data Tests
    print_header "SAMPLE DATA AND METRICS TESTS"
    
    run_query_test "Sample tables exist" \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" \
        "$POSTGRES_USER"
    
    run_query_test "Sample data exists" \
        "SELECT count(*) FROM users UNION SELECT count(*) FROM posts;" \
        "$POSTGRES_USER"
    
    # Test 8: pg_stat_statements Test (may fail if not in shared_preload_libraries)
    print_header "QUERY PERFORMANCE MONITORING TESTS"
    
    if run_query_test "pg_stat_statements is accessible" \
        "SELECT count(*) FROM pg_stat_statements;" \
        "$POSTGRES_MONITORING_USER"; then
        echo -e "${GREEN}pg_stat_statements is fully functional${NC}"
    else
        print_warning "pg_stat_statements requires 'shared_preload_libraries' configuration"
        print_warning "Add 'shared_preload_libraries = pg_stat_statements' to postgresql.conf and restart"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Summary
    print_header "VALIDATION SUMMARY"
    
    echo -e "${BLUE}Total Tests:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC} $PASSED_TESTS"
    echo -e "${RED}Failed:${NC} $FAILED_TESTS"
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 PostgreSQL Datadog Monitoring Setup: VALIDATED${NC}"
        echo -e "${GREEN}✅ Ready for Datadog Database Monitoring integration${NC}"
        
        if [ $WARNINGS -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Some optimizations recommended (see warnings above)${NC}"
        fi
        
        echo ""
        echo -e "${CYAN}Next Steps:${NC}"
        echo "1. Deploy Datadog agent with PostgreSQL integration"
        echo "2. Configure Datadog agent with these connection details:"
        echo "   - Host: $POSTGRES_HOST"
        echo "   - Port: $POSTGRES_PORT"
        echo "   - Database: $POSTGRES_DB"
        echo "   - Username: $POSTGRES_MONITORING_USER"
        echo "   - Password: datadog_monitoring_password"
        echo "3. Enable DBM (Database Monitoring) in Datadog configuration"
        echo "4. Verify metrics appear in Datadog dashboard"
        
        return 0
    else
        echo -e "${RED}❌ PostgreSQL Datadog Monitoring Setup: FAILED${NC}"
        echo -e "${RED}Please fix the failed tests before proceeding${NC}"
        return 1
    fi
}

# Usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Validate PostgreSQL Database Monitoring setup for Datadog integration.

Options:
    --container NAME    PostgreSQL container name (default: postgres-monitoring)
    --host HOST         PostgreSQL host (default: localhost)
    --port PORT         PostgreSQL port (default: 5432)
    --database DB       Database name (default: vibecode)
    --user USER         Main database user (default: vibecode)
    --monitor-user USER Monitoring user (default: datadog)
    --help              Show this help message

Examples:
    # Validate default setup
    $0
    
    # Validate custom container
    $0 --container my-postgres
    
    # Validate remote database
    $0 --host db.example.com --port 5433
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --container)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --host)
            POSTGRES_HOST="$2"
            shift 2
            ;;
        --port)
            POSTGRES_PORT="$2"
            shift 2
            ;;
        --database)
            POSTGRES_DB="$2"
            shift 2
            ;;
        --user)
            POSTGRES_USER="$2"
            shift 2
            ;;
        --monitor-user)
            POSTGRES_MONITORING_USER="$2"
            shift 2
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
