/**
 * Distributed Tracing Configuration for AgentAPI
 * Enables end-to-end tracing from Next.js → AgentAPI → Agent Runtime
 */

import { trace, context, propagation, type Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
// import { logger } from '@/lib/logger';
const TRACER_NAME = 'agentapi-distributed-tracing';

interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

interface RequestHeaders {
  traceparent?: string;
  tracestate?: string;
  [key: string]: string | undefined;
}

class AgentAPIDistributedTracing {
  private tracer = trace.getTracer(TRACER_NAME);
  private propagator = new W3CTraceContextPropagator();

  /**
   * Extract trace context from incoming HTTP request headers
   */
  extractTraceContext(headers: RequestHeaders): TraceContext | null {
    try {
      const carrier: Record<string, string> = {};

      // W3C Trace Context format: traceparent header
      if (headers.traceparent) {
        carrier['traceparent'] = headers.traceparent;
      }
      if (headers.tracestate) {
        carrier['tracestate'] = headers.tracestate;
      }

      // Extract context from headers
      const extractedContext = propagation.extract(context.active(), carrier);
      const span = trace.getSpan(extractedContext);

      if (span) {
        const spanContext = span.spanContext();
        return {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
          traceFlags: spanContext.traceFlags,
          traceState: spanContext.traceState?.serialize()
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to extract trace context:', error);
      return null;
    }
  }

  /**
   * Inject trace context into outgoing HTTP request headers
   */
  injectTraceContext(headers: Record<string, string> = {}): Record<string, string> {
    const carrier: Record<string, string> = { ...headers };

    try {
      propagation.inject(context.active(), carrier);
    } catch (error) {
      console.error('Failed to inject trace context:', error);
    }

    return carrier;
  }

  /**
   * Start client span for Next.js → AgentAPI request
   */
  startClientSpan(
    method: string,
    url: string,
    body?: any
  ): Span {
    return this.tracer.startSpan(
      `HTTP ${method} ${url}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': method,
          'http.url': url,
          'http.target': new URL(url).pathname,
          'http.scheme': new URL(url).protocol.replace(':', ''),
          'http.host': new URL(url).host,
          'component': 'nextjs-client',
          'peer.service': 'agentapi',
          ...(body && { 'http.request.body': JSON.stringify(body) })
        }
      }
    );
  }

  /**
   * Start server span for AgentAPI handling incoming request
   */
  startServerSpan(
    method: string,
    path: string,
    headers: RequestHeaders
  ): Span {
    // Extract parent context if present
    const parentContext = this.extractTraceContext(headers);

    return this.tracer.startSpan(
      `AgentAPI ${method} ${path}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': method,
          'http.route': path,
          'http.target': path,
          'component': 'agentapi-server',
          'service.name': 'agentapi',
          ...(parentContext && {
            'parent.trace_id': parentContext.traceId,
            'parent.span_id': parentContext.spanId
          })
        }
      }
    );
  }

  /**
   * Start internal span for agent runtime execution
   */
  startAgentRuntimeSpan(
    agentType: string,
    agentId: string,
    operation: string
  ): Span {
    return this.tracer.startSpan(
      `Agent ${operation}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'agent.type': agentType,
          'agent.id': agentId,
          'agent.operation': operation,
          'component': 'agent-runtime'
        }
      }
    );
  }

  /**
   * Add agent execution details to span
   */
  enrichAgentSpan(
    span: Span,
    details: {
      workspace?: string;
      files?: string[];
      model?: string;
      task?: string;
      pid?: number;
    }
  ): void {
    const attributes: Record<string, any> = {};

    if (details.workspace) attributes['agent.workspace'] = details.workspace;
    if (details.files) attributes['agent.files'] = details.files.join(',');
    if (details.model) attributes['agent.model'] = details.model;
    if (details.task) attributes['agent.task'] = details.task;
    if (details.pid) attributes['agent.process_id'] = details.pid;

    span.setAttributes(attributes);
  }

  /**
   * Record agent lifecycle event
   */
  recordAgentEvent(
    span: Span,
    eventName: string,
    attributes?: Record<string, any>
  ): void {
    span.addEvent(eventName, {
      timestamp: Date.now(),
      ...attributes
    });
  }

  /**
   * Complete span with success
   */
  completeSpan(
    span: Span,
    statusCode?: number,
    responseSize?: number
  ): void {
    if (statusCode) {
      span.setAttribute('http.status_code', statusCode);
    }
    if (responseSize) {
      span.setAttribute('http.response_content_length', responseSize);
    }

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  /**
   * Complete span with error
   */
  completeSpanWithError(
    span: Span,
    error: Error,
    statusCode?: number
  ): void {
    span.recordException(error);

    if (statusCode) {
      span.setAttribute('http.status_code', statusCode);
    }

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });

    span.end();
  }

  /**
   * Create trace link for correlation
   */
  createTraceLink(traceId: string, spanId: string): string {
    // Datadog trace link format
    const datadogSite = process.env.DD_SITE || 'datadoghq.com';
    return `https://app.${datadogSite}/apm/trace/${traceId}?span_id=${spanId}`;
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): TraceContext | null {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        const spanContext = span.spanContext();
        return {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
          traceFlags: spanContext.traceFlags,
          traceState: spanContext.traceState?.serialize()
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get current trace context:', error);
      return null;
    }
  }

  /**
   * Create correlation ID for logs
   */
  createCorrelationId(traceId: string, spanId: string): string {
    return `trace_id=${traceId} span_id=${spanId}`;
  }
}

// Export singleton instance
export const distributedTracing = new AgentAPIDistributedTracing();

/**
 * Middleware for Next.js API routes to enable distributed tracing
 */
export function withDistributedTracing<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    const request = args[0] as Request;
    const method = request.method || 'GET';
    const url = request.url;

    // Extract trace context from incoming request
    const headers: RequestHeaders = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Start server span
    const span = distributedTracing.startServerSpan(method, new URL(url).pathname, headers);

    try {
      // Execute handler within span context
      const response = await context.with(trace.setSpan(context.active(), span), async () => {
        return await handler(...args);
      });

      // Complete span with success
      distributedTracing.completeSpan(
        span,
        response.status,
        parseInt(response.headers.get('content-length') || '0', 10)
      );

      return response;

    } catch (error) {
      // Complete span with error
      distributedTracing.completeSpanWithError(span, error as Error, 500);
      throw error;
    }
  }) as T;
}

/**
 * Client-side fetch wrapper with distributed tracing
 */
export async function tracedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || 'GET';

  // Start client span
  const span = distributedTracing.startClientSpan(method, url, options.body);

  // Inject trace context into request headers
  const headers = distributedTracing.injectTraceContext(
    options.headers as Record<string, string> || {}
  );

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Complete span with success
    distributedTracing.completeSpan(
      span,
      response.status,
      parseInt(response.headers.get('content-length') || '0', 10)
    );

    return response;

  } catch (error) {
    // Complete span with error
    distributedTracing.completeSpanWithError(span, error as Error);
    throw error;
  }
}

// Export types
export type { TraceContext, RequestHeaders };
