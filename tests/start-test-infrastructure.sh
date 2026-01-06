#!/bin/bash
# Start test infrastructure for integration tests
# Usage: ./tests/start-test-infrastructure.sh

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting test infrastructure..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop or Colima and try again"
    exit 1
fi

# Start services
echo "📦 Starting Docker containers..."
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."

# Wait for PostgreSQL
echo "  Waiting for PostgreSQL..."
timeout=30
elapsed=0
until docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U vibecode_test -d vibecode_test > /dev/null 2>&1; do
    if [ $elapsed -ge $timeout ]; then
        echo "❌ PostgreSQL failed to start within ${timeout}s"
        exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done
echo "  ✓ PostgreSQL is ready"

# Wait for Redis
echo "  Waiting for Redis..."
elapsed=0
until docker-compose -f docker-compose.test.yml exec -T redis valkey-cli ping > /dev/null 2>&1; do
    if [ $elapsed -ge $timeout ]; then
        echo "❌ Redis failed to start within ${timeout}s"
        exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done
echo "  ✓ Redis is ready"

# Wait for MongoDB
echo "  Waiting for MongoDB..."
elapsed=0
until docker-compose -f docker-compose.test.yml exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    if [ $elapsed -ge $timeout ]; then
        echo "❌ MongoDB failed to start within ${timeout}s"
        exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done
echo "  ✓ MongoDB is ready"

# Export environment variables for tests
export DATABASE_URL="postgresql://vibecode_test:vibecode_test_password@localhost:5432/vibecode_test"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export MONGODB_URI="mongodb://vibecode_test:vibecode_test_password@localhost:27017/vibecode_test?authSource=admin"

echo ""
echo "✅ Test infrastructure is running!"
echo ""
echo "📋 Service URLs:"
echo "  PostgreSQL: postgresql://vibecode_test:vibecode_test_password@localhost:5432/vibecode_test"
echo "  Redis:      redis://localhost:6379"
echo "  MongoDB:    mongodb://vibecode_test:vibecode_test_password@localhost:27017/vibecode_test"
echo ""
echo "🔧 Admin Tools:"
echo "  Adminer (Postgres):     http://localhost:8080"
echo "  Redis Commander:        http://localhost:8081"
echo "  Mongo Express:          http://localhost:8082 (admin/admin)"
echo ""
echo "📝 To run tests with infrastructure:"
echo "  export DATABASE_URL='$DATABASE_URL'"
echo "  export REDIS_HOST='$REDIS_HOST'"
echo "  export REDIS_PORT='$REDIS_PORT'"
echo "  export MONGODB_URI='$MONGODB_URI'"
echo "  npm test"
echo ""
echo "🛑 To stop infrastructure:"
echo "  ./tests/stop-test-infrastructure.sh"
echo ""
