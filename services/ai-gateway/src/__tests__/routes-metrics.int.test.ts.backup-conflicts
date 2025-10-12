/// <reference types="jest" />
import express from 'express';
import request from 'supertest';
<<<<<<< HEAD

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
=======
import nock from 'nock';

const SITE = 'us1.datadoghq.com';
const API_BASE = `https://api.${SITE}`;

async function buildTestApp() {
  const { aiRoutes } = await import('../routes/ai-routes');
  const { authMiddleware } = await import('../middleware/auth');
  const app = express();
  app.use(express.json());
  app.use('/api/v1', authMiddleware, aiRoutes);
  return app;
}

describe('AI Routes - Datadog metrics integration (route-level)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.API_KEYS = 'vbai_dev_key_1,vbai_dev_key_2';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.DD_API_KEY = 'test_api_key';
    process.env.DATADOG_SITE = SITE;
    process.env.DD_ENV = 'development';
    process.env.DD_SERVICE = 'vibecode-ai-gateway';
    process.env.DD_VERSION = '0.0.0-test';
  });

  afterEach(() => {
    nock.cleanAll();
    process.env = OLD_ENV;
  });

  it('emits selection metric on /models/select', async () => {
    const app = await buildTestApp();

    // Mock model list
    const orBase = 'https://openrouter.ai';
    nock(orBase)
      .get('/api/v1/models')
      .reply(200, {
        data: [
          {
            id: 'anthropic/claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            provider: 'anthropic',
            pricing: { prompt: 0.0005, completion: 0.0015 },
            context_length: 200000,
            architecture: { modality: 'text', tokenizer: 'cl100k' }
          }
        ]
      });

    // Expect selection metric
    const scope = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        const tags = s?.tags || [];
        return (
          s?.metric === 'vibecode.ai_gateway.selection' &&
          s?.type === 'count' &&
          tags.includes('task:code') &&
          tags.includes('model_provider:anthropic') &&
          tags.includes('model_family:claude-3')
        );
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/models/select')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [
          { role: 'user', content: 'Write a function in JavaScript to sort an array ascending.' }
        ],
        model: 'auto'
      });

    expect(res.status).toBe(200);
    expect(scope.isDone()).toBe(true);
  });

  it('emits latency/tokens/cost metrics on /chat/completions success', async () => {
    const app = await buildTestApp();

    const orBase = 'https://openrouter.ai';
    nock(orBase)
      .get('/api/v1/models')
      .reply(200, {
        data: [
          {
            id: 'anthropic/claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            provider: 'anthropic',
            pricing: { prompt: 0.0005, completion: 0.0015 },
            context_length: 200000,
            architecture: { modality: 'text', tokenizer: 'cl100k' }
          }
        ]
      });

    nock(orBase)
      .post('/api/v1/chat/completions')
      .reply(200, {
        id: 'cmpl_test',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'anthropic/claude-3-haiku-20240307',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello world' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
      });

    const ddLatency = nock(API_BASE)
      .post('/api/v1/series', (body: any) => body?.series?.[0]?.metric === 'vibecode.ai_gateway.latency_ms')
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const ddTokens = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        return s?.metric === 'vibecode.ai_gateway.tokens_total' && s?.points?.[0]?.[1] === 30;
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const ddCost = nock(API_BASE)
      .post('/api/v1/series', (body: any) => body?.series?.[0]?.metric === 'vibecode.ai_gateway.cost_usd')
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/chat/completions')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [ { role: 'user', content: 'Say hello' } ],
        model: 'anthropic/claude-3-haiku-20240307'
      });

    expect(res.status).toBe(200);
    expect(ddLatency.isDone()).toBe(true);
    expect(ddTokens.isDone()).toBe(true);
    expect(ddCost.isDone()).toBe(true);
  });

  it('emits error counter on /chat/completions when model not found', async () => {
    const app = await buildTestApp();

    const orBase = 'https://openrouter.ai';
    nock(orBase)
      .get('/api/v1/models')
      .reply(200, { data: [] });

    const ddError = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        const tags = s?.tags || [];
        return (
          s?.metric === 'vibecode.ai_gateway.error' &&
          s?.type === 'count' &&
          tags.includes('error_class:ValidationError') &&
          tags.includes('http_status:400')
        );
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/chat/completions')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [ { role: 'user', content: 'Say hello' } ],
        model: 'unknown_model_123'
      });

    expect(res.status).toBe(400);
    expect(ddError.isDone()).toBe(true);
  });

  it('emits latency metric on /chat/completions/stream success', async () => {
    const app = await buildTestApp();

    const orBase = 'https://openrouter.ai';
    nock(orBase)
      .get('/api/v1/models')
      .reply(200, {
        data: [
          {
            id: 'anthropic/claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            provider: 'anthropic',
            pricing: { prompt: 0.0005, completion: 0.0015 },
            context_length: 200000,
            architecture: { modality: 'text', tokenizer: 'cl100k' }
          }
        ]
      });

    // Mock SSE stream
    const { Readable } = await import('stream');
    const stream = new Readable({ read() {} });
    const chunk = {
      id: 'cmpl_stream',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'anthropic/claude-3-haiku-20240307',
      choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }]
    };
    setTimeout(() => {
      stream.push(`data: ${JSON.stringify(chunk)}\n\n`);
      stream.push('data: [DONE]\n\n');
      stream.push(null);
    }, 10);

    nock(orBase)
      .post('/api/v1/chat/completions')
      .reply(200, () => stream, { 'Content-Type': 'text/event-stream' });

    const ddLatency = nock(API_BASE)
      .post('/api/v1/series', (body: any) => body?.series?.[0]?.metric === 'vibecode.ai_gateway.latency_ms')
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/chat/completions/stream')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [ { role: 'user', content: 'Stream hello' } ],
        model: 'anthropic/claude-3-haiku-20240307'
      });

    expect(res.status).toBe(200);
    expect(ddLatency.isDone()).toBe(true);
  });

  it('emits error counter on /chat/completions/stream when model not found (response 500)', async () => {
    const app = await buildTestApp();

    const orBase = 'https://openrouter.ai';
    nock(orBase)
      .get('/api/v1/models')
      .reply(200, { data: [] });

    const ddError = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        const tags = s?.tags || [];
        return (
          s?.metric === 'vibecode.ai_gateway.error' &&
          s?.type === 'count' &&
          tags.includes('error_class:ValidationError') &&
          tags.includes('http_status:400')
        );
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/chat/completions/stream')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [ { role: 'user', content: 'Stream hello' } ],
        model: 'unknown_model_123'
      });

    expect(res.status).toBe(500);
    expect(ddError.isDone()).toBe(true);
>>>>>>> merge-conflict-cleanup
  });
});
