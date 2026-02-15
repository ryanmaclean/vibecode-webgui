/**
 * Integration tests for OpenTelemetry full-stack tracing
 * Tests end-to-end tracing from browser through API to database and AI services
 */

import { jest } from '@jest/globals'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { trace, context, SpanStatusCode } from '@opentelemetry/api'

// Strongly-typed mock for getServerSession to avoid 'any' casts in tests
const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

// Mock environment before any imports
process.env.OTEL_ENABLED = 'true'
process.env.DOCKER_BUILD = 'false'
process.env.SKIP_MONITORING = 'false'

// Mock rate-limiting - must be before route imports
jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => jest.fn().mockResolvedValue({
    success: true,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60000
  }))
}))

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

// Mock auth options
jest.mock('../../src/lib/auth', () => ({
  authOptions: {},
}))

// Mock monitoring auth helpers to avoid edge-specific Response.json and cookie runtime
jest.mock('@/lib/monitoring/auth', () => {
  return {
    checkMonitoringAuth: async (request: Request) => {
      const { getServerSession } = await import('next-auth')
      const session = await getServerSession()
      if (!session || !(session as { user?: unknown }).user) {
        return { isAuthorized: false, error: 'Unauthorized' }
      }
      const method = request.method || 'GET'
      const role = (session as { user?: { role?: string } }).user?.role
      if (method === 'GET') {
        return role === 'admin' ? { isAuthorized: true } : { isAuthorized: false, error: 'Unauthorized' }
      }
      // For POST allow any authenticated user
      return { isAuthorized: true }
    },
    getUnauthorizedResponse: (error?: string) =>
      new Response(JSON.stringify({ error: error || 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
  }
})

// Mock monitoring module for metrics submission
jest.mock('../../src/lib/monitoring', () => ({
  monitoring: {
    submitMetric: jest.fn().mockResolvedValue(undefined),
    submitEvent: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock cache
jest.mock('../../src/lib/cache/unified-cache-client', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  CacheTTL: {
    SHORT: 60,
  },
}))

import { GET, POST } from '../../src/app/api/monitoring/traces/route'
import { monitoring } from '../../src/lib/monitoring'
import {
  createAISpan,
  createDBSpan,
  getCurrentTraceContext,
  extractTraceContext,
  createTraceparentHeader,
  extractAndInjectTraceContext,
  AISpanAttributes,
  DBSpanAttributes,
} from '../../src/lib/monitoring/trace-context'
import {
  getDatabaseTraceContext,
  traceDatabaseOperation,
  traceRedisOperation,
  getRedisTraceContext,
} from '../../src/lib/monitoring/database-instrumentation'
import {
  getOpenTelemetryConfig,
  createCustomSpan,
} from '../../src/lib/monitoring/opentelemetry'

// Jest environment polyfill: Next's Response.json helper isn't available in Node's WHATWG Response
const g = globalThis as unknown as { Response: typeof Response & { json?: (body: unknown, init?: ResponseInit) => Response } }
if (!g.Response.json) {
  g.Response.json = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
}

describe('OpenTelemetry Full-Stack Tracing Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('OpenTelemetry Configuration', () => {
    test('should provide valid OpenTelemetry configuration', () => {
      const config = getOpenTelemetryConfig()

      expect(config).toHaveProperty('initialized')
      expect(config).toHaveProperty('service_name')
      expect(config).toHaveProperty('service_version')
      expect(config).toHaveProperty('environment')
      expect(config).toHaveProperty('otlp_endpoint')
      expect(config).toHaveProperty('prometheus_port')
      expect(config).toHaveProperty('datadog_integration')
      expect(config).toHaveProperty('database_instrumentation')

      expect(config.service_name).toBe('vibecode-webgui')
      expect(typeof config.initialized).toBe('boolean')
    })

    test('should include database instrumentation configuration', () => {
      const config = getOpenTelemetryConfig()
      const dbConfig = config.database_instrumentation

      expect(dbConfig).toBeDefined()
      expect(dbConfig).toHaveProperty('enabled')
      expect(dbConfig).toHaveProperty('enhanced_reporting')
      expect(dbConfig).toHaveProperty('query_sanitization')
      expect(dbConfig).toHaveProperty('span_correlation')
    })
  })

  describe('Trace Export API - GET /api/monitoring/traces', () => {
    test('should return trace data for admin user', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        headers: new Headers(),
      }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('configuration')
      expect(data).toHaveProperty('current_trace')
      expect(data).toHaveProperty('export')
      expect(data).toHaveProperty('services')
      expect(data).toHaveProperty('statistics')
      expect(data).toHaveProperty('visualization')

      // Verify configuration
      expect(data.configuration).toHaveProperty('enabled')
      expect(data.configuration).toHaveProperty('service_name')
      expect(data.configuration.service_name).toBe('vibecode-webgui')

      // Verify services
      expect(Array.isArray(data.services)).toBe(true)
      expect(data.services.length).toBeGreaterThan(0)

      // Verify service map
      expect(data.visualization).toHaveProperty('service_map')
      expect(data.visualization.service_map).toHaveProperty('nodes')
      expect(data.visualization.service_map).toHaveProperty('edges')
    })

    test('should extract trace context from request headers', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId)

      const headers = new Headers()
      headers.set('traceparent', traceparent)

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        headers,
      }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.incoming_trace).not.toBeNull()
      expect(data.incoming_trace.trace_id).toBe(traceId)
      expect(data.incoming_trace.parent_span_id).toBe(spanId)
    })

    test('should support timeframe and service filtering', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request(
        'http://localhost:3000/api/monitoring/traces?timeframe=6h&service=vibecode-webgui',
        { headers: new Headers() }
      ) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.timeframe).toBe('6h')
      expect(data.service_filter).toBe('vibecode-webgui')
    })

    test('should deny access for non-admin users', async () => {
      // Mock regular user session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        headers: new Headers(),
      }) as unknown as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    test('should provide export format information', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        headers: new Headers(),
      }) as unknown as NextRequest

      const response = await GET(request)
      const data = await response.json()

      expect(data.export_formats).toHaveProperty('json')
      expect(data.export_formats).toHaveProperty('otlp')
      expect(data.export_formats).toHaveProperty('jaeger')
      expect(data.export_formats).toHaveProperty('zipkin')
    })
  })

  describe('Browser Telemetry Collection - POST /api/monitoring/traces', () => {
    test('should accept simple format browser spans', async () => {
      const requestBody = {
        spans: [
          {
            name: 'page-load',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            duration: 250,
          },
          {
            name: 'user-interaction',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            duration: 50,
          },
        ],
      }

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.processed_spans).toBe(2)
      expect(data.errors).toBe(0)

      // Verify metrics were submitted
      expect(monitoring.submitMetric).toHaveBeenCalledTimes(2)
    })

    test('should accept OTLP format browser spans', async () => {
      const requestBody = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: 'service.name',
                  value: { stringValue: 'vibecode-webgui-client' },
                },
              ],
            },
            instrumentationLibrarySpans: [
              {
                instrumentationLibrary: {
                  name: '@opentelemetry/instrumentation-document-load',
                },
                spans: [
                  {
                    name: 'documentLoad',
                    startTimeUnixNano: '1640000000000000000',
                    endTimeUnixNano: '1640000000250000000',
                    attributes: [
                      {
                        key: 'document.url',
                        value: { stringValue: 'http://localhost:3000/' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.processed_spans).toBe(1)

      // Verify metrics and events were submitted
      expect(monitoring.submitMetric).toHaveBeenCalled()
      expect(monitoring.submitEvent).toHaveBeenCalled()
    })

    test('should reject invalid trace data format', async () => {
      const requestBody = {
        invalid: 'format',
      }

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Invalid trace data format')
    })

    test('should track user interaction metrics from OTLP spans', async () => {
      const requestBody = {
        resourceSpans: [
          {
            resource: { attributes: [] },
            instrumentationLibrarySpans: [
              {
                instrumentationLibrary: { name: 'user-interaction' },
                spans: [
                  {
                    name: 'button-click',
                    startTimeUnixNano: '1640000000000000000',
                    endTimeUnixNano: '1640000000050000000',
                    attributes: [
                      {
                        key: 'user.interaction',
                        value: { stringValue: 'click' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const request = new Request('http://localhost:3000/api/monitoring/traces', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(200)

      // Verify user interaction metric was submitted
      expect(monitoring.submitMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'vibecode.client.user_interactions.count',
          value: 1,
        })
      )
    })
  })

  describe('AI Request Tracing', () => {
    test('should create AI span with custom attributes', async () => {
      const result = await createAISpan(
        'chat.completion',
        {
          [AISpanAttributes.AI_PROVIDER]: 'anthropic',
          [AISpanAttributes.AI_MODEL]: 'claude-3-sonnet',
          [AISpanAttributes.AI_TEMPERATURE]: 0.7,
          [AISpanAttributes.AI_MAX_TOKENS]: 1024,
        },
        async (span) => {
          // Simulate AI request
          await new Promise((resolve) => setTimeout(resolve, 10))

          // Set response metrics
          span.setAttribute(AISpanAttributes.AI_INPUT_TOKENS, 150)
          span.setAttribute(AISpanAttributes.AI_OUTPUT_TOKENS, 300)
          span.setAttribute(AISpanAttributes.AI_TOTAL_TOKENS, 450)
          span.setAttribute(AISpanAttributes.AI_LATENCY_MS, 1234)
          span.setAttribute(AISpanAttributes.AI_FINISH_REASON, 'stop')

          return { response: 'AI generated response' }
        }
      )

      expect(result).toEqual({ response: 'AI generated response' })
    })

    test('should handle AI request errors with trace context', async () => {
      await expect(async () => {
        await createAISpan(
          'chat.completion',
          {
            [AISpanAttributes.AI_PROVIDER]: 'anthropic',
            [AISpanAttributes.AI_MODEL]: 'claude-3-sonnet',
          },
          async () => {
            throw new Error('API rate limit exceeded')
          }
        )
      }).rejects.toThrow('API rate limit exceeded')
    })

    test('should correlate AI request with parent trace', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-request', async (apiSpan) => {
        try {
          const parentTraceId = apiSpan.spanContext().traceId

          // Execute AI request within API span
          await createAISpan(
            'chat.completion',
            {
              [AISpanAttributes.AI_PROVIDER]: 'anthropic',
              [AISpanAttributes.AI_MODEL]: 'claude-3-sonnet',
            },
            async () => {
              // Get current trace context - should match parent
              const currentContext = getCurrentTraceContext()
              expect(currentContext.traceId).toBe(parentTraceId)

              return { response: 'Success' }
            }
          )

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })
  })

  describe('Database Query Tracing', () => {
    test('should create database span with query attributes', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-handler', async (apiSpan) => {
        try {
          const result = await createDBSpan(
            'query',
            {
              [DBSpanAttributes.DB_SYSTEM]: 'postgresql',
              [DBSpanAttributes.DB_NAME]: 'vibecode',
              [DBSpanAttributes.DB_OPERATION]: 'SELECT',
              [DBSpanAttributes.DB_TABLE]: 'users',
            },
            async (span) => {
              // Simulate database query
              await new Promise((resolve) => setTimeout(resolve, 15))

              span.setAttribute('db.query.row_count', 5)
              return { rows: 5 }
            }
          )

          expect(result).toEqual({ rows: 5 })

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should trace PostgreSQL operations with correlation', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-handler', async (apiSpan) => {
        try {
          const parentTraceId = apiSpan.spanContext().traceId

          const result = await traceDatabaseOperation(
            'insert',
            {
              'db.table': 'workspaces',
              'db.operation': 'INSERT',
            },
            async () => {
              // Verify trace context is propagated
              const dbContext = getDatabaseTraceContext()
              expect(dbContext.trace_id).toBe(parentTraceId)

              return { id: 'workspace-123' }
            }
          )

          expect(result.id).toBe('workspace-123')

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should handle database errors with trace context', async () => {
      await expect(async () => {
        await traceDatabaseOperation(
          'query',
          {
            'db.table': 'users',
            'db.operation': 'SELECT',
          },
          async () => {
            throw new Error('Connection timeout')
          }
        )
      }).rejects.toThrow('Connection timeout')
    })
  })

  describe('Redis/Cache Operation Tracing', () => {
    test('should trace Redis operations with attributes', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('cache-operation', async (span) => {
        try {
          const result = await traceRedisOperation(
            'get',
            {
              'cache.key': 'user:123',
            },
            async () => {
              // Simulate Redis GET
              await new Promise((resolve) => setTimeout(resolve, 5))
              return { value: 'cached-data' }
            }
          )

          expect(result).toEqual({ value: 'cached-data' })

          span.setStatus({ code: SpanStatusCode.OK })
        } finally {
          span.end()
        }
      })
    })

    test('should correlate Redis operations with parent trace', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-request', async (apiSpan) => {
        try {
          const parentTraceId = apiSpan.spanContext().traceId

          await traceRedisOperation(
            'set',
            {
              'cache.key': 'session:456',
              'cache.ttl': 3600,
            },
            async () => {
              // Verify trace context
              const redisContext = getRedisTraceContext()
              expect(redisContext.trace_id).toBe(parentTraceId)

              return { success: true }
            }
          )

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should handle Redis errors gracefully', async () => {
      await expect(async () => {
        await traceRedisOperation(
          'get',
          { 'cache.key': 'test:key' },
          async () => {
            throw new Error('Redis connection refused')
          }
        )
      }).rejects.toThrow('Redis connection refused')
    })
  })

  describe('Custom Span Creation', () => {
    test('should create custom span with attributes', async () => {
      const result = await createCustomSpan(
        'business-logic',
        {
          'operation.type': 'workspace.create',
          'user.id': 'user123',
          'workspace.type': 'development',
        },
        async (span) => {
          // Simulate business logic
          await new Promise((resolve) => setTimeout(resolve, 20))

          span.setAttribute('operation.duration_ms', 20)
          span.setAttribute('operation.success', true)

          return { workspace_id: 'ws-456' }
        }
      )

      expect(result).toEqual({ workspace_id: 'ws-456' })
    })

    test('should handle custom span errors', async () => {
      await expect(async () => {
        await createCustomSpan(
          'validation',
          { 'validation.type': 'input' },
          async () => {
            throw new Error('Validation failed')
          }
        )
      }).rejects.toThrow('Validation failed')
    })
  })

  describe('W3C Trace Context Propagation', () => {
    test('should extract and inject trace context from headers', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId)

      const headers = new Headers()
      headers.set('traceparent', traceparent)

      const { traceContext } = extractAndInjectTraceContext(headers)

      expect(traceContext).not.toBeNull()
      expect(traceContext?.trace_id).toBe(traceId)
      expect(traceContext?.span_id).toBe(spanId)
      expect(traceContext?.trace_flags).toBe('01')
    })

    test('should handle missing traceparent header', () => {
      const headers = new Headers()

      const { traceContext } = extractAndInjectTraceContext(headers)

      expect(traceContext).toBeNull()
    })

    test('should support custom trace flags', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId, '00')

      const headers = new Headers()
      headers.set('traceparent', traceparent)

      const extracted = extractTraceContext(headers)

      expect(extracted?.traceFlags).toBe('00')
    })
  })

  describe('Full-Stack Trace Scenarios', () => {
    test('should trace complete request flow: browser -> API -> database', async () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'
      const traceparent = createTraceparentHeader(traceId, spanId)

      // Step 1: Browser sends request with trace context
      const browserHeaders = new Headers()
      browserHeaders.set('traceparent', traceparent)

      // Step 2: Extract trace context in API
      const { traceContext } = extractAndInjectTraceContext(browserHeaders)
      expect(traceContext?.trace_id).toBe(traceId)

      // Step 3: Process request with API span
      const tracer = trace.getTracer('vibecode-webgui')
      await tracer.startActiveSpan('api-handler', async (apiSpan) => {
        try {
          apiSpan.setAttributes({
            'http.method': 'POST',
            'http.route': '/api/workspaces',
          })

          // Step 4: Database operation
          await traceDatabaseOperation(
            'insert',
            { 'db.table': 'workspaces' },
            async () => {
              const dbContext = getDatabaseTraceContext()
              expect(dbContext.trace_id).toBe(apiSpan.spanContext().traceId)
              return { id: 'ws-123' }
            }
          )

          // Step 5: Cache operation
          await traceRedisOperation(
            'set',
            { 'cache.key': 'workspace:ws-123' },
            async () => {
              const redisContext = getRedisTraceContext()
              expect(redisContext.trace_id).toBe(apiSpan.spanContext().traceId)
              return { success: true }
            }
          )

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should trace AI-enhanced request flow', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('api-ai-request', async (apiSpan) => {
        try {
          const parentTraceId = apiSpan.spanContext().traceId

          // Step 1: Database query to get context
          await traceDatabaseOperation(
            'query',
            { 'db.table': 'context' },
            async () => {
              return { context: 'user preferences' }
            }
          )

          // Step 2: AI request with context
          const aiResult = await createAISpan(
            'chat.completion',
            {
              [AISpanAttributes.AI_PROVIDER]: 'anthropic',
              [AISpanAttributes.AI_MODEL]: 'claude-3-sonnet',
            },
            async (aiSpan) => {
              // Verify trace correlation
              const currentContext = getCurrentTraceContext()
              expect(currentContext.traceId).toBe(parentTraceId)

              aiSpan.setAttribute(AISpanAttributes.AI_INPUT_TOKENS, 200)
              aiSpan.setAttribute(AISpanAttributes.AI_OUTPUT_TOKENS, 400)
              return { response: 'AI response' }
            }
          )

          // Step 3: Save result to database
          await traceDatabaseOperation(
            'insert',
            { 'db.table': 'ai_responses' },
            async () => {
              return { id: 'response-123' }
            }
          )

          // Step 4: Cache the response
          await traceRedisOperation(
            'set',
            { 'cache.key': 'ai:response-123' },
            async () => {
              return { success: true }
            }
          )

          expect(aiResult.response).toBe('AI response')

          apiSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          apiSpan.end()
        }
      })
    })

    test('should maintain trace correlation across nested operations', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('root-operation', async (rootSpan) => {
        try {
          const rootTraceId = rootSpan.spanContext().traceId

          // Nested operation 1
          await tracer.startActiveSpan('nested-operation-1', async (nested1) => {
            try {
              expect(nested1.spanContext().traceId).toBe(rootTraceId)

              await traceDatabaseOperation(
                'query',
                { 'db.table': 'data1' },
                async () => {
                  const dbContext = getDatabaseTraceContext()
                  expect(dbContext.trace_id).toBe(rootTraceId)
                  return { data: 'result1' }
                }
              )

              nested1.setStatus({ code: SpanStatusCode.OK })
            } finally {
              nested1.end()
            }
          })

          // Nested operation 2 (sibling to operation 1)
          await tracer.startActiveSpan('nested-operation-2', async (nested2) => {
            try {
              expect(nested2.spanContext().traceId).toBe(rootTraceId)

              await traceRedisOperation(
                'get',
                { 'cache.key': 'data2' },
                async () => {
                  const redisContext = getRedisTraceContext()
                  expect(redisContext.trace_id).toBe(rootTraceId)
                  return { data: 'result2' }
                }
              )

              nested2.setStatus({ code: SpanStatusCode.OK })
            } finally {
              nested2.end()
            }
          })

          rootSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          rootSpan.end()
        }
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle concurrent requests with different trace IDs', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      const requests = [
        { id: 'req1', traceId: '0af7651916cd43dd8448eb211c80319c' },
        { id: 'req2', traceId: '1bf8762027de54ee9559fc322d91420d' },
        { id: 'req3', traceId: '2cg9873138ef65ff0660gd433e02531e' },
      ]

      await Promise.all(
        requests.map(async ({ id, traceId }) => {
          await tracer.startActiveSpan(`request-${id}`, async (span) => {
            try {
              // Each request should maintain its own trace context
              await traceDatabaseOperation(
                'query',
                { 'db.operation': id },
                async () => {
                  const dbContext = getDatabaseTraceContext()
                  expect(dbContext.trace_id).toBeDefined()
                  return { id }
                }
              )

              span.setStatus({ code: SpanStatusCode.OK })
            } finally {
              span.end()
            }
          })
        })
      )
    })

    test('should handle missing trace context gracefully', () => {
      const dbContext = getDatabaseTraceContext()
      expect(dbContext).toEqual({})

      const redisContext = getRedisTraceContext()
      expect(redisContext).toEqual({})

      const currentContext = getCurrentTraceContext()
      expect(currentContext.traceId).toBeNull()
      expect(currentContext.spanId).toBeNull()
    })

    test('should handle invalid traceparent format', () => {
      const headers = new Headers()
      headers.set('traceparent', 'invalid-format')

      const extracted = extractTraceContext(headers)
      expect(extracted).toBeNull()
    })

    test('should propagate errors through trace context', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await expect(async () => {
        await tracer.startActiveSpan('error-request', async (span) => {
          try {
            await createAISpan(
              'chat.completion',
              { [AISpanAttributes.AI_PROVIDER]: 'anthropic' },
              async () => {
                throw new Error('AI service unavailable')
              }
            )
          } finally {
            span.end()
          }
        })
      }).rejects.toThrow('AI service unavailable')
    })
  })

  describe('Performance and Metrics', () => {
    test('should measure span duration accurately', async () => {
      const startTime = Date.now()

      await createCustomSpan(
        'timed-operation',
        { 'operation.type': 'test' },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return { success: true }
        }
      )

      const duration = Date.now() - startTime
      expect(duration).toBeGreaterThanOrEqual(50)
    })

    test('should handle high-frequency span creation', async () => {
      const tracer = trace.getTracer('vibecode-webgui')

      await tracer.startActiveSpan('high-frequency-test', async (rootSpan) => {
        try {
          const promises = []

          for (let i = 0; i < 10; i++) {
            promises.push(
              createCustomSpan(
                `operation-${i}`,
                { 'operation.index': i },
                async () => {
                  return { index: i }
                }
              )
            )
          }

          const results = await Promise.all(promises)
          expect(results).toHaveLength(10)

          rootSpan.setStatus({ code: SpanStatusCode.OK })
        } finally {
          rootSpan.end()
        }
      })
    })
  })
})
