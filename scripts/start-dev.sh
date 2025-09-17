#!/bin/bash

# VibeCode WebGUI Automated Startup Script
# This script sets up and starts the development environment automatically

set -e

echo "🚀 Starting VibeCode WebGUI Development Environment..."

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    echo "   On macOS: brew services start postgresql@16"
    echo "   On Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

# Check if test database exists, create if not
if ! psql -h localhost -U test -d testdb -c "SELECT 1;" >/dev/null 2>&1; then
    echo "📦 Creating test database..."
    createdb -h localhost -U test testdb 2>/dev/null || echo "Database might already exist"
fi

# Set required environment variables
export DATABASE_URL="postgresql://test:test@localhost:5432/testdb"
export NEXTAUTH_SECRET="test-secret-key-for-local-development"
export NEXTAUTH_URL="http://localhost:3000"
export NODE_ENV="development"

echo "✅ Environment variables set"
echo "   DATABASE_URL: $DATABASE_URL"
echo "   NEXTAUTH_URL: $NEXTAUTH_URL"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Push database schema
echo "🗄️  Syncing database schema..."
npx prisma db push --force-reset

echo "🎯 Starting development server..."
echo "   Server will be available at: http://localhost:3000"
echo "   Login credentials: developer@vibecode.dev / dev123"
echo ""

# Start the development server
npm run dev:simple
