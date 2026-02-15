/**
 * OpenTelemetry Trace Context Utilities
 * Provides helpers for creating and managing custom spans for AI requests
 */

// Check if we're in a Docker build environment
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Conditional imports to prevent build-time errors in Docker
let api: any = null;
let trace: any = null;
let context: any = null;
let SpanStatusCode: any = null;

if (!isDockerBuild) {
  try {
    const otelApi = require('@opentelemetry/api');
    api = otelApi;
    trace = otelApi.trace;
    context = otelApi.context;
    SpanStatusCode = otelApi.SpanStatusCode;
  } catch (error) {
    // Modules not available
  }
}

const isServer = typeof window === 'undefined';

/**
 * Span attribute keys for AI operations
 */
export const AISpanAttributes = {
  // AI operation metadata
  AI_OPERATION_TYPE: 'ai.operation.type',
  AI_PROVIDER: 'ai.provider',
  AI_MODEL: 'ai.model',
  AI_REQUEST_ID: 'ai.request.id',

  // Request/response metrics
  AI_INPUT_TOKENS: 'ai.usage.input_tokens',
  AI_OUTPUT_TOKENS: 'ai.usage.output_tokens',
  AI_TOTAL_TOKENS: 'ai.usage.total_tokens',
  AI_COST: 'ai.usage.cost',

  // Performance metrics
  AI_LATENCY_MS: 'ai.latency.ms',
  AI_TTFB_MS: 'ai.latency.time_to_first_byte_ms',

  // Request parameters
  AI_TEMPERATURE: 'ai.request.temperature',
  AI_MAX_TOKENS: 'ai.request.max_tokens',
  AI_STREAM: 'ai.request.stream',

  // Response metadata
  AI_FINISH_REASON: 'ai.response.finish_reason',
  AI_ERROR_TYPE: 'ai.error.type',
  AI_ERROR_MESSAGE: 'ai.error.message',
} as const;

/**
 * Database span attribute keys
 */
export const DBSpanAttributes = {
  DB_SYSTEM: 'db.system',
  DB_NAME: 'db.name',
  DB_OPERATION: 'db.operation',
  DB_STATEMENT: 'db.statement',
  DB_TABLE: 'db.table',
  DB_QUERY_TIME_MS: 'db.query_time_ms',
} as const;

/**
 * Get the active tracer
 */
export function getTracer(name: string = 'vibecode-webgui') {
  if (!isServer || isDockerBuild || !trace) {
    // Return mock tracer for client-side or Docker build
    return {
      startSpan: () => ({
        setAttribute: () => {},
        setAttributes: () => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {},
      }),
      startActiveSpan: (name: string, fn: Function) => {
        return fn({
          setAttribute: () => {},
          setAttributes: () => {},
          setStatus: () => {},
          recordException: () => {},
          end: () => {},
        });
      },
    };
  }

  return trace.getTracer(name);
}

/**
 * Create a custom span for AI operations
 */
export function createAISpan<T>(
  operationType: string,
  attributes: Record<string, any>,
  fn: (span: any) => Promise<T>
): Promise<T> {
  if (!isServer || isDockerBuild || !trace || !context || !SpanStatusCode) {
    // Execute function without tracing in Docker build or client-side
    return fn({
      setAttribute: () => {},
      setAttributes: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {},
    });
  }

  const tracer = getTracer();
  const spanName = `ai.${operationType}`;

  return tracer.startActiveSpan(spanName, async (span: any) => {
    try {
      // Set initial attributes
      span.setAttributes({
        [AISpanAttributes.AI_OPERATION_TYPE]: operationType,
        ...attributes,
      });

      // Execute the function
      const result = await fn(span);

      // Mark span as successful
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      // Record error in span
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      span.recordException(error as Error);

      span.setAttributes({
        [AISpanAttributes.AI_ERROR_TYPE]: error instanceof Error ? error.constructor.name : 'Error',
        [AISpanAttributes.AI_ERROR_MESSAGE]: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a custom span for database operations
 */
export function createDBSpan<T>(
  operation: string,
  attributes: Record<string, any>,
  fn: (span: any) => Promise<T>
): Promise<T> {
  if (!isServer || isDockerBuild || !trace || !context || !SpanStatusCode) {
    // Execute function without tracing in Docker build or client-side
    return fn({
      setAttribute: () => {},
      setAttributes: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {},
    });
  }

  const tracer = getTracer();
  const spanName = `db.${operation}`;

  return tracer.startActiveSpan(spanName, async (span: any) => {
    const startTime = Date.now();

    try {
      // Set initial attributes
      span.setAttributes({
        [DBSpanAttributes.DB_OPERATION]: operation,
        ...attributes,
      });

      // Execute the function
      const result = await fn(span);

      // Mark span as successful and record query time
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute(DBSpanAttributes.DB_QUERY_TIME_MS, Date.now() - startTime);

      return result;
    } catch (error) {
      // Record error in span
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      span.recordException(error as Error);

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Get current trace and span IDs
 */
export function getCurrentTraceContext() {
  if (!isServer || isDockerBuild || !trace || !context) {
    return {
      traceId: null,
      spanId: null,
      traceFlags: null,
    };
  }

  try {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return {
        traceId: null,
        spanId: null,
        traceFlags: null,
      };
    }

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  } catch (error) {
    return {
      traceId: null,
      spanId: null,
      traceFlags: null,
    };
  }
}

/**
 * Extract trace context from headers (W3C Trace Context format)
 */
export function extractTraceContext(headers: Headers | Record<string, string>) {
  const traceparent = headers instanceof Headers
    ? headers.get('traceparent')
    : headers['traceparent'];

  if (!traceparent) {
    return null;
  }

  // W3C Trace Context format: version-traceId-spanId-traceFlags
  // Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
  const parts = traceparent.split('-');
  if (parts.length !== 4) {
    return null;
  }

  return {
    version: parts[0],
    traceId: parts[1],
    spanId: parts[2],
    traceFlags: parts[3],
  };
}

/**
 * Create W3C Trace Context header value
 */
export function createTraceparentHeader(traceId: string, spanId: string, traceFlags: string = '01') {
  return `00-${traceId}-${spanId}-${traceFlags}`;
}
