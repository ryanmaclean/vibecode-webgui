#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      config({ path: fullPath, override: false });
    }
  }
}

async function main() {
  loadEnv();

  const openRouterConfigured = typeof process.env.OPENROUTER_API_KEY === 'string' && process.env.OPENROUTER_API_KEY.trim().length > 0;
  const openAIConfigured = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim().length > 0;

  const { createChatCompletionWithFallback, getFreeModelPool } = await import('../src/lib/ai-clients/litellm-instance.ts');

  const pool = getFreeModelPool();
  if (!pool.length) {
    throw new Error('Free model pool is empty – set FREE_LLM_MODELS or OPENROUTER_API_KEY.');
  }

  const preferredModel = process.env.TEST_MODEL || pool[0];

  const payload = {
    model: preferredModel,
    messages: [
      {
        role: 'user' as const,
        content: 'Quick smoke test: confirm Datadog LLM fallback rotation works.'
      }
    ],
    max_tokens: 200,
    temperature: 0.2
  };

  console.info('ℹ️  Starting fallback verification');
  console.info(`    Pool size: ${pool.length}`);
  console.info(`    Preferred model: ${preferredModel}`);
  console.info(`    OPENROUTER_API_KEY loaded: ${openRouterConfigured}`);
  console.info(`    OPENAI_API_KEY loaded: ${openAIConfigured}`);

  const start = Date.now();
  const result = await createChatCompletionWithFallback(payload);
  const duration = Date.now() - start;

  console.info('✅ Fallback pipeline returned a response');
  console.info(`    Provider used: ${result.provider}`);
  console.info(`    Model used: ${result.modelUsed}`);
  console.info(`    Attempts before success: ${result.attempts.length}`);
  if (result.attempts.length) {
    for (const attempt of result.attempts) {
      console.info(`      ↺ ${attempt.provider}:${attempt.model} -> ${attempt.error}`);
    }
  }

  const choice = result.response.choices?.[0];
  if (choice?.message?.content) {
    console.info('--- Model reply ---');
    console.info(choice.message.content);
    console.info('--------------------');
  }

  console.info(`Total latency: ${duration} ms`);
}

main().catch(err => {
  console.error('❌ Fallback verification failed');
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
