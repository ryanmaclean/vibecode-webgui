#!/usr/bin/env node
/*
 * Verify vector import into Azure PostgreSQL
 * - Checks pgvector extension
 * - Counts rows in document_embeddings and rag_chunks with embeddings
 * - Ensures indexes exist
 * - Executes a sample similarity query (if rag_chunks has data)
 */

const { Client } = require('pg');

(async () => {
  try {
    const conn = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION || process.env.CONN;
    if (!conn) {
      console.error('Missing connection string. Set DATABASE_URL (or POSTGRES_CONNECTION/CONN).');
      process.exit(2);
    }

    const client = new Client({ connectionString: conn });
    await client.connect();

    // Ensure extension and helpful indexes exist
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query("CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ivfflat_idx ON document_embeddings USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)");
    await client.query("CREATE INDEX IF NOT EXISTS rag_chunks_embedding_ivfflat_idx ON rag_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)");

    const ext = await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
    const docCount = await client.query("SELECT COUNT(*)::int AS c FROM document_embeddings");
    const ragCount = await client.query("SELECT COUNT(*)::int AS c FROM rag_chunks WHERE embedding IS NOT NULL");

    const result = {
      vector_extension: ext.rows[0]?.extversion || null,
      document_embeddings: docCount.rows[0].c,
      rag_chunks_with_embeddings: ragCount.rows[0].c,
      sample_documents: [],
      rag_similarity_top5: []
    };

    if (docCount.rows[0].c > 0) {
      const sampleDocs = await client.query(
        "SELECT document_id, title, LEFT(content, 48) AS preview FROM document_embeddings ORDER BY id DESC LIMIT 3"
      );
      result.sample_documents = sampleDocs.rows;
    }

    if (ragCount.rows[0].c > 0) {
      // Build a random unit vector for similarity query
      const dim = 1536;
      const vec = Array.from({ length: dim }, () => Math.random() * 2 - 1);
      const mag = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
      const unit = vec.map((x) => x / mag);

      // Prepare vector as pgvector string literal
      const vecLiteral = `[${unit.map((x) => x.toFixed(6)).join(',')}]`;
      const sim = await client.query(
        "SELECT chunk_id, 1 - (embedding <=> $1::vector) AS similarity FROM rag_chunks WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT 5",
        [vecLiteral]
      );
      result.rag_similarity_top5 = sim.rows;
    }

    console.log(JSON.stringify(result, null, 2));
    await client.end();
  } catch (e) {
    console.error('Verification failed:', e);
    process.exit(1);
  }
})();
