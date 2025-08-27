/**
 * Vector Database Zero-Downtime Index Migration
 * 
 * This script demonstrates how to perform a zero-downtime migration
 * from one vector index type to another (e.g., IVFFlat to HNSW).
 * 
 * It uses a temporary "shadow" index to build the new index while
 * the application continues to use the old one, then swaps them with
 * minimal downtime.
 */

import { Client, ClientConfig } from 'pg';
import { DefaultAzureCredential } from '@azure/identity';
import { setTimeout } from 'timers/promises';
import { parseArgs } from 'node:util';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    host: { type: 'string', default: process.env.POSTGRES_HOST || 'localhost' },
    database: { type: 'string', default: process.env.POSTGRES_DATABASE || 'vibecode' },
    port: { type: 'string', default: process.env.POSTGRES_PORT || '5432' },
    user: { type: 'string', default: process.env.POSTGRES_USER || 'postgres' },
    password: { type: 'string', default: process.env.POSTGRES_PASSWORD },
    'managed-identity': { type: 'boolean', default: process.env.USE_MANAGED_IDENTITY === 'true' },
    'table-name': { type: 'string', default: 'rag_chunks' },
    'column-name': { type: 'string', default: 'embedding' },
    'target-index-type': { type: 'string', default: 'hnsw' },
    'dry-run': { type: 'boolean', default: process.env.DRY_RUN === 'true' },
    verbose: { type: 'boolean', default: process.env.VERBOSE === 'true' }
  }
});

// Configuration
const config = {
  host: values.host,
  database: values.database,
  port: parseInt(values.port),
  user: values.user,
  password: values.password,
  useManagedIdentity: values['managed-identity'],
  tableName: values['table-name'],
  columnName: values['column-name'],
  targetIndexType: values['target-index-type'],
  dryRun: values['dry-run'],
  verbose: values.verbose
};

// Index configurations
const indexConfigs = {
  hnsw: {
    createSql: (tableName, columnName, indexName) =>
      `CREATE INDEX CONCURRENTLY ${indexName} ON ${tableName} 
       USING hnsw (${columnName} vector_cosine_ops) 
       WITH (m = 16, ef_construction = 64)`,
    description: 'HNSW (Hierarchical Navigable Small World)',
    pros: 'Better search performance, higher recall',
    cons: 'Slower to build, uses more memory'
  },
  ivfflat: {
    createSql: (tableName, columnName, indexName) =>
      `CREATE INDEX CONCURRENTLY ${indexName} ON ${tableName} 
       USING ivfflat (${columnName} vector_cosine_ops) 
       WITH (lists = 100)`,
    description: 'IVFFlat (Inverted File with Flat Compression)',
    pros: 'Faster to build, uses less memory',
    cons: 'Slower search performance, lower recall'
  }
};

/**
 * Get a PostgreSQL client with Azure managed identity if configured
 */
async function getClient(): Promise<Client> {
  const clientConfig: ClientConfig = {
    host: config.host,
    database: config.database,
    port: config.port,
    user: config.user,
    ssl: config.host.includes('.postgres.database.azure.com') ? true : false
  };

  if (config.useManagedIdentity) {
    console.log('Using Azure Managed Identity for authentication...');
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
    clientConfig.password = token.token;
    
    // Azure PostgreSQL requires SSL
    clientConfig.ssl = {
      rejectUnauthorized: true
    };
  } else {
    clientConfig.password = config.password;
  }
  
  return new Client(clientConfig);
}

/**
 * Log messages with optional verbosity control
 */
function log(message: string, isVerbose = false): void {
  if (!isVerbose || config.verbose) {
    console.log(message);
  }
}

/**
 * Check if pgvector extension is available
 */
async function checkPgVectorExtension(client: Client): Promise<boolean> {
  const result = await client.query(`
    SELECT * FROM pg_extension WHERE extname = 'vector';
  `);
  
  return result.rows.length > 0;
}

/**
 * Find existing vector indexes on the table
 */
async function findExistingVectorIndexes(client: Client): Promise<any[]> {
  const result = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = $1
      AND indexdef LIKE '%' || $2 || '%'
      AND (indexdef LIKE '%vector_cosine_ops%' OR 
           indexdef LIKE '%vector_ip_ops%' OR 
           indexdef LIKE '%vector_l2_ops%')
  `, [config.tableName, config.columnName]);
  
  return result.rows;
}

/**
 * Get the index type from an index definition
 */
function getIndexTypeFromDefinition(indexDef: string): string {
  if (indexDef.includes('USING hnsw')) {
    return 'hnsw';
  } else if (indexDef.includes('USING ivfflat')) {
    return 'ivfflat';
  } else {
    return 'unknown';
  }
}

/**
 * Create a shadow index
 */
async function createShadowIndex(client: Client): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const shadowIndexName = `idx_shadow_${config.tableName}_${config.columnName}_${timestamp}`;
  
  log(`Creating shadow index: ${shadowIndexName} (${config.targetIndexType})...`);
  
  if (config.dryRun) {
    log('[DRY RUN] Would create shadow index');
    return shadowIndexName;
  }
  
  const createIndexSql = indexConfigs[config.targetIndexType].createSql(
    config.tableName, 
    config.columnName, 
    shadowIndexName
  );
  
  log(`SQL: ${createIndexSql}`, true);
  
  // Check index build progress using pg_stat_progress_create_index in a separate client
  const monitorClient = await getClient();
  await monitorClient.connect();
  
  // Start index creation
  const indexPromise = client.query(createIndexSql);
  
  // Monitor progress
  let monitoringActive = true;
  
  const monitorProgress = async () => {
    while (monitoringActive) {
      try {
        const progressResult = await monitorClient.query(`
          SELECT
            pid,
            phase,
            lockers_total,
            lockers_done,
            blocks_total,
            blocks_done,
            tuples_total,
            tuples_done,
            round(100.0 * blocks_done / nullif(blocks_total, 0), 2) AS blocks_percent,
            round(100.0 * tuples_done / nullif(tuples_total, 0), 2) AS tuples_percent
          FROM pg_stat_progress_create_index
          WHERE index_relid = (
            SELECT c.relfilenode
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
            ORDER BY c.relfilenode DESC
            LIMIT 1
          )
        `);
        
        if (progressResult.rows.length > 0) {
          const progress = progressResult.rows[0];
          log(`Index build progress: Phase ${progress.phase} | Blocks: ${progress.blocks_percent}% | Tuples: ${progress.tuples_percent}%`);
        }
      } catch (err) {
        log(`Error monitoring index progress: ${err}`, true);
      }
      
      await setTimeout(5000); // Check every 5 seconds
    }
  };
  
  // Start monitoring in background
  const monitorPromise = monitorProgress();
  
  // Wait for index creation to complete
  try {
    await indexPromise;
    log(`✅ Shadow index created successfully: ${shadowIndexName}`);
  } catch (err) {
    log(`❌ Error creating shadow index: ${err}`);
    throw err;
  } finally {
    // Stop monitoring
    monitoringActive = false;
    await monitorPromise;
    await monitorClient.end();
  }
  
  return shadowIndexName;
}

/**
 * Analyze the index to update statistics
 */
async function analyzeIndex(client: Client, indexName: string): Promise<void> {
  log(`Analyzing index ${indexName}...`);
  
  if (config.dryRun) {
    log('[DRY RUN] Would analyze index');
    return;
  }
  
  await client.query(`ANALYZE ${config.tableName}`);
  log(`✅ Index analyzed successfully`);
}

/**
 * Get index usage statistics
 */
async function getIndexUsageStats(client: Client, indexName: string): Promise<any> {
  const result = await client.query(`
    SELECT
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes
    WHERE indexrelname = $1
  `, [indexName]);
  
  return result.rows.length > 0 ? result.rows[0] : { idx_scan: 0, idx_tup_read: 0, idx_tup_fetch: 0 };
}

/**
 * Rename indexes to swap them
 */
async function swapIndexes(client: Client, oldIndexName: string, shadowIndexName: string): Promise<void> {
  log(`Swapping indexes: ${oldIndexName} -> ${shadowIndexName}...`);
  
  if (config.dryRun) {
    log('[DRY RUN] Would swap indexes');
    return;
  }
  
  // Use temporary name for old index
  const tempIndexName = `${oldIndexName}_old_temp`;
  
  // Begin transaction for atomic swap
  await client.query('BEGIN');
  
  try {
    // Rename old index to temp name
    await client.query(`ALTER INDEX ${oldIndexName} RENAME TO ${tempIndexName}`);
    
    // Rename shadow index to original name
    await client.query(`ALTER INDEX ${shadowIndexName} RENAME TO ${oldIndexName}`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    log(`✅ Indexes swapped successfully`);
    
    // Drop the old index outside of transaction
    log(`Dropping old index ${tempIndexName}...`);
    await client.query(`DROP INDEX ${tempIndexName}`);
    log(`✅ Old index dropped successfully`);
  } catch (err) {
    // Rollback on error
    await client.query('ROLLBACK');
    log(`❌ Error swapping indexes: ${err}`);
    throw err;
  }
}

/**
 * Set search path to target schema if needed
 */
async function setSearchPath(client: Client): Promise<void> {
  // Extract schema from table name if it contains a dot
  if (config.tableName.includes('.')) {
    const [schema] = config.tableName.split('.');
    await client.query(`SET search_path TO ${schema}, public`);
    log(`Set search path to ${schema}, public`, true);
  }
}

/**
 * Main migration function
 */
async function migrateVectorIndex(): Promise<void> {
  log('🔄 Starting vector index migration...');
  log('Configuration:', config.verbose);
  
  if (config.verbose) {
    console.log(config);
  }
  
  const client = await getClient();
  
  try {
    await client.connect();
    log('✅ Connected to PostgreSQL database');
    
    // Set search path if needed
    await setSearchPath(client);
    
    // Check if pgvector extension is installed
    const pgvectorInstalled = await checkPgVectorExtension(client);
    if (!pgvectorInstalled) {
      throw new Error('pgvector extension is not installed in the database');
    }
    log('✅ pgvector extension is installed');
    
    // Find existing vector indexes
    const existingIndexes = await findExistingVectorIndexes(client);
    
    if (existingIndexes.length === 0) {
      log(`No existing vector indexes found for ${config.tableName}.${config.columnName}`);
      
      // Create new index directly
      const newIndexName = `idx_${config.tableName.replace('.', '_')}_${config.columnName}_${config.targetIndexType}`;
      log(`Creating new ${config.targetIndexType} index: ${newIndexName}...`);
      
      if (!config.dryRun) {
        const createIndexSql = indexConfigs[config.targetIndexType].createSql(
          config.tableName,
          config.columnName,
          newIndexName
        );
        
        await client.query(createIndexSql);
        await analyzeIndex(client, newIndexName);
        log(`✅ New index ${newIndexName} created successfully`);
      } else {
        log('[DRY RUN] Would create new index');
      }
      
      return;
    }
    
    // Process each existing index
    for (const indexInfo of existingIndexes) {
      const oldIndexName = indexInfo.indexname;
      const oldIndexDef = indexInfo.indexdef;
      const oldIndexType = getIndexTypeFromDefinition(oldIndexDef);
      
      log(`Found existing index: ${oldIndexName} (${oldIndexType})`);
      log(`Definition: ${oldIndexDef}`, true);
      
      // If already using target index type, skip migration
      if (oldIndexType === config.targetIndexType) {
        log(`✅ Index is already using ${config.targetIndexType}, no migration needed`);
        continue;
      }
      
      // Compare index types
      log(`\nMigrating from ${oldIndexType} to ${config.targetIndexType}:`);
      log(`- Current: ${indexConfigs[oldIndexType]?.description || oldIndexType}`);
      log(`  Pros: ${indexConfigs[oldIndexType]?.pros || 'Unknown'}`);
      log(`  Cons: ${indexConfigs[oldIndexType]?.cons || 'Unknown'}`);
      
      log(`- Target: ${indexConfigs[config.targetIndexType].description}`);
      log(`  Pros: ${indexConfigs[config.targetIndexType].pros}`);
      log(`  Cons: ${indexConfigs[config.targetIndexType].cons}`);
      
      // Get baseline usage statistics
      const baselineStats = await getIndexUsageStats(client, oldIndexName);
      log(`\nCurrent index usage: ${JSON.stringify(baselineStats)}`, true);
      
      // Create shadow index
      const shadowIndexName = await createShadowIndex(client);
      
      // Analyze the shadow index
      await analyzeIndex(client, shadowIndexName);
      
      // Swap indexes
      await swapIndexes(client, oldIndexName, shadowIndexName);
      
      log(`\n✅ Index migration completed: ${oldIndexName} (${oldIndexType} → ${config.targetIndexType})`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    log('✅ Database connection closed');
  }
}

// Run the migration
migrateVectorIndex().catch(console.error);