#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/*
 * Verify HNSW (cosine) indexes exist and are used by planner with EXPLAIN
 */
const { Client } = require('pg');

// Initialize log aggregation
const logAggregation = new LogAggregation();


function unitVec(dim) {
  const v = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / m);
}

(async () => {
  try {
    const conn = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION || process.env.CONN;
    if (!conn) {
      console.error('Missing connection string. Set DATABASE_URL (or POSTGRES_CONNECTION/CONN).');
      process.exit(2);
    }
    const client = new Client({ connectionString: conn });
    await client.connect();

    // List HNSW cosine indexes
    const idx = await client.query(
      "SELECT tablename, indexname, indexdef FROM pg_indexes " +
        "WHERE tablename IN ('rag_chunks','document_embeddings') " +
        "AND indexdef ILIKE '%USING hnsw%' AND indexdef ILIKE '%vector_cosine_ops%'"
    );
    console.log('\n== HNSW cosine indexes ==');
    console.table(idx.rows);

    // EXPLAIN with a random unit vector
    const vec = unitVec(1536);
    const vecLiteral = '[' + vec.map((x) => x.toFixed(6)).join(',') + ']';
    const plan = await client.query(
      'EXPLAIN (ANALYZE, VERBOSE) ' +
        'SELECT chunk_id FROM rag_chunks ' +
        'WHERE embedding IS NOT NULL ' +
        'ORDER BY embedding <=> $1::vector LIMIT 5',
      [vecLiteral]
    );
    console.log('\n== EXPLAIN ANALYZE (rag_chunks) ==');
    console.log(plan.rows.map((r) => r['QUERY PLAN']).join('\n'));

    await client.end();
  } catch (e) {
    console.error('verify-hnsw-indexes failed:', e);
    process.exit(1);
  }
})();
