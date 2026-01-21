# Training Snapshots: Simulated Blocking Queries (2025-09-24)

These examples were generated for troubleshooting workshops. The queries were **not** executed against production data; they illustrate how to recognise blocking patterns in Datadog Database Monitoring dashboards.

## Staging (`service:vibecode-postgres`)

```sql
-- Session A (blocking)
BEGIN;
SELECT * FROM "Workspace" WHERE status = 'active' FOR UPDATE;
-- Session kept open intentionally for 120 seconds

-- Session B (blocked)
UPDATE "Workspace"
   SET updated_at = NOW()
 WHERE workspace_id = 'wk-training-staging-001';
```

Key metrics observed:
- `postgresql.blocked_by_locks`: 1
- `postgresql.avg_transaction_duration`: 118 seconds
- Tags: `env:staging`, `training:20250924`, `operator:kim.smith`

## Production (`service:vibecode-postgres`)

```sql
-- Blocking session (read transaction)
BEGIN;
SELECT * FROM "Project" WHERE plan = 'enterprise' AND archived = false FOR SHARE;
-- Forgot to COMMIT during tabletop exercise

-- Blocked session
DELETE FROM "Project"
 WHERE project_id = 'proj-training-prod-042';
```

Metrics captured for the dry-run demo:
- `postgresql.blocked_by_locks`: 2
- `postgresql.deadlocks`: 0
- `postgresql.rows_returned`: 1523 (blocking query)
- Tags: `env:production`, `training:20250924`, `operator:jessie`

## Development (`service:vibecode-postgres-dev`)

```sql
-- Simulated migration lock
BEGIN;
ALTER TABLE "training_session_audit" ADD COLUMN demo_flag BOOLEAN DEFAULT false;
-- Session kept open while discussing locking behaviour

-- Blocked analytical query
SELECT COUNT(*)
  FROM "training_session_audit"
 WHERE demo_flag = false;
```

Metrics recorded in the training dashboard:
- `postgresql.blocked_by_locks`: 1
- `postgresql.connections_waiting`: 3
- `postgresql.wait_event_type`: `Lock`
- Tags: `env:development`, `training:20250924`, `operator:kim.smith`

> ℹ️  These entries live in Datadog dashboards labelled **"Training: Blocking Queries"** so new responders can practice triage without touching live traffic.
