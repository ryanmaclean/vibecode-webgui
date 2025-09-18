import './tracing';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { aiRoutes } from './routes/ai-routes';
import { healthRoutes } from './routes/health-routes';
import { metricsRoutes } from './routes/metrics-routes';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
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

  // CORS configuration
  app.use(cors({
    origin: config.cors.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimit.requestsPerWindow,
    message: {
      error: 'Too many requests',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/metrics'
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Inbound request tracing + logging
  app.use((req, res, next) => {
    const tracer = trace.getTracer('ai-gateway');
    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    tracer.startActiveSpan(`HTTP ${req.method} ${req.path}`, (span) => {
      try {
        const ua = req.get('User-Agent') || '';
        span.setAttribute('http.method', String(req.method || ''));
        span.setAttribute('http.target', String((req as any).originalUrl || req.url || ''));
        span.setAttribute('http.route', String((req as any).path || ''));
        span.setAttribute('http.client_ip', String((req as any).ip || ''));
        span.setAttribute('user_agent', ua);
        span.setAttribute('request_id', requestId);

        // Propagate traceparent to response for client-side correlation
        const ctx = span.spanContext();
        if (ctx && ctx.traceId && ctx.spanId) {
          const sampled = (ctx.traceFlags & 0x01) === 0x01 ? '01' : '00';
          const traceparent = `00-${ctx.traceId}-${ctx.spanId}-${sampled}`;
          res.setHeader('traceparent', traceparent);
        }

        logger.info('Incoming request', {
          requestId,
          method: req.method,
          url: req.url,
          userAgent: ua,
          ip: req.ip,
          trace_id: ctx?.traceId,
          span_id: ctx?.spanId
        });

        res.on('finish', () => {
          span.setAttribute('http.status_code', res.statusCode);
          if (res.statusCode >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
          }
          span.end();
        });

        next();
      } catch (err) {
        span.recordException(err as any);
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'middleware error' });
        span.end();
        next(err as any);
      }
    });
  });

  // Routes
  app.use('/health', healthRoutes);
  app.use('/metrics', metricsRoutes);
  app.use('/api/v1', authMiddleware, aiRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  // Error handling
  app.use(errorHandler);

  return app;
}
