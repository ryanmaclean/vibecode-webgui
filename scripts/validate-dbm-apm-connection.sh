#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Datadog DBM-APM Connection Validation Script
# This script validates that the DBM-APM connection is properly configured
# across DEV, staging, and production environments

# Initialize log aggregation
init_log_aggregation


set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to check environment variables
check_env_vars() {
    local env=$1
    print_status "INFO" "Checking environment variables for $env"
    
    local required_vars=(
        "DD_API_KEY"
        "DD_SERVICE"
        "DD_ENV"
        "DD_VERSION"
        "DD_DBM_PROPAGATION_MODE"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_status "SUCCESS" "All required environment variables are set"
        return 0
    else
        print_status "ERROR" "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
}

# Function to validate Datadog API key
validate_datadog_api() {
    print_status "INFO" "Validating Datadog API key"
    
    if [ -z "$DD_API_KEY" ]; then
        print_status "ERROR" "DD_API_KEY is not set"
        return 1
    fi
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/datadog_response.json \
        -X GET "https://api.datadoghq.com/api/v1/validate" \
        -H "DD-API-KEY: $DD_API_KEY")
    
    if [ "$response" = "200" ]; then
        print_status "SUCCESS" "Datadog API key is valid"
        return 0
    else
        print_status "ERROR" "Datadog API key validation failed (HTTP $response)"
        return 1
    fi
}

# Function to check database connectivity
check_database_connectivity() {
    print_status "INFO" "Checking database connectivity"
    
    if [ -z "$DATABASE_URL" ]; then
        print_status "WARNING" "DATABASE_URL is not set, skipping database connectivity check"
        return 0
    fi
    
    # Extract connection details from DATABASE_URL
    local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [ -z "$db_host" ] || [ -z "$db_port" ] || [ -z "$db_name" ]; then
        print_status "ERROR" "Could not parse DATABASE_URL: $DATABASE_URL"
        return 1
    fi
    
    # Test database connection
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
            print_status "SUCCESS" "Database connectivity verified"
            return 0
        else
            print_status "ERROR" "Database connection failed"
            return 1
        fi
    else
        print_status "WARNING" "psql not found, skipping database connectivity check"
        return 0
    fi
}

# Function to check Redis connectivity
check_redis_connectivity() {
    print_status "INFO" "Checking Redis connectivity"
    
    if [ -z "$REDIS_URL" ]; then
        print_status "WARNING" "REDIS_URL is not set, skipping Redis connectivity check"
        return 0
    fi
    
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
            print_status "SUCCESS" "Redis connectivity verified"
            return 0
        else
            print_status "ERROR" "Redis connection failed"
            return 1
        fi
    else
        print_status "WARNING" "redis-cli not found, skipping Redis connectivity check"
        return 0
    fi
}

# Function to check Node.js dependencies
check_nodejs_dependencies() {
    print_status "INFO" "Checking Node.js dependencies"
    
    if [ ! -f "package.json" ]; then
        print_status "ERROR" "package.json not found"
        return 1
    fi
    
    # Check if dd-trace is installed
    if npm list dd-trace >/dev/null 2>&1; then
        local version=$(npm list dd-trace --depth=0 | grep dd-trace | sed 's/.*@\([0-9.]*\).*/\1/')
        print_status "SUCCESS" "dd-trace is installed (version: $version)"
        return 0
    else
        print_status "ERROR" "dd-trace is not installed"
        return 1
    fi
}

# Function to check Go dependencies
check_go_dependencies() {
    print_status "INFO" "Checking Go dependencies"
    
    if [ ! -f "go.mod" ]; then
        print_status "WARNING" "go.mod not found, skipping Go dependency check"
        return 0
    fi
    
    # Check if Datadog Go tracer is in go.mod
    if grep -q "gopkg.in/DataDog/dd-trace-go.v1" go.mod; then
        print_status "SUCCESS" "Datadog Go tracer is in go.mod"
        return 0
    else
        print_status "ERROR" "Datadog Go tracer is not in go.mod"
        return 1
    fi
}

# Function to check Docker Compose configurations
check_docker_compose_configs() {
    print_status "INFO" "Checking Docker Compose configurations"
    
    local compose_files=(
        "docker-compose.dev.yml"
        "docker-compose.yml"
        "docker-compose.production.yml"
    )
    
    local all_good=true
    
    for file in "${compose_files[@]}"; do
        if [ -f "$file" ]; then
            if grep -q "DD_DBM_PROPAGATION_MODE" "$file"; then
                print_status "SUCCESS" "$file contains DBM propagation configuration"
            else
                print_status "ERROR" "$file is missing DBM propagation configuration"
                all_good=false
            fi
        else
            print_status "WARNING" "$file not found"
        fi
    done
    
    if [ "$all_good" = true ]; then
        return 0
    else
        return 1
    fi
}

# Function to check Kubernetes configurations
check_kubernetes_configs() {
    print_status "INFO" "Checking Kubernetes configurations"
    
    local k8s_files=(
        "k8s/datadog-values.yaml"
        "ops/monitoring/datadog-values.yaml"
    )
    
    local all_good=true
    
    for file in "${k8s_files[@]}"; do
        if [ -f "$file" ]; then
            if grep -q "DD_DBM_PROPAGATION_MODE" "$file"; then
                print_status "SUCCESS" "$file contains DBM propagation configuration"
            else
                print_status "ERROR" "$file is missing DBM propagation configuration"
                all_good=false
            fi
        else
            print_status "WARNING" "$file not found"
        fi
    done
    
    if [ "$all_good" = true ]; then
        return 0
    else
        return 1
    fi
}

# Function to check instrumentation files
check_instrumentation_files() {
    print_status "INFO" "Checking instrumentation files"
    
    local all_good=true
    
    # Check TypeScript instrumentation
    if [ -f "src/instrument.ts" ]; then
        if grep -q "DD_DBM_PROPAGATION_MODE" src/instrument.ts; then
            print_status "SUCCESS" "src/instrument.ts contains DBM propagation configuration"
        else
            print_status "ERROR" "src/instrument.ts is missing DBM propagation configuration"
            all_good=false
        fi
    else
        print_status "WARNING" "src/instrument.ts not found"
    fi
    
    # Check CommonJS instrumentation
    if [ -f "src/instrument.cjs" ]; then
        if grep -q "DD_DBM_PROPAGATION_MODE" src/instrument.cjs; then
            print_status "SUCCESS" "src/instrument.cjs contains DBM propagation configuration"
        else
            print_status "ERROR" "src/instrument.cjs is missing DBM propagation configuration"
            all_good=false
        fi
    else
        print_status "WARNING" "src/instrument.cjs not found"
    fi
    
    if [ "$all_good" = true ]; then
        return 0
    else
        return 1
    fi
}

# Main validation function
main() {
    echo -e "${BLUE}🔍 Datadog DBM-APM Connection Validation${NC}"
    echo "=============================================="
    echo
    
    local exit_code=0
    
    # Check environment variables
    if ! check_env_vars "$DD_ENV"; then
        exit_code=1
    fi
    echo
    
    # Validate Datadog API key
    if ! validate_datadog_api; then
        exit_code=1
    fi
    echo
    
    # Check database connectivity
    if ! check_database_connectivity; then
        exit_code=1
    fi
    echo
    
    # Check Redis connectivity
    if ! check_redis_connectivity; then
        exit_code=1
    fi
    echo
    
    # Check Node.js dependencies
    if ! check_nodejs_dependencies; then
        exit_code=1
    fi
    echo
    
    # Check Go dependencies
    if ! check_go_dependencies; then
        exit_code=1
    fi
    echo
    
    # Check Docker Compose configurations
    if ! check_docker_compose_configs; then
        exit_code=1
    fi
    echo
    
    # Check Kubernetes configurations
    if ! check_kubernetes_configs; then
        exit_code=1
    fi
    echo
    
    # Check instrumentation files
    if ! check_instrumentation_files; then
        exit_code=1
    fi
    echo
    
    # Summary
    echo "=============================================="
    if [ $exit_code -eq 0 ]; then
        print_status "SUCCESS" "All DBM-APM connection validations passed!"
        echo
        print_status "INFO" "Your environment is properly configured for DBM-APM connection."
        print_status "INFO" "You can now deploy and monitor your application with full trace correlation."
    else
        print_status "ERROR" "Some validations failed. Please fix the issues above."
        echo
        print_status "INFO" "Refer to DATADOG_DBM_APM_CONNECTION_GUIDE.md for detailed setup instructions."
    fi
    
    exit $exit_code
}

# Run main function
main "$@"
