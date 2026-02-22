-- AI Quality Metrics Tracking Tables
-- Adds tables for tracking AI suggestion quality, acceptance rates, edit distance, and user ratings

-- AISuggestion: Core table for tracking AI-generated suggestions
CREATE TABLE "AISuggestion" (
  "id" SERIAL PRIMARY KEY,
  "suggestion_id" TEXT NOT NULL UNIQUE,
  "model_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "language" TEXT,
  "file_path" TEXT,
  "context_before" TEXT,
  "context_after" TEXT,
  "prompt" TEXT,
  "user_id" INTEGER NOT NULL,
  "workspace_id" INTEGER,
  "project_id" INTEGER,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "duration_ms" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AISuggestion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AISuggestion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AISuggestion_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AISuggestion_user_id_idx" ON "AISuggestion"("user_id");
CREATE INDEX "AISuggestion_workspace_id_idx" ON "AISuggestion"("workspace_id");
CREATE INDEX "AISuggestion_project_id_idx" ON "AISuggestion"("project_id");
CREATE INDEX "AISuggestion_model_id_created_at_idx" ON "AISuggestion"("model_id", "created_at");
CREATE INDEX "AISuggestion_provider_created_at_idx" ON "AISuggestion"("provider", "created_at");

COMMENT ON TABLE "AISuggestion" IS 'Tracks AI-generated code suggestions with metadata';

-- AISuggestionEvent: Tracks acceptance, rejection, and edit events
CREATE TABLE "AISuggestionEvent" (
  "id" SERIAL PRIMARY KEY,
  "suggestion_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "original_code" TEXT,
  "final_code" TEXT,
  "edit_distance" INTEGER,
  "similarity_score" DOUBLE PRECISION,
  "time_to_decision_ms" INTEGER,
  "time_to_accept_ms" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AISuggestionEvent_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "AISuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AISuggestionEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AISuggestionEvent_suggestion_id_idx" ON "AISuggestionEvent"("suggestion_id");
CREATE INDEX "AISuggestionEvent_user_id_idx" ON "AISuggestionEvent"("user_id");
CREATE INDEX "AISuggestionEvent_event_type_created_at_idx" ON "AISuggestionEvent"("event_type", "created_at");
CREATE INDEX "AISuggestionEvent_suggestion_id_event_type_idx" ON "AISuggestionEvent"("suggestion_id", "event_type");

COMMENT ON TABLE "AISuggestionEvent" IS 'Tracks suggestion lifecycle events with edit distance metrics';

-- AIQualityRating: User quality ratings (thumbs up/down)
CREATE TABLE "AIQualityRating" (
  "id" SERIAL PRIMARY KEY,
  "suggestion_id" INTEGER NOT NULL,
  "event_id" INTEGER,
  "user_id" INTEGER NOT NULL,
  "rating" TEXT NOT NULL,
  "rating_value" INTEGER NOT NULL,
  "comment" TEXT,
  "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIQualityRating_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "AISuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AIQualityRating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "one_rating_per_suggestion" UNIQUE ("suggestion_id", "user_id")
);

CREATE INDEX "AIQualityRating_suggestion_id_idx" ON "AIQualityRating"("suggestion_id");
CREATE INDEX "AIQualityRating_user_id_idx" ON "AIQualityRating"("user_id");
CREATE INDEX "AIQualityRating_rating_created_at_idx" ON "AIQualityRating"("rating", "created_at");
CREATE INDEX "AIQualityRating_suggestion_id_rating_idx" ON "AIQualityRating"("suggestion_id", "rating");
CREATE INDEX "AIQualityRating_user_id_created_at_idx" ON "AIQualityRating"("user_id", "created_at");

COMMENT ON TABLE "AIQualityRating" IS 'User quality ratings (thumbs up/down) for AI suggestions';

-- AIQualityMetric: Calculated quality scores for suggestions
CREATE TABLE "AIQualityMetric" (
  "id" SERIAL PRIMARY KEY,
  "suggestion_id" INTEGER NOT NULL,
  "overall_score" DOUBLE PRECISION NOT NULL,
  "relevance" DOUBLE PRECISION,
  "completeness" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "coherence" DOUBLE PRECISION,
  "evaluation_method" TEXT NOT NULL,
  "judge_model_id" TEXT,
  "reasoning" TEXT,
  "model_id" TEXT NOT NULL,
  "metadata" JSONB,
  "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIQualityMetric_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "AISuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AIQualityMetric_suggestion_id_idx" ON "AIQualityMetric"("suggestion_id");
CREATE INDEX "AIQualityMetric_model_id_evaluated_at_idx" ON "AIQualityMetric"("model_id", "evaluated_at");
CREATE INDEX "AIQualityMetric_overall_score_model_id_idx" ON "AIQualityMetric"("overall_score", "model_id");
CREATE INDEX "AIQualityMetric_evaluation_method_model_id_idx" ON "AIQualityMetric"("evaluation_method", "model_id");
CREATE INDEX "AIQualityMetric_evaluated_at_idx" ON "AIQualityMetric"("evaluated_at");
CREATE INDEX "AIQualityMetric_model_id_overall_score_evaluated_at_idx" ON "AIQualityMetric"("model_id", "overall_score", "evaluated_at");

COMMENT ON TABLE "AIQualityMetric" IS 'Calculated quality scores and metrics for AI suggestions';
