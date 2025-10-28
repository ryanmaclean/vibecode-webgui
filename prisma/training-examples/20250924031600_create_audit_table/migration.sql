-- Training example migration: create a session audit table and immediately drop it.
CREATE TABLE IF NOT EXISTS "training_session_audit" (
  "id" SERIAL PRIMARY KEY,
  "run_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "operator" TEXT NOT NULL,
  "notes" TEXT
);

-- Tear down after demo to keep databases clean.
DROP TABLE IF EXISTS "training_session_audit";
