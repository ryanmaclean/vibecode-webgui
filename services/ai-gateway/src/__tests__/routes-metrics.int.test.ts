/// <reference types="jest" />
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://openrouter.ai'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      }
    }
  }));

  // Avoid early import of config/environment; use env var directly for CORS if provided
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8090')
    .split(',');
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_REQUESTS || '1000', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/metrics'
  });
  app.use(limiter);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Dynamically import modules that rely on config/environment after env is set
  let authMiddleware: any;
  let errorHandler: any;
  let aiRoutes: any;
  let healthRoutes: any;
  let metricsRoutes: any;

  await new Promise<void>((resolve) => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      authMiddleware = require('../middleware/auth').authMiddleware;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      errorHandler = require('../middleware/error-handler').errorHandler;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      aiRoutes = require('../routes/ai-routes').aiRoutes;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      healthRoutes = require('../routes/health-routes').healthRoutes;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      metricsRoutes = require('../routes/metrics-routes').metricsRoutes;
      resolve();
    });
  });

  // Mount routes (same structure as server.ts)
  app.use('/health', healthRoutes);
  app.use('/metrics', metricsRoutes);
  app.use('/api/v1', authMiddleware, aiRoutes);

  app.use(errorHandler);
  return app;
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
  });

  test('POST /api/v1/models/select without API key is unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/models/select')
      .send({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(res.status).toBe(401);
  });
});
