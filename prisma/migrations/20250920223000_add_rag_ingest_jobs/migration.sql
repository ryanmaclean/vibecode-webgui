CREATE TABLE IF NOT EXISTS "rag_ingest_jobs" (
  "id" uuid PRIMARY KEY,
  "upload_id" integer,
  "blob_name" text NOT NULL,
  "storage_container" text NOT NULL,
  "original_file_name" text NOT NULL,
  "size" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "queue_name" text,
  "user_identifier" text,
  "workspace_identifier" text,
  "project_identifier" text,
  "chunk_count" integer NOT NULL DEFAULT 0,
  "error" text,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "rag_ingest_jobs_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_rag_ingest_jobs_status" ON "rag_ingest_jobs" ("status");
CREATE INDEX IF NOT EXISTS "idx_rag_ingest_jobs_requested_at" ON "rag_ingest_jobs" ("requested_at");
