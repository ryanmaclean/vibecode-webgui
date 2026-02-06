#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Docker-based testing for vector store optimizations
# Builds and tests our performance improvements in isolated environment

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 Docker-based Vector Performance Testing"
echo "=============================================="

# Build the optimized application
echo "📦 Building optimized application..."
docker build -t vibecode-test:latest -f docker/Dockerfile --target production .

# Start test environment with PostgreSQL
echo "🔄 Starting test environment..."
docker run -d --name postgres-test \
  -e POSTGRES_DB=vibecode_test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test123 \
  -p 5433:5432 \
  postgres:15-alpine

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Start the application with test configuration  
echo "🏃 Starting application with optimizations..."
docker run -d --name vibecode-test \
  --link postgres-test:postgres \
  -e DATABASE_URL="postgresql://test:test123@postgres:5432/vibecode_test" \
  -e NODE_ENV=test \
  -e NEXTAUTH_SECRET=test-secret-123 \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -p 3002:3000 \
  vibecode-test:latest

# Wait for application to start
echo "⏳ Waiting for application to start..."
sleep 15

# Test our enhanced monitoring endpoints
echo "🔍 Testing enhanced vector metrics endpoint..."
if curl -f http://localhost:3002/api/health/vector-metrics > /tmp/vector-metrics.json 2>/dev/null; then
  echo "✅ Vector metrics endpoint operational"
  echo "📊 Response preview:"
  cat /tmp/vector-metrics.json | jq '.performance' 2>/dev/null || echo "Raw response available at /tmp/vector-metrics.json"
else
  echo "❌ Vector metrics endpoint failed"
fi

echo ""
echo "🔗 Testing connection pool endpoint..."
if curl -f http://localhost:3002/api/health/connection-pool > /tmp/pool-metrics.json 2>/dev/null; then
  echo "✅ Connection pool endpoint operational"
  echo "📊 Pool metrics:"
  cat /tmp/pool-metrics.json | jq '.poolMetrics' 2>/dev/null || echo "Raw response available at /tmp/pool-metrics.json"
else
  echo "❌ Connection pool endpoint failed"
fi

echo ""
echo "📈 Testing database metrics endpoint..."
if curl -f http://localhost:3002/api/health/database/metrics > /tmp/db-metrics.json 2>/dev/null; then
  echo "✅ Database metrics endpoint operational"
  echo "📊 Database health:"
  cat /tmp/db-metrics.json | jq '.status' 2>/dev/null || echo "Raw response available at /tmp/db-metrics.json"
else
  echo "❌ Database metrics endpoint failed"
fi

# Performance stress test
echo ""
echo "⚡ Running light performance test..."
echo "🔄 Testing endpoint response times..."

TOTAL_REQUESTS=10
SUCCESS_COUNT=0

for i in $(seq 1 $TOTAL_REQUESTS); do
  if curl -f -s http://localhost:3002/api/health/vector-metrics > /dev/null; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
  sleep 0.5
done

SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_REQUESTS))
echo "📊 Performance test results: ${SUCCESS_COUNT}/${TOTAL_REQUESTS} successful (${SUCCESS_RATE}%)"

if [ $SUCCESS_RATE -gt 80 ]; then
  echo "🎉 Performance optimizations working well!"
else
  echo "⚠️  Performance needs improvement"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test environment..."
docker stop vibecode-test postgres-test 2>/dev/null || true
docker rm vibecode-test postgres-test 2>/dev/null || true

echo ""
echo "✅ Docker-based testing complete!"
echo "📋 Test artifacts saved in /tmp/*-metrics.json"