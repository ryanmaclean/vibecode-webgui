#!/bin/bash
# Deploy Complete RAG Stack on i9-zfs-pop.local
# Creates: PostgreSQL + pgvector, Valkey, Development environment

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
echo "1️⃣  Deploying PostgreSQL 16 + pgvector"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ssh $HOST "docker run -d \
  --name rag-postgres \
  --network $NETWORK \
  -e POSTGRES_PASSWORD=vibecode2025 \
  -e POSTGRES_DB=vibecode \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:16-alpine"

echo "Waiting for PostgreSQL to start..."
sleep 5

# Install pgvector
echo "Installing pgvector extension..."
ssh $HOST "docker exec rag-postgres sh -c 'apk add --no-cache git build-base postgresql-dev && \
  cd /tmp && \
  git clone https://github.com/pgvector/pgvector.git && \
  cd pgvector && \
  make && \
  make install'"

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
echo "2️⃣  Deploying Valkey 8.1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ssh $HOST "docker run -d \
  --name rag-valkey \
  --network $NETWORK \
  -p 6379:6379 \
  --restart unless-stopped \
  valkey/valkey:8.1-alpine \
  valkey-server --maxmemory 512mb --maxmemory-policy allkeys-lru"

echo "Waiting for Valkey to start..."
sleep 3

# Verify
echo "Verifying Valkey..."
ssh $HOST "docker exec rag-valkey valkey-cli ping"
ssh $HOST "docker exec rag-valkey valkey-cli INFO server | grep version"

echo "✅ Valkey 8.1 ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Deploying Development Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ssh $HOST "docker run -d \
  --name rag-dev \
  --network $NETWORK \
  -p 8080:8080 \
  --restart unless-stopped \
  alpine:3.22 \
  tail -f /dev/null"

# Install Node.js
echo "Installing Node.js 22..."
ssh $HOST "docker exec rag-dev sh -c 'apk add --no-cache nodejs npm git'"

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
echo "PostgreSQL:"
echo "  Host: i9-zfs-pop.local"
echo "  Port: 5432"
echo "  Database: vibecode"
echo "  User: postgres"
echo "  Password: vibecode2025"
echo "  Extensions: pgvector"
echo ""
echo "Valkey:"
echo "  Host: i9-zfs-pop.local"
echo "  Port: 6379"
echo "  Max Memory: 512MB"
echo "  Policy: allkeys-lru"
echo ""
echo "Development:"
echo "  Host: i9-zfs-pop.local"
echo "  Port: 8080"
echo "  Node.js: v22.x"
echo "  npm: v11.x"
echo ""
echo "Docker Network: $NETWORK"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RAG Stack Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Test PostgreSQL: psql -h i9-zfs-pop.local -U postgres -d vibecode"
echo "  2. Test Valkey: redis-cli -h i9-zfs-pop.local"
echo "  3. Deploy RAG application to rag-dev container"
