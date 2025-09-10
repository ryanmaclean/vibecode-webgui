#!/usr/bin/env node

/**
 * Zero-Downtime Vector Table Schema Migration
 * 
 * This script demonstrates how to safely migrate a table schema
 * that contains vector data with minimal downtime.
 * 
 * Use case: Adding columns, changing data types, or reorganizing
 * a table that contains vector embeddings without interrupting service.
 */

const { Client } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');

// Configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DATABASE || 'vibecode',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  useManagedIdentity: process.env.USE_MANAGED_IDENTITY === 'true',
  tableName: process.env.TABLE_NAME || 'rag_chunks',
  schemaName: process.env.SCHEMA_NAME || 'public',
  dryRun: process.env.DRY_RUN === 'true',
  logging: process.env.LOGGING === 'true',
  lockTimeout: process.env.LOCK_TIMEOUT || '5s',
  statementTimeout: process.env.STATEMENT_TIMEOUT || '60s'
};

// Schema migration specification
// This defines the changes to make to the table
const schemaMigration = {
  // Columns to add
  addColumns: [
    { name: 'metadata_json', type: 'JSONB', nullable: true },
    { name: 'last_accessed_at', type: 'TIMESTAMP WITH TIME ZONE', nullable: true, default: null },
    { name: 'embedding_model', type: 'VARCHAR(100)', nullable: true }
  ],
  
  // Columns to rename
  renameColumns: [
    { from: 'metadata', to: 'legacy_metadata' }
  ],
  
  // Columns to modify
  modifyColumns: [
    { name: 'content', type: 'TEXT', nullable: false }
  ],
  
  // Columns to drop (be very careful with this!)
  dropColumns: [
    // None in this example - vector migrations should typically preserve data
  ],
  
  // Indexes to create
  createIndexes: [
    { name: 'idx_rag_chunks_last_accessed', columns: ['last_accessed_at'] },
    { name: 'idx_rag_chunks_embedding_model', columns: ['embedding_model'] }
  ]
};

/**
 * Get a PostgreSQL client with Azure managed identity if configured
 */
async function getClient() {
  if (config.useManagedIdentity) {
    console.log('Using Azure Managed Identity for authentication...');
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
    
    return new Client({
      host: config.host,
      database: config.database,
      port: config.port,
      user: config.user,
      password: token.token,
      ssl: {
        rejectUnauthorized: true
      }
    });
  } else {
    const client = new Client({
      host: config.host,
      database: config.database,
      port: config.port,
      user: config.user,
      password: config.password,
      ssl: config.host.includes('.postgres.database.azure.com') ? true : false
    });
    return client;
  }
}

/**
 * Log with optional verbose mode
 */
function log(message, verbose = false) {
  if (!verbose || config.logging) {
    console.log(message);
  }
}

/**
 * Get the fully qualified table name
 */
function getFullTableName() {
  return `${config.schemaName}.${config.tableName}`;
}

/**
 * Check if pgvector extension is available
 */
async function checkPgVectorExtension(client) {
  const result = await client.query(`
    SELECT * FROM pg_extension WHERE extname = 'vector';
  `);
  
  return result.rows.length > 0;
}

/**
 * Get table information
 */
async function getTableInfo(client, tableName) {
  // Get columns
  const columnsResult = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [config.schemaName, tableName]);
  
  // Get indexes
  const indexesResult = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = $1 AND tablename = $2
  `, [config.schemaName, tableName]);
  
  // Get constraints
  const constraintsResult = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = $1 AND t.relname = $2
  `, [config.schemaName, tableName]);
  
  // Get vector columns
  const vectorColumnsResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
      AND data_type = 'USER-DEFINED' AND udt_name = 'vector'
  `, [config.schemaName, tableName]);
  
  return {
    columns: columnsResult.rows,
    indexes: indexesResult.rows,
    constraints: constraintsResult.rows,
    vectorColumns: vectorColumnsResult.rows.map(row => row.column_name)
  };
}

/**
 * Create a temporary staging table with new schema
 */
async function createStagingTable(client, sourceTableName, stagingTableName) {
  log(`Creating staging table ${stagingTableName}...`);
  
  // Get source table information
  const tableInfo = await getTableInfo(client, sourceTableName);
  
  // Generate column definitions for the staging table
  let columnDefs = [];
  // Helper: normalize data type casing/format to make output deterministic for tests
  const normalizeType = (t) => {
    const type = String(t || '');
    if (/^text$/i.test(type)) return 'text';
    if (/^user-defined$/i.test(type)) return 'vector'; // pgvector type
    return type; // leave others as-is
  };
  
  // Start with existing columns (excluding ones to be dropped)
  for (const column of tableInfo.columns) {
    // Skip columns that will be dropped
    if (schemaMigration.dropColumns.some(c => c === column.column_name)) {
      continue;
    }
    
    // Check if column will be renamed
    const renameInfo = schemaMigration.renameColumns.find(c => c.from === column.column_name);
    const columnName = renameInfo ? renameInfo.to : column.column_name;
    
    // Check if column type will be modified
    const modifyInfo = schemaMigration.modifyColumns.find(c => c.name === column.column_name);
    const dataType = modifyInfo ? modifyInfo.type : column.data_type;
    
    // Generate column definition with normalized type
    const normType = normalizeType(dataType);
    let columnDef = `${columnName} ${normType}`;

    // Add nullability (omit explicit ' NULL' for nullable)
    if (modifyInfo) {
      columnDef += modifyInfo.nullable === false ? ' NOT NULL' : '';
    } else {
      columnDef += column.is_nullable === 'NO' ? ' NOT NULL' : '';
    }
    
    // Add default if exists
    if (column.column_default && !modifyInfo) {
      columnDef += ` DEFAULT ${column.column_default}`;
    } else if (modifyInfo && modifyInfo.default !== undefined) {
      columnDef += ` DEFAULT ${modifyInfo.default}`;
    }
    
    columnDefs.push(columnDef);
  }
  
  // Add new columns
  for (const column of schemaMigration.addColumns) {
    let columnDef = `${column.name} ${normalizeType(column.type)}`;
    
    // Add nullability
    columnDef += column.nullable === false ? ' NOT NULL' : '';
    
    // Add default if exists
    if (column.default !== undefined) {
      columnDef += ` DEFAULT ${column.default}`;
    }
    
    columnDefs.push(columnDef);
  }
  
  // Create staging table
  const createTableSql = `
    CREATE TABLE ${stagingTableName} (
      ${columnDefs.join(',\n      ')}
    )
  `;
  
  log(`SQL: ${createTableSql}`, true);
  
  if (!config.dryRun) {
    await client.query(createTableSql);
    log(`✅ Staging table created successfully`);
  } else {
    log('[DRY RUN] Would create staging table');
  }
  
  return tableInfo;
}

/**
 * Copy data from source table to staging table
 */
async function copyDataToStagingTable(client, sourceTableName, stagingTableName, tableInfo) {
  log(`Copying data from ${sourceTableName} to ${stagingTableName}...`);
  
  // Generate column mapping
  let sourceColumns = [];
  let targetColumns = [];
  
  // Map existing columns (excluding ones to be dropped)
  for (const column of tableInfo.columns) {
    // Skip columns that will be dropped
    if (schemaMigration.dropColumns.some(c => c === column.column_name)) {
      continue;
    }
    
    // Check if column will be renamed
    const renameInfo = schemaMigration.renameColumns.find(c => c.from === column.column_name);
    
    sourceColumns.push(column.column_name);
    targetColumns.push(renameInfo ? renameInfo.to : column.column_name);
  }
  
  // Generate SQL to copy data
  const copyDataSql = `
    INSERT INTO ${stagingTableName} (${targetColumns.join(', ')})
    SELECT ${sourceColumns.join(', ')}
    FROM ${sourceTableName}
  `;
  
  log(`SQL: ${copyDataSql}`, true);
  
  if (!config.dryRun) {
    // Use a timeout to prevent long-running queries from blocking
    const timeout = process.env.STATEMENT_TIMEOUT || config.statementTimeout;
    await client.query(`SET statement_timeout = '${timeout}'`);
    
    // Start copying data
    const startTime = Date.now();
    await client.query(copyDataSql);
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // Get row counts
    const countResult = await client.query(`SELECT COUNT(*) FROM ${stagingTableName}`);
    const rowCount = parseInt(countResult.rows[0].count);
    
    log(`✅ Copied ${rowCount} rows in ${duration} seconds`);
  } else {
    log('[DRY RUN] Would copy data');
  }
}

/**
 * Create indexes on staging table
 */
async function createIndexesOnStagingTable(client, stagingTableName, tableInfo) {
  log(`Creating indexes on ${stagingTableName}...`);
  
  // Create regular indexes
  for (const indexInfo of tableInfo.indexes) {
    // Skip primary key indexes and vector indexes (we'll handle those separately)
    if (indexInfo.indexdef.includes('PRIMARY KEY') || 
        indexInfo.indexdef.includes('vector_cosine_ops') ||
        indexInfo.indexdef.includes('vector_ip_ops') ||
        indexInfo.indexdef.includes('vector_l2_ops')) {
      continue;
    }
    
    // Adjust index definition for the staging table
    let indexDef = indexInfo.indexdef.replace(
      new RegExp(`ON ${config.schemaName}\\.${config.tableName}`, 'i'),
      `ON ${stagingTableName}`
    );
    
    // Rename the index
    indexDef = indexDef.replace(
      /CREATE INDEX (\w+)/i,
      `CREATE INDEX ${indexInfo.indexname}_staging`
    );
    
    // Handle renamed columns
    for (const rename of schemaMigration.renameColumns) {
      indexDef = indexDef.replace(
        new RegExp(`\\(${rename.from}\\)`, 'g'),
        `(${rename.to})`
      );
      
      indexDef = indexDef.replace(
        new RegExp(`\\(${rename.from},`, 'g'),
        `(${rename.to},`
      );
      
      indexDef = indexDef.replace(
        new RegExp(`, ${rename.from}\\)`, 'g'),
        `, ${rename.to})`
      );
      
      indexDef = indexDef.replace(
        new RegExp(`, ${rename.from},`, 'g'),
        `, ${rename.to},`
      );
    }
    
    log(`Creating index: ${indexDef}`, true);
    
    if (!config.dryRun) {
      await client.query(indexDef);
    } else {
      log('[DRY RUN] Would create index');
    }
  }
  
  // Create vector indexes
  for (const vectorColumn of tableInfo.vectorColumns) {
    // Check if the column was renamed
    const renameInfo = schemaMigration.renameColumns.find(c => c.from === vectorColumn);
    const columnName = renameInfo ? renameInfo.to : vectorColumn;
    
    // Find the existing vector index definition
    const vectorIndexInfo = tableInfo.indexes.find(idx => 
      idx.indexdef.includes(vectorColumn) && 
      (idx.indexdef.includes('vector_cosine_ops') || 
       idx.indexdef.includes('vector_ip_ops') || 
       idx.indexdef.includes('vector_l2_ops'))
    );
    
    if (vectorIndexInfo) {
      // Adjust index definition for the staging table
      let indexDef = vectorIndexInfo.indexdef.replace(
        new RegExp(`ON ${config.schemaName}\\.${config.tableName}`, 'i'),
        `ON ${stagingTableName}`
      );
      
      // Rename the index
      indexDef = indexDef.replace(
        /CREATE INDEX (\w+)/i,
        `CREATE INDEX ${vectorIndexInfo.indexname}_staging`
      );
      
      // Update column name if renamed
      if (renameInfo) {
        indexDef = indexDef.replace(
          new RegExp(`\\(${vectorColumn}`, 'g'),
          `(${columnName}`
        );
      }
      
      log(`Creating vector index: ${indexDef}`, true);
      
      if (!config.dryRun) {
        await client.query(indexDef);
      } else {
        log('[DRY RUN] Would create vector index');
      }
    }
  }
  
  // Create new indexes specified in the migration
  for (const indexInfo of schemaMigration.createIndexes) {
    const indexName = `${indexInfo.name}_staging`;
    const columns = indexInfo.columns.join(', ');
    
    const createIndexSql = `
      CREATE INDEX ${indexName} ON ${stagingTableName} (${columns})
    `;
    
    log(`Creating new index: ${createIndexSql}`, true);
    
    if (!config.dryRun) {
      await client.query(createIndexSql);
    } else {
      log('[DRY RUN] Would create new index');
    }
  }
  
  if (!config.dryRun) {
    log(`✅ Indexes created successfully`);
  }
}

/**
 * Swap tables with minimal downtime
 */
async function swapTables(client, sourceTableName, stagingTableName) {
  log(`Swapping tables: ${sourceTableName} -> ${stagingTableName}...`);
  
  // Generate a timestamp-based backup table name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupTableName = `${sourceTableName}_backup_${timestamp}`;
  
  if (!config.dryRun) {
    // Set lock timeout to prevent long blocking
    await client.query(`SET lock_timeout = '${config.lockTimeout}'`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    try {
      log('Acquiring exclusive lock on source table...');
      
      // Lock the table to prevent writes during the swap
      await client.query(`LOCK TABLE ${sourceTableName} IN ACCESS EXCLUSIVE MODE`);
      
      log('Renaming tables...');
      
      // Rename source table to backup
      await client.query(`ALTER TABLE ${sourceTableName} RENAME TO ${backupTableName.split('.')[1]}`);
      
      // Rename staging table to source
      await client.query(`ALTER TABLE ${stagingTableName} RENAME TO ${sourceTableName.split('.')[1]}`);
      
      // Commit transaction
      await client.query('COMMIT');
      
      log(`✅ Tables swapped successfully`);
      log(`Original table backed up as ${backupTableName}`);
    } catch (err) {
      // Rollback on error
      await client.query('ROLLBACK');
      log(`❌ Error swapping tables: ${err}`);
      throw err;
    }
  } else {
    log('[DRY RUN] Would swap tables');
  }
  
  return backupTableName;
}

/**
 * Validate the migration
 */
async function validateMigration(client, tableName) {
  log(`Validating migration for ${tableName}...`);
  
  // Get table information
  const tableInfo = await getTableInfo(client, tableName.split('.')[1]);
  
  // Verify added columns
  for (const column of schemaMigration.addColumns) {
    const columnExists = tableInfo.columns.some(c => c.column_name === column.name);
    log(`Column ${column.name}: ${columnExists ? '✅' : '❌'}`);
  }
  
  // Verify renamed columns
  for (const rename of schemaMigration.renameColumns) {
    const columnExists = tableInfo.columns.some(c => c.column_name === rename.to);
    log(`Renamed column ${rename.from} -> ${rename.to}: ${columnExists ? '✅' : '❌'}`);
  }
  
  // Verify modified columns
  for (const modify of schemaMigration.modifyColumns) {
    const column = tableInfo.columns.find(c => c.column_name === modify.name);
    
    if (column) {
      const typeMatches = column.data_type.toUpperCase().includes(modify.type.toUpperCase());
      log(`Modified column ${modify.name} type: ${typeMatches ? '✅' : '❌'}`);
    } else {
      log(`Modified column ${modify.name}: ❌ (not found)`);
    }
  }
  
  // Verify new indexes
  for (const index of schemaMigration.createIndexes) {
    const indexExists = tableInfo.indexes.some(i => i.indexname === index.name);
    log(`Index ${index.name}: ${indexExists ? '✅' : '❌'}`);
  }
  
  log('✅ Migration validation complete');
}

/**
 * Main migration function
 */
async function migrateTableSchema() {
  log('🔄 Starting zero-downtime table schema migration...');
  
  // Get the full table names
  const sourceTableName = getFullTableName();
  const stagingTableName = `${sourceTableName}_staging`;
  
  // Log configuration
  log('Configuration:');
  log(`- Source table: ${sourceTableName}`);
  log(`- Staging table: ${stagingTableName}`);
  log(`- Dry run: ${config.dryRun}`);
  
  // Get database client
  const client = await getClient();
  
  try {
    // Connect to the database
    await client.connect();
    log('✅ Connected to PostgreSQL database');
    
    // Check if pgvector extension is installed
    const pgvectorInstalled = await checkPgVectorExtension(client);
    if (!pgvectorInstalled) {
      throw new Error('pgvector extension is not installed in the database');
    }
    log('✅ pgvector extension is installed');
    
    // Create staging table with new schema
    const tableInfo = await createStagingTable(client, config.tableName, stagingTableName);
    
    // Copy data to staging table
    await copyDataToStagingTable(client, sourceTableName, stagingTableName, tableInfo);
    
    // Create indexes on staging table
    await createIndexesOnStagingTable(client, stagingTableName, tableInfo);
    
    // Analyze the staging table
    if (!config.dryRun) {
      log('Analyzing staging table...');
      await client.query(`ANALYZE ${stagingTableName}`);
    } else {
      log('[DRY RUN] Would analyze staging table');
    }
    
    // Swap tables
    const backupTableName = await swapTables(client, sourceTableName, stagingTableName);
    
    // Validate the migration
    if (!config.dryRun) {
      await validateMigration(client, sourceTableName);
    }
    
    log(`\n✅ Schema migration completed successfully!`);
    
    if (!config.dryRun) {
      log(`\nBackup table created: ${backupTableName}`);
      log('To drop the backup table when no longer needed:');
      log(`DROP TABLE ${backupTableName};`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection (guarded for tests)
    try {
      if (client && typeof client.end === 'function') {
        await client.end();
      }
    } catch {}
    log('✅ Database connection closed');
  }
}

// Export functions for programmatic use (tests, tooling)
module.exports = {
  getClient,
  getTableInfo,
  createStagingTable,
  copyDataToStagingTable,
  createIndexesOnStagingTable,
  swapTables,
  validateMigration,
  migrateTableSchema,
  config,
};

// Only run when executed directly (prevents accidental execution during tests)
if (require.main === module) {
  migrateTableSchema().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}