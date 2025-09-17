# Vector Database Migration Utility

This directory contains tools for managing vector database schema migrations and data migrations for vector embeddings.

## Overview

The vector database migration utility provides a structured way to:

1. **Apply schema changes** to vector databases
2. **Migrate vector data** between schemas or databases
3. **Track migration history** for audit and rollback purposes
4. **Handle large datasets** with batching and error recovery
5. **Safely perform zero-downtime migrations**

## Directory Structure

```
vector-db-migrations/
├── migrations/           # Migration scripts
│   ├── YYYYMMDDHHMMSS_description.js   # Timestamp-based migrations
├── migrate-vector-data.js              # Tool for vector data migration
├── migrate-vector-index.ts             # Tool for vector index migration
├── vector-schema-migrator.js           # Core migration engine
├── zero-downtime-schema-migration.cjs   # Zero-downtime migration utility
└── README.md                           # This documentation
```

## Migration Format

Each migration is a JavaScript module with the following structure:

```javascript
/**
 * Migration: <description>
 * <detailed description>
 */

/**
 * Apply the migration (up)
 * @param {object} client - Database client
 * @returns {Promise<void>}
 */
exports.up = async (client) => {
  // Schema changes to apply
  await client.query(`
    -- SQL statements for schema changes
  `);
};

/**
 * Revert the migration (down)
 * @param {object} client - Database client
 * @returns {Promise<void>}
 */
exports.down = async (client) => {
  // SQL statements to undo schema changes
  await client.query(`
    -- SQL statements to revert changes
  `);
};
```

## Usage

### Creating a New Migration

1. Generate a timestamped migration file name:
   ```
   node scripts/vector-db-migrations/create-migration.js add_vector_index
   ```

2. Edit the generated file with your schema changes in the `up` and `down` functions.

### Running Migrations

To apply all pending migrations:

```
node scripts/vector-db-migrations/run-migrations.js
```

Options:
- `--env=<environment>`: Environment to run migrations on (default: development)
- `--dry-run`: Show what would be executed without applying changes
- `--verbose`: Show detailed output

### Rolling Back Migrations

To roll back the most recent migration:

```
node scripts/vector-db-migrations/rollback-migration.js
```

To roll back multiple migrations:

```
node scripts/vector-db-migrations/rollback-migration.js --steps=3
```

## Large Dataset Migrations

For large datasets, the utility provides batching support:

```javascript
exports.up = async (client) => {
  // Set batch size
  const batchSize = 1000;
  
  // Get total count
  const countResult = await client.query('SELECT COUNT(*) FROM source_table');
  const totalRecords = parseInt(countResult.rows[0].count);
  
  // Process in batches
  for (let offset = 0; offset < totalRecords; offset += batchSize) {
    await client.query('BEGIN');
    try {
      // Process batch
      await client.query(`
        INSERT INTO target_table (...)
        SELECT ...
        FROM source_table
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
};
```

## Zero-Downtime Migrations

For production environments, use the zero-downtime migration pattern:

```
node scripts/vector-db-migrations/zero-downtime-schema-migration.cjs \
  --table=document_embeddings \
  --operation=add-column \
  --column-name=embedding_model \
  --column-type="VARCHAR(100)"
```

## Best Practices

1. **Always include both `up` and `down` methods** for reversibility
2. **Use transactions** for data consistency
3. **Handle errors gracefully** with appropriate rollbacks
4. **Batch large operations** to avoid memory issues
5. **Add comments** to explain complex migrations
6. **Test migrations** in development before applying to production
7. **Validate data integrity** after migrations
8. **Back up data** before running migrations in production

## Testing

To test the migration system:

```
./scripts/test-vector-migration-utility.sh
```

This script runs a comprehensive test suite covering:
- Basic migration functionality
- Rollback capability
- Large dataset handling
- Edge case handling