#!/usr/bin/env node

/**
 * Vector Database Migration Script for Azure PostgreSQL
 * 
 * This script safely migrates vector embeddings to a new schema, table, or column,
 * with monitoring and rollback capabilities. It's designed for production use
 * with pgvector on Azure PostgreSQL Flexible Server.
 * 
 * Usage:
 * node migrate-vector-data.js [options]
 * 
 * Options:
 *   --source-table      Source table name (default: 'rag_chunks')
 *   --source-column     Source embedding column (default: 'embedding')
 *   --target-table      Target table name (default: 'rag_chunks_new')
 *   --target-column     Target embedding column (default: 'embedding')
 *   --batch-size        Number of vectors to migrate in each batch (default: 100)
 *   --dry-run           Validate migration without making changes (default: false)
 *   --with-index        Create vector index after migration (default: true)
 *   --index-type        Index type: 'ivfflat' or 'hnsw' (default: 'hnsw')
 *   --dimensions        Vector dimensions (default: 1536)
 *   --connection        Connection string (or use env var POSTGRES_CONNECTION)
 *   --monitor           Send metrics to Datadog (default: true)
 *   --notify            Send notifications on progress (default: true)
 *   --environment       Environment name for metrics (default: 'development')
 *   --help              Show this help message
 * 
 * Examples:
 *   // Basic usage with environment variables
 *   node migrate-vector-data.js
 * 
 *   // Migrate to a new table with a different index type
 *   node migrate-vector-data.js --target-table="embeddings_v2" --index-type="ivfflat"
 * 
 *   // Dry run to validate migration
 *   node migrate-vector-data.js --dry-run
 */

const { Pool } = require('pg');
const { program } = require('commander');
const { dog } = require('datadog-metrics');
const path = require('path');
const fs = require('fs');

// Configure CLI options
program
  .option('--source-table <table>', 'Source table name', 'rag_chunks')
  .option('--source-column <column>', 'Source embedding column', 'embedding')
  .option('--target-table <table>', 'Target table name', 'rag_chunks_new')
  .option('--target-column <column>', 'Target embedding column', 'embedding')
  .option('--batch-size <size>', 'Batch size for migration', 100)
  .option('--dry-run', 'Validate without making changes', false)
  .option('--with-index', 'Create vector index after migration', true)
  .option('--index-type <type>', 'Index type: ivfflat or hnsw', 'hnsw')
  .option('--dimensions <dims>', 'Vector dimensions', 1536)
  .option('--connection <string>', 'Connection string')
  .option('--monitor', 'Send metrics to Datadog', true)
  .option('--notify', 'Send notifications on progress', true)
  .option('--environment <env>', 'Environment name for metrics', process.env.NODE_ENV || 'development')
  .parse(process.argv);

const options = program.opts();

// Initialize connection
const connectionString = options.connection || process.env.POSTGRES_CONNECTION;
if (!connectionString) {
  console.error('Error: Connection string not provided. Use --connection or set POSTGRES_CONNECTION environment variable.');
  // Do not exit when running under Jest or when imported as a module
  if (require.main === module && !process.env.JEST_WORKER_ID) {
    process.exit(1);
  }
}

// Initialize Datadog if monitoring enabled
if (options.monitor) {
  dog.init({
    host: process.env.DD_HOST || 'localhost',
    prefix: 'vector.migration.',
    defaultTags: [`env:${options.environment}`]
  });
}

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  max: 5, // Limit connections for migration
  application_name: 'vector-migration'
});

// Migration state tracking
const migrationState = {
  totalRows: 0,
  processedRows: 0,
  failedRows: 0,
  startTime: Date.now(),
  batches: 0,
  lastLogTime: Date.now(),
  logInterval: 5000, // Log progress every 5 seconds
  migrationId: Date.now().toString(),
  rollbackNeeded: false,
  rollbackPoint: null,
};

// Create migration log file
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, `vector-migration-${migrationState.migrationId}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

/**
 * Log message to console and file
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Log to console
  if (level === 'error') {
    console.error(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
  
  // Log to file
  logStream.write(formattedMessage + '\n');
  
  // Send to Datadog if monitoring enabled
  if (options.monitor && level === 'error') {
    dog.increment('errors', 1);
  }
}

/**
 * Create target table if it doesn't exist
 */
async function createTargetTable() {
  const client = await pool.connect();
  
  try {
    log(`Ensuring pgvector extension is enabled`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    
    // Check if target table exists
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      ) as exists
    `, [options.targetTable]);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      log(`Target table ${options.targetTable} does not exist, creating it`);
      
      if (options.dryRun) {
        log(`[DRY RUN] Would create table ${options.targetTable}`);
      } else {
        // Get source table schema
        const schemaResult = await client.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
        `, [options.sourceTable]);
        
        // Create create table statement
        let createTableSQL = `CREATE TABLE ${options.targetTable} (\n`;
        
        // Add columns
        for (const column of schemaResult.rows) {
          // Skip source embedding column, we'll add the target one separately
          if (column.column_name === options.sourceColumn) continue;
          
          let dataType = column.data_type;
          if (dataType === 'character varying' && column.character_maximum_length) {
            dataType = `varchar(${column.character_maximum_length})`;
          }
          
          const nullable = column.is_nullable === 'YES' ? '' : ' NOT NULL';
          createTableSQL += `  ${column.column_name} ${dataType}${nullable},\n`;
        }
        
        // Add vector column
        createTableSQL += `  ${options.targetColumn} vector(${options.dimensions}),\n`;
        
        // Copy primary key from source (if exists)
        const pkResult = await client.query(`
          SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass
          AND i.indisprimary
        `, [options.sourceTable]);
        
        if (pkResult.rows.length > 0) {
          const pkColumns = pkResult.rows.map(row => row.attname).join(', ');
          createTableSQL += `  PRIMARY KEY (${pkColumns})\n`;
        } else {
          // Remove trailing comma
          createTableSQL = createTableSQL.slice(0, -2) + '\n';
        }
        
        createTableSQL += `);`;
        
        // Execute create table
        await client.query(createTableSQL);
        log(`Created target table ${options.targetTable}`);
      }
    } else {
      log(`Target table ${options.targetTable} already exists`);
      
      // Check if vector column exists
      const columnCheckResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        ) as exists
      `, [options.targetTable, options.targetColumn]);
      
      const columnExists = columnCheckResult.rows[0].exists;
      
      if (!columnExists) {
        log(`Adding vector column ${options.targetColumn} to existing table`);
        
        if (!options.dryRun) {
          await client.query(`
            ALTER TABLE ${options.targetTable} 
            ADD COLUMN ${options.targetColumn} vector(${options.dimensions})
          `);
        }
      }
    }
    
    return true;
  } catch (error) {
    log(`Error creating target table: ${error.message}`, 'error');
    return false;
  } finally {
    client.release();
  }
}

/**
 * Count total rows to migrate
 */
async function countRows() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT COUNT(*) as total FROM ${options.sourceTable}
      WHERE ${options.sourceColumn} IS NOT NULL
    `);
    
    migrationState.totalRows = parseInt(result.rows[0].total, 10);
    log(`Found ${migrationState.totalRows} rows with embeddings to migrate`);
    
    if (options.monitor) {
      dog.gauge('total_rows', migrationState.totalRows);
    }
    
    return migrationState.totalRows;
  } catch (error) {
    log(`Error counting rows: ${error.message}`, 'error');
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Create savepoint for potential rollback
 */
async function createSavepoint() {
  if (options.dryRun) return true;
  
  const client = await pool.connect();
  
  try {
    // Create a savepoint name
    migrationState.rollbackPoint = `vector_migration_${Date.now()}`;
    
    // Start transaction and create savepoint
    await client.query('BEGIN');
    await client.query(`SAVEPOINT ${migrationState.rollbackPoint}`);
    
    log(`Created savepoint ${migrationState.rollbackPoint}`);
    return true;
  } catch (error) {
    log(`Error creating savepoint: ${error.message}`, 'error');
    return false;
  } finally {
    client.release();
  }
}

/**
 * Migrate data in batches
 */
async function migrateData() {
  if (migrationState.totalRows === 0) {
    log('No data to migrate');
    return true;
  }
  
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    let offset = 0;
    let batchCount = 0;
    
    // Process in batches
    while (offset < migrationState.totalRows) {
      const batchStartTime = Date.now();
      
      // Get batch of embeddings
      const selectResult = await client.query(`
        SELECT *, ${options.sourceColumn} as source_embedding
        FROM ${options.sourceTable}
        WHERE ${options.sourceColumn} IS NOT NULL
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [options.batchSize, offset]);
      
      const rows = selectResult.rows;
      if (rows.length === 0) break;
      
      batchCount++;
      
      // Skip source embedding column in insert
      const columnNames = Object.keys(rows[0])
        .filter(col => col !== 'source_embedding' && col !== options.sourceColumn)
        .concat([options.targetColumn]);
      
      // Process each row in the batch
      for (const row of rows) {
        const values = columnNames.map(col => {
          if (col === options.targetColumn) {
            // Use source embedding for target
            return row.source_embedding;
          }
          return row[col];
        });
        
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        if (!options.dryRun) {
          try {
            // Insert data into target table
            await client.query(`
              INSERT INTO ${options.targetTable} (${columnNames.join(', ')})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `, values);
            
            migrationState.processedRows++;
          } catch (error) {
            log(`Error inserting row ${JSON.stringify(row.id)}: ${error.message}`, 'error');
            migrationState.failedRows++;
            migrationState.rollbackNeeded = true;
          }
        } else {
          // In dry run, just increment counter
          migrationState.processedRows++;
        }
      }
      
      offset += rows.length;
      
      // Log progress periodically
      if (Date.now() - migrationState.lastLogTime > migrationState.logInterval) {
        const progress = Math.round((migrationState.processedRows / migrationState.totalRows) * 100);
        const elapsed = (Date.now() - migrationState.startTime) / 1000;
        const rate = Math.round(migrationState.processedRows / elapsed);
        
        log(`Progress: ${progress}% (${migrationState.processedRows}/${migrationState.totalRows}) at ${rate} rows/sec`);
        
        if (options.monitor) {
          dog.gauge('progress_percent', progress);
          dog.gauge('processed_rows', migrationState.processedRows);
          dog.gauge('failed_rows', migrationState.failedRows);
          dog.gauge('processing_rate', rate);
        }
        
        migrationState.lastLogTime = Date.now();
      }
      
      // Track batch metrics
      const batchTime = Date.now() - batchStartTime;
      if (options.monitor) {
        dog.histogram('batch_time', batchTime);
      }
      
      // Commit batch if not in dry run
      if (!options.dryRun) {
        if (migrationState.rollbackNeeded) {
          log('Errors detected, rolling back batch', 'error');
          await client.query('ROLLBACK');
          return false;
        }
      }
    }
    
    // Commit the transaction if not in dry run
    if (!options.dryRun) {
      await client.query('COMMIT');
    }
    
    const totalTime = (Date.now() - migrationState.startTime) / 1000;
    log(`Migration ${options.dryRun ? 'dry run ' : ''}completed: ${migrationState.processedRows} rows in ${totalTime.toFixed(2)} seconds`);
    log(`Failed rows: ${migrationState.failedRows}`);
    
    if (options.monitor) {
      dog.gauge('total_time', totalTime);
      dog.increment('migration_complete', 1);
    }
    
    return migrationState.failedRows === 0;
  } catch (error) {
    log(`Error during migration: ${error.message}`, 'error');
    
    if (!options.dryRun) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        log(`Error during rollback: ${rollbackError.message}`, 'error');
      }
    }
    
    return false;
  } finally {
    client.release();
  }
}

/**
 * Create vector index on target table
 */
async function createVectorIndex() {
  if (options.dryRun || !options.withIndex) return true;
  
  const client = await pool.connect();
  
  try {
    const indexName = `idx_${options.targetTable}_${options.targetColumn}`;
    
    log(`Creating ${options.indexType} index on ${options.targetTable}(${options.targetColumn})`);
    
    // Set higher maintenance_work_mem for index creation
    await client.query(`SET maintenance_work_mem = '1GB'`);
    
    let indexSQL;
    if (options.indexType === 'hnsw') {
      indexSQL = `
        CREATE INDEX ${indexName}
        ON ${options.targetTable} USING hnsw (${options.targetColumn} vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
    } else {
      indexSQL = `
        CREATE INDEX ${indexName}
        ON ${options.targetTable} USING ivfflat (${options.targetColumn} vector_cosine_ops)
        WITH (lists = 100)
      `;
    }
    
    const startTime = Date.now();
    await client.query(indexSQL);
    const indexTime = (Date.now() - startTime) / 1000;
    
    log(`Created index ${indexName} in ${indexTime.toFixed(2)} seconds`);
    
    if (options.monitor) {
      dog.gauge('index_creation_time', indexTime);
    }
    
    return true;
  } catch (error) {
    log(`Error creating vector index: ${error.message}`, 'error');
    return false;
  } finally {
    client.release();
  }
}

/**
 * Validate migration results
 */
async function validateMigration() {
  const client = await pool.connect();
  
  try {
    // Count rows in target table
    const targetCount = await client.query(`
      SELECT COUNT(*) as count FROM ${options.targetTable}
      WHERE ${options.targetColumn} IS NOT NULL
    `);
    
    const targetRows = parseInt(targetCount.rows[0].count, 10);
    
    // Check if all rows were migrated
    const success = targetRows >= migrationState.processedRows - migrationState.failedRows;
    
    log(`Validation: Target table has ${targetRows} rows with embeddings`);
    log(`Validation ${success ? 'passed' : 'failed'}: Expected at least ${migrationState.processedRows - migrationState.failedRows} rows`);
    
    // Check a random sample for data integrity
    if (success && targetRows > 0 && !options.dryRun) {
      log('Performing data integrity check on sample rows');
      
      const sampleSize = Math.min(10, targetRows);
      const sampleRows = await client.query(`
        SELECT id FROM ${options.targetTable}
        WHERE ${options.targetColumn} IS NOT NULL
        ORDER BY random()
        LIMIT $1
      `, [sampleSize]);
      
      let integrityErrors = 0;
      
      for (const row of sampleRows.rows) {
        // Get embedding from source and target
        const sourceResult = await client.query(`
          SELECT ${options.sourceColumn} FROM ${options.sourceTable} WHERE id = $1
        `, [row.id]);
        
        const targetResult = await client.query(`
          SELECT ${options.targetColumn} FROM ${options.targetTable} WHERE id = $1
        `, [row.id]);
        
        if (sourceResult.rows.length === 0 || targetResult.rows.length === 0) {
          log(`Integrity check failed for row ${row.id}: Missing in source or target`, 'error');
          integrityErrors++;
          continue;
        }
        
        // Compare embeddings
        const sourceEmb = sourceResult.rows[0][options.sourceColumn];
        const targetEmb = targetResult.rows[0][options.targetColumn];
        
        if (JSON.stringify(sourceEmb) !== JSON.stringify(targetEmb)) {
          log(`Integrity check failed for row ${row.id}: Embeddings don't match`, 'error');
          integrityErrors++;
        }
      }
      
      if (integrityErrors === 0) {
        log(`Integrity check passed for ${sampleSize} sample rows`);
      } else {
        log(`Integrity check failed: ${integrityErrors}/${sampleSize} errors`, 'error');
        return false;
      }
    }
    
    return success;
  } catch (error) {
    log(`Error validating migration: ${error.message}`, 'error');
    return false;
  } finally {
    client.release();
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    log('Starting vector database migration');
    log(`Source: ${options.sourceTable}.${options.sourceColumn}`);
    log(`Target: ${options.targetTable}.${options.targetColumn}`);
    log(`Batch size: ${options.batchSize}`);
    log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    
    // Step 1: Prepare target table
    const tableReady = await createTargetTable();
    if (!tableReady) {
      log('Failed to prepare target table, aborting', 'error');
      return false;
    }
    
    // Step 2: Count rows to migrate
    const rowCount = await countRows();
    if (rowCount === 0) {
      log('No rows to migrate, exiting');
      return true;
    }
    
    // Step 3: Create savepoint for potential rollback
    if (!options.dryRun) {
      const savepointCreated = await createSavepoint();
      if (!savepointCreated) {
        log('Failed to create savepoint, aborting', 'error');
        return false;
      }
    }
    
    // Step 4: Migrate data
    const migrationSuccess = await migrateData();
    if (!migrationSuccess) {
      log('Migration failed, some rows could not be migrated', 'error');
      return false;
    }
    
    // Step 5: Create vector index
    if (options.withIndex && !options.dryRun) {
      const indexCreated = await createVectorIndex();
      if (!indexCreated) {
        log('Failed to create vector index', 'error');
        // Continue, as data is already migrated
      }
    }
    
    // Step 6: Validate migration
    const validationPassed = await validateMigration();
    if (!validationPassed) {
      log('Validation failed, migration may be incomplete', 'error');
      return false;
    }
    
    log('Migration completed successfully');
    return true;
  } catch (error) {
    log(`Unhandled error during migration: ${error.message}`, 'error');
    log(error.stack, 'error');
    return false;
  } finally {
    // Close pool and log file
    await pool.end();
    logStream.end();
    
    // Final Datadog metrics
    if (options.monitor) {
      dog.flush();
    }
  }
}

// Export for programmatic usage in tests and tooling
module.exports = {
  createTargetTable,
  countRows,
  createSavepoint,
  migrateData,
  createVectorIndex,
  validateMigration,
  runMigration,
  migrationState,
};

// Only execute when run directly from the CLI
if (require.main === module && !process.env.JEST_WORKER_ID) {
  runMigration().then(success => {
    process.exit(success ? 0 : 1);
  });
}