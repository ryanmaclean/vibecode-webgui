#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/*
 * Create/ensure HNSW (cosine) indexes for pgvector on Azure PostgreSQL
 * Tables: rag_chunks.embedding, document_embeddings.embedding
 */
const { Client } = require('pg');

// Initialize log aggregation
const logAggregation = new LogAggregation();


(async () => {
  try {
    const conn = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION || process.env.CONN;
    if (!conn) {
      console.error('Missing connection string. Set DATABASE_URL (or POSTGRES_CONNECTION/CONN).');
      process.exit(2);
    }
    const client = new Client({ connectionString: conn });
    await client.connect();

    console.log('Ensuring pgvector extension and HNSW indexes (cosine ops)...');

    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    await client.query(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS rag_chunks_embedding_hnsw_idx ' +
      'ON rag_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)'
    );

    await client.query(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS document_embeddings_embedding_hnsw_idx ' +
      'ON document_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)'
    );

    await client.query('ANALYZE rag_chunks');
    await client.query('ANALYZE document_embeddings');

    console.log('Done ensuring HNSW indexes.');
    await client.end();
  } catch (e) {
    console.error('create-hnsw-indexes failed:', e);
    process.exit(1);
  }
})();
