-- Training example migration (not applied automatically)
-- Prisma command used: prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script
-- Adds a virtual flag column for demonstration purposes only.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "is_training_example" BOOLEAN DEFAULT false;

-- Cleanup statement for the training session.
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "is_training_example";
