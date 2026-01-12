/**
 * Dashboard Performance API Route Tests
 * Tests the /api/dashboard/performance endpoint
 *
 * AGENT 92: Enhanced Monitoring Dashboards Foundation
 */

import { NextRequest } from 'next/server'

describe('GET /api/dashboard/performance', () => {
  let GET: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    // Mock performance monitoring module
    jest.mock('@/lib/monitoring/performance-monitoring', () => ({
      performanceMonitor: {
        generatePerformanceReport: jest.fn().mockReturnValue({
          summary: {
            total_metrics: 100,
            avg_api_response_time: 150,
            avg_database_query_time: 50,
            memory_usage_trend: 45,
            timeframe: '1h'
          },
          recommendations: ['Optimize slow queries', 'Add caching'],
          critical_issues: []
        })
      }
    }))

    // Import the route module after mocking
    const routeModule = await import('@/app/api/dashboard/performance/route')
    GET = routeModule.GET
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return performance metrics with default timeframe', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.timeRange).toBe('1h')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('metrics')
    expect(data).toHaveProperty('dataPoints')
  })

  it('should accept custom time range parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance?range=24h')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.timeRange).toBe('24h')
  })

  it('should include all required metrics', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')

    const response = await GET(request)
    const data = await response.json()

    expect(data.metrics).toHaveProperty('requests')
    expect(data.metrics).toHaveProperty('avgLatency')
    expect(data.metrics).toHaveProperty('errorRate')
    expect(data.metrics).toHaveProperty('p95Latency')
    expect(data.metrics).toHaveProperty('p99Latency')

    expect(typeof data.metrics.requests).toBe('number')
    expect(typeof data.metrics.avgLatency).toBe('number')
    expect(typeof data.metrics.errorRate).toBe('number')
    expect(typeof data.metrics.p95Latency).toBe('number')
    expect(typeof data.metrics.p99Latency).toBe('number')
  })

  it('should return time series data points', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')

    const response = await GET(request)
    const data = await response.json()

    expect(Array.isArray(data.dataPoints)).toBe(true)
    expect(data.dataPoints.length).toBeGreaterThan(0)

    const firstPoint = data.dataPoints[0]
    expect(firstPoint).toHaveProperty('timestamp')
    expect(firstPoint).toHaveProperty('latency')
    expect(firstPoint).toHaveProperty('requests')
  })

  it('should validate time range parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance?range=invalid')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('Invalid time range')
    expect(data.message).toContain('Valid ranges are')
  })

  it('should accept all valid time ranges', async () => {
    const validRanges = ['1h', '6h', '24h', '7d']

    for (const range of validRanges) {
      const request = new NextRequest(`http://localhost:3000/api/dashboard/performance?range=${range}`)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeRange).toBe(range)
    }
  })

  it('should return appropriate number of data points for time range', async () => {
    const request1h = new NextRequest('http://localhost:3000/api/dashboard/performance?range=1h')
    const response1h = await GET(request1h)
    const data1h = await response1h.json()

    const request7d = new NextRequest('http://localhost:3000/api/dashboard/performance?range=7d')
    const response7d = await GET(request7d)
    const data7d = await response7d.json()

    // Both should have reasonable number of points
    expect(data1h.dataPoints.length).toBeGreaterThanOrEqual(10)
    expect(data1h.dataPoints.length).toBeLessThanOrEqual(20)
    expect(data7d.dataPoints.length).toBeGreaterThanOrEqual(10)
    expect(data7d.dataPoints.length).toBeLessThanOrEqual(20)
  })

  it('should return chronologically ordered data points', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')

    const response = await GET(request)
    const data = await response.json()

    const timestamps = data.dataPoints.map((p: any) => new Date(p.timestamp).getTime())

    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
    }
  })

  it('should calculate p95 and p99 percentiles correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')

    const response = await GET(request)
    const data = await response.json()

    // p95 should be higher than average, p99 should be higher than p95
    expect(data.metrics.p95Latency).toBeGreaterThan(data.metrics.avgLatency)
    expect(data.metrics.p99Latency).toBeGreaterThan(data.metrics.p95Latency)
  })

  it('should handle errors gracefully', async () => {
    // Re-import with failing mock
    jest.resetModules()
    jest.mock('@/lib/monitoring/performance-monitoring', () => ({
      performanceMonitor: {
        generatePerformanceReport: jest.fn().mockImplementation(() => {
          throw new Error('Performance monitoring unavailable')
        })
      }
    }))

    const routeModule = await import('@/app/api/dashboard/performance/route')
    const GET = routeModule.GET

    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('Failed to fetch performance metrics')
  })

  it('should include valid ISO timestamp', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/performance')

    const response = await GET(request)
    const data = await response.json()

    const timestamp = new Date(data.timestamp)
    expect(timestamp.getTime()).toBeGreaterThan(0)
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
