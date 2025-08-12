#!/bin/bash

# Database Configuration Validation Script
# Validates database connectivity, extensions, and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 VibeCode Database Configuration Validation${NC}"
echo "============================================"

# Function to run SQL and capture output
run_sql() {
  local sql="$1"
  timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma <<< "$sql" 2>/dev/null || return 1
}

# Validate environment
echo -e "${YELLOW}📋 Validating environment variables...${NC}"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL: MISSING${NC}"
  exit 1
else
  echo -e "${GREEN}✅ DATABASE_URL: SET${NC}"
  # Mask password in output
  MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
  echo "   URL: $MASKED_URL"
fi

# Test basic connectivity
echo -e "${YELLOW}🔗 Testing database connectivity...${NC}"

if run_sql "SELECT 1 as connectivity_test;" > /dev/null; then
  echo -e "${GREEN}✅ CONNECTIVITY: SUCCESS${NC}"
else
  echo -e "${RED}❌ CONNECTIVITY: FAILED${NC}"
  echo "Cannot connect to database. Please check your DATABASE_URL and ensure the database is running."
  exit 1
fi

# Get database information
echo -e "${YELLOW}📊 Gathering database information...${NC}"

DB_INFO=$(run_sql "
SELECT 
  current_database() as database_name,
  current_user as database_user,
  version() as postgresql_version,
  pg_size_pretty(pg_database_size(current_database())) as database_size;
") || {
  echo -e "${RED}❌ Could not gather database information${NC}"
  exit 1
}

echo "$DB_INFO"

# Check required extensions
echo -e "${YELLOW}🧩 Checking PostgreSQL extensions...${NC}"

EXTENSIONS_CHECK=$(run_sql "
SELECT 
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') 
    THEN '✅ pgvector: INSTALLED (v' || (SELECT extversion FROM pg_extension WHERE extname = 'vector') || ')'
    ELSE '❌ pgvector: MISSING' END as pgvector_status,
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') 
    THEN '✅ uuid-ossp: INSTALLED (v' || (SELECT extversion FROM pg_extension WHERE extname = 'uuid-ossp') || ')'
    ELSE '❌ uuid-ossp: MISSING' END as uuid_status;
") || {
  echo -e "${RED}❌ Could not check extensions${NC}"
  exit 1
}

echo "$EXTENSIONS_CHECK"

# Check if pgvector is working
echo -e "${YELLOW}🧮 Testing pgvector functionality...${NC}"

VECTOR_TEST=$(run_sql "
SELECT 
  '[1,2,3]'::vector as sample_vector,
  '[1,2,3]'::vector <-> '[1,2,4]'::vector as cosine_distance;
") 2>/dev/null || {
  echo -e "${RED}❌ pgvector functionality test failed${NC}"
  echo "pgvector extension may not be properly installed or configured"
}

if [ ! -z "$VECTOR_TEST" ]; then
  echo -e "${GREEN}✅ pgvector functionality test passed${NC}"
  echo "$VECTOR_TEST"
fi

# Check database schema
echo -e "${YELLOW}🏗️  Checking database schema...${NC}"

SCHEMA_CHECK=$(run_sql "
SELECT 
  table_name,
  CASE WHEN table_name IN ('users', 'workspaces', 'projects', 'files', 'rag_chunks', 'ai_requests')
    THEN '✅ CRITICAL'
    ELSE '📋 OPTIONAL'
  END as table_importance
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
") || {
  echo -e "${RED}❌ Could not check database schema${NC}"
}

if [ ! -z "$SCHEMA_CHECK" ]; then
  echo "$SCHEMA_CHECK"
  
  # Count critical tables
  CRITICAL_TABLES=$(echo "$SCHEMA_CHECK" | grep -c "CRITICAL" || echo "0")
  if [ "$CRITICAL_TABLES" -ge "5" ]; then
    echo -e "${GREEN}✅ Schema validation: $CRITICAL_TABLES/6 critical tables found${NC}"
  else
    echo -e "${YELLOW}⚠️  Schema validation: Only $CRITICAL_TABLES/6 critical tables found${NC}"
    echo "You may need to run database migrations"
  fi
fi

# Check vector-specific schema
echo -e "${YELLOW}🎯 Checking RAG/Vector schema...${NC}"

VECTOR_SCHEMA=$(run_sql "
SELECT 
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rag_chunks' AND column_name = 'embedding'
  ) THEN '✅ Vector column exists in rag_chunks table'
  ELSE '❌ Vector column missing from rag_chunks table' END as vector_column,
  
  CASE WHEN EXISTS(
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'rag_chunks' AND indexname ILIKE '%embedding%'
  ) THEN '✅ Vector index exists (' || (
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'rag_chunks' AND indexname ILIKE '%embedding%' LIMIT 1
  ) || ')'
  ELSE '⚠️  No vector index found' END as vector_index;
") || {
  echo -e "${YELLOW}⚠️  Could not check vector schema (table may not exist yet)${NC}"
}

if [ ! -z "$VECTOR_SCHEMA" ]; then
  echo "$VECTOR_SCHEMA"
fi

# Check database performance settings
echo -e "${YELLOW}⚡ Checking performance configuration...${NC}"

PERFORMANCE_CHECK=$(run_sql "
SELECT 
  name as setting_name,
  setting as current_value,
  unit,
  CASE 
    WHEN name = 'work_mem' AND setting::integer < 32768 THEN '⚠️  Recommended: >= 256MB for vector operations'
    WHEN name = 'maintenance_work_mem' AND setting::integer < 131072 THEN '⚠️  Recommended: >= 512MB for index building'
    WHEN name = 'max_connections' AND setting::integer > 200 THEN '⚠️  Consider reducing for better performance'
    WHEN name = 'shared_buffers' AND setting::integer < 131072 THEN '⚠️  Consider increasing'
    ELSE '✅ OK'
  END as recommendation
FROM pg_settings 
WHERE name IN ('work_mem', 'maintenance_work_mem', 'max_connections', 'shared_buffers')
ORDER BY name;
") || {
  echo -e "${YELLOW}⚠️  Could not check performance settings (may require elevated privileges)${NC}"
}

if [ ! -z "$PERFORMANCE_CHECK" ]; then
  echo "$PERFORMANCE_CHECK"
fi

# Check database connections and activity
echo -e "${YELLOW}👥 Checking database connections...${NC}"

CONNECTION_CHECK=$(run_sql "
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  max(now() - backend_start) as longest_connection
FROM pg_stat_activity 
WHERE datname = current_database();
") || {
  echo -e "${YELLOW}⚠️  Could not check connection status${NC}"
}

if [ ! -z "$CONNECTION_CHECK" ]; then
  echo "$CONNECTION_CHECK"
fi

# Check for common issues
echo -e "${YELLOW}🔧 Checking for common configuration issues...${NC}"

ISSUES_CHECK=$(run_sql "
SELECT 
  CASE 
    WHEN (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) > 50 
    THEN '⚠️  High connection count detected'
    ELSE '✅ Connection count normal'
  END as connection_status,
  
  CASE 
    WHEN (SELECT setting::integer FROM pg_settings WHERE name = 'log_min_duration_statement') < 1000
    THEN '✅ Slow query logging enabled'
    ELSE '⚠️  Consider enabling slow query logging'
  END as logging_status;
") || {
  echo -e "${YELLOW}⚠️  Could not perform comprehensive issue check${NC}"
}

if [ ! -z "$ISSUES_CHECK" ]; then
  echo "$ISSUES_CHECK"
fi

# Final summary
echo ""
echo "============================================"
echo -e "${BLUE}📋 Validation Summary${NC}"
echo ""

# Extract key status indicators
if echo "$EXTENSIONS_CHECK" | grep -q "✅ pgvector"; then
  echo -e "${GREEN}✅ pgvector extension: READY${NC}"
else
  echo -e "${RED}❌ pgvector extension: NOT READY${NC}"
fi

if echo "$EXTENSIONS_CHECK" | grep -q "✅ uuid-ossp"; then
  echo -e "${GREEN}✅ uuid-ossp extension: READY${NC}"
else
  echo -e "${RED}❌ uuid-ossp extension: NOT READY${NC}"
fi

if [ ! -z "$VECTOR_TEST" ]; then
  echo -e "${GREEN}✅ Vector operations: FUNCTIONAL${NC}"
else
  echo -e "${RED}❌ Vector operations: NOT FUNCTIONAL${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Recommendations:${NC}"

if echo "$EXTENSIONS_CHECK" | grep -q "❌"; then
  echo "• Install missing PostgreSQL extensions"
fi

if echo "$PERFORMANCE_CHECK" | grep -q "⚠️"; then
  echo "• Review and optimize database performance settings"
fi

if echo "$SCHEMA_CHECK" | grep -q "critical tables found" && echo "$SCHEMA_CHECK" | grep -v "6/6"; then
  echo "• Run database migrations to create missing tables"
fi

echo "• Monitor database performance in production"
echo "• Set up automated backups if not configured"
echo "• Consider setting up connection pooling for high-traffic scenarios"

echo ""
echo -e "${GREEN}Database configuration validation complete! 🏁${NC}"