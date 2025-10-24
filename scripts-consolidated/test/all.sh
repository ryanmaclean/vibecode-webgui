#!/bin/bash
# Testing and Validation
# Usage: ./vibecode test [subcommand] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
WATCH=false
VERBOSE=false
CI_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --watch)
            WATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        *)
            SUBCOMMAND="$1"
            shift
            ;;
    esac
done

case "$SUBCOMMAND" in
    unit)
        print_status "Running unit tests..."
        
        if [ "$WATCH" = true ]; then
            npm run test:watch
        elif [ "$CI_MODE" = true ]; then
            npm run test:ci
        else
            npm test
        fi
        
        print_success "Unit tests completed!"
        ;;
        
    integration)
        print_status "Running integration tests..."
        
        # Start test services
        cd docker
        docker-compose -f docker-compose.test.yml up -d
        
        # Wait for services to be ready
        sleep 10
        
        # Run integration tests
        npm run test:integration
        
        # Cleanup
        docker-compose -f docker-compose.test.yml down
        
        print_success "Integration tests completed!"
        ;;
        
    e2e)
        print_status "Running end-to-end tests..."
        
        # Start full environment
        cd docker
        docker-compose -f docker-compose.prod.yml up -d
        
        # Wait for services
        sleep 15
        
        # Run E2E tests
        npm run test:e2e
        
        # Cleanup
        docker-compose -f docker-compose.prod.yml down
        
        print_success "E2E tests completed!"
        ;;
        
    all)
        print_status "Running all tests..."
        
        # Run unit tests
        npm test
        
        # Run integration tests
        cd docker
        docker-compose -f docker-compose.test.yml up -d
        sleep 10
        npm run test:integration
        docker-compose -f docker-compose.test.yml down
        
        # Run E2E tests
        docker-compose -f docker-compose.prod.yml up -d
        sleep 15
        npm run test:e2e
        docker-compose -f docker-compose.prod.yml down
        
        print_success "All tests completed!"
        ;;
        
    coverage)
        print_status "Running tests with coverage..."
        
        npm run test:coverage
        
        print_success "Coverage tests completed!"
        ;;
        
    performance)
        print_status "Running performance tests..."
        
        # Start performance test environment
        cd docker
        docker-compose -f docker-compose.prod.yml up -d
        
        # Wait for services
        sleep 15
        
        # Run performance tests
        npm run test:performance
        
        # Cleanup
        docker-compose -f docker-compose.prod.yml down
        
        print_success "Performance tests completed!"
        ;;
        
    *)
        print_error "Unknown subcommand: $SUBCOMMAND"
        echo "Available subcommands: unit, integration, e2e, all, coverage, performance"
        exit 1
        ;;
esac
