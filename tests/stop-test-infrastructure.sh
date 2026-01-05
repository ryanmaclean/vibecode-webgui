#!/bin/bash
# Stop test infrastructure
# Usage: ./tests/stop-test-infrastructure.sh [--clean]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🛑 Stopping test infrastructure..."

if [ "$1" == "--clean" ]; then
    echo "🧹 Removing volumes and data..."
    docker-compose -f docker-compose.test.yml down -v
    echo "✅ Test infrastructure stopped and cleaned"
else
    docker-compose -f docker-compose.test.yml down
    echo "✅ Test infrastructure stopped (data preserved)"
    echo ""
    echo "💡 To remove all data, run: ./tests/stop-test-infrastructure.sh --clean"
fi
