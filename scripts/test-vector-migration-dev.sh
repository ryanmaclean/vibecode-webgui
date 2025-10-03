#!/usr/bin/env bash

# Test Vector Database Migration in Development Environment
# Spins up a temporary pgvector instance, runs the migration harness, and cleans up.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Bootstrap shared helpers
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/bootstrap.sh"
bootstrap_init "$SCRIPT_DIR"
# shellcheck disable=SC1091
source "$LIB_DIR/logging.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/pgvector.sh"

POSTGRES_PORT=5499
POSTGRES_DB=vector_test_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
CONTAINER_NAME=pg-vector-migration-test
MIGRATIONS_DIR="$SCRIPT_DIR/vector-db-migrations"

cleanup() {
  log_info "Tearing down pgvector container"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log_step "Starting pgvector test container"
pgvector_start_container \
  "$CONTAINER_NAME" \
  "$POSTGRES_PORT" \
  "$POSTGRES_DB" \
  "$POSTGRES_USER" \
  "$POSTGRES_PASSWORD" \
  "ankane/pgvector"

log_info "Waiting for pgvector readiness"
if ! pgvector_wait_for_start "$CONTAINER_NAME" "$POSTGRES_USER" "$POSTGRES_DB" 20 2; then
  log_error "pgvector container did not become ready"
  exit 1
fi

log_step "Seeding synthetic vector data"
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE TABLE IF NOT EXISTS rag_chunks (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding 
    ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
  INSERT INTO rag_chunks (document_id, content, embedding, metadata)
  SELECT 
    'doc-' || i,
    'This is test content ' || i,
    (SELECT array_agg(random()) FROM generate_series(1, 1536)),
    json_build_object('source', 'test', 'page', (i % 10))::text
  FROM generate_series(1, 100) i;
"

log_step "Running zero downtime schema migration"
node "$MIGRATIONS_DIR/zero-downtime-schema-migration.cjs"

log_step "Verifying migrated schema"
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'rag_chunks'
  ORDER BY ordinal_position;
"

docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'rag_chunks';
"

log_step "Running vector index migration harness"
INDEX_MIGRATION_TS="$MIGRATIONS_DIR/migrate-vector-index.ts"
if [[ -f "$INDEX_MIGRATION_TS" ]]; then
  if command -v ts-node >/dev/null 2>&1; then
    ts-node "$INDEX_MIGRATION_TS"
    log_success "Vector index migration TypeScript executed"
  else
    log_warn "ts-node not available; skipping migrate-vector-index.ts"
  fi
else
  log_warn "migrate-vector-index.ts not found; skipping vector index migration"
fi

log_step "Capturing final metrics"
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT COUNT(*) AS vector_count FROM rag_chunks;
"

log_success "Vector database migration tests completed"
