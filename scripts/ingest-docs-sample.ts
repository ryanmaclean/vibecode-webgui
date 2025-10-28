#!/usr/bin/env tsx

import { DocumentationRAGIngester } from './ingest-docs-to-rag';

const DOC_LIMIT = Number(process.env.RAG_SAMPLE_DOC_LIMIT || '2');
const CHUNK_LIMIT = Number(process.env.RAG_SAMPLE_CHUNK_LIMIT || '6');
const TIMEOUT_MS = Number(process.env.RAG_SAMPLE_TIMEOUT_MS || '6000');

async function main() {
  console.log('🚀 Running sample RAG ingestion (controlled for rate limits)...');

  const ingester = new DocumentationRAGIngester();

  const timer = setTimeout(() => {
    console.log(`⏹ Sample run hit ${TIMEOUT_MS / 1000}s timeout, exiting early to avoid rate limit.`);
    process.exit(0);
  }, TIMEOUT_MS);
  timer.unref();

  try {
    const allFiles: string[] = await (ingester as any).getMarkdownFiles();
    const limitedFiles = allFiles.slice(0, DOC_LIMIT);
    console.log(`🪓 Limiting ingestion to ${limitedFiles.length} docs (of ${allFiles.length} available)`);

    const allChunks: any[] = [];
    for (const filePath of limitedFiles) {
      console.log(`📄 Processing sample doc: ${filePath}`);
      const chunks = await (ingester as any).processMarkdownFile(filePath);
      allChunks.push(...chunks);
    }

    console.log(`📦 Generated ${allChunks.length} sample chunks (pre-limit)`);

    const limitedChunks = allChunks.slice(0, CHUNK_LIMIT);
    console.log(`🪓 Limiting stored chunks to ${limitedChunks.length}`);
    await (ingester as any).storeDocumentChunks(limitedChunks);

    console.log('✅ Sample ingestion completed (limited run).');
  } catch (error) {
    console.error('❌ Sample ingestion error:', error);
    process.exitCode = 1;
  } finally {
    await (ingester as any).prisma?.$disconnect?.();
  }
}

if (require.main === module) {
  main();
}

