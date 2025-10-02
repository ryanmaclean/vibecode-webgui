#!/usr/bin/env node

/**
 * Vector Database Performance Benchmark for Azure PostgreSQL
 * 
 * This script benchmarks vector search performance on Azure PostgreSQL with pgvector,
 * sending metrics to Datadog for monitoring and visualization.
 * 
 * It measures:
 * - Vector search latency (avg, p95, p99)
 * - Search throughput under different loads
 * - Index effectiveness
 * - Memory and CPU impact
 * 
 * Usage:
 *   node benchmark-vector-search.js [options]
 * 
 * Options:
 *   --table <name>         Table to benchmark (default: 'rag_chunks')
 *   --column <name>        Vector column name (default: 'embedding')
 *   --dimensions <num>     Vector dimensions (default: 1536)
 *   --queries <num>        Number of queries to run (default: 100)
 *   --concurrency <num>    Concurrent queries (default: 10)
 *   --k <num>              Number of results to fetch (default: 10)
 *   --index-type <type>    Index type to test: ivfflat, hnsw, none (default: test all)
 *   --output <file>        Output file for results (default: 'benchmark-results.json')
 *   --connection <string>  Connection string (or use POSTGRES_CONNECTION env var)
 *   --monitor              Send metrics to Datadog (default: false)
 *   --environment <env>    Environment name for metrics (default: 'development')
 *   --help                 Show this help message
 */

const { Pool } = require('pg');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const os = require('os');
const cluster = require('cluster');
const pMap = require('p-map');
const { v4: uuidv4 } = require('uuid');

let dog;
try {
  dog = require('datadog-metrics');
} catch (err) {
  // Optional dependency
}

// Configure CLI options
program
  .option('--table <name>', 'Table to benchmark', 'rag_chunks')
  .option('--column <name>', 'Vector column name', 'embedding')
  .option('--dimensions <num>', 'Vector dimensions', 1536)
  .option('--queries <num>', 'Number of queries to run', 100)
  .option('--concurrency <num>', 'Concurrent queries', 10)
  .option('--k <num>', 'Number of results to fetch', 10)
  .option('--index-type <type>', 'Index type to test: ivfflat, hnsw, none (default: test all)')
  .option('--output <file>', 'Output file for results', 'benchmark-results.json')
  .option('--connection <string>', 'Connection string')
  .option('--monitor', 'Send metrics to Datadog', false)
  .option('--environment <env>', 'Environment name for metrics', process.env.NODE_ENV || 'development')
  .parse(process.argv);

const options = program.opts();

// Validate options
options.dimensions = parseInt(options.dimensions, 10);
options.queries = parseInt(options.queries, 10);
options.concurrency = parseInt(options.concurrency, 10);
options.k = parseInt(options.k, 10);

// Initialize Datadog if monitoring enabled
if (options.monitor && dog) {
  dog.init({
    host: process.env.DD_HOST || 'localhost',
    prefix: 'vector.benchmark.',
    defaultTags: [`env:${options.environment}`]
  });
}

// Initialize connection
const connectionString = options.connection || process.env.POSTGRES_CONNECTION;
if (!connectionString) {
  console.error('Error: Connection string not provided. Use --connection or set POSTGRES_CONNECTION environment variable.');
  process.exit(1);
}

// Global results object
const results = {
  metadata: {
    timestamp: new Date().toISOString(),
    table: options.table,
    column: options.column,
    dimensions: options.dimensions,
    queries: options.queries,
    concurrency: options.concurrency,
    k: options.k,
    environment: options.environment,
    system: {
      cpu: os.cpus().length,
      memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
      platform: os.platform(),
      node: process.version
    }
  },
  postgresql: {},
  tests: [],
  summary: {}
};

/**
 * Generate a random vector with specified dimensions
 */
function generateRandomVector(dimensions) {
  const vector = [];
  for (let i = 0; i < dimensions; i++) {
    vector.push((Math.random() * 2) - 1); // Random values between -1 and 1
  }
  return vector;
}

/**
 * Normalize a vector to unit length (for cosine similarity)
 */
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

/**
 * Get PostgreSQL and pgvector info
 */
async function getPostgresInfo(pool) {
  const client = await pool.connect();
  
  try {
    // Get PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    results.postgresql.version = versionResult.rows[0].version;
    
    // Get pgvector version
    const pgvectorResult = await client.query(`
      SELECT default_version
      FROM pg_available_extensions
      WHERE name = 'vector'
    `);
    
    if (pgvectorResult.rows.length > 0) {
      results.postgresql.pgvector_version = pgvectorResult.rows[0].default_version;
    }
    
    // Get instance details from Azure
    try {
      const azureResult = await client.query(`
        SELECT * FROM pg_stat_database_conflicts
        WHERE datname = current_database()
      `);
      
      results.postgresql.is_azure = true;
    } catch (err) {
      results.postgresql.is_azure = false;
    }
    
    // Get connection pool stats
    results.postgresql.max_connections = (await client.query('SHOW max_connections')).rows[0].max_connections;
    results.postgresql.current_connections = (await client.query(`
      SELECT count(*) as count FROM pg_stat_activity
    `)).rows[0].count;
    
    // Get table info
    const tableResult = await client.query(`
      SELECT count(*) as row_count
      FROM ${options.table}
      WHERE ${options.column} IS NOT NULL
    `);
    
    results.postgresql.table_row_count = parseInt(tableResult.rows[0].row_count, 10);
    
    // Get vector indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = $1
        AND indexdef LIKE '%vector%'
    `, [options.table]);
    
    results.postgresql.vector_indexes = indexResult.rows.map(row => ({
      name: row.indexname,
      definition: row.indexdef
    }));
    
    return true;
  } catch (error) {
    console.error(`Error getting PostgreSQL info: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Prepare indexes for testing
 */
async function prepareIndexes(pool, indexType) {
  const client = await pool.connect();
  
  try {
    // Set maintenance_work_mem for index creation
    await client.query(`SET maintenance_work_mem = '1GB'`);
    
    // Get existing indexes
    const indexesResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = $1
        AND indexdef LIKE '%${options.column}%'
    `, [options.table]);
    
    const existingIndexes = indexesResult.rows.map(row => row.indexname);
    
    // If testing without index, drop all vector indexes
    if (indexType === 'none') {
      for (const idx of existingIndexes) {
        console.log(`Dropping index ${idx} for 'none' index test`);
        await client.query(`DROP INDEX IF EXISTS ${idx}`);
      }
      return true;
    }
    
    // If specific index type requested, ensure it exists
    if (indexType) {
      // Generate index name
      const indexName = `idx_benchmark_${options.table}_${options.column}_${indexType}`;
      
      // Check if requested index already exists
      const hasRequestedIndex = existingIndexes.some(idx => 
        idx.includes(indexType) && idx.includes(options.column));
        
      if (!hasRequestedIndex) {
        // Drop other vector indexes first
        for (const idx of existingIndexes) {
          console.log(`Dropping existing index ${idx} before creating ${indexType} index`);
          await client.query(`DROP INDEX IF EXISTS ${idx}`);
        }
        
        // Create requested index type
        console.log(`Creating ${indexType} index for benchmark`);
        
        if (indexType === 'ivfflat') {
          await client.query(`
            CREATE INDEX ${indexName}
            ON ${options.table} USING ivfflat (${options.column} vector_cosine_ops)
            WITH (lists = 100)
          `);
        } else if (indexType === 'hnsw') {
          await client.query(`
            CREATE INDEX ${indexName}
            ON ${options.table} USING hnsw (${options.column} vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error preparing indexes: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Get sample vectors from the database
 */
async function getSampleVectors(pool, count) {
  const client = await pool.connect();
  
  try {
    // Get random sample of vectors
    const result = await client.query(`
      SELECT ${options.column}
      FROM ${options.table}
      WHERE ${options.column} IS NOT NULL
      ORDER BY random()
      LIMIT $1
    `, [count]);
    
    if (result.rows.length === 0) {
      console.log('No vectors found in the database, generating random vectors');
      
      // Generate random vectors if none found
      return Array(count).fill(0).map(() => 
        normalizeVector(generateRandomVector(options.dimensions))
      );
    }
    
    return result.rows.map(row => row[options.column]);
  } catch (error) {
    console.error(`Error getting sample vectors: ${error.message}`);
    return Array(count).fill(0).map(() => 
      normalizeVector(generateRandomVector(options.dimensions))
    );
  } finally {
    client.release();
  }
}

/**
 * Run single vector search query
 */
async function runVectorQuery(pool, vector, indexType) {
  const client = await pool.connect();
  
  try {
    // Format vector for query
    const vectorStr = `[${vector.join(',')}]`;
    
    // Set index parameters if needed
    if (indexType === 'hnsw') {
      await client.query('SET hnsw.ef_search = 100');
    }
    
    // Measure query time
    const startTime = performance.now();
    
    // Run query
    await client.query(`
      SELECT id
      FROM ${options.table}
      ORDER BY ${options.column} <=> $1::vector
      LIMIT $2
    `, [vectorStr, options.k]);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    return duration;
  } catch (error) {
    console.error(`Error in vector query: ${error.message}`);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  if (p <= 0) return sortedArr[0];
  if (p >= 100) return sortedArr[sortedArr.length - 1];
  
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[index];
}

/**
 * Format latency statistics
 */
function formatLatencyStats(durations) {
  if (durations.length === 0) return null;
  
  // Sort durations for percentiles
  const sorted = [...durations].sort((a, b) => a - b);
  
  return {
    min: Math.min(...durations).toFixed(2),
    max: Math.max(...durations).toFixed(2),
    avg: (durations.reduce((sum, d) => sum + d, 0) / durations.length).toFixed(2),
    p50: percentile(sorted, 50).toFixed(2),
    p90: percentile(sorted, 90).toFixed(2),
    p95: percentile(sorted, 95).toFixed(2),
    p99: percentile(sorted, 99).toFixed(2),
    samples: durations.length
  };
}

/**
 * Run benchmark test for specific index type
 */
async function runBenchmark(indexType) {
  console.log(`\nRunning benchmark with index type: ${indexType}`);
  
  const pool = new Pool({
    connectionString,
    max: options.concurrency + 2, // Extra connections for management
    application_name: 'vector-benchmark'
  });
  
  try {
    // Prepare index
    const indexReady = await prepareIndexes(pool, indexType);
    if (!indexReady) {
      console.error(`Failed to prepare ${indexType} index, skipping test`);
      return;
    }
    
    // Get sample vectors
    const sampleVectors = await getSampleVectors(pool, options.queries);
    if (sampleVectors.length < options.queries) {
      console.warn(`Only found ${sampleVectors.length} vectors, using what we have`);
    }
    
    console.log(`Running ${sampleVectors.length} queries with concurrency ${options.concurrency}`);
    
    // Warm up database
    console.log('Warming up...');
    await pMap(
      sampleVectors.slice(0, 5),
      vector => runVectorQuery(pool, vector, indexType),
      { concurrency: 2 }
    );
    
    // Run benchmark
    console.log('Running benchmark...');
    const testStartTime = performance.now();
    
    const durations = await pMap(
      sampleVectors,
      async vector => {
        const duration = await runVectorQuery(pool, vector, indexType);
        return duration;
      },
      { concurrency: options.concurrency }
    );
    
    const testEndTime = performance.now();
    const validDurations = durations.filter(d => d !== null);
    
    // Calculate results
    const totalTime = testEndTime - testStartTime;
    const throughput = (validDurations.length / (totalTime / 1000)).toFixed(2);
    const stats = formatLatencyStats(validDurations);
    
    // Create test result object
    const testResult = {
      index_type: indexType,
      total_queries: sampleVectors.length,
      successful_queries: validDurations.length,
      failed_queries: sampleVectors.length - validDurations.length,
      total_time_ms: totalTime.toFixed(2),
      throughput_qps: throughput,
      latency_ms: stats,
      concurrency: options.concurrency,
      k_value: options.k,
      timestamp: new Date().toISOString()
    };
    
    // Add to results
    results.tests.push(testResult);
    
    // Log results
    console.log(`Benchmark complete for ${indexType} index:`);
    console.log(`- Throughput: ${throughput} queries/sec`);
    console.log(`- Avg latency: ${stats.avg} ms`);
    console.log(`- p95 latency: ${stats.p95} ms`);
    console.log(`- p99 latency: ${stats.p99} ms`);
    
    // Send to Datadog if enabled
    if (options.monitor && dog) {
      dog.gauge(`${indexType}.throughput`, parseFloat(throughput));
      dog.gauge(`${indexType}.latency.avg`, parseFloat(stats.avg));
      dog.gauge(`${indexType}.latency.p95`, parseFloat(stats.p95));
      dog.gauge(`${indexType}.latency.p99`, parseFloat(stats.p99));
      dog.gauge(`${indexType}.success_rate`, (validDurations.length / sampleVectors.length) * 100);
    }
    
    return testResult;
  } catch (error) {
    console.error(`Error in benchmark for ${indexType}: ${error.message}`);
  } finally {
    await pool.end();
  }
}

/**
 * Calculate and add summary statistics
 */
function addSummary() {
  if (results.tests.length === 0) {
    results.summary = { status: 'failed', reason: 'No tests completed successfully' };
    return;
  }
  
  // Get best performing index
  const bestThroughput = results.tests.reduce((best, test) => 
    parseFloat(test.throughput_qps) > parseFloat(best.throughput_qps) ? test : best
  , results.tests[0]);
  
  const bestLatency = results.tests.reduce((best, test) => 
    parseFloat(test.latency_ms.avg) < parseFloat(best.latency_ms.avg) ? test : best
  , results.tests[0]);
  
  results.summary = {
    status: 'success',
    test_count: results.tests.length,
    best_throughput: {
      index_type: bestThroughput.index_type,
      throughput_qps: bestThroughput.throughput_qps,
      improvement_factor: results.tests
        .filter(t => t.index_type !== bestThroughput.index_type)
        .map(t => parseFloat(bestThroughput.throughput_qps) / parseFloat(t.throughput_qps))
        .reduce((sum, val) => sum + val, 0) / (results.tests.length - 1)
    },
    best_latency: {
      index_type: bestLatency.index_type,
      latency_ms: bestLatency.latency_ms.avg,
      improvement_factor: results.tests
        .filter(t => t.index_type !== bestLatency.index_type)
        .map(t => parseFloat(t.latency_ms.avg) / parseFloat(bestLatency.latency_ms.avg))
        .reduce((sum, val) => sum + val, 0) / (results.tests.length - 1)
    },
    recommendation: bestThroughput.index_type === bestLatency.index_type
      ? `Use ${bestThroughput.index_type} index for best overall performance`
      : `Use ${bestThroughput.index_type} for throughput or ${bestLatency.index_type} for latency`
  };
}

/**
 * Main function
 */
async function main() {
  console.log('Starting Vector Database Performance Benchmark');
  console.log(`Table: ${options.table}, Column: ${options.column}`);
  console.log(`Queries: ${options.queries}, Concurrency: ${options.concurrency}, K: ${options.k}`);
  
  // Create initial connection pool
  const pool = new Pool({
    connectionString,
    max: 2,
    application_name: 'vector-benchmark-init'
  });
  
  try {
    // Get PostgreSQL and pgvector info
    await getPostgresInfo(pool);
    
    // Determine which index types to test
    let indexTypes = ['hnsw', 'ivfflat', 'none'];
    if (options.indexType) {
      indexTypes = [options.indexType];
    }
    
    // Run benchmarks for each index type
    for (const indexType of indexTypes) {
      await runBenchmark(indexType);
    }
    
    // Add summary
    addSummary();
    
    // Write results to file
    fs.writeFileSync(
      options.output,
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\nBenchmark complete, results written to ${options.output}`);
    
    // Send final metrics to Datadog
    if (options.monitor && dog) {
      dog.flush();
    }
    
  } catch (error) {
    console.error(`Error in benchmark: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run main function
main();