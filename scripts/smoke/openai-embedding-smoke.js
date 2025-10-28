#!/usr/bin/env node

const assert = require('assert');
const OpenAI = require('openai');

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY must be set to run this smoke test');
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const { data } = await client.embeddings.create({
    model,
    input: 'Smoke test: React components render reusable UI blocks.',
  });

  const embedding = data?.[0]?.embedding;
  assert(Array.isArray(embedding), 'Expected embedding array');
  assert(embedding.length > 0, 'Embedding vector should not be empty');

  console.log('✅ OpenAI embedding smoke test succeeded (model %s, vector length %d)', model, embedding.length);
}

main().catch((err) => {
  console.error('OpenAI embedding smoke test failed:', err);
  process.exit(1);
});
