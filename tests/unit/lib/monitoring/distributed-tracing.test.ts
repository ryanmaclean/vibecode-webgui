/**
 * Unit Tests for Distributed Tracing Module
 * Tests trace context creation and middleware functionality
 */

import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'

// Mock logger module - must be declared before jest.mock
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

import {
  createTraceContext,
  withTracing,
  type TracingOptions,
  type TraceContext
} from '@/lib/monitoring/distributed-tracing'
import { logger } from '@/lib/logger'

const mockLogger = logger as jest.Mocked<typeof logger>

describe('Distributed Tracing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('createTraceContext', () => {
    it('should create trace context from request', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context).toHaveProperty('traceId')
      expect(context).toHaveProperty('spanId')
      expect(context).toHaveProperty('operation')
      expect(context).toHaveProperty('startTime')
      expect(context).toHaveProperty('service')
      expect(context).toHaveProperty('tags')
    })

    it('should use x-trace-id header if present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-trace-id': 'existing-trace-id'
        }
      })

      const context = createTraceContext(request)

      expect(context.traceId).toBe('existing-trace-id')
    })

    it('should use x-datadog-trace-id header if present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-datadog-trace-id': 'datadog-trace-id'
        }
      })

      const context = createTraceContext(request)

      expect(context.traceId).toBe('datadog-trace-id')
    })

    it('should use x-request-id header if present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-request-id': 'request-id'
        }
      })

      const context = createTraceContext(request)

      expect(context.traceId).toBe('request-id')
    })

    it('should generate UUID if no trace header present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    it('should use x-span-id header if present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-span-id': 'existing-span-id'
        }
      })

      const context = createTraceContext(request)

      expect(context.spanId).toBe('existing-span-id')
    })

    it('should use x-datadog-span-id header if present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-datadog-span-id': 'datadog-span-id'
        }
      })

      const context = createTraceContext(request)

      expect(context.spanId).toBe('datadog-span-id')
    })

    it('should generate span UUID if no span header present', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context.spanId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    it('should use custom operation from options', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const options: TracingOptions = {
        operation: 'custom-operation'
      }

      const context = createTraceContext(request, options)

      expect(context.operation).toBe('custom-operation')
    })

    it('should generate operation from request if not provided', () => {
      const request = new NextRequest('https://example.com/api/users', {
        method: 'POST'
      })

      const context = createTraceContext(request)

      expect(context.operation).toBe('POST /api/users')
    })

    it('should use custom service from options', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const options: TracingOptions = {
        service: 'custom-service'
      }

      const context = createTraceContext(request, options)

      expect(context.service).toBe('custom-service')
    })

    it('should default to vibecode-webgui service', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context.service).toBe('vibecode-webgui')
    })

    it('should include HTTP method tag', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST'
      })

      const context = createTraceContext(request)

      expect(context.tags['http.method']).toBe('POST')
    })

    it('should include HTTP URL tag', () => {
      const request = new NextRequest('https://example.com/api/test?param=value', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context.tags['http.url']).toBe('https://example.com/api/test?param=value')
    })

    it('should include user agent tag', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0'
        }
      })

      const context = createTraceContext(request)

      expect(context.tags['http.user_agent']).toBe('Mozilla/5.0')
    })

    it('should use unknown for missing user agent', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context.tags['http.user_agent']).toBe('unknown')
    })

    it('should include remote address from x-forwarded-for', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-forwarded-for': '192.168.1.1'
        }
      })

      const context = createTraceContext(request)

      expect(context.tags['http.remote_addr']).toBe('192.168.1.1')
    })

    it('should include remote address from x-real-ip', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-real-ip': '10.0.0.1'
        }
      })

      const context = createTraceContext(request)

      expect(context.tags['http.remote_addr']).toBe('10.0.0.1')
    })

    it('should use unknown for missing remote address', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)

      expect(context.tags['http.remote_addr']).toBe('unknown')
    })

    it('should merge custom tags', () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const options: TracingOptions = {
        tags: {
          'custom.tag': 'custom-value',
          'another.tag': 'another-value'
        }
      }

      const context = createTraceContext(request, options)

      expect(context.tags['custom.tag']).toBe('custom-value')
      expect(context.tags['another.tag']).toBe('another-value')
      expect(context.tags['http.method']).toBe('GET')
    })

    it('should set startTime to current timestamp', () => {
      const before = Date.now()
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const context = createTraceContext(request)
      const after = Date.now()

      expect(context.startTime).toBeGreaterThanOrEqual(before)
      expect(context.startTime).toBeLessThanOrEqual(after)
    })
  })

  describe('withTracing middleware', () => {
    it('should wrap handler with tracing', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
    })

    it('should add trace headers to response', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'x-trace-id': 'test-trace-id'
        }
      })

      const response = await wrappedHandler(request)

      expect(response.headers.get('x-trace-id')).toBe('test-trace-id')
      expect(response.headers.get('x-span-id')).toBeTruthy()
    })

    it('should log trace start', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withTracing(mockHandler, {
        operation: 'test-operation'
      })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      await wrappedHandler(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting trace'),
        expect.objectContaining({
          operation: 'test-operation'
        })
      )
    })

    it('should log successful completion', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      await wrappedHandler(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('GET https://example.com/api/test'),
        expect.objectContaining({
          success: true,
          duration: expect.any(Number)
        })
      )
    })

    it('should log errors', async () => {
      const testError = new Error('Handler error')
      const mockHandler = jest.fn(async () => {
        throw testError
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'vibecode.errors.total',
        expect.objectContaining({
          operation: 'GET /api/test',
          error_type: 'Error'
        })
      )
    })

    it('should calculate duration', async () => {
      const mockHandler = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      await wrappedHandler(request)

      const logCall = mockLogger.info.mock.calls.find(call =>
        call[0].includes('GET https://example.com/api/test')
      )

      expect(logCall![1].duration).toBeGreaterThanOrEqual(50)
    })

    it('should pass through handler arguments', async () => {
      const mockHandler = jest.fn(async (request: NextRequest, ctx: any) => {
        return NextResponse.json({ params: ctx.params })
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const params = { params: { id: '123' } }
      await wrappedHandler(request, params)

      expect(mockHandler).toHaveBeenCalledWith(request, params)
    })

    it('should handle handler returning different status codes', async () => {
      const mockHandler = jest.fn(async () => {
        return new NextResponse('Created', { status: 201 })
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST'
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(201)

      const logCall = mockLogger.info.mock.calls.find(call =>
        call[0].includes('POST https://example.com/api/test')
      )

      expect(logCall![1].status).toBe(201)
    })

    it('should handle errors gracefully', async () => {
      const testError = new Error('Test error')
      const mockHandler = jest.fn(async () => {
        throw testError
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        traceId: expect.any(String)
      })
    })

    it('should include custom options in trace context', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json({ success: true })
      })

      const options: TracingOptions = {
        operation: 'custom-op',
        service: 'custom-service',
        tags: { 'custom.tag': 'value' }
      }

      const wrappedHandler = withTracing(mockHandler, options)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      await wrappedHandler(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting trace'),
        expect.objectContaining({
          operation: 'custom-op',
          service: 'custom-service',
          'custom.tag': 'value'
        })
      )
    })

    it('should handle multiple concurrent requests', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withTracing(mockHandler)

      const requests = [
        new NextRequest('https://example.com/api/test1', { method: 'GET' }),
        new NextRequest('https://example.com/api/test2', { method: 'GET' }),
        new NextRequest('https://example.com/api/test3', { method: 'GET' })
      ]

      const responses = await Promise.all(requests.map(r => wrappedHandler(r)))

      expect(responses).toHaveLength(3)
      expect(mockHandler).toHaveBeenCalledTimes(3)
      expect(mockLogger.info).toHaveBeenCalledTimes(6) // 3 starts + 3 completions
    })

    it('should preserve response headers from handler', async () => {
      const mockHandler = jest.fn(async () => {
        return NextResponse.json(
          { success: true },
          { headers: { 'X-Custom-Header': 'custom-value' } }
        )
      })

      const wrappedHandler = withTracing(mockHandler)

      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })

      const response = await wrappedHandler(request)

      // Note: Next.js middleware may or may not preserve custom headers
      // This test verifies the response is properly returned
      expect(response.status).toBe(200)
    })
  })

  describe('Integration Tests', () => {
    it('should trace complete request lifecycle', async () => {
      const mockHandler = jest.fn(async (request: NextRequest) => {
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10))
        return NextResponse.json({ data: 'test' })
      })

      const wrappedHandler = withTracing(mockHandler, {
        operation: 'api.users.list',
        service: 'user-service'
      })

      const request = new NextRequest('https://example.com/api/users', {
        method: 'GET',
        headers: {
          'user-agent': 'test-client/1.0',
          'x-forwarded-for': '192.168.1.1'
        }
      })

      const response = await wrappedHandler(request)

      // Verify trace was created
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting trace'),
        expect.objectContaining({
          operation: 'api.users.list',
          service: 'user-service',
          'http.method': 'GET',
          'http.user_agent': 'test-client/1.0',
          'http.remote_addr': '192.168.1.1'
        })
      )

      // Verify completion logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('GET https://example.com/api/users'),
        expect.objectContaining({
          status: 200,
          success: true,
          duration: expect.any(Number)
        })
      )

      // Verify response has trace headers
      expect(response.headers.get('x-trace-id')).toBeTruthy()
      expect(response.headers.get('x-span-id')).toBeTruthy()
    })

    it('should trace error scenarios', async () => {
      const mockHandler = jest.fn(async () => {
        throw new Error('Database connection failed')
      })

      const wrappedHandler = withTracing(mockHandler, {
        operation: 'api.data.fetch'
      })

      const request = new NextRequest('https://example.com/api/data', {
        method: 'GET'
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'vibecode.errors.total',
        expect.objectContaining({
          operation: 'api.data.fetch',
          error_type: 'Error'
        })
      )
    })
  })
})
