-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_metrics" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "user_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "experiment_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "experiments_key_key" ON "experiments"("key");

-- CreateIndex
CREATE INDEX "experiments_status_idx" ON "experiments"("status");

-- CreateIndex
CREATE INDEX "experiments_key_status_idx" ON "experiments"("key", "status");

-- CreateIndex
CREATE INDEX "experiments_created_at_idx" ON "experiments"("created_at");

-- CreateIndex
CREATE INDEX "experiment_assignments_experiment_id_user_id_idx" ON "experiment_assignments"("experiment_id", "user_id");

-- CreateIndex
CREATE INDEX "experiment_assignments_experiment_id_variant_key_idx" ON "experiment_assignments"("experiment_id", "variant_key");

-- CreateIndex
CREATE INDEX "experiment_assignments_timestamp_idx" ON "experiment_assignments"("timestamp");

-- CreateIndex
CREATE INDEX "experiment_assignments_user_id_timestamp_idx" ON "experiment_assignments"("user_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_experiment_id_user_id_key" ON "experiment_assignments"("experiment_id", "user_id");

-- CreateIndex
CREATE INDEX "experiment_metrics_experiment_id_metric_name_idx" ON "experiment_metrics"("experiment_id", "metric_name");

-- CreateIndex
CREATE INDEX "experiment_metrics_experiment_id_variant_key_metric_name_idx" ON "experiment_metrics"("experiment_id", "variant_key", "metric_name");

-- CreateIndex
CREATE INDEX "experiment_metrics_experiment_id_timestamp_idx" ON "experiment_metrics"("experiment_id", "timestamp");

-- CreateIndex
CREATE INDEX "experiment_metrics_user_id_timestamp_idx" ON "experiment_metrics"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "experiment_metrics_metric_name_timestamp_idx" ON "experiment_metrics"("metric_name", "timestamp");

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_metrics" ADD CONSTRAINT "experiment_metrics_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
