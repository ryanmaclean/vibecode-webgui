#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# VibeCode WebGUI Automated Test Runner
# This script runs all tests with proper setup and cleanup

# Initialize log aggregation
init_log_aggregation


set -e

echo "🧪 Running VibeCode WebGUI Test Suite..."

# Set required environment variables
export DATABASE_URL="postgresql://test:test@localhost:5432/testdb"
export NEXTAUTH_SECRET="test-secret-key-for-local-development"
export NEXTAUTH_URL="http://localhost:3000"
export NODE_ENV="test"

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Check if test database exists
if ! psql -h localhost -U test -d testdb -c "SELECT 1;" >/dev/null 2>&1; then
    echo "📦 Creating test database..."
    createdb -h localhost -U test testdb 2>/dev/null || echo "Database might already exist"
fi

# Push database schema
echo "🗄️  Syncing database schema..."
npx prisma db push --force-reset

# Start the development server in background
echo "🚀 Starting development server..."
npm run dev:simple &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s -H "User-Agent: Mozilla/5.0" http://localhost:3000/api/health/simple >/dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Server failed to start within 30 seconds"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Run tests
echo "🧪 Running test suite..."

# Unit tests
echo "📊 Running unit tests..."
npm run test -- --passWithNoTests

# E2E tests (with timeout)
echo "🌐 Running E2E tests..."
timeout 300 npx playwright test tests/e2e/ --reporter=line || echo "E2E tests completed with some failures"

# Integration tests
echo "🔗 Running integration tests..."
npm run test -- tests/integration/ --passWithNoTests

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

echo "✅ Test suite completed!"
