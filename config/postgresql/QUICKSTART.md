# PostgreSQL + pgvector Quick Start

Fast reference guide for launching and testing your PostgreSQL + pgvector database.

## Launch Database

```bash
# Navigate to project root
cd /Users/ryan.maclean/vibecode-webgui

# Start VM (first time - will take 10-15 minutes)
vfkit --config config/vfkit/postgresql-pgvector-vm.yaml

# Subsequent starts should be faster
```

## Test Connection

```bash
# From host machine
psql -h localhost -p 5432 -U vibecode -d vibecode

# When prompted, enter password: vibecode_prod_2024
```

## Update .env

```bash
# Add to .env
DATABASE_URL="postgresql://vibecode:vibecode_prod_2024@localhost:5432/vibecode?sslmode=require"
```

## Run Prisma Migrations

```bash
# Generate Prisma client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy

# Verify connection
npx prisma db pull
```

## Test Vector Operations

```sql
-- Connect to database
psql -h localhost -p 5432 -U vibecode -d vibecode

-- Test pgvector
vibecode=> \dx
-- Should show: vector | 0.7.4

-- Test vector query
vibecode=> SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector;

-- Test similarity search
vibecode=> SET search_path TO vector_test, public;
vibecode=> SELECT * FROM find_similar_code(
  array_fill(0.3, ARRAY[1536])::vector,
  0.5,
  5
);

-- View statistics
vibecode=> SELECT * FROM get_vector_stats();
```

## Quick Commands

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# View logs
tail -f /var/log/postgresql/postgresql-*.log

# Restart PostgreSQL (from VM)
pg_ctl restart -D /var/lib/postgresql/data

# Stop VM
# Press Ctrl+C in the vfkit terminal
```

## Connection Details

| Parameter | Value |
|-----------|-------|
| Host | localhost |
| Port | 5432 |
| Database | vibecode |
| User | vibecode |
| Password | vibecode_prod_2024 |
| SSL Mode | require |

## Admin Access

```bash
# Connect as superuser
psql -h localhost -p 5432 -U postgres -d postgres
# Password: postgres_admin_2024
```

## Common Issues

### Can't connect to database
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check VM status
vfkit list
```

### Port already in use
```bash
# Check what's using port 5432
lsof -i :5432

# Kill existing process or change port in config
```

### pgvector extension not found
```sql
-- Try recreating extension
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector;
```

## Need Help?

See full documentation: `/Users/ryan.maclean/vibecode-webgui/docs/POSTGRESQL_PGVECTOR_SETUP.md`
