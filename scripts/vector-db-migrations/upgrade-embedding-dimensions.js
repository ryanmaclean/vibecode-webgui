#!/usr/bin/env node

/**
 * Vector Database Migration Script
 * Upgrades embedding dimensions from 768 to 1536 dimensions
 * 
 * This script demonstrates how to safely migrate vector data when upgrading
 * from smaller to larger embedding dimensions.
 * 
 * Use case: When migrating from text-embedding-ada-002 (1536d) to 
 * text-embedding-3-small (1536d)
 */

const { Client } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');
const { setTimeout } = require('timers/promises');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DATABASE || 'vibecode',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  useManagedIdentity: process.env.USE_MANAGED_IDENTITY === 'true',
  batchSize: parseInt(process.env.BATCH_SIZE || '500'),
  dryRun: process.env.DRY_RUN === 'true',
  targetDimensions: parseInt(process.env.TARGET_DIMENSIONS || '1536'),
  logging: process.env.LOGGING === 'true',
  delayBetweenBatchesMs: parseInt(process.env.DELAY_MS || '1000'),
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '4')
};

// Tracking metrics
let stats = {
  totalRecords: 0,
  processedRecords: 0,
  failedRecords: 0,
  startTime: Date.now(),
  currentBatch: 0,
  totalBatches: 0
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
    return new Client({
      host: config.host,
      database: config.database,
      port: config.port,
      user: config.user,
      password: config.password,
      ssl: config.host.includes('.postgres.database.azure.com') ? true : false
    });
  }
}

/**
 * Get current vector dimensions
 */
async function getCurrentDimensions(client) {
  const result = await client.query(`
    SELECT typmod FROM pg_type WHERE typname = 'vector';
  `);
  
  if (result.rows.length === 0) {
    throw new Error('Vector type not found. Is pgvector extension installed?');
  }
  
  return parseInt(result.rows[0].typmod);
}

/**
 * Check if we need to upgrade the vector type
 */
async function checkVectorUpgrade(client) {
  const currentDimensions = await getCurrentDimensions(client);
  
  console.log(`Current vector dimensions: ${currentDimensions}`);
  console.log(`Target vector dimensions: ${config.targetDimensions}`);
  
  if (currentDimensions < config.targetDimensions) {
    console.log('🔄 Vector dimensions upgrade needed');
    return true;
  } else if (currentDimensions > config.targetDimensions) {
    console.warn('⚠️ Warning: Current dimensions larger than target. Downgrading dimensions is not recommended.');
    return false;
  } else {
    console.log('✅ Vector dimensions already at target size');
    return false;
  }
}

/**
 * Backup existing vector data
 */
async function backupVectorData(client, tableName, columns) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupTableName = `${tableName}_backup_${timestamp}`;
  
  console.log(`📦 Backing up table ${tableName} to ${backupTableName}...`);
  
  if (config.dryRun) {
    console.log('[DRY RUN] Would create backup table');
    return backupTableName;
  }
  
  await client.query(`CREATE TABLE ${backupTableName} AS SELECT * FROM ${tableName};`);
  
  const countResult = await client.query(`SELECT COUNT(*) FROM ${backupTableName};`);
  console.log(`✅ Backup created with ${countResult.rows[0].count} rows`);
  
  return backupTableName;
}

/**
 * Upgrade vector dimensions in the database
 */
async function upgradeVectorDimensions(client) {
  console.log(`⬆️ Upgrading vector dimensions to ${config.targetDimensions}...`);
  
  if (config.dryRun) {
    console.log('[DRY RUN] Would upgrade vector dimensions');
    return;
  }
  
  // For safety, check if there are any tables using vector type
  const tablesResult = await client.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE data_type = 'USER-DEFINED' AND udt_name = 'vector';
  `);
  
  if (tablesResult.rows.length > 0) {
    console.log(`Found ${tablesResult.rows.length} columns using vector type:`);
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_schema}.${row.table_name}.${row.column_name}`);
    });
    
    console.log('⚠️ All vector data will need to be re-generated after dimension upgrade');
  }
  
  // Alter the vector type dimensions
  await client.query(`
    ALTER TYPE vector SET (DIMENSIONS = ${config.targetDimensions});
  `);
  
  console.log('✅ Vector dimensions upgraded successfully');
}

/**
 * Get total count of records to process
 */
async function getTotalRecordCount(client, tableName, columnName, whereClause = '') {
  const query = `
    SELECT COUNT(*) 
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    ${whereClause ? 'AND ' + whereClause : ''}
  `;
  
  const result = await client.query(query);
  return parseInt(result.rows[0].count);
}

/**
 * Process vector data in batches
 */
async function processBatches(client, tableName, columnName, processor, whereClause = '') {
  // Get total records for progress tracking
  stats.totalRecords = await getTotalRecordCount(client, tableName, columnName, whereClause);
  stats.totalBatches = Math.ceil(stats.totalRecords / config.batchSize);
  
  console.log(`🔄 Processing ${stats.totalRecords} records in ${stats.totalBatches} batches...`);
  
  // Use cursor for efficient batch processing
  await client.query('BEGIN');
  
  const cursorName = 'vector_migration_cursor';
  const cursorQuery = `
    DECLARE ${cursorName} CURSOR FOR
    SELECT id, ${columnName}
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    ${whereClause ? 'AND ' + whereClause : ''}
    ORDER BY id
  `;
  
  await client.query(cursorQuery);
  
  let hasMoreBatches = true;
  let concurrentPromises = [];
  
  while (hasMoreBatches) {
    // Fetch next batch
    const batchResult = await client.query(`FETCH ${config.batchSize} FROM ${cursorName}`);
    stats.currentBatch++;
    
    if (batchResult.rows.length === 0) {
      hasMoreBatches = false;
      break;
    }
    
    // Process this batch
    console.log(`📊 Processing batch ${stats.currentBatch}/${stats.totalBatches} (${batchResult.rows.length} records)...`);
    
    if (config.dryRun) {
      console.log(`[DRY RUN] Would process ${batchResult.rows.length} records`);
      stats.processedRecords += batchResult.rows.length;
    } else {
      const processingPromise = processor(client, batchResult.rows, tableName, columnName)
        .then(processed => {
          stats.processedRecords += processed;
          // Calculate and display progress
          const progress = Math.round((stats.processedRecords / stats.totalRecords) * 100);
          const elapsedSeconds = Math.round((Date.now() - stats.startTime) / 1000);
          const recordsPerSecond = Math.round(stats.processedRecords / (elapsedSeconds || 1));
          
          console.log(`⏱️ Progress: ${progress}% (${stats.processedRecords}/${stats.totalRecords}) | Speed: ${recordsPerSecond} records/sec`);
        })
        .catch(err => {
          console.error(`❌ Error processing batch ${stats.currentBatch}:`, err);
          stats.failedRecords += batchResult.rows.length;
        });
      
      concurrentPromises.push(processingPromise);
      
      // Limit concurrency
      if (concurrentPromises.length >= config.maxConcurrency) {
        await Promise.race(concurrentPromises);
        concurrentPromises = concurrentPromises.filter(p => p.pending);
      }
      
      // Add a small delay between batches to reduce database load
      await setTimeout(config.delayBetweenBatchesMs);
    }
  }
  
  // Wait for all remaining promises to complete
  await Promise.all(concurrentPromises);
  
  await client.query(`CLOSE ${cursorName}`);
  await client.query('COMMIT');
  
  console.log(`✅ Completed processing ${stats.processedRecords}/${stats.totalRecords} records with ${stats.failedRecords} failures`);
}

/**
 * Regenerate embeddings for a batch of records
 * This is a placeholder for the actual embedding generation logic
 */
async function regenerateEmbeddings(client, batch, tableName, columnName) {
  // In a real implementation, you would:
  // 1. Extract the text content from each record
  // 2. Send to your embedding API to generate new embeddings
  // 3. Update the database with the new embeddings
  
  console.log(`🔄 Regenerating embeddings for ${batch.length} records (placeholder)...`);
  
  // This is a placeholder - in real implementation you would call your embedding API
  // and update the database with the new embeddings
  
  if (config.dryRun) {
    return batch.length;
  }
  
  // Simulating update in batches of 100
  const updateBatchSize = 100;
  for (let i = 0; i < batch.length; i += updateBatchSize) {
    const updateBatch = batch.slice(i, i + updateBatchSize);
    const updateQuery = `
      UPDATE ${tableName}
      SET ${columnName} = NULL
      WHERE id = ANY($1)
    `;
    
    await client.query(updateQuery, [updateBatch.map(row => row.id)]);
  }
  
  return batch.length;
}

/**
 * Recreate vector indexes after migration
 */
async function recreateIndexes(client, tableName, columnName, indexType = 'hnsw') {
  console.log(`🔄 Recreating indexes for ${tableName}.${columnName}...`);
  
  // Find existing vector indexes
  const indexResult = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = $1
      AND indexdef LIKE '%' || $2 || '%'
      AND (indexdef LIKE '%vector_cosine_ops%' OR 
           indexdef LIKE '%vector_ip_ops%' OR 
           indexdef LIKE '%vector_l2_ops%')
  `, [tableName, columnName]);
  
  if (indexResult.rows.length === 0) {
    console.log('No existing vector indexes found');
    
    // Create a new index if none exists
    if (config.dryRun) {
      console.log(`[DRY RUN] Would create new ${indexType} index`);
      return;
    }
    
    const indexName = `idx_${tableName}_${columnName}_${indexType}`;
    
    if (indexType === 'hnsw') {
      await client.query(`
        CREATE INDEX ${indexName} ON ${tableName} 
        USING hnsw (${columnName} vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);
    } else {
      await client.query(`
        CREATE INDEX ${indexName} ON ${tableName} 
        USING ivfflat (${columnName} vector_cosine_ops)
        WITH (lists = 100)
      `);
    }
    
    console.log(`✅ Created new ${indexType} index: ${indexName}`);
    return;
  }
  
  // Recreate existing indexes
  for (const index of indexResult.rows) {
    console.log(`Found index: ${index.indexname}`);
    console.log(`Definition: ${index.indexdef}`);
    
    if (config.dryRun) {
      console.log(`[DRY RUN] Would drop and recreate index: ${index.indexname}`);
      continue;
    }
    
    // Drop the existing index
    await client.query(`DROP INDEX IF EXISTS ${index.indexname}`);
    
    // Extract the index type and parameters from the definition
    const indexDef = index.indexdef;
    let newIndexDef = indexDef;
    
    // If dimensions changed, we need to recreate with the same parameters
    console.log(`✅ Recreated index: ${index.indexname}`);
    await client.query(newIndexDef);
  }
}

/**
 * Main migration function
 */
async function migrateVectorData() {
  console.log('📊 Starting vector database migration...');
  console.log('Configuration:', {
    ...config,
    password: config.password ? '***' : undefined
  });
  
  // Start timing
  stats.startTime = Date.now();
  
  // Get database client
  const client = await getClient();
  
  try {
    // Connect to the database
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Check if vector extension is installed
    const extensionResult = await client.query(`
      SELECT * FROM pg_extension WHERE extname = 'vector';
    `);
    
    if (extensionResult.rows.length === 0) {
      throw new Error('pgvector extension is not installed in the database');
    }
    
    console.log('✅ pgvector extension is installed');
    
    // Check if dimensions upgrade is needed
    const needsUpgrade = await checkVectorUpgrade(client);
    
    if (!needsUpgrade) {
      console.log('No dimension upgrade needed. Proceeding with data processing...');
    } else {
      // Tables with vector columns
      const vectorTablesResult = await client.query(`
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE data_type = 'USER-DEFINED' AND udt_name = 'vector';
      `);
      
      // Backup tables with vector columns
      for (const row of vectorTablesResult.rows) {
        const tableName = `${row.table_schema}.${row.table_name}`;
        const columnName = row.column_name;
        
        await backupVectorData(client, tableName, columnName);
      }
      
      // Upgrade vector dimensions
      await upgradeVectorDimensions(client);
      
      // Process each table
      for (const row of vectorTablesResult.rows) {
        const tableName = `${row.table_schema}.${row.table_name}`;
        const columnName = row.column_name;
        
        console.log(`\n📊 Processing table ${tableName}, column ${columnName}...`);
        
        // Process records in batches
        await processBatches(client, tableName, columnName, regenerateEmbeddings);
        
        // Recreate indexes
        await recreateIndexes(client, tableName, columnName);
      }
    }
    
    // Migration complete
    const totalTimeSeconds = Math.round((Date.now() - stats.startTime) / 1000);
    console.log(`\n✅ Vector migration completed in ${totalTimeSeconds} seconds`);
    console.log(`📊 Processed ${stats.processedRecords}/${stats.totalRecords} records with ${stats.failedRecords} failures`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run the migration
migrateVectorData().catch(console.error);