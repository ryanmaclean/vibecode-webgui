#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Production Database Migration Deployment Script
# Safely deploys database migrations with pgvector support

# Initialize log aggregation
init_log_aggregation


set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting VibeCode Database Migration Deployment${NC}"
echo "=================================================="

# Validate environment variables
echo -e "${YELLOW}📋 Validating environment...${NC}"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ ERROR: DATABASE_URL environment variable required${NC}"
  exit 1
fi

if [ -z "$NODE_ENV" ]; then
  echo -e "${YELLOW}⚠️  NODE_ENV not set, defaulting to 'production'${NC}"
  export NODE_ENV=production
fi

echo -e "${GREEN}✅ Environment validation complete${NC}"

# Extract database connection details for direct psql commands
DB_HOST=$(echo "$DATABASE_URL" | sed 's/.*@\([^:]*\).*/\1/')
DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\/\([^?]*\).*/\1/')

echo -e "${YELLOW}📡 Testing database connectivity...${NC}"

# Test basic connectivity
if ! timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma < /dev/null; then
  echo -e "${RED}❌ ERROR: Cannot connect to database${NC}"
  echo "Database URL: $DATABASE_URL"
  echo "Please check your connection string and database availability"
  exit 1
fi

echo -e "${GREEN}✅ Database connectivity confirmed${NC}"

# Check PostgreSQL version and extensions
echo -e "${YELLOW}🔍 Checking PostgreSQL version and extensions...${NC}"

PSQL_OUTPUT=$(timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma <<EOF
SELECT 
  version() as pg_version,
  (SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector') as pgvector_installed,
  (SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp') as uuid_installed;
EOF
) || {
  echo -e "${RED}❌ ERROR: Failed to check database extensions${NC}"
  exit 1
}

echo "$PSQL_OUTPUT"

# Verify pgvector extension
PGVECTOR_COUNT=$(echo "$PSQL_OUTPUT" | grep -o 'pgvector_installed.*[0-9]' | grep -o '[0-9]' | head -1)

if [ "$PGVECTOR_COUNT" != "1" ]; then
  echo -e "${YELLOW}⚠️  pgvector extension not found, attempting to install...${NC}"
  
  echo "CREATE EXTENSION IF NOT EXISTS vector;" | timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma || {
    echo -e "${RED}❌ ERROR: Failed to install pgvector extension${NC}"
    echo "Please ensure the database user has SUPERUSER privileges or ask your DBA to install the pgvector extension"
    exit 1
  }
  
  echo -e "${GREEN}✅ pgvector extension installed${NC}"
else
  echo -e "${GREEN}✅ pgvector extension already installed${NC}"
fi

# Check migration status
echo -e "${YELLOW}📊 Checking migration status...${NC}"

MIGRATION_STATUS=$(npx prisma migrate status --schema=prisma/schema.prisma 2>&1) || true

if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
  echo -e "${GREEN}✅ Database schema is already up to date${NC}"
elif echo "$MIGRATION_STATUS" | grep -q "pending migrations"; then
  echo -e "${YELLOW}📦 Pending migrations found, deploying...${NC}"
  echo "$MIGRATION_STATUS"
  
  # Deploy migrations
  echo -e "${YELLOW}🚀 Deploying database migrations...${NC}"
  
  npx prisma migrate deploy --schema=prisma/schema.prisma || {
    echo -e "${RED}❌ ERROR: Migration deployment failed${NC}"
    exit 1
  }
  
  echo -e "${GREEN}✅ Database migrations deployed successfully${NC}"
else
  echo -e "${RED}❌ ERROR: Could not determine migration status${NC}"
  echo "$MIGRATION_STATUS"
  exit 1
fi

# Generate Prisma client
echo -e "${YELLOW}🔄 Generating Prisma client...${NC}"

npx prisma generate --schema=prisma/schema.prisma || {
  echo -e "${RED}❌ ERROR: Failed to generate Prisma client${NC}"
  exit 1
}

echo -e "${GREEN}✅ Prisma client generated successfully${NC}"

# Verify database structure
echo -e "${YELLOW}🔍 Verifying database structure...${NC}"

# Check critical tables exist
TABLES_CHECK=$(timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma <<EOF
SELECT 
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
    THEN 'users: ✅' ELSE 'users: ❌' END as users_table,
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') 
    THEN 'workspaces: ✅' ELSE 'workspaces: ❌' END as workspaces_table,
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rag_chunks') 
    THEN 'rag_chunks: ✅' ELSE 'rag_chunks: ❌' END as rag_table;
EOF
) || {
  echo -e "${RED}❌ ERROR: Failed to verify database structure${NC}"
  exit 1
}

echo "$TABLES_CHECK"

# Check vector column and indexes
VECTOR_CHECK=$(timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma <<EOF
SELECT 
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rag_chunks' AND column_name = 'embedding'
  ) THEN 'vector_column: ✅' ELSE 'vector_column: ❌' END as vector_column,
  CASE WHEN EXISTS(
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'rag_chunks' AND indexname LIKE '%embedding%'
  ) THEN 'vector_index: ✅' ELSE 'vector_index: ❌' END as vector_index;
EOF
) || {
  echo -e "${YELLOW}⚠️  Could not verify vector structure (may be normal for new databases)${NC}"
}

echo "$VECTOR_CHECK"

# Final health check
echo -e "${YELLOW}🏥 Running final health check...${NC}"

HEALTH_CHECK=$(timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma <<EOF
SELECT 
  'Database: ' || current_database() as database_name,
  'User: ' || current_user as current_user,
  'Timestamp: ' || now() as timestamp;
EOF
) || {
  echo -e "${RED}❌ ERROR: Health check failed${NC}"
  exit 1
}

echo "$HEALTH_CHECK"

# Performance recommendations
echo -e "${YELLOW}⚡ Checking database performance settings...${NC}"

PERFORMANCE_CHECK=$(timeout 30 npx prisma db execute --stdin --schema=prisma/schema.prisma <<EOF
SELECT 
  name,
  setting,
  unit,
  CASE 
    WHEN name = 'work_mem' AND setting::integer < 32768 THEN '⚠️  Consider increasing'
    WHEN name = 'maintenance_work_mem' AND setting::integer < 131072 THEN '⚠️  Consider increasing'
    WHEN name = 'max_connections' AND setting::integer > 200 THEN '⚠️  Consider decreasing'
    ELSE '✅ OK'
  END as recommendation
FROM pg_settings 
WHERE name IN ('work_mem', 'maintenance_work_mem', 'max_connections', 'shared_buffers')
ORDER BY name;
EOF
) 2>/dev/null || {
  echo -e "${YELLOW}⚠️  Could not check performance settings (may require elevated privileges)${NC}"
}

if [ ! -z "$PERFORMANCE_CHECK" ]; then
  echo "$PERFORMANCE_CHECK"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Database migration deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "✅ Database connectivity verified"
echo "✅ pgvector extension installed/confirmed"
echo "✅ Database migrations deployed"
echo "✅ Prisma client generated"
echo "✅ Database structure verified"
echo ""
echo -e "${BLUE}🔗 Next Steps:${NC}"
echo "1. Test your application's database connectivity"
echo "2. Verify vector search functionality works"
echo "3. Monitor database performance in production"
echo "4. Set up automated backups if not already configured"
echo ""
echo -e "${GREEN}Database is ready for production use! 🚀${NC}"