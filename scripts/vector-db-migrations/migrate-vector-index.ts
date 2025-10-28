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
import { parseArgs } from 'node:util';

// Strong types for script configuration and query results
type TargetIndexType = 'hnsw' | 'ivfflat';

interface Values {
  host: string;
  database: string;
  port: string;
  user: string;
  password?: string;
  'managed-identity': boolean;
  'table-name': string;
  'column-name': string;
  'target-index-type': TargetIndexType;
  'dry-run': boolean;
  verbose: boolean;
}

interface Config {
  host: string;
  database: string;
  port: number;
  user: string;
  password?: string;
  useManagedIdentity: boolean;
  tableName: string;
  columnName: string;
  targetIndexType: TargetIndexType;
  dryRun: boolean;
  verbose: boolean;
}

interface IndexConfig {
  createSql: (tableName: string, columnName: string, indexName: string) => string;
  description: string;
  pros: string;
  cons: string;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

interface IndexUsageStats {
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
}

// Build argument values. Avoid parsing CLI flags during tests or when imported.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMain = (require as any)?.main === module;
const isJest = !!process.env.JEST_WORKER_ID;
const values = (() => {
  if (isMain && !isJest) {
    const parsed = parseArgs({
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
      },
      allowPositionals: true,
    });
    return parsed.values as Values;
  }
  // Defaults for tests/imports
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DATABASE || 'vibecode',
    port: process.env.POSTGRES_PORT || '5432',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    'managed-identity': process.env.USE_MANAGED_IDENTITY === 'true',
    'table-name': 'rag_chunks',
    'column-name': 'embedding',
    'target-index-type': 'hnsw',
    'dry-run': process.env.DRY_RUN === 'true',
    verbose: process.env.VERBOSE === 'true',
  } as Values;
})();

// Configuration
const config: Config = {
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
const indexConfigs: Record<TargetIndexType, IndexConfig> = {
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
async function findExistingVectorIndexes(client: Client): Promise<IndexInfo[]> {
  const result = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1
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

  try {
    await client.query(createIndexSql);
    log(`✅ Shadow index created successfully: ${shadowIndexName}`);
  } catch (err) {
    log(`❌ Error creating shadow index: ${err}`);
    throw err;
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
async function getIndexUsageStats(client: Client, indexName: string): Promise<IndexUsageStats> {
  const result = await client.query(`
    SELECT
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes
    WHERE indexrelname = $1
  `, [indexName]);
  
  return result.rows.length > 0 ? (result.rows[0] as IndexUsageStats) : { idx_scan: 0, idx_tup_read: 0, idx_tup_fetch: 0 };
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

// Export for programmatic usage (tests, tooling)
export {
  getClient,
  checkPgVectorExtension,
  findExistingVectorIndexes,
  getIndexTypeFromDefinition,
  createShadowIndex,
  analyzeIndex,
  swapIndexes,
  setSearchPath,
  migrateVectorIndex,
  config,
};

// Only execute when run directly (prevents running during tests)
if ((require as any)?.main === module) {
  migrateVectorIndex().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}