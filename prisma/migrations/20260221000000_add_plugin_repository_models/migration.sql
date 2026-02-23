-- CreateTable: Plugin Repository (Marketplace Plugins)
CREATE TABLE "plugin_repository" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "repository_url" TEXT,
    "homepage_url" TEXT,
    "icon_url" TEXT,
    "category" TEXT NOT NULL,
    "tags" JSONB,
    "downloads_count" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'published',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Plugin Versions
CREATE TABLE "plugin_versions" (
    "id" SERIAL NOT NULL,
    "plugin_id" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT,
    "package_url" TEXT NOT NULL,
    "package_checksum" TEXT NOT NULL,
    "compatible_versions" JSONB,
    "downloads_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Plugin Ratings
CREATE TABLE "plugin_ratings" (
    "id" SERIAL NOT NULL,
    "plugin_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "review" TEXT,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Plugin Downloads
CREATE TABLE "plugin_downloads" (
    "id" SERIAL NOT NULL,
    "plugin_id" INTEGER NOT NULL,
    "version_id" INTEGER,
    "user_id" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: plugin_repository indexes
CREATE INDEX "plugin_repository_author_id_idx" ON "plugin_repository"("author_id");
CREATE INDEX "plugin_repository_name_idx" ON "plugin_repository"("name");
CREATE INDEX "plugin_repository_status_idx" ON "plugin_repository"("status");
CREATE INDEX "plugin_repository_category_idx" ON "plugin_repository"("category");
CREATE INDEX "plugin_repository_featured_status_idx" ON "plugin_repository"("featured", "status");
CREATE INDEX "plugin_repository_verified_status_idx" ON "plugin_repository"("verified", "status");
CREATE INDEX "plugin_repository_downloads_count_status_idx" ON "plugin_repository"("downloads_count", "status");
CREATE INDEX "plugin_repository_average_rating_status_idx" ON "plugin_repository"("average_rating", "status");
CREATE INDEX "plugin_repository_status_created_at_idx" ON "plugin_repository"("status", "created_at");
CREATE INDEX "plugin_repository_category_status_downloads_count_idx" ON "plugin_repository"("category", "status", "downloads_count");

-- CreateIndex: plugin_versions indexes
CREATE UNIQUE INDEX "plugin_id_version" ON "plugin_versions"("plugin_id", "version");
CREATE INDEX "plugin_versions_plugin_id_idx" ON "plugin_versions"("plugin_id");
CREATE INDEX "plugin_versions_version_idx" ON "plugin_versions"("version");
CREATE INDEX "plugin_versions_status_idx" ON "plugin_versions"("status");
CREATE INDEX "plugin_versions_published_at_idx" ON "plugin_versions"("published_at");
CREATE INDEX "plugin_versions_plugin_id_status_published_at_idx" ON "plugin_versions"("plugin_id", "status", "published_at");
CREATE INDEX "plugin_versions_downloads_count_status_idx" ON "plugin_versions"("downloads_count", "status");

-- CreateIndex: plugin_ratings indexes
CREATE UNIQUE INDEX "plugin_id_user_id" ON "plugin_ratings"("plugin_id", "user_id");
CREATE INDEX "plugin_ratings_plugin_id_idx" ON "plugin_ratings"("plugin_id");
CREATE INDEX "plugin_ratings_user_id_idx" ON "plugin_ratings"("user_id");
CREATE INDEX "plugin_ratings_rating_idx" ON "plugin_ratings"("rating");
CREATE INDEX "plugin_ratings_plugin_id_rating_idx" ON "plugin_ratings"("plugin_id", "rating");
CREATE INDEX "plugin_ratings_helpful_count_plugin_id_idx" ON "plugin_ratings"("helpful_count", "plugin_id");
CREATE INDEX "plugin_ratings_created_at_idx" ON "plugin_ratings"("created_at");

-- CreateIndex: plugin_downloads indexes
CREATE INDEX "plugin_downloads_plugin_id_idx" ON "plugin_downloads"("plugin_id");
CREATE INDEX "plugin_downloads_version_id_idx" ON "plugin_downloads"("version_id");
CREATE INDEX "plugin_downloads_user_id_idx" ON "plugin_downloads"("user_id");
CREATE INDEX "plugin_downloads_created_at_idx" ON "plugin_downloads"("created_at");
CREATE INDEX "plugin_downloads_plugin_id_created_at_idx" ON "plugin_downloads"("plugin_id", "created_at");
CREATE INDEX "plugin_downloads_version_id_created_at_idx" ON "plugin_downloads"("version_id", "created_at");
CREATE INDEX "plugin_downloads_user_id_created_at_idx" ON "plugin_downloads"("user_id", "created_at");

-- AddForeignKey: plugin_repository -> users
ALTER TABLE "plugin_repository" ADD CONSTRAINT "plugin_repository_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: plugin_versions -> plugin_repository
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugin_repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: plugin_ratings -> plugin_repository
ALTER TABLE "plugin_ratings" ADD CONSTRAINT "plugin_ratings_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugin_repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: plugin_ratings -> users
ALTER TABLE "plugin_ratings" ADD CONSTRAINT "plugin_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: plugin_downloads -> plugin_repository
ALTER TABLE "plugin_downloads" ADD CONSTRAINT "plugin_downloads_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugin_repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: plugin_downloads -> plugin_versions
ALTER TABLE "plugin_downloads" ADD CONSTRAINT "plugin_downloads_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: plugin_downloads -> users
ALTER TABLE "plugin_downloads" ADD CONSTRAINT "plugin_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
