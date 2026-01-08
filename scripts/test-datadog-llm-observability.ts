#!/usr/bin/env node

/**
 * Datadog LLM Observability Test Script
 *
 * This script tests the Datadog LLM Observability integration by:
 * 1. Validating environment configuration
 * 2. Making actual LLM API calls with proper instrumentation
 * 3. Verifying traces are being captured
 * 4. Flushing data to Datadog
 *
 * Usage:
 *   npx ts-node scripts/test-datadog-llm-observability.ts
 */

// Must be required FIRST before any other modules
require('../src/instrument');

import tracer from 'dd-trace';
import { LLMTracer } from '../src/lib/monitoring/llm-tracer';
import OpenAI from 'openai';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Running: ${name}`);
    await fn();
    const duration = Date.now() - startTime;
    results.push({ name, status: 'pass', message: 'OK', duration });
    console.log(`✅ PASS: ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'fail', message, duration });
    console.log(`❌ FAIL: ${name} - ${message}`);
  }
}

async function validateEnvironment(): Promise<void> {
  const required = [
    'DD_API_KEY',
    'DD_LLMOBS_ENABLED',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  console.log('✅ Environment variables:');
  console.log(`   DD_API_KEY: ${process.env.DD_API_KEY?.substring(0, 8)}***`);
  console.log(`   DD_SITE: ${process.env.DD_SITE || 'datadoghq.com'}`);
  console.log(`   DD_ENV: ${process.env.DD_ENV || 'development'}`);
  console.log(`   DD_SERVICE: ${process.env.DD_SERVICE || 'vibecode-webgui'}`);
  console.log(`   DD_LLMOBS_ENABLED: ${process.env.DD_LLMOBS_ENABLED}`);
  console.log(`   DD_LLMOBS_ML_APP: ${process.env.DD_LLMOBS_ML_APP || 'vibecode-ai'}`);
}

async function testOpenAIIntegration(): Promise<void> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Make a simple, quick API call
  const response = await LLMTracer.traceLLMCall(
    'test-completion',
    {
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      prompt: 'Write a one-sentence summary of artificial intelligence.',
      temperature: 0.7,
      maxTokens: 100,
    },
    async () => {
      return await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Write a one-sentence summary of artificial intelligence.',
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
    }
  );

  if (!response.choices?.[0]?.message?.content) {
    throw new Error('No response content from OpenAI');
  }

  console.log(`   Response: ${response.choices[0].message.content.substring(0, 100)}...`);
  console.log(`   Tokens used: ${response.usage?.total_tokens || 0}`);
}

async function testLLMTracer(): Promise<void> {
  const result = await LLMTracer.traceLLMCall(
    'test-operation',
    {
      model: 'test-model',
      provider: 'test-provider',
      input: 'test input',
      userId: 'test-user-123',
      sessionId: 'test-session-456',
    },
    async () => {
      // Simulate a quick LLM operation
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        output: 'test output',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    }
  );

  console.log(`   Result: ${JSON.stringify(result).substring(0, 100)}`);
}

async function testTokenTracking(): Promise<void> {
  LLMTracer.trackTokenUsage(
    'test-provider',
    'test-model',
    150,  // prompt tokens
    75,   // completion tokens
    0.05  // cost
  );
  console.log('   Token metrics tracked');
}

async function testDatadogTracer(): Promise<void> {
  const span = tracer.startSpan('llm.test', {
    tags: {
      'llm.operation': 'test',
      'llm.model': 'test-model',
      'llm.provider': 'test-provider',
    },
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 50));
    span.setTag('llm.status', 'success');
  } finally {
    span.finish();
  }

  console.log('   Datadog span created and finished');
}

async function flushMetrics(): Promise<void> {
  return new Promise(resolve => {
    // Give some time for spans to be written
    setTimeout(() => {
      console.log('   Waiting for metrics to flush...');
      (tracer as any).flush(() => {
        console.log('   Metrics flushed to Datadog');
        resolve();
      });
    }, 1000);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Datadog LLM Observability Test Suite                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Run all tests
  await runTest('Validate Environment', validateEnvironment);
  await runTest('LLMTracer Basic Test', testLLMTracer);
  await runTest('Token Tracking', testTokenTracking);
  await runTest('Datadog Tracer', testDatadogTracer);

  // OpenAI test is optional - skip if it fails
  try {
    await runTest('OpenAI Integration', testOpenAIIntegration);
  } catch (error) {
    console.log(`⚠️  Skipping OpenAI test: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Flush metrics
  await runTest('Flush Metrics to Datadog', flushMetrics);

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Results Summary                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${result.name.padEnd(40)} ${result.status.toUpperCase().padEnd(6)} (${result.duration}ms)`);
    if (result.message !== 'OK') {
      console.log(`   └─ ${result.message}`);
    }
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${totalDuration}ms total)`);

  // Next steps
  console.log('\n📝 Next Steps:');
  console.log('   1. Go to https://app.datadoghq.com/llm/');
  console.log('   2. Navigate to "LLM Observability" dashboard');
  console.log('   3. Check these metrics appear in your dashboard:');
  console.log('      - llm.completion spans');
  console.log('      - llm.requests.total counter');
  console.log('      - llm.tokens.* histograms');
  console.log('      - llm.response.latency_ms');
  console.log('');
  console.log('   4. View traces at: https://app.datadoghq.com/apm/services');
  console.log(`      - Service: vibecode-ai`);
  console.log('      - Look for spans tagged with llm.operation');
  console.log('');
  console.log('   5. Wait 2-5 minutes for metrics to appear in dashboards');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
