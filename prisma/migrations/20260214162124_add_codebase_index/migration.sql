-- CreateTable
CREATE TABLE "codebase_index" (
    "id" SERIAL NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "workspace_id" INTEGER,
    "project_id" INTEGER,
    "language" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_modified_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codebase_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codebase_index_user_id_idx" ON "codebase_index"("user_id");

-- CreateIndex
CREATE INDEX "codebase_index_workspace_id_idx" ON "codebase_index"("workspace_id");

-- CreateIndex
CREATE INDEX "codebase_index_project_id_idx" ON "codebase_index"("project_id");

-- CreateIndex
CREATE INDEX "codebase_index_file_path_idx" ON "codebase_index"("file_path");

-- CreateIndex
CREATE INDEX "codebase_index_file_hash_idx" ON "codebase_index"("file_hash");

-- CreateIndex
CREATE INDEX "codebase_index_workspace_id_project_id_idx" ON "codebase_index"("workspace_id", "project_id");

-- CreateIndex
CREATE INDEX "codebase_index_project_id_indexed_at_idx" ON "codebase_index"("project_id", "indexed_at");

-- CreateIndex
CREATE INDEX "codebase_index_workspace_id_indexed_at_idx" ON "codebase_index"("workspace_id", "indexed_at");

-- AddForeignKey
ALTER TABLE "codebase_index" ADD CONSTRAINT "codebase_index_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codebase_index" ADD CONSTRAINT "codebase_index_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codebase_index" ADD CONSTRAINT "codebase_index_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
