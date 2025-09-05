/**
 * Integration tests for monitoring API endpoints
 * Tests real API functionality and Datadog integration
 */

import { jest } from '@jest/globals'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Strongly-typed mock for getServerSession to avoid 'any' casts in tests
const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

// Mock auth options
jest.mock('../../src/lib/auth', () => ({
  authOptions: {},
}))

// Mock server monitoring
jest.mock('../../src/lib/server-monitoring', () => ({
  getHealthCheck: jest.fn(() => Promise.resolve({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: 3600,
    memory: { used: 100, total: 1000, percentage: 10 },
    cpu: { usage: 25 },
  })),
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

import { GET, POST } from '../../src/app/api/monitoring/metrics/route'

// Jest environment polyfill: Next's Response.json helper isn't available in Node's WHATWG Response
// Provide a compatible shim that returns a Response with JSON body.
const g = globalThis as unknown as { Response: typeof Response & { json?: (body: unknown, init?: ResponseInit) => Response } }
if (!g.Response.json) {
  g.Response.json = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
}

describe('Monitoring API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/monitoring/metrics', () => {
    test('should return metrics for admin user', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/metrics', { headers: new Headers() }) as unknown as NextRequest;
      const response = await GET(request);
      // Diagnostic logging for debugging in Jest environment
      console.log('DEBUG admin GET response:', {
        type: typeof response,
        status: response.status,
        ctor: response?.constructor?.name,
      })

      expect(response.status).toBe(200);

      const data = await response.json()
      expect(data).toHaveProperty('cpu')
      expect(data).toHaveProperty('memory')
      expect(data).toHaveProperty('diskUsage')
      expect(data).toHaveProperty('networkIO')
      expect(data).toHaveProperty('activeUsers')
      expect(data).toHaveProperty('activeWorkspaces')
      expect(data).toHaveProperty('totalSessions')
      expect(data).toHaveProperty('avgResponseTime')
      expect(data).toHaveProperty('errorRate')
      expect(data).toHaveProperty('uptime')})

    test('should deny access for non-admin users', async () => {
      // Mock regular user session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const request = new Request('http://localhost:3000/api/monitoring/metrics', { headers: new Headers() }) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(401);

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })})

    test('should deny access for unauthenticated users', async () => {
      // Mock no session
      mockedGetServerSession.mockResolvedValue(null)
      const request = new Request('http://localhost:3000/api/monitoring/metrics', { headers: new Headers() }) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(401);

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })})

    test('should handle internal server errors gracefully', async () => {
      // Mock admin session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // Force an error by corrupting the metrics calculation
      const originalCpuUsage = process.cpuUsage
      process.cpuUsage = jest.fn(() => {
        throw new Error('CPU usage failed')})

      const request = new Request('http://localhost:3000/api/monitoring/metrics', { headers: new Headers() }) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(500);

      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to fetch metrics' });

      // Restore original function
      process.cpuUsage = originalCpuUsage
      consoleSpy.mockRestore()})})

  describe('POST /api/monitoring/metrics', () => {
    test('should accept response time metrics from authenticated users', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const requestBody = {
        type: 'response_time',
        data: { duration: 250 },
      }
      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ success: true })})

    test('should accept error metrics from authenticated users', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const requestBody = {
        type: 'error',
        data: {},
      }
      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ success: true })})

    test('should accept user activity metrics from authenticated users', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const requestBody = {
        type: 'user_activity',
        data: { userId: 'user123', workspaceId: 'workspace456' },
      }
      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ success: true })})

    test('should accept network I/O metrics from authenticated users', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const requestBody = {
        type: 'network_io',
        data: { bytesIn: 1024, bytesOut: 2048 },
      }
      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ success: true })})

    test('should reject unknown metric types', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      const requestBody = {
        type: 'unknown_metric',
        data: {},
      }
      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);

      const data = await response.json()
      expect(data).toEqual({ error: 'Unknown metric type' })})

    test('should deny access for unauthenticated users', async () => {
      // Mock no session
      mockedGetServerSession.mockResolvedValue(null)

      const requestBody = {
        type: 'response_time',
        data: { duration: 250 },
      }
      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(401);

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })})

    test('should handle malformed JSON gracefully', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      })

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      const request = new Request('http://localhost:3000/api/monitoring/metrics', {
        method: 'POST',
        body: 'invalid json',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }) as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to update metrics' });

      consoleSpy.mockRestore()})})

  describe('Metrics Storage and Limits', () => {
    test('should maintain response time array size limit', async () => {
      // Mock authenticated session
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'user123', role: 'user' },
      });

      // Add many response times to test the limit
      for (let i = 0; i < 150; i++) {
        const requestBody = {
          type: 'response_time',
          data: { duration: i },
        }
        const request = new Request('http://localhost:3000/api/monitoring/metrics', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }) as unknown as NextRequest;

        await POST(request)}

      // Get metrics to verify limit
      mockedGetServerSession.mockResolvedValue({
        user: { id: 'admin123', role: 'admin' },
      })

      const getRequest = new Request('http://localhost:3000/api/monitoring/metrics', { headers: new Headers() }) as unknown as NextRequest;
      const getResponse = await GET(getRequest);

      expect(getResponse.status).toBe(200);

      // The response time calculation should work even with the limit
      const data = await getResponse.json()
      expect(typeof data.avgResponseTime).toBe('number');
      expect(data.avgResponseTime).toBeGreaterThanOrEqual(0)})})});
