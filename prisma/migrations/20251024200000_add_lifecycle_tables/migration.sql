-- Add lifecycle event tracking table
CREATE TABLE "experiment_lifecycle_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "experiment_key" TEXT NOT NULL,
    "previous_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "user_id" TEXT,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "experiment_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- Add scheduled operations table
CREATE TABLE "experiment_scheduled_operations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "experiment_key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executed_at" TIMESTAMP(3),
    "result" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_scheduled_operations_pkey" PRIMARY KEY ("id")
);

-- Add winner check history table
CREATE TABLE "experiment_winner_checks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "experiment_key" TEXT NOT NULL,
    "has_winner" BOOLEAN NOT NULL,
    "winning_variant" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_winner_checks_pkey" PRIMARY KEY ("id")
);

-- Add rollout schedules table
CREATE TABLE "experiment_rollouts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "experiment_key" TEXT NOT NULL,
    "winning_variant" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "current_stage" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paused_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiment_rollouts_pkey" PRIMARY KEY ("id")
);

-- Add guardrail snapshots table
CREATE TABLE "experiment_guardrail_snapshots" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "experiment_key" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "violations" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_guardrail_snapshots_pkey" PRIMARY KEY ("id")
);

-- Create indexes for lifecycle events
CREATE INDEX "experiment_lifecycle_events_experiment_key_idx" ON "experiment_lifecycle_events"("experiment_key");
CREATE INDEX "experiment_lifecycle_events_timestamp_idx" ON "experiment_lifecycle_events"("timestamp");
CREATE INDEX "experiment_lifecycle_events_experiment_key_timestamp_idx" ON "experiment_lifecycle_events"("experiment_key", "timestamp");

-- Create indexes for scheduled operations
CREATE INDEX "experiment_scheduled_operations_experiment_key_idx" ON "experiment_scheduled_operations"("experiment_key");
CREATE INDEX "experiment_scheduled_operations_scheduled_for_idx" ON "experiment_scheduled_operations"("scheduled_for");
CREATE INDEX "experiment_scheduled_operations_executed_idx" ON "experiment_scheduled_operations"("executed");
CREATE INDEX "experiment_scheduled_operations_scheduled_for_executed_idx" ON "experiment_scheduled_operations"("scheduled_for", "executed");

-- Create indexes for winner checks
CREATE INDEX "experiment_winner_checks_experiment_key_idx" ON "experiment_winner_checks"("experiment_key");
CREATE INDEX "experiment_winner_checks_timestamp_idx" ON "experiment_winner_checks"("timestamp");
CREATE INDEX "experiment_winner_checks_experiment_key_timestamp_idx" ON "experiment_winner_checks"("experiment_key", "timestamp");

-- Create indexes for rollouts
CREATE INDEX "experiment_rollouts_experiment_key_idx" ON "experiment_rollouts"("experiment_key");
CREATE INDEX "experiment_rollouts_status_idx" ON "experiment_rollouts"("status");
CREATE INDEX "experiment_rollouts_experiment_key_status_idx" ON "experiment_rollouts"("experiment_key", "status");

-- Create indexes for guardrail snapshots
CREATE INDEX "experiment_guardrail_snapshots_experiment_key_idx" ON "experiment_guardrail_snapshots"("experiment_key");
CREATE INDEX "experiment_guardrail_snapshots_timestamp_idx" ON "experiment_guardrail_snapshots"("timestamp");
CREATE INDEX "experiment_guardrail_snapshots_experiment_key_timestamp_idx" ON "experiment_guardrail_snapshots"("experiment_key", "timestamp");
