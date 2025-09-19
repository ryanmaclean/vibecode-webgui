/// <reference types="jest" />
import express from 'express';
import request from 'supertest';

// Ensure required env are set for config validation
const OLD_ENV = process.env;

beforeAll(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  process.env.NODE_ENV = 'test';
  process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test_openrouter_key';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
  process.env.API_KEYS = process.env.API_KEYS || 'vbai_test_key';
  process.env.RATE_LIMIT_REQUESTS = process.env.RATE_LIMIT_REQUESTS || '1000';
  process.env.ENABLE_TRACING = 'false';
});

afterAll(() => {
  process.env = OLD_ENV;
});

async function buildApp() {
  let createApp: (() => express.Express) | undefined;
  await new Promise<void>((resolve) => {
    jest.isolateModules(() => {
      // Avoid early import to ensure env is set
       
      createApp = require('../app').createApp as () => express.Express;
      resolve();
    });
  });
  if (!createApp) {
    throw new Error('Failed to load createApp from ../app');
  }
  return createApp();
}

describe('AI Gateway route-level metrics integration', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'vibecode-ai-gateway');
    // Inbound tracing middleware should set headers
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  });

  test('GET /metrics returns basic metrics shape', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'vibecode-ai-gateway');
    expect(res.body).toHaveProperty('performance');
    expect(res.body).toHaveProperty('system');
  });

  test('GET /metrics/prometheus returns Prometheus text', async () => {
    const res = await request(app).get('/metrics/prometheus');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('vibecode_ai_gateway_uptime_seconds');
  });

  test('POST /api/v1/models/select selects a model with valid API key', async () => {
    const res = await request(app)
      .post('/api/v1/models/select')
      .set('X-API-Key', 'vbai_test_key')
      .send({ messages: [{ role: 'user', content: 'Hello there!' }] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('selected');
    expect(typeof res.body.selected).toBe('string');
    // Tracing headers present
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  });

  test('POST /api/v1/models/select without API key is unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/models/select')
      .send({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(res.status).toBe(401);
  });
});
