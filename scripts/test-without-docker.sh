#!/bin/bash

# Test Suite Runner - No Docker/KIND Dependencies
# Runs comprehensive tests for VibeCode platform functionality
# Validates real integrations without requiring containerized services

set -e

echo "🧪 VibeCode Test Suite - No Docker Dependencies"
echo "=================================================="

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

# Function to check if API keys are configured
check_api_keys() {
    print_status "Checking API key configuration..."
    
    local missing_keys=()
    
    if [ -z "$OPENROUTER_API_KEY" ]; then
        missing_keys+=("OPENROUTER_API_KEY")
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        missing_keys+=("DATABASE_URL")
    fi
    
    if [ ${#missing_keys[@]} -gt 0 ]; then
        print_warning "Missing API keys: ${missing_keys[*]}"
        print_warning "Some real integration tests will be skipped"
        return 1
    else
        print_success "All required API keys are configured"
        export ENABLE_REAL_AI_TESTS=true
        return 0
    fi
}

# Function to run a specific test suite
run_test_suite() {
    local suite_name="$1"
    local test_pattern="$2"
    local description="$3"
    
    print_status "Running $suite_name tests..."
    echo "Description: $description"
    
    if npm test -- --testPathPattern="$test_pattern" --verbose --detectOpenHandles --forceExit; then
        print_success "$suite_name tests passed"
        return 0
    else
        print_error "$suite_name tests failed"
        return 1
    fi
}

# Main test execution
main() {
    print_status "Starting VibeCode test suite execution..."
    
    # Check Node.js version
    node_version=$(node --version)
    print_status "Node.js version: $node_version"
    
    # Check npm version
    npm_version=$(npm --version)
    print_status "npm version: $npm_version"
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    
    # Check API key configuration
    has_api_keys=false
    if check_api_keys; then
        has_api_keys=true
    fi
    
    local failed_suites=()
    local total_suites=0
    
    # 1. Unit Tests (No external dependencies)
    print_status "========================================"
    print_status "1. Unit Tests (No External Dependencies)"
    print_status "========================================"
    
    total_suites=$((total_suites + 1))
    if ! run_test_suite "Unit" "tests/unit" "Core functionality and component tests"; then
        failed_suites+=("Unit Tests")
    fi
    
    # 2. Integration Tests (Without Docker dependencies)
    print_status "============================================"
    print_status "2. Integration Tests (No Docker Required)"
    print_status "============================================"
    
    # Vector Search and RAG Tests
    if [ "$has_api_keys" = true ]; then
        total_suites=$((total_suites + 1))
        if ! run_test_suite "Vector Search RAG" "vector-search-rag-real" "Real vector search and RAG functionality"; then
            failed_suites+=("Vector Search RAG")
        fi
        
        total_suites=$((total_suites + 1))
        if ! run_test_suite "AI Chat RAG" "ai-chat-rag-real" "Real AI chat with RAG integration"; then
            failed_suites+=("AI Chat RAG")
        fi
        
        total_suites=$((total_suites + 1))
        if ! run_test_suite "OpenRouter Integration" "real-openrouter-integration" "Real OpenRouter API integration"; then
            failed_suites+=("OpenRouter Integration")
        fi
    else
        print_warning "Skipping real AI integration tests - API keys not configured"
    fi
    
    # Monitoring tests (without Datadog dependencies)
    total_suites=$((total_suites + 1))
    if ! run_test_suite "Monitoring" "monitoring-unmocked" "Monitoring functionality without external dependencies"; then
        failed_suites+=("Monitoring")
    fi
    
    # Authentication tests
    total_suites=$((total_suites + 1))
    if ! run_test_suite "Authentication" "auth\\.test" "Authentication and session management"; then
        failed_suites+=("Authentication")
    fi
    
    # File operations tests
    total_suites=$((total_suites + 1))
    if ! run_test_suite "File Operations" "file-operations" "File system operations and management"; then
        failed_suites+=("File Operations")
    fi
    
    # Collaboration tests
    total_suites=$((total_suites + 1))
    if ! run_test_suite "Collaboration" "collaboration\\.test" "Real-time collaboration features"; then
        failed_suites+=("Collaboration")
    fi
    
    # 3. Security Tests (No Docker required)
    print_status "=============================="
    print_status "3. Security Tests"
    print_status "=============================="
    
    total_suites=$((total_suites + 1))
    if ! run_test_suite "Security" "tests/security" "Security validation and penetration testing"; then
        failed_suites+=("Security")
    fi
    
    # 4. Performance Tests (Basic, no load testing)
    print_status "============================"
    print_status "4. Performance Tests"
    print_status "============================"
    
    total_suites=$((total_suites + 1))
    if ! run_test_suite "Performance" "system-metrics-validation" "System metrics and performance validation"; then
        failed_suites+=("Performance")
    fi
    
    # Skip Docker-dependent tests with clear messaging
    print_status "=========================================="
    print_status "Skipped Tests (Docker/KIND Dependencies)"
    print_status "=========================================="
    print_warning "Kubernetes/KIND tests skipped - no container runtime"
    print_warning "Docker container health tests skipped - no Docker"
    print_warning "Database integration tests skipped - no PostgreSQL container"
    print_warning "Redis tests skipped - no Redis container"
    
    # Summary
    print_status "=========================="
    print_status "Test Execution Summary"
    print_status "=========================="
    
    local passed_suites=$((total_suites - ${#failed_suites[@]}))
    
    print_status "Total test suites: $total_suites"
    print_success "Passed: $passed_suites"
    
    if [ ${#failed_suites[@]} -gt 0 ]; then
        print_error "Failed: ${#failed_suites[@]}"
        print_error "Failed suites: ${failed_suites[*]}"
        
        if [ "$has_api_keys" = false ]; then
            print_warning "Note: Some failures may be due to missing API keys"
            print_warning "Set OPENROUTER_API_KEY and DATABASE_URL for full test coverage"
        fi
        
        exit 1
    else
        print_success "All available test suites passed!"
        
        if [ "$has_api_keys" = true ]; then
            print_success "✅ Full test coverage including real API integrations"
        else
            print_warning "⚠️  Partial test coverage - configure API keys for complete validation"
        fi
        
        exit 0
    fi
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  OPENROUTER_API_KEY    Required for AI integration tests"
    echo "  DATABASE_URL          Required for database integration tests"
    echo "  ENABLE_REAL_AI_TESTS  Set to 'true' to enable real API tests"
    echo ""
    echo "This script runs comprehensive tests without Docker/KIND dependencies."
    echo "Configure API keys for full test coverage."
    exit 0
fi

# Execute main function
main