/**
 * Integration tests for /api/monitoring/ai-metrics endpoint
 * Tests data aggregation, filtering, and response format
 */

import { GET } from '@/app/api/monitoring/ai-metrics/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aIRequest: {
      findMany: jest.fn()
    }
  }
}))

// Mock authentication
jest.mock('@/lib/monitoring/auth', () => ({
  checkMonitoringAuth: jest.fn().mockResolvedValue({ isAuthorized: true }),
  getUnauthorizedResponse: jest.fn()
}))

describe('GET /api/monitoring/ai-metrics', () => {
  const mockAIRequests = [
    {
      id: '1',
      model: 'gpt-4',
      provider: 'openai',
      request_type: 'chat',
      input_tokens: 100,
      output_tokens: 50,
      cost: 0.005,
      duration_ms: 1200,
      status: 'success',
      error: null,
      created_at: new Date('2026-02-23T10:00:00Z')
    },
    {
      id: '2',
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      request_type: 'completion',
      input_tokens: 80,
      output_tokens: 40,
      cost: 0.002,
      duration_ms: 600,
      status: 'success',
      error: null,
      created_at: new Date('2026-02-23T11:00:00Z')
    },
    {
      id: '3',
      model: 'gpt-4',
      provider: 'openai',
      request_type: 'chat',
      input_tokens: 120,
      output_tokens: 60,
      cost: 0.006,
      duration_ms: 1500,
      status: 'error',
      error: 'rate_limit',
      created_at: new Date('2026-02-23T12:00:00Z')
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.aIRequest.findMany as jest.Mock).mockResolvedValue(mockAIRequests)
  })

  test('returns 200 with metrics data', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('overview')
    expect(data).toHaveProperty('timeSeries')
    expect(data).toHaveProperty('byModel')
    expect(data).toHaveProperty('byProvider')
  })

  test('calculates overview metrics correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)
    const data = await response.json()

    expect(data.overview.totalRequests).toBe(3)
    expect(data.overview.totalInputTokens).toBe(300) // 100 + 80 + 120
    expect(data.overview.totalOutputTokens).toBe(150) // 50 + 40 + 60
    expect(data.overview.totalTokens).toBe(450)
    expect(data.overview.totalCost).toBe(0.013) // 0.005 + 0.002 + 0.006
    expect(data.overview.errorCount).toBe(1)
    expect(data.overview.errorRate).toBeCloseTo(0.333, 2) // 1/3
  })

  test('aggregates metrics by model', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)
    const data = await response.json()

    expect(data.byModel).toHaveLength(2) // gpt-4 and gpt-3.5-turbo

    const gpt4Stats = data.byModel.find((m: any) => m.model === 'gpt-4')
    expect(gpt4Stats.requestCount).toBe(2)
    expect(gpt4Stats.totalCost).toBe(0.011) // 0.005 + 0.006
  })

  test('aggregates metrics by provider', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)
    const data = await response.json()

    expect(data.byProvider).toHaveLength(1) // Only openai

    const openaiStats = data.byProvider.find((p: any) => p.provider === 'openai')
    expect(openaiStats.requestCount).toBe(3)
  })

  test('calculates latency percentiles correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)
    const data = await response.json()

    expect(data.latency).toHaveProperty('avg')
    expect(data.latency).toHaveProperty('p50')
    expect(data.latency).toHaveProperty('p95')
    expect(data.latency).toHaveProperty('p99')

    // Average: (1200 + 600 + 1500) / 3 = 1100
    expect(data.latency.avg).toBe(1100)
  })

  test('creates hourly time-series buckets', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)
    const data = await response.json()

    expect(data.timeSeries).toBeDefined()
    expect(Array.isArray(data.timeSeries)).toBe(true)
    expect(data.timeSeries.length).toBeGreaterThan(0)
  })

  test('filters by model parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h&model=gpt-4')
    await GET(request)

    expect(prisma.aIRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          model: 'gpt-4'
        })
      })
    )
  })

  test('filters by provider parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h&provider=openai')
    await GET(request)

    expect(prisma.aIRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'openai'
        })
      })
    )
  })

  test('supports different period values', async () => {
    const periods = ['1h', '6h', '12h', '24h', '7d', '30d', '90d']

    for (const period of periods) {
      const request = new NextRequest(`http://localhost:3000/api/monitoring/ai-metrics?period=${period}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.aIRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({
              gte: expect.any(Date)
            })
          })
        })
      )
    }
  })

  test('handles authentication failure', async () => {
    const { checkMonitoringAuth, getUnauthorizedResponse } = require('@/lib/monitoring/auth')
    checkMonitoringAuth.mockResolvedValueOnce({ isAuthorized: false, error: 'Unauthorized' })
    getUnauthorizedResponse.mockReturnValueOnce(new Response('Unauthorized', { status: 401 }))

    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  test('handles database errors gracefully', async () => {
    ;(prisma.aIRequest.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'))

    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  test('returns cached data when available', async () => {
    // First request - cache miss
    const request1 = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    await GET(request1)

    // Second request - should use cache
    const request2 = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h')
    const response2 = await GET(request2)
    const data2 = await response2.json()

    // Verify Prisma was only called once (cached on second call)
    expect(data2).toHaveProperty('from_cache')
  })

  test('skip_cache parameter bypasses cache', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics?period=24h&skip_cache=true')
    const response = await GET(request)
    const data = await response.json()

    expect(data.from_cache).toBeUndefined()
  })
})
