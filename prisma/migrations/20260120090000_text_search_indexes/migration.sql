-- Enable pg_trgm for trigram indexes if not already available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Accelerate conversation title searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_title_trgm_idx
  ON conversations USING gin (title gin_trgm_ops);

-- Accelerate message content searches used by chat search APIs
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_content_trgm_idx
  ON messages USING gin (content gin_trgm_ops);

-- Accelerate fallback text search on rag chunks
CREATE INDEX CONCURRENTLY IF NOT EXISTS rag_chunks_content_trgm_idx
  ON rag_chunks USING gin (content gin_trgm_ops);
