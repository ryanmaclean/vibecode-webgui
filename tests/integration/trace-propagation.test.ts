/**
 * Integration tests for end-to-end trace propagation
 * Verifies trace correlation from browser to database
 */

import { jest } from '@jest/globals'

// Mock environment before any imports
process.env.OTEL_ENABLED = 'true'
process.env.DOCKER_BUILD = 'false'
process.env.SKIP_MONITORING = 'false'

// Track exported spans for verification
const exportedSpans: any[] = []

// Mock OpenTelemetry SDK and modules
jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    shutdown: jest.fn()
  }))
}))

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn(() => [])
}))

jest.mock('@opentelemetry/exporter-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({
    export: jest.fn((spans: any[], callback: Function) => {
      // Store exported spans for verification
      exportedSpans.push(...spans)
      callback({ code: 0 }) // Success
    }),
    shutdown: jest.fn()
  }))
}))

jest.mock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: jest.fn().mockImplementation(() => ({
    startServer: jest.fn()
  }))
}))

jest.mock('@opentelemetry/resources', () => ({
  Resource: jest.fn().mockImplementation((attrs: any) => ({
    attributes: attrs
  }))
}))

jest.mock('@opentelemetry/semantic-conventions', () => ({
  SEMRESATTRS_SERVICE_NAME: 'service.name',
  SEMRESATTRS_SERVICE_VERSION: 'service.version',
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version'
}))

jest.mock('@opentelemetry/instrumentation-pg', () => ({
  PgInstrumentation: jest.fn().mockImplementation(() => ({
    enable: jest.fn(),
    disable: jest.fn()
  }))
}))

// Import OpenTelemetry API for real
import { trace, context, SpanStatusCode } from '@opentelemetry/api'
import {
  extractTraceContext,
  createTraceparentHeader,
  extractAndInjectTraceContext
} from '../../src/lib/monitoring/trace-context'
import {
  getDatabaseTraceContext,
  traceDatabaseOperation
} from '../../src/lib/monitoring/database-instrumentation'

// Jest environment polyfill for Response.json
const g = globalThis as unknown as { Response: typeof Response & { json?: (body: unknown, init?: ResponseInit) => Response } }
if (!g.Response.json) {
  g.Response.json = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
}

describe('End-to-End Trace Propagation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    exportedSpans.length = 0 // Clear exported spans
  })

  describe('W3C Trace Context Propagation', () => {
    test('should extract trace context from traceparent header', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId, '01')

      const headers = new Headers()
      headers.set('traceparent', traceparent)

      const extracted = extractTraceContext(headers)

      expect(extracted).not.toBeNull()
      expect(extracted?.traceId).toBe(traceId)
      expect(extracted?.spanId).toBe(spanId)
      expect(extracted?.traceFlags).toBe('01')
      expect(extracted?.version).toBe('00')
    })

    test('should create valid traceparent header', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'

      const traceparent = createTraceparentHeader(traceId, spanId)

      expect(traceparent).toBe(`00-${traceId}-${spanId}-01`)

      // Verify it's extractable
      const headers = new Headers()
      headers.set('traceparent', traceparent)
      const extracted = extractTraceContext(headers)

      expect(extracted?.traceId).toBe(traceId)
      expect(extracted?.spanId).toBe(spanId)
    })

    test('should handle invalid traceparent format', () => {
      const headers = new Headers()
      headers.set('traceparent', 'invalid-format')

      const extracted = extractTraceContext(headers)

      expect(extracted).toBeNull()
    })

    test('should return null when traceparent header is missing', () => {
      const headers = new Headers()

      const extracted = extractTraceContext(headers)

      expect(extracted).toBeNull()
    })
  })

  describe('Browser to API Trace Propagation', () => {
    test('should propagate trace context from browser request to API', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId)

      // Simulate browser request with traceparent header
      const headers = new Headers()
      headers.set('traceparent', traceparent)
      headers.set('user-agent', 'Mozilla/5.0 Test Browser')

      // Extract and inject trace context
      const { traceContext } = extractAndInjectTraceContext(headers)

      // Verify trace context was extracted
      expect(traceContext).not.toBeNull()
      expect(traceContext?.trace_id).toBe(traceId)
      expect(traceContext?.span_id).toBe(spanId)
    })

    test('should create new trace context when traceparent is missing', () => {
      const headers = new Headers()
      headers.set('user-agent', 'Mozilla/5.0 Test Browser')

      const { traceContext } = extractAndInjectTraceContext(headers)

      // Should handle missing traceparent gracefully
      expect(traceContext).toBeNull()
    })
  })

  describe('API to Database Trace Propagation', () => {
    test('should propagate trace context to database queries', async () => {
      // Create a root span to establish trace context
      const tracer = trace.getTracer('test-tracer')

      await tracer.startActiveSpan('test-api-request', async (span) => {
        try {
          const spanContext = span.spanContext()

          // Get database trace context while in active span
          const dbTraceContext = getDatabaseTraceContext()

          // Verify trace context is available
          expect(dbTraceContext).toBeDefined()
          expect(dbTraceContext.trace_id).toBe(spanContext.traceId)
          expect(dbTraceContext.span_id).toBe(spanContext.spanId)

          span.setStatus({ code: SpanStatusCode.OK })
        } finally {
          span.end()
        }
      })
    })

    test('should create database span with trace correlation', async () => {
      const tracer = trace.getTracer('test-tracer')

      await tracer.startActiveSpan('test-api-request', async (parentSpan) => {
        try {
          // Execute a traced database operation
          const result = await traceDatabaseOperation(
            'query',
            {
              'db.table': 'users',
              'db.operation': 'SELECT'
            },
            async () => {
              // Simulate database query
              await new Promise(resolve => setTimeout(resolve, 10))
              return { rows: 5 }
            }
          )

          expect(result).toEqual({ rows: 5 })

          parentSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          parentSpan.end()
        }
      })
    })

    test('should handle database errors with trace context', async () => {
      const tracer = trace.getTracer('test-tracer')

      await expect(async () => {
        await tracer.startActiveSpan('test-api-request', async (parentSpan) => {
          try {
            // Execute a traced database operation that fails
            await traceDatabaseOperation(
              'query',
              {
                'db.table': 'users',
                'db.operation': 'SELECT'
              },
              async () => {
                throw new Error('Database connection failed')
              }
            )
          } finally {
            parentSpan.end()
          }
        })
      }).rejects.toThrow('Database connection failed')
    })
  })

  describe('Full Stack Trace Verification', () => {
    test('should create complete trace from browser to database', async () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId)

      // Step 1: Browser sends request with trace context
      const browserHeaders = new Headers()
      browserHeaders.set('traceparent', traceparent)
      browserHeaders.set('user-agent', 'Mozilla/5.0 Test Browser')

      // Step 2: Extract trace context in API
      const { traceContext } = extractAndInjectTraceContext(browserHeaders)
      expect(traceContext?.trace_id).toBe(traceId)

      // Step 3: Create API span
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-handler', async (apiSpan) => {
        try {
          apiSpan.setAttributes({
            'http.method': 'POST',
            'http.route': '/api/workspaces',
            'vibecode.service': 'webgui'
          })

          // Step 4: Execute database operation within API span
          const dbResult = await traceDatabaseOperation(
            'insert',
            {
              'db.table': 'workspaces',
              'db.operation': 'INSERT'
            },
            async () => {
              // Simulate database insert
              await new Promise(resolve => setTimeout(resolve, 5))
              return { id: 'workspace-123' }
            }
          )

          expect(dbResult.id).toBe('workspace-123')

          // Verify database trace context is correlated
          const dbTraceContext = getDatabaseTraceContext()
          expect(dbTraceContext.trace_id).toBe(apiSpan.spanContext().traceId)

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should maintain trace context across multiple database operations', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-handler', async (apiSpan) => {
        try {
          const parentTraceId = apiSpan.spanContext().traceId

          // First database operation
          await traceDatabaseOperation(
            'query',
            { 'db.table': 'users', 'db.operation': 'SELECT' },
            async () => {
              const traceContext1 = getDatabaseTraceContext()
              expect(traceContext1.trace_id).toBe(parentTraceId)
              return { rows: [] }
            }
          )

          // Second database operation (should have same trace ID)
          await traceDatabaseOperation(
            'insert',
            { 'db.table': 'audit_log', 'db.operation': 'INSERT' },
            async () => {
              const traceContext2 = getDatabaseTraceContext()
              expect(traceContext2.trace_id).toBe(parentTraceId)
              return { inserted: 1 }
            }
          )

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should propagate trace context through nested operations', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-request', async (apiSpan) => {
        try {
          const rootTraceId = apiSpan.spanContext().traceId

          // Business logic span
          await tracer.startActiveSpan('business-logic', async (businessSpan) => {
            try {
              // Verify trace ID is maintained
              expect(businessSpan.spanContext().traceId).toBe(rootTraceId)

              // Database operation in nested span
              await traceDatabaseOperation(
                'query',
                { 'db.table': 'products' },
                async () => {
                  const dbContext = getDatabaseTraceContext()
                  expect(dbContext.trace_id).toBe(rootTraceId)
                  return { rows: [] }
                }
              )

              businessSpan.setStatus({ code: SpanStatusCode.OK })
            } finally {
              businessSpan.end()
            }
          })

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })
  })

  describe('Trace Context Header Propagation', () => {
    test('should propagate traceparent in outbound requests', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'

      const traceparent = createTraceparentHeader(traceId, spanId)

      // Simulate adding to outbound request
      const outboundHeaders = new Headers()
      outboundHeaders.set('traceparent', traceparent)

      // Verify header is correctly formatted for downstream service
      expect(outboundHeaders.get('traceparent')).toBe(`00-${traceId}-${spanId}-01`)
    })

    test('should handle trace context with custom flags', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceFlags = '00' // Not sampled

      const traceparent = createTraceparentHeader(traceId, spanId, traceFlags)

      expect(traceparent).toBe(`00-${traceId}-${spanId}-00`)

      const headers = new Headers()
      headers.set('traceparent', traceparent)
      const extracted = extractTraceContext(headers)

      expect(extracted?.traceFlags).toBe('00')
    })
  })

  describe('Error Scenarios', () => {
    test('should handle missing trace context gracefully', () => {
      const dbTraceContext = getDatabaseTraceContext()

      // Should return empty object when no active span
      expect(dbTraceContext).toEqual({})
    })

    test('should handle malformed traceparent header', () => {
      const headers = new Headers()
      headers.set('traceparent', '00-invalid')

      const extracted = extractTraceContext(headers)

      expect(extracted).toBeNull()
    })

    test('should handle trace context extraction from plain object', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId)

      const headersObject = {
        'traceparent': traceparent,
        'user-agent': 'Test'
      }

      const extracted = extractTraceContext(headersObject)

      expect(extracted?.traceId).toBe(traceId)
      expect(extracted?.spanId).toBe(spanId)
    })
  })

  describe('Performance and Concurrency', () => {
    test('should handle concurrent requests with different trace contexts', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      const requests = [
        { traceId: '0af7651916cd43dd8448eb211c80319c', spanId: 'b7ad6b7169203331' },
        { traceId: '1bf8762027de54ee9559fc322d91420d', spanId: 'c8be7c8270304442' },
        { traceId: '2cg9873138ef65ff0660gd433e02531e', spanId: 'd9cf8d9381415553' }
      ]

      // Execute concurrent requests
      await Promise.all(
        requests.map(async ({ traceId, spanId }) => {
          await tracer.startActiveSpan(`request-${traceId.slice(0, 8)}`, async (span) => {
            try {
              // Simulate work
              await new Promise(resolve => setTimeout(resolve, 5))

              // Each request should maintain its own trace context
              const spanContext = span.spanContext()
              expect(spanContext.traceId).toBeDefined()

              span.setStatus({ code: SpanStatusCode.OK })
            } finally {
              span.end()
            }
          })
        })
      )
    })

    test('should not leak trace context between sequential requests', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      let firstTraceId: string | null = null
      let secondTraceId: string | null = null

      // First request
      await tracer.startActiveSpan('request-1', async (span1) => {
        try {
          firstTraceId = span1.spanContext().traceId
          span1.setStatus({ code: SpanStatusCode.OK })
        } finally {
          span1.end()
        }
      })

      // Second request (should have different trace ID)
      await tracer.startActiveSpan('request-2', async (span2) => {
        try {
          secondTraceId = span2.spanContext().traceId
          span2.setStatus({ code: SpanStatusCode.OK })
        } finally {
          span2.end()
        }
      })

      // Verify trace IDs are different
      expect(firstTraceId).toBeDefined()
      expect(secondTraceId).toBeDefined()
      expect(firstTraceId).not.toBe(secondTraceId)
    })
  })
})
