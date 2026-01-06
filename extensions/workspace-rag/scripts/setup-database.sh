#!/bin/bash

# Database setup script for Workspace RAG Extension
# This script creates the necessary PostgreSQL database and enables the vector extension

set -e

echo "Setting up PostgreSQL database for Workspace RAG..."

# Configuration
DB_NAME="${POSTGRES_DB:-rag_db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}PostgreSQL is not installed${NC}"
    echo ""
    echo "Install PostgreSQL:"
    echo "  macOS:   brew install postgresql@15"
    echo "  Linux:   sudo apt install postgresql"
    echo ""
    exit 1
fi

echo -e "${GREEN}PostgreSQL found${NC}"

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
    echo -e "${YELLOW}PostgreSQL is not running${NC}"
    echo ""
    echo "Start PostgreSQL:"
    echo "  macOS:   brew services start postgresql@15"
    echo "  Linux:   sudo systemctl start postgresql"
    echo ""
    exit 1
fi

echo -e "${GREEN}PostgreSQL is running${NC}"

# Create database if it doesn't exist
echo ""
echo "Creating database '$DB_NAME'..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME"

echo -e "${GREEN}Database '$DB_NAME' ready${NC}"

# Enable vector extension
echo ""
echo "Enabling vector extension..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" &> /dev/null

echo -e "${GREEN}Vector extension enabled${NC}"

# Verify extension
echo ""
echo "Verifying installation..."
VECTOR_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT extversion FROM pg_extension WHERE extname='vector';")

if [ -z "$VECTOR_VERSION" ]; then
    echo -e "${RED}Vector extension not properly installed${NC}"
    echo ""
    echo "Install pgvector:"
    echo "  macOS:   brew install pgvector"
    echo "  Linux:   sudo apt install postgresql-15-pgvector"
    echo ""
    exit 1
fi

echo -e "${GREEN}pgvector $VECTOR_VERSION installed${NC}"

# Create tables (optional - extension will create them automatically)
echo ""
echo "Database setup complete"
echo ""
echo "Connection details:"
echo "  Host:     $DB_HOST"
echo "  Port:     $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User:     $DB_USER"
echo ""
echo "Next steps:"
echo "  1. Update VS Code settings with these connection details"
echo "  2. Run 'RAG: Index Workspace' command in VS Code"
echo "  3. Start asking questions about your codebase"
echo ""

