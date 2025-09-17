/// <reference types="jest" />
import express from 'express';
import request from 'supertest';
import nock from 'nock';

const SITE = 'us1.datadoghq.com';
const API_BASE = `https://api.${SITE}`;

async function buildTestApp() {
  // Ensure env loaded before importing modules that validate env
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
    process.env.DATADOG_SITE = 'us1.datadoghq.com';
    process.env.DD_ENV = 'development';
    process.env.DD_SERVICE = 'vibecode-ai-gateway';
    process.env.DD_VERSION = '0.0.0-test';
  });

  it('emits error counter on /chat/completions/stream when model not found (response 500)', async () => {
    const app = await buildTestApp();

    // Ensure registry has models that do NOT include the requested one
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

    // Expect Datadog error metric with http_status=400 (ValidationError)
    const ddBase = 'https://api.us1.datadoghq.com';
    const ddError = nock(ddBase)
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
        messages: [
          { role: 'user', content: 'Stream hello' }
        ],
        model: 'unknown_model_123'
      });

    expect(res.status).toBe(500);
    expect(ddError.isDone()).toBe(true);
  });

  afterEach(() => {
    nock.cleanAll();
    process.env = OLD_ENV;
  });

  it('emits selection metric on /models/select', async () => {
    const app = await buildTestApp();

    // Expect selection metric (count) to be sent to Datadog
    const scope = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        const tags = s?.tags || [];
        return (
          s?.metric === 'vibecode.ai_gateway.selection' &&
          s?.type === 'count' &&
          tags.includes('env:development') &&
          tags.includes('service:vibecode-ai-gateway') &&
          tags.some((t: string) => t.startsWith('model:')) &&
          tags.includes('task:code')
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
    expect(res.body).toHaveProperty('selected');
    expect(res.body).toHaveProperty('task', 'code');
    expect(scope.isDone()).toBe(true);
  });

  it('emits latency/tokens/cost metrics on /chat/completions success', async () => {
    const app = await buildTestApp();

    // Mock OpenRouter models to include a known model with pricing
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

    // Mock OpenRouter chat completion
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

    // Expect three Datadog metrics posts: latency_ms, tokens_total, cost_usd
    const ddBase = 'https://api.us1.datadoghq.com';
    const ddLatency = nock(ddBase)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        return s?.metric === 'vibecode.ai_gateway.latency_ms' && s?.points?.[0]?.[1] >= 0;
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const ddTokens = nock(ddBase)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        return s?.metric === 'vibecode.ai_gateway.tokens_total' && s?.points?.[0]?.[1] === 30;
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const ddCost = nock(ddBase)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        return s?.metric === 'vibecode.ai_gateway.cost_usd';
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/chat/completions')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [
          { role: 'user', content: 'Say hello' }
        ],
        model: 'anthropic/claude-3-haiku-20240307'
      });

    expect(res.status).toBe(200);
    expect(ddLatency.isDone()).toBe(true);
    expect(ddTokens.isDone()).toBe(true);
    expect(ddCost.isDone()).toBe(true);
  });

  it('emits error counter on /chat/completions when model not found', async () => {
    const app = await buildTestApp();

    // Mock OpenRouter models WITHOUT our requested model
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

    // Expect Datadog error metric (count)
    const ddBase = 'https://api.us1.datadoghq.com';
    const ddError = nock(ddBase)
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
        messages: [
          { role: 'user', content: 'Say hello' }
        ],
        model: 'unknown_model_123'
      });

    expect(res.status).toBe(400);
    expect(ddError.isDone()).toBe(true);
  });

  it('emits latency metric on /chat/completions/stream success', async () => {
    const app = await buildTestApp();

    const orBase = 'https://openrouter.ai';
    // Models include our streaming model
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

    // Mock streaming response as SSE-like lines
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
      .reply(200, () => stream, {
        'Content-Type': 'text/event-stream'
      });

    // Expect at least latency metric
    const ddBase = 'https://api.us1.datadoghq.com';
    const ddLatency = nock(ddBase)
      .post('/api/v1/series', (body: any) => {
        const s = body?.series?.[0];
        return s?.metric === 'vibecode.ai_gateway.latency_ms';
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const res = await request(app)
      .post('/api/v1/chat/completions/stream')
      .set('X-API-Key', 'vbai_dev_key_1')
      .send({
        messages: [
          { role: 'user', content: 'Stream hello' }
        ],
        model: 'anthropic/claude-3-haiku-20240307'
      });

    expect(res.status).toBe(200);
    expect(ddLatency.isDone()).toBe(true);
  });
});
