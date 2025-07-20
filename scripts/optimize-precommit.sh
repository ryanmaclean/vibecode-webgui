#!/usr/bin/env bash

# Script to optimize pre-commit hooks for faster commits
# Usage: ./scripts/optimize-precommit.sh [enable|disable|status]

set -euo pipefail

OPTIMIZED_SCRIPT="scripts/pre-commit-tests-optimized.sh"
ORIGINAL_SCRIPT="scripts/pre-commit-tests.sh"
HUSKY_HOOK=".husky/pre-commit"

case "${1:-enable}" in
    "enable")
        echo "Enabling optimized pre-commit hooks..."
        
        # Make the optimized script executable
        chmod +x "$OPTIMIZED_SCRIPT"
        
        # Update Husky hook to use optimized script
        cat > "$HUSKY_HOOK" << 'EOF'
#!/bin/sh

# Run optimized pre-commit tests with parallel execution
./scripts/pre-commit-tests-optimized.sh
EOF
        
        chmod +x "$HUSKY_HOOK"
        
        echo "Optimized pre-commit hooks enabled"
        echo ""
        echo "Performance features:"
        echo "   - Parallel execution of independent checks"
        echo "   - Smart file change detection and caching"
        echo "   - Skip expensive tests for documentation-only changes"
        echo "   - Run only relevant tests for changed files"
        echo ""
        echo "Environment variables:"
        echo "   SKIP_EXPENSIVE_TESTS=true   # Skip build and full test suite"
        echo "   PARALLEL_JOBS=4             # Number of parallel jobs (default: 4)"
        echo ""
        echo "Quick commit tips:"
        echo "   git commit -m 'msg'                    # Normal optimized flow"
        echo "   SKIP_EXPENSIVE_TESTS=true git commit   # Skip builds/tests"
        echo "   git commit --no-verify                 # Skip all hooks"
        ;;
        
    "disable")
        echo "Reverting to original pre-commit hooks..."
        
        # Update Husky hook to use original script
        cat > "$HUSKY_HOOK" << 'EOF'
#!/bin/sh

# Run comprehensive pre-commit tests
./scripts/pre-commit-tests.sh
EOF
        
        chmod +x "$HUSKY_HOOK"
        
        echo "Original pre-commit hooks restored"
        ;;
        
    "status")
        echo "Pre-commit Hook Status:"
        echo ""
        
        if grep -q "pre-commit-tests-optimized.sh" "$HUSKY_HOOK" 2>/dev/null; then
            echo "Currently using: OPTIMIZED hooks"
            echo "   - Parallel execution enabled"
            echo "   - Smart caching enabled"
            echo "   - Performance optimizations active"
        elif grep -q "pre-commit-tests.sh" "$HUSKY_HOOK" 2>/dev/null; then
            echo "Currently using: ORIGINAL hooks"
            echo "   - Sequential execution"
            echo "   - No caching"
            echo "   - All tests run every time"
        else
            echo "Unknown pre-commit configuration"
        fi
        
        echo ""
        echo "Available commands:"
        echo "   ./scripts/optimize-precommit.sh enable    # Switch to optimized"
        echo "   ./scripts/optimize-precommit.sh disable   # Switch to original"
        echo "   ./scripts/optimize-precommit.sh status    # Show current status"
        ;;
        
    *)
        echo "Unknown command: $1"
        echo "Usage: $0 [enable|disable|status]"
        exit 1
        ;;
esac 