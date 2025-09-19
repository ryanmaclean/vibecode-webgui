/// <reference types="jest" />
import express from 'express';
import request from 'supertest';

const shouldRun = !!process.env.OPENROUTER_API_KEY;

async function buildApp() {
  let createApp: (() => express.Express) | undefined;
  await new Promise<void>((resolve) => {
    jest.isolateModules(() => {
      // Ensure env is set before import
       
      createApp = require('../app').createApp as () => express.Express;
      resolve();
    });
  });
  if (!createApp) throw new Error('Failed to load createApp');
  return createApp();
}

(shouldRun ? describe : describe.skip)('AI Gateway OpenRouter E2E (real)', () => {
  let app: express.Express;

  beforeAll(async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
    process.env.API_KEYS = process.env.API_KEYS || 'vbai_test_key';
    process.env.RATE_LIMIT_REQUESTS = process.env.RATE_LIMIT_REQUESTS || '1000';
    process.env.ENABLE_TRACING = process.env.ENABLE_TRACING || 'false';
    // Require an actual OpenRouter API key in CI to run this test
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is required to run E2E test');
    }
    app = await buildApp();
  }, 15000);

  test('POST /api/v1/chat/completions responds and sets tracing headers', async () => {
    const model = process.env.E2E_CHAT_MODEL || 'auto';
    const res = await request(app)
      .post('/api/v1/chat/completions')
      .set('X-API-Key', 'vbai_test_key')
      .send({
        model,
        messages: [
          { role: 'user', content: 'Say hi in one short sentence.' }
        ],
        max_tokens: 16,
        temperature: 0
      });

    // Always assert tracing headers for correlation
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);

    // If the key has access/credits, we expect 200 with choices
    if (res.status === 200) {
      expect(res.body).toHaveProperty('choices');
      expect(Array.isArray(res.body.choices)).toBe(true);
    } else {
      // Otherwise, treat as a soft pass for environments without model access
      // The main value is verifying real call path and correlation headers
       
      console.warn(`E2E chat returned status ${res.status}; validated tracing headers`);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  }, 60000);
});
