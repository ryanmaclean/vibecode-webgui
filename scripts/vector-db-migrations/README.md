# Vector Database Migration Patterns

This directory contains scripts and patterns for managing PostgreSQL databases with pgvector, with a focus on Azure PostgreSQL Flexible Server. These examples showcase best practices for maintaining, migrating, and optimizing vector databases for GenAI applications.

## Table of Contents

1. [Overview](#overview)
2. [Migration Patterns](#migration-patterns)
3. [Script Usage](#script-usage)
4. [Azure PostgreSQL Considerations](#azure-postgresql-considerations)
5. [Monitoring During Migrations](#monitoring-during-migrations)

## Overview

Vector databases using pgvector require special care during migrations due to:

- Large data volumes typical in GenAI applications
- Performance sensitivity of vector similarity operations
- Importance of maintaining index efficiency
- Zero-downtime requirements for production systems

The scripts in this directory implement proven patterns for safely migrating vector databases while maintaining performance and availability.

## Migration Patterns

### 1. Embedding Dimension Upgrade

**Script:** [upgrade-embedding-dimensions.js](./upgrade-embedding-dimensions.js)

This pattern handles the migration from one embedding model to another with different dimensions (e.g., upgrading from OpenAI's text-embedding-ada-002 to text-embedding-3-small).

**Key Features:**
- Safe dimension upgrade with backups
- Batch processing to avoid memory issues
- Progress tracking with detailed metrics
- Support for Azure Managed Identity

**When to Use:**
- When changing embedding models with different dimensions
- When upgrading pgvector to support higher dimensions
- After initial experimentation with lower-dimension models

### 2. Vector Index Migration

**Script:** [migrate-vector-index.ts](./migrate-vector-index.ts)

This pattern demonstrates how to migrate between different vector index types (e.g., IVFFlat to HNSW) with minimal downtime.

**Key Features:**
- Shadow index creation to avoid blocking reads
- Atomic index swap with minimal locking
- Detailed progress monitoring
- Performance comparison between index types

**When to Use:**
- When scaling up vector operations (HNSW typically performs better for large datasets)
- When scaling down (IVFFlat uses less memory)
- When optimizing for specific query patterns

### 3. Zero-Downtime Schema Migration

**Script:** [zero-downtime-schema-migration.js](./zero-downtime-schema-migration.js)

This pattern shows how to perform schema changes on tables containing vector data with minimal downtime.

**Key Features:**
- Staging table approach avoids long locks
- Handles vector columns and indexes properly
- Preserves data integrity with validation
- Creates automatic backups

**When to Use:**
- When adding new columns to vector tables
- When changing column types or constraints
- When reorganizing table structure

## Script Usage

### Embedding Dimension Upgrade

```bash
# With username/password
node upgrade-embedding-dimensions.js

# With environment variables
export POSTGRES_HOST="your-server.postgres.database.azure.com"
export POSTGRES_DATABASE="your-database"
export POSTGRES_USER="your-username"
export POSTGRES_PASSWORD="your-password"
export TARGET_DIMENSIONS=1536
node upgrade-embedding-dimensions.js

# With Azure Managed Identity
export POSTGRES_HOST="your-server.postgres.database.azure.com"
export POSTGRES_DATABASE="your-database"
export POSTGRES_USER="your-username"
export USE_MANAGED_IDENTITY=true
node upgrade-embedding-dimensions.js
```

### Vector Index Migration

```bash
# Install TypeScript if needed
npm install -g typescript

# Compile TypeScript
tsc migrate-vector-index.ts

# Basic usage
node migrate-vector-index.js --host=your-server.postgres.database.azure.com --database=your-database --user=your-username --password=your-password --table-name=rag_chunks --column-name=embedding --target-index-type=hnsw

# With Azure Managed Identity
node migrate-vector-index.js --host=your-server.postgres.database.azure.com --database=your-database --user=your-username --managed-identity --table-name=rag_chunks --column-name=embedding --target-index-type=hnsw
```

### Zero-Downtime Schema Migration

```bash
# Edit the schemaMigration object in the script to define your schema changes

# Basic usage
node zero-downtime-schema-migration.js

# With environment variables
export POSTGRES_HOST="your-server.postgres.database.azure.com"
export POSTGRES_DATABASE="your-database"
export POSTGRES_USER="your-username"
export POSTGRES_PASSWORD="your-password"
export TABLE_NAME="rag_chunks"
export SCHEMA_NAME="public"
node zero-downtime-schema-migration.js

# Dry run mode
export DRY_RUN=true
node zero-downtime-schema-migration.js
```

## Azure PostgreSQL Considerations

When running these migrations on Azure PostgreSQL Flexible Server, keep in mind:

1. **Authentication**
   - All scripts support both username/password and Azure Managed Identity
   - Using Managed Identity is recommended for security

2. **Resource Constraints**
   - Set batch sizes appropriate for your server tier
   - Monitor CPU and memory during migrations
   - Consider scheduling migrations during off-peak hours

3. **Maintenance Window**
   - Coordinate with Azure maintenance windows
   - Avoid migrations during automated backups

4. **Networking**
   - If using private endpoints, ensure your migration scripts run from a connected network
   - Consider running migration scripts in Azure (e.g., from Azure Functions or VMs)

5. **Monitoring**
   - Enable Query Store before migrations to capture performance changes
   - Use Azure Monitor alerts to detect issues during migration
   - Set up Datadog monitors to track vector query performance

## Monitoring During Migrations

During vector database migrations, monitor these key metrics:

1. **Performance Metrics**
   - Query latency for vector similarity searches
   - Database CPU and memory utilization
   - Transaction rate and active connections

2. **Vector-Specific Metrics**
   - Index scan vs. sequential scan rates
   - Index size and growth rate
   - Cache hit rates for vector queries

3. **Application Impact**
   - End-to-end latency for vector search operations
   - Error rates for vector operations
   - Overall application throughput

Use Datadog or Azure Monitor to create dashboards for these metrics before starting migrations.

## Best Practices

1. **Always create backups before migrations**
   - These scripts include backup mechanisms, but additional backups are recommended

2. **Start with a dry run**
   - All scripts support a dry run mode to show what changes would be made

3. **Test in staging first**
   - Validate migration scripts in a non-production environment before production use

4. **Monitor and validate results**
   - After migration, validate that vector queries return expected results
   - Compare performance before and after migration

5. **Keep original data until validation is complete**
   - The scripts create backup tables that can be kept until you're confident in the migration