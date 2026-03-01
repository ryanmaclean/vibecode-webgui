#!/usr/bin/env bash

# Optional Pre-commit Test Script
# Runs quick unit tests before commit
# Can be skipped with SKIP_TESTS=1 environment variable

set -e

# Show help if requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    cat << 'EOF'
Usage: pre-commit-test.sh [options]

Runs quick unit tests before commit with optional coverage.

Options:
  --help, -h    Show this help message

Environment Variables:
  SKIP_TESTS=1       Skip test execution entirely
  SHOW_COVERAGE=1    Display coverage summary after tests

Examples:
  # Run tests normally
  ./scripts/pre-commit-test.sh

  # Skip tests
  SKIP_TESTS=1 git commit -m "quick fix"

  # Run with coverage summary
  SHOW_COVERAGE=1 ./scripts/pre-commit-test.sh

Note: This script runs only quick unit tests (--maxWorkers=2).
      Full integration and E2E tests are run in CI.
EOF
    exit 0
fi

# Check if tests should be skipped
if [[ "${SKIP_TESTS}" == "1" ]]; then
    echo "⏭️  Skipping pre-commit tests (SKIP_TESTS=1)"
    echo "   To enable: unset SKIP_TESTS or set SKIP_TESTS=0"
    exit 0
fi

echo "🧪 Running pre-commit tests..."
echo ""

# Run quick unit tests only
echo "Running unit tests (quick mode)..."
if [[ "${SHOW_COVERAGE}" == "1" ]]; then
    # Run with coverage
    npm run test:coverage -- --bail --maxWorkers=2 --passWithNoTests || {
        echo ""
        echo "❌ Tests failed. Aborting commit."
        echo "   To skip: SKIP_TESTS=1 git commit -m \"message\""
        exit 1
    }

    echo ""
    echo "✅ Tests passed with coverage summary above"
else
    # Run without coverage (faster)
    npm run quick-test -- --bail --passWithNoTests || {
        echo ""
        echo "❌ Tests failed. Aborting commit."
        echo "   To skip: SKIP_TESTS=1 git commit -m \"message\""
        echo "   To see coverage: SHOW_COVERAGE=1 ./scripts/pre-commit-test.sh"
        exit 1
    }

    echo ""
    echo "✅ Tests passed"
    echo "   Tip: Run with SHOW_COVERAGE=1 to see coverage summary"
fi

echo ""
echo "💡 Tip: To skip tests, use: SKIP_TESTS=1 git commit -m \"message\""
