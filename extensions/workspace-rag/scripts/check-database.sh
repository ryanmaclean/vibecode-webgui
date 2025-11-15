#!/bin/bash

# Database health check script for Workspace RAG Extension
# Verifies connection, extension, and table status

set -e

# Configuration
DB_NAME="${POSTGRES_DB:-rag_db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Checking Workspace RAG database health...${NC}"
echo ""

# Check 1: PostgreSQL connection
echo -n "Checking PostgreSQL connection... "
if pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT${NC}"
    exit 1
fi

# Check 2: Database exists
echo -n "Checking database '$DB_NAME'... "
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | xargs)
if [ "$DB_EXISTS" == "1" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}Database '$DB_NAME' does not exist!${NC}"
    echo "Run: ./scripts/setup-database.sh"
    exit 1
fi

# Check 3: Vector extension
echo -n "Checking pgvector extension... "
VECTOR_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT extversion FROM pg_extension WHERE extname='vector';" 2>/dev/null || echo "")
if [ -n "$VECTOR_VERSION" ]; then
    echo -e "${GREEN}OK (v$VECTOR_VERSION)${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}Vector extension not enabled!${NC}"
    echo "Run: ./scripts/setup-database.sh"
    exit 1
fi

# Check 4: Tables
echo -n "Checking workspace_documents table... "
TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='workspace_documents';" 2>/dev/null || echo "")
if [ "$TABLE_EXISTS" == "1" ]; then
    echo -e "${GREEN}OK${NC}"
    
    # Get document count
    DOC_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM workspace_documents;" 2>/dev/null || echo "0")
    WORKSPACE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(DISTINCT workspace_id) FROM workspace_documents;" 2>/dev/null || echo "0")
    
    echo ""
    echo -e "${BLUE}Database Statistics:${NC}"
    echo "  Documents indexed: $DOC_COUNT"
    echo "  Workspaces: $WORKSPACE_COUNT"
else
    echo -e "${YELLOW}PENDING (will be created on first index)${NC}"
fi

# Check 5: Index performance
if [ "$TABLE_EXISTS" == "1" ] && [ "$DOC_COUNT" -gt 0 ]; then
    echo ""
    echo -n "Checking indexes... "
    INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_indexes WHERE tablename='workspace_documents';" 2>/dev/null || echo "0")
    if [ "$INDEX_COUNT" -gt 0 ]; then
        echo -e "${GREEN}OK ($INDEX_COUNT indexes)${NC}"
    else
        echo -e "${YELLOW}WARNING: No indexes found${NC}"
    fi
fi

# Summary
echo ""
echo -e "${GREEN}Database is healthy${NC}"
echo ""
echo "Connection info:"
echo "  postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Optional: Show recent activity
if [ "$DOC_COUNT" -gt 0 ]; then
    echo "Recent workspaces:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            workspace_id,
            COUNT(*) as documents,
            MAX(last_modified) as last_indexed
        FROM workspace_documents
        GROUP BY workspace_id
        ORDER BY MAX(last_modified) DESC
        LIMIT 5;
    " 2>/dev/null || true
fi

