#!/usr/bin/env ts-node

import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory, EmbeddingProvider } from '../../src/lib/ai/embeddingServiceFactory.ts';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY must be set to run this smoke test');
  }

  const prisma = new PrismaClient();
  try {
    const factory = new EmbeddingServiceFactory(prisma);
    const service = factory.createEmbeddingService({
      provider: EmbeddingProvider.OPENAI,
      apiKey,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    });

    const embedding = await service.generateEmbedding('Smoke test: React components render UI.');
    assert(Array.isArray(embedding), 'Embedding should be an array');
    assert(embedding.length > 0, 'Embedding should not be empty');

    console.log('✅ OpenAI embedding smoke test succeeded (vector length %d)', embedding.length);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Embedding smoke test failed:', err);
  process.exit(1);
});
