-- Add the embedding column back to rag_chunks for pgvector storage.
ALTER TABLE "rag_chunks"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
