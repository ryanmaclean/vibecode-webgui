---
title: Azure Postgresql Deployment
description: Auto-generated placeholder. Update as needed.
---

# Azure PostgreSQL Deployment Guide

This guide outlines how to deploy the VibeCode platform on Azure PostgreSQL Flexible Server, addressing common pitfalls and providing solutions for proper pgvector setup.

## Overview

Azure PostgreSQL Flexible Server is an excellent choice for hosting the VibeCode database, but there are some specific considerations when setting up pgvector for vector embeddings support.

## Prerequisites

- Azure subscription
- Azure CLI installed
- PostgreSQL 14+ Flexible Server instance
- Appropriate networking setup (VNet, subnets, security groups)

## Azure PostgreSQL pgvector Limitations

### Important Note: shared_preload_libraries Limitation

**Azure PostgreSQL Flexible Server has a critical limitation**: You cannot add `vector` to the `shared_preload_libraries` parameter.

When attempting to run:

```bash
az postgres flexible-server parameter set \
  --resource-group myResourceGroup \
  --server-name myserver \
  --name shared_preload_libraries \
  --value "vector"
```

You'll receive an error like:

```
ERROR: (ServerParameterToCMSUnAllowedParameterValue) Value 'vector' is invalid for server parameter 'shared_preload_libraries'.
Allowed values are ',age,anon,auto_explain,azure_storage,pg_cron,pg_duckdb,pg_failover_slots,pg_hint_plan,pg_partman_bgw,pg_prewarm,pg_squeeze,pg_stat_statements,pgaudit,pglogical,timescaledb,wal2json'.
```

## Proper pgvector Setup on Azure PostgreSQL

Despite this limitation, pgvector can still work on Azure PostgreSQL. Here's how to set it up correctly:

### 1. Create your Azure PostgreSQL Flexible Server

```bash
# Create a resource group
az group create --name myResourceGroup --location eastus

# Create a PostgreSQL Flexible Server (note the high memory specs needed for vector operations)
az postgres flexible-server create \
  --resource-group myResourceGroup \
  --name vibecode-postgres \
  --admin-user vibecodeadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --storage-size 64 \
  --version 14

# Create the database
az postgres flexible-server db create \
  --resource-group myResourceGroup \
  --server-name vibecode-postgres \
  --database-name vibecode
```

### 2. Verify pgvector is Available

Connect to your database and check if pgvector is available in the extensions list:

```sql
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

If it's not listed, contact Azure support to enable it for your server.

### 3. Create the pgvector Extension

Skip adding vector to shared_preload_libraries and create the extension directly:

```sql
-- This works on Azure PostgreSQL without requiring shared_preload_libraries
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension was created successfully
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

### 4. Set Vector Dimensions for OpenAI Embeddings

For OpenAI embeddings (1536 dimensions):

```sql
-- Set dimensions for OpenAI embeddings
DO $$
DECLARE
  current_dimensions INTEGER;
BEGIN
  SELECT typmod INTO current_dimensions FROM pg_type WHERE typname = 'vector';
  IF current_dimensions < 1536 THEN
    EXECUTE 'ALTER TYPE vector SET (DIMENSIONS = 1536)';
  END IF;
END
$$;
```

### 5. Create an Optimized Vector Index

```sql
-- For better search quality (HNSW index)
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- OR for faster build time (IVFFlat index)
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

## Automatic Handling in VibeCode

VibeCode's `AzurePostgresConnection` class has built-in handling for this limitation. It:

1. Checks if pgvector is available in `pg_available_extensions`
2. Creates the extension without relying on `shared_preload_libraries`
3. Verifies the vector type exists and operations work correctly
4. Provides detailed error messages when issues occur

## Performance Tuning

For optimal performance with pgvector on Azure PostgreSQL:

```bash
# Set maintenance_work_mem for faster index creation
az postgres flexible-server parameter set \
  --resource-group myResourceGroup \
  --server-name vibecode-postgres \
  --name maintenance_work_mem \
  --value 1048576 # 1GB

# Set work_mem for query execution
az postgres flexible-server parameter set \
  --resource-group myResourceGroup \
  --server-name vibecode-postgres \
  --name work_mem \
  --value 262144 # 256MB
```

## Troubleshooting

If you encounter issues with pgvector on Azure PostgreSQL:

1. Verify pgvector is available:
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'vector';
   ```

2. Check if vector extension is already installed:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

3. Verify vector data type exists:
   ```sql
   SELECT typname FROM pg_type WHERE typname = 'vector';
   ```

4. Test vector operations:
   ```sql
   SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector AS cosine_distance;
   ```

5. Check server logs for detailed error messages:
   ```bash
   az postgres flexible-server logs list \
     --resource-group myResourceGroup \
     --name vibecode-postgres
   ```

## For More Information

For more detailed information, refer to:
- [docs/azure-postgres-pgvector-guide.md](docs/azure-postgres-pgvector-guide.md)
- [docs/postgres-vector-troubleshooting.md](docs/postgres-vector-troubleshooting.md)
- [Azure PostgreSQL Documentation](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/)