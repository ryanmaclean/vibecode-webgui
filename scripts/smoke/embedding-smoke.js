#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { EmbeddingServiceFactory, EmbeddingProvider } = require('../dist/lib/ai/embeddingServiceFactory');

// Initialize log aggregation
const logAggregation = new LogAggregation();


async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY must be set to run this smoke test');
  }

  const prisma = new PrismaClient();
  const factory = new EmbeddingServiceFactory(prisma);
  const service = factory.createEmbeddingService({
    provider: EmbeddingProvider.OPENAI,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  });

  const embedding = await service.generateEmbedding('Smoke test: React components render UI.');
  assert(Array.isArray(embedding), 'Embedding should be an array');
  assert(embedding.length > 0, 'Embedding should not be empty');
  console.log('✅ OpenAI embedding smoke test succeeded (vector length %d)', embedding.length);
}

main().catch((err) => {
  console.error('Embedding smoke test failed:', err);
  process.exit(1);
});
