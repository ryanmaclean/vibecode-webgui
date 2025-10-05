#!/bin/bash

# =====================================================
# Datadog Database Monitoring Recommendations Generator
# =====================================================
# This script runs all the DBM recommendation scenarios
# to trigger various Datadog DBM recommendations.
# =====================================================

set -e

# Configuration
DB_NAME="${DB_NAME:-vibecode}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if psql is available
check_psql() {
    if ! command -v psql &> /dev/null; then
        print_error "psql is not installed or not in PATH"
        exit 1
    fi
}

# Function to check database connection
check_connection() {
    print_status "Checking database connection..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        print_error "Cannot connect to database. Please check your connection parameters."
        print_error "Host: $DB_HOST, Port: $DB_PORT, User: $DB_USER, Database: $DB_NAME"
        exit 1
    fi
    print_success "Database connection successful"
}

# Function to run a scenario
run_scenario() {
    local scenario_file="$1"
    local scenario_name="$2"
    
    if [ ! -f "$scenario_file" ]; then
        print_error "Scenario file not found: $scenario_file"
        return 1
    fi
    
    print_status "Running scenario: $scenario_name"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$scenario_file"; then
        print_success "Completed scenario: $scenario_name"
    else
        print_error "Failed to run scenario: $scenario_name"
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [SCENARIO]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -d, --database      Database name (default: vibecode)"
    echo "  -H, --host          Database host (default: localhost)"
    echo "  -p, --port          Database port (default: 5432)"
    echo "  -U, --user          Database user (default: postgres)"
    echo "  -a, --all           Run all scenarios"
    echo "  -l, --list          List available scenarios"
    echo ""
    echo "Scenarios:"
    echo "  function-in-filter  Function in Filter recommendations"
    echo "  high-impact-blocker High Impact Blocker recommendations"
    echo "  high-row-count      High Row Count recommendations"
    echo "  long-running-query Long Running Query recommendations"
    echo "  missing-index       Missing Index recommendations"
    echo "  query-load-increase Query Load Increase recommendations"
    echo "  unused-index        Unused Index recommendations"
    echo ""
    echo "Examples:"
    echo "  $0 --all                    # Run all scenarios"
    echo "  $0 function-in-filter       # Run specific scenario"
    echo "  $0 -d mydb -H db.example.com # Use custom database settings"
}

# Function to list available scenarios
list_scenarios() {
    echo "Available scenarios:"
    echo "  1. function-in-filter  - Function in Filter recommendations"
    echo "  2. high-impact-blocker - High Impact Blocker recommendations"
    echo "  3. high-row-count      - High Row Count recommendations"
    echo "  4. long-running-query  - Long Running Query recommendations"
    echo "  5. missing-index       - Missing Index recommendations"
    echo "  6. query-load-increase - Query Load Increase recommendations"
    echo "  7. unused-index        - Unused Index recommendations"
}

# Function to run all scenarios
run_all_scenarios() {
    print_status "Running all DBM recommendation scenarios..."
    
    local scenarios=(
        "01-function-in-filter.sql:Function in Filter"
        "02-high-impact-blocker.sql:High Impact Blocker"
        "03-high-row-count.sql:High Row Count"
        "04-long-running-query.sql:Long Running Query"
        "05-missing-index.sql:Missing Index"
        "06-query-load-increase.sql:Query Load Increase"
        "07-unused-index.sql:Unused Index"
    )
    
    local failed_scenarios=()
    
    for scenario in "${scenarios[@]}"; do
        IFS=':' read -r file name <<< "$scenario"
        if ! run_scenario "scripts/dbm-scenarios/$file" "$name"; then
            failed_scenarios+=("$name")
        fi
        echo ""
    done
    
    if [ ${#failed_scenarios[@]} -eq 0 ]; then
        print_success "All scenarios completed successfully!"
    else
        print_warning "Some scenarios failed:"
        for scenario in "${failed_scenarios[@]}"; do
            print_warning "  - $scenario"
        done
    fi
}

# Function to run specific scenario
run_specific_scenario() {
    local scenario="$1"
    local scenario_file=""
    local scenario_name=""
    
    case "$scenario" in
        "function-in-filter")
            scenario_file="scripts/dbm-scenarios/01-function-in-filter.sql"
            scenario_name="Function in Filter"
            ;;
        "high-impact-blocker")
            scenario_file="scripts/dbm-scenarios/02-high-impact-blocker.sql"
            scenario_name="High Impact Blocker"
            ;;
        "high-row-count")
            scenario_file="scripts/dbm-scenarios/03-high-row-count.sql"
            scenario_name="High Row Count"
            ;;
        "long-running-query")
            scenario_file="scripts/dbm-scenarios/04-long-running-query.sql"
            scenario_name="Long Running Query"
            ;;
        "missing-index")
            scenario_file="scripts/dbm-scenarios/05-missing-index.sql"
            scenario_name="Missing Index"
            ;;
        "query-load-increase")
            scenario_file="scripts/dbm-scenarios/06-query-load-increase.sql"
            scenario_name="Query Load Increase"
            ;;
        "unused-index")
            scenario_file="scripts/dbm-scenarios/07-unused-index.sql"
            scenario_name="Unused Index"
            ;;
        *)
            print_error "Unknown scenario: $scenario"
            list_scenarios
            exit 1
            ;;
    esac
    
    run_scenario "$scenario_file" "$scenario_name"
}

# Main function
main() {
    local run_all=false
    local scenario=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -d|--database)
                DB_NAME="$2"
                shift 2
                ;;
            -H|--host)
                DB_HOST="$2"
                shift 2
                ;;
            -p|--port)
                DB_PORT="$2"
                shift 2
                ;;
            -U|--user)
                DB_USER="$2"
                shift 2
                ;;
            -a|--all)
                run_all=true
                shift
                ;;
            -l|--list)
                list_scenarios
                exit 0
                ;;
            *)
                if [ -z "$scenario" ]; then
                    scenario="$1"
                else
                    print_error "Unknown argument: $1"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Check prerequisites
    check_psql
    check_connection
    
    # Show warning
    print_warning "This script will modify your database and create test data!"
    print_warning "Make sure you're running this on a test environment."
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled by user"
        exit 0
    fi
    
    # Run scenarios
    if [ "$run_all" = true ]; then
        run_all_scenarios
    elif [ -n "$scenario" ]; then
        run_specific_scenario "$scenario"
    else
        print_error "No scenario specified. Use --all or specify a scenario name."
        show_usage
        exit 1
    fi
    
    print_success "Script execution completed!"
    print_status "Check your Datadog DBM dashboard for recommendations."
}

# Run main function with all arguments
main "$@"
