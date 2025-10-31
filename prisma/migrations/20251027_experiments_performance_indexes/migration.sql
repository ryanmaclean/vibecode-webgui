-- High-performance indexes for experiment queries
-- Using CONCURRENTLY to avoid locking tables during index creation

-- Composite index for fast assignment lookups (user + variant filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_assignments_lookup
ON "experiment_assignments"(experiment_id, user_id, variant_key);

-- Composite index for metric aggregation queries (group by variant + time range)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_metrics_aggregation
ON "experiment_metrics"(experiment_id, metric_name, timestamp);

-- Partial index for active/running experiments (faster dashboard queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_running
ON "experiments"(status, started_at)
WHERE status = 'RUNNING';

-- Index for user assignment history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_assignments_user_history
ON "experiment_assignments"(user_id, assigned_at DESC);

-- Index for time-series metric queries (ordered by timestamp)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_metrics_timeseries
ON "experiment_metrics"(experiment_id, timestamp DESC, metric_name);

-- Composite index for variant-specific metric queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_assignments_variant_lookup
ON "experiment_assignments"(experiment_id, variant_key, assigned_at);

-- Index for completed experiments analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_completed
ON "experiments"(status, completed_at DESC)
WHERE status = 'COMPLETED';
