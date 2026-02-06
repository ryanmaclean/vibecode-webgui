#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# VibeCode WebGUI Database Setup Script
# This script automates database setup for development and production

# Initialize log aggregation
init_log_aggregation


set -e

# Configuration
DB_NAME=${DB_NAME:-"testdb"}
DB_USER=${DB_USER:-"test"}
DB_PASSWORD=${DB_PASSWORD:-"test"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  VibeCode WebGUI Database Setup${NC}"
echo "=================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL:"
    echo "  macOS: brew install postgresql@16"
    echo "  Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo "  CentOS: sudo yum install postgresql-server postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT >/dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    echo "Please start PostgreSQL:"
    echo "  macOS: brew services start postgresql@16"
    echo "  Ubuntu: sudo systemctl start postgresql"
    echo "  CentOS: sudo systemctl start postgresql"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Create database if it doesn't exist
echo -e "${YELLOW}📦 Creating database '$DB_NAME'...${NC}"
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' already exists${NC}"
else
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo -e "${GREEN}✅ Database '$DB_NAME' created${NC}"
fi

# Set environment variables
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

echo -e "${YELLOW}🔧 Setting up database schema...${NC}"

# Check if Prisma is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Node.js/npm is not installed${NC}"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Push database schema
echo -e "${YELLOW}🔄 Syncing database schema...${NC}"
npx prisma db push --force-reset

# Generate Prisma client
echo -e "${YELLOW}🔨 Generating Prisma client...${NC}"
npx prisma generate

# Run database migrations if they exist
if [ -d "prisma/migrations" ]; then
    echo -e "${YELLOW}🔄 Running database migrations...${NC}"
    # Try to deploy migrations, if it fails due to non-empty schema, reset and deploy
    if ! npx prisma migrate deploy; then
        echo -e "${YELLOW}⚠️  Database schema conflict detected, resetting and redeploying...${NC}"
        npx prisma migrate reset --force
        npx prisma migrate deploy
    fi
fi

# Seed database if seed script exists
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
    echo -e "${YELLOW}🌱 Seeding database...${NC}"
    npx prisma db seed
fi

echo -e "${GREEN}✅ Database setup completed successfully!${NC}"
echo ""
echo -e "${GREEN}📋 Database Configuration:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Connection URL: $DATABASE_URL"
echo ""
echo -e "${GREEN}🚀 You can now start the application with:${NC}"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}💡 To reset the database:${NC}"
echo "  npx prisma db push --force-reset"
