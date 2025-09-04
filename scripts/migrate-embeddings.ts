import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Migration script to move embeddings from a JSON file (or other source)
 * into the PostgreSQL `embedding` table using Prisma.
 *
 * Usage:
 *   TS_NODE_PROJECT=tsconfig.json ts-node scripts/migrate-embeddings.ts \
 *     --source=./data/embeddings.json \
 *     --dry-run
 *
 * Options:
 *   --source    Path to JSON file containing embeddings array. Each item must have
 *               { id: string, embedding: number[] }.
 *   --dry-run   Run without actually writing to the database (default false).
 */
async function main() {
  const args = process.argv.slice(2);
  const sourcePath =
    args.find((a) => a.startsWith("--source="))?.split("=")[1] ||
    "./embeddings.json";
  const dryRun = args.includes("--dry-run");

  console.log(`Reading embeddings from ${sourcePath}`);
  const raw = fs.readFileSync(path.resolve(sourcePath), "utf-8");
  let data: { id: string; embedding: number[] }[];
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error("Expected an array of embeddings");
    process.exit(1);
  }

  console.log(`Found ${data.length} embedding(s)`);

  if (dryRun) {
    console.log("[DRY RUN] Skipping database writes.");
    process.exit(0);
  }

  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    const chunk = data.slice(i, i + batchSize);
    // Prisma bulk create
    await prisma.$transaction(
      chunk.map((item) =>
        prisma.embedding.create({
          data: {
            id: item.id,
            embedding: item.embedding,
          },
        })
      )
    );
    console.log(`Inserted ${i + chunk.length} / ${data.length}`);
  }

  console.log("Migration completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
