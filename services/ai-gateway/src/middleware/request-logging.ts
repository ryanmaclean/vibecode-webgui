import { Request, Response, NextFunction } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';

type RequestWithContext = AuthenticatedRequest & {
    requestId?: string;
};

const getUserContext = (req: RequestWithContext) => {
    if (req.user) {
        return {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        };
    }

    if (req.apiKey) {
        return {
            apiKeyPrefix: `${req.apiKey.substring(0, 8)}...`
        };
    }

    return undefined;
};

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const request = req as RequestWithContext;
    const tracer = trace.getTracer('ai-gateway');
    const requestId = request.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    request.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    const startTime = Date.now();

    tracer.startActiveSpan(`HTTP ${request.method} ${request.path}`, (span) => {
        try {
            const ua = request.get('User-Agent') || '';
            span.setAttribute('http.method', String(request.method || ''));
            span.setAttribute('http.target', String(request.originalUrl || request.url || ''));
            span.setAttribute('http.route', String(request.path || ''));
            span.setAttribute('http.client_ip', String(request.ip || ''));
            span.setAttribute('user_agent', ua);
            span.setAttribute('request_id', requestId);

            const ctx = span.spanContext();
            if (ctx && ctx.traceId && ctx.spanId) {
                const sampled = (ctx.traceFlags & 0x01) === 0x01 ? '01' : '00';
                const traceparent = `00-${ctx.traceId}-${ctx.spanId}-${sampled}`;
                res.setHeader('traceparent', traceparent);
            }

            let ended = false;
            const finalize = (event: 'finish' | 'close') => {
                if (ended) return;
                ended = true;
                const durationMs = Date.now() - startTime;
                const statusCode = res.statusCode;
                const userContext = getUserContext(request);
                const logPayload = {
                    requestId,
                    method: request.method,
                    url: request.originalUrl || request.url,
                    statusCode,
                    durationMs,
                    ip: request.ip,
                    userAgent: ua,
                    user: userContext,
                    event,
                    trace_id: ctx?.traceId,
                    span_id: ctx?.spanId
                };

                span.setAttribute('http.status_code', statusCode);
                span.setAttribute('http.server_duration_ms', durationMs);

                if (event === 'close' && !res.writableEnded) {
                    logger.warn('Request aborted', logPayload);
                } else if (statusCode >= 500) {
                    span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${statusCode}` });
                    logger.error('Request failed', logPayload);
                } else if (statusCode >= 400) {
                    logger.warn('Request completed with error', logPayload);
                } else {
                    logger.info('Request completed', logPayload);
                }

                span.end();
            };

            res.on('finish', () => finalize('finish'));
            res.on('close', () => finalize('close'));
            next();
        } catch (err) {
            span.recordException(err as Error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'request logging middleware error' });
            span.end();
            next(err as Error);
        }
    });
};
