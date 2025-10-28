#!/bin/bash
# Deploy Complete RAG Stack on i9-zfs-pop.local
# Uses ankane/pgvector image (pre-built with pgvector)

set -e

HOST="studio@i9-zfs-pop.local"
NETWORK="rag-network"

echo "🚀 Deploying RAG Stack on i9-zfs-pop.local"
echo "==========================================="
echo ""

# Create Docker network
echo "📡 Creating Docker network..."
ssh $HOST "docker network create $NETWORK 2>/dev/null || echo 'Network already exists'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Deploying PostgreSQL 16 + pgvector (pre-built)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop and remove existing container if it exists
ssh $HOST "docker rm -f rag-postgres 2>/dev/null || true"

ssh $HOST "docker run -d \
  --name rag-postgres \
  --network $NETWORK \
  -e POSTGRES_PASSWORD=vibecode2025 \
  -e POSTGRES_DB=vibecode \
  -p 5432:5432 \
  --restart unless-stopped \
  ankane/pgvector:latest"

echo "Waiting for PostgreSQL to start..."
sleep 8

# Create extension
echo "Creating pgvector extension..."
ssh $HOST "docker exec rag-postgres psql -U postgres -d vibecode -c 'CREATE EXTENSION IF NOT EXISTS vector;'"

# Verify
echo "Verifying PostgreSQL + pgvector..."
ssh $HOST "docker exec rag-postgres psql -U postgres -d vibecode -c 'SELECT version();'"
ssh $HOST "docker exec rag-postgres psql -U postgres -d vibecode -c '\\dx vector'"

echo "✅ PostgreSQL 16 + pgvector ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Deploying Valkey 7.2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop and remove existing container if it exists
ssh $HOST "docker rm -f rag-valkey 2>/dev/null || true"

ssh $HOST "docker run -d \
  --name rag-valkey \
  --network $NETWORK \
  -p 6379:6379 \
  --restart unless-stopped \
  valkey/valkey:7.2-alpine \
  valkey-server --maxmemory 512mb --maxmemory-policy allkeys-lru"

echo "Waiting for Valkey to start..."
sleep 3

# Verify
echo "Verifying Valkey..."
ssh $HOST "docker exec rag-valkey valkey-cli ping"
ssh $HOST "docker exec rag-valkey valkey-cli INFO server | grep -E 'redis_version|valkey_version'"

echo "✅ Valkey 7.2 ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Deploying Development Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop and remove existing container if it exists
ssh $HOST "docker rm -f rag-dev 2>/dev/null || true"

ssh $HOST "docker run -d \
  --name rag-dev \
  --network $NETWORK \
  -p 8080:8080 \
  --restart unless-stopped \
  alpine:3.22 \
  tail -f /dev/null"

# Install Node.js
echo "Installing Node.js 22..."
ssh $HOST "docker exec rag-dev sh -c 'apk add --no-cache nodejs npm git curl'"

# Verify
echo "Verifying development environment..."
ssh $HOST "docker exec rag-dev node --version"
ssh $HOST "docker exec rag-dev npm --version"

echo "✅ Development environment ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RAG Stack Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ssh $HOST "docker ps --filter 'name=rag-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Connection Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "PostgreSQL + pgvector:"
echo "  Host: i9-zfs-pop.local (or 10.0.3.68)"
echo "  Port: 5432"
echo "  Database: vibecode"
echo "  User: postgres"
echo "  Password: vibecode2025"
echo "  Extensions: vector (pgvector)"
echo "  Connection: postgresql://postgres:vibecode2025@i9-zfs-pop.local:5432/vibecode"
echo ""
echo "Valkey:"
echo "  Host: i9-zfs-pop.local (or 10.0.3.68)"
echo "  Port: 6379"
echo "  Max Memory: 512MB"
echo "  Policy: allkeys-lru"
echo "  Connection: redis://i9-zfs-pop.local:6379"
echo ""
echo "Development:"
echo "  Host: i9-zfs-pop.local (or 10.0.3.68)"
echo "  Port: 8080"
echo "  Node.js: v22.x"
echo "  npm: v11.x"
echo ""
echo "Docker Network: $NETWORK"
echo "  All containers can communicate using container names"
echo "  Example: rag-dev can connect to rag-postgres:5432"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RAG Stack Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test commands:"
echo "  # Test PostgreSQL"
echo "  psql postgresql://postgres:vibecode2025@i9-zfs-pop.local:5432/vibecode"
echo ""
echo "  # Test Valkey"
echo "  redis-cli -h i9-zfs-pop.local ping"
echo ""
echo "  # Test vector operations"
echo "  ssh $HOST \"docker exec rag-postgres psql -U postgres -d vibecode -c 'SELECT vector_dims(ARRAY[1,2,3]::vector);'\""
