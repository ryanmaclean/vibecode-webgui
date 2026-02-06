#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


const fetch = require('node-fetch');

// Initialize log aggregation
const logAggregation = new LogAggregation();


async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const candidateModels = Array.from(
    new Set(
      [
        process.env.OPENROUTER_FREE_MODEL,
        'openai/gpt-oss-20b:free',
        'deepseek/deepseek-chat-v3.1:free'
      ].filter(Boolean)
    )
  );

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER;
  }
  if (process.env.OPENROUTER_APP_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_APP_TITLE;
  }

  const requestTemplate = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Summarize what a React component is in one sentence.' }
    ],
    max_tokens: 120,
    temperature: 0.2
  };

  let lastError;
  for (const model of candidateModels) {
    console.log(`Attempting OpenRouter chat completion with model: ${model}`);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...requestTemplate, model })
    });

    const rawText = await response.text();
    console.log('status:', response.status, response.statusText);
    console.log(rawText);

    if (!response.ok) {
      lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
      continue;
    }

    try {
      const payload = rawText ? JSON.parse(rawText) : {};
      if (payload.error) {
        const code = payload.error?.code ?? 'unknown';
        const message = payload.error?.message ?? 'unknown error';
        lastError = new Error(`OpenRouter error (${code}): ${message}`);
        console.warn(`OpenRouter reported upstream error for model ${model}:`, payload.error);
        continue;
      }

      console.log('✅ OpenRouter chat completion succeeded');
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Failed to parse OpenRouter response for model ${model}:`, lastError);
    }
  }

  throw lastError ?? new Error('No OpenRouter models attempted');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
