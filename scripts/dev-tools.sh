#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Colors for output

# Initialize log aggregation
init_log_aggregation

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Print header
print_header() {
  echo -e "\n${GREEN}=== $1 ===${NC}\n"
}

# Install dependencies
install_deps() {
  print_header "Installing Dependencies"
  
  if command_exists pnpm; then
    echo "Using pnpm for installation..."
    pnpm install
  elif command_exists yarn; then
    echo "Using yarn for installation..."
    yarn install
  else
    echo "Using npm for installation..."
    npm ci
  fi
  
  echo -e "\n${GREEN}✓ Dependencies installed successfully${NC}"
}

# Run linters
run_lint() {
  print_header "Running Linters"
  
  if command_exists pnpm; then
    pnpm lint
  elif command_exists yarn; then
    yarn lint
  else
    npm run lint
  fi
  
  echo -e "\n${GREEN}✓ Linting completed${NC}"
}

# Run tests
run_tests() {
  local watch=false
  local coverage=false
  
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --watch) watch=true ;;
      --coverage) coverage=true ;;
    esac
    shift
  done
  
  print_header "Running Tests"
  
  local test_cmd=""
  
  if [ "$coverage" = true ]; then
    test_cmd+="test:coverage"
  elif [ "$watch" = true ]; then
    test_cmd+="test:watch"
  else
    test_cmd+="test"
  fi
  
  if command_exists pnpm; then
    pnpm "$test_cmd"
  elif command_exists yarn; then
    yarn "$test_cmd"
  else
    npm run "$test_cmd"
  fi
  
  echo -e "\n${GREEN}✓ Tests completed${NC}"
}

# Run the development server
run_dev() {
  print_header "Starting Development Server"
  
  if command_exists pnpm; then
    pnpm dev
  elif command_exists yarn; then
    yarn dev
  else
    npm run dev
  fi
}

# Run production build
run_build() {
  print_header "Building for Production"
  
  if command_exists pnpm; then
    pnpm build
  elif command_exists yarn; then
    yarn build
  else
    npm run build
  fi
  
  echo -e "\n${GREEN}✓ Build completed${NC}"
}

# Run database migrations
run_migrations() {
  print_header "Running Database Migrations"
  
  if command_exists pnpm; then
    pnpm prisma migrate dev
  elif command_exists yarn; then
    yarn prisma migrate dev
  else
    npx prisma migrate dev
  fi
  
  echo -e "\n${GREEN}✓ Migrations completed${NC}"
}

# Run all checks (lint + test + build)
run_checks() {
  print_header "Running All Checks"
  
  run_lint
  run_tests --coverage
  run_build
  
  echo -e "\n${GREEN}✓ All checks passed!${NC}"
}

# Show help
show_help() {
  echo -e "${YELLOW}Development Tools Script${NC}\n"
  echo "Usage: ./dev-tools.sh [command]"
  echo ""
  echo "Available commands:"
  echo "  install       Install project dependencies"
  echo "  lint          Run linters"
  echo "  test          Run tests"
  echo "    --watch     Run tests in watch mode"
  echo "    --coverage  Run tests with coverage"
  echo "  dev           Start development server"
  echo "  build         Create production build"
  echo "  migrate       Run database migrations"
  echo "  check         Run all checks (lint + test + build)"
  echo "  help          Show this help message"
  echo ""
}

# Main script
case "$1" in
  install)
    install_deps
    ;;
  lint)
    run_lint
    ;;
  test)
    shift
    run_tests "$@"
    ;;
  dev)
    run_dev
    ;;
  build)
    run_build
    ;;
  migrate)
    run_migrations
    ;;
  check)
    run_checks
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo -e "${YELLOW}Unknown command: $1${NC}\n"
    show_help
    exit 1
    ;;
esac

exit 0
