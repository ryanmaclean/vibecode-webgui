-- Drop existing experiment tables if they exist (from old schema)
DROP TABLE IF EXISTS "experiment_metrics" CASCADE;
DROP TABLE IF EXISTS "experiment_assignments" CASCADE;
DROP TABLE IF EXISTS "experiments" CASCADE;
DROP TYPE IF EXISTS "ExperimentStatus";

-- Create enum for experiment status
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'REVIEW', 'RUNNING', 'COMPLETED', 'ARCHIVED');

-- CreateTable: Experiment
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExperimentAssignment
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExperimentMetric
CREATE TABLE "experiment_metrics" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "experiment_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Experiment indexes
CREATE UNIQUE INDEX "experiments_key_key" ON "experiments"("key");
CREATE INDEX "experiments_status_created_at_idx" ON "experiments"("status", "created_at");
CREATE INDEX "experiments_key_idx" ON "experiments"("key");

-- CreateIndex: ExperimentAssignment indexes
CREATE UNIQUE INDEX "experiment_assignments_experiment_id_user_id_key" ON "experiment_assignments"("experiment_id", "user_id");
CREATE INDEX "experiment_assignments_experiment_id_variant_key_idx" ON "experiment_assignments"("experiment_id", "variant_key");
CREATE INDEX "experiment_assignments_user_id_idx" ON "experiment_assignments"("user_id");
CREATE INDEX "experiment_assignments_assigned_at_idx" ON "experiment_assignments"("assigned_at");

-- CreateIndex: ExperimentMetric indexes
CREATE INDEX "experiment_metrics_experiment_id_metric_name_idx" ON "experiment_metrics"("experiment_id", "metric_name");
CREATE INDEX "experiment_metrics_assignment_id_metric_name_idx" ON "experiment_metrics"("assignment_id", "metric_name");
CREATE INDEX "experiment_metrics_timestamp_idx" ON "experiment_metrics"("timestamp");

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_metrics" ADD CONSTRAINT "experiment_metrics_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_metrics" ADD CONSTRAINT "experiment_metrics_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "experiment_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
